"""
把 AI 生成的表情差分（闭眼 / 半闭眼 / 张嘴）对齐到原立绘，裁出眼睛和嘴的小贴片。

差分图是用 1024×1024 的脸部裁图（原图 FACE_CROP 区域放大）喂给图像编辑接口得到的，
接口不会严格保持像素位置，所以这里先用 ECC 估计仿射变换对齐、再匹配色调。
"""
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'design/final/live2d-base-front.png'
VARIANTS = ROOT / 'design/pseudo/face-variants'
OUT = ROOT / 'packages/widget/public/huinuo-pseudo'

FACE_CROP = (360, 40, 660, 340)  # 原图坐标，差分图 = 这块区域放大到 1024
REGIONS = {
    # 原图坐标：贴片范围（含羽化边）
    'eye_l': (442, 192, 507, 246),
    'eye_r': (517, 192, 584, 246),
    'mouth': (484, 248, 536, 282),
}
SPRITES = {
    'eye_l': ['eyes_half', 'eyes_closed'],
    'eye_r': ['eyes_half', 'eyes_closed'],
    'mouth': ['mouth_open', 'mouth_wide'],
}
FEATHER = 6


def to_face(img):
    x0, y0, x1, y1 = FACE_CROP
    return np.array(img.crop(FACE_CROP).resize((1024, 1024), Image.LANCZOS).convert('RGB'), np.float32)


def align(variant, ref):
    """估计 variant → ref 的仿射变换（排除眼睛和嘴附近，只看头发和脸型）。"""
    g = lambda a: cv2.cvtColor(a.astype(np.uint8), cv2.COLOR_RGB2GRAY).astype(np.float32) / 255
    mask = np.ones((1024, 1024), np.uint8)
    s = 1024 / (FACE_CROP[2] - FACE_CROP[0])
    for (x0, y0, x1, y1) in REGIONS.values():
        cv2.rectangle(mask, (int((x0 - FACE_CROP[0] - 10) * s), int((y0 - FACE_CROP[1] - 10) * s)),
                      (int((x1 - FACE_CROP[0] + 10) * s), int((y1 - FACE_CROP[1] + 10) * s)), 0, -1)
    warp = np.eye(2, 3, dtype=np.float32)
    crit = (cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 200, 1e-6)
    _, warp = cv2.findTransformECC(g(ref), g(variant), warp, cv2.MOTION_AFFINE, crit, mask, 5)
    aligned = cv2.warpAffine(variant, warp, (1024, 1024), flags=cv2.INTER_LINEAR + cv2.WARP_INVERSE_MAP,
                             borderMode=cv2.BORDER_REPLICATE)
    return aligned, warp


def main():
    src = Image.open(SRC).convert('RGB')
    ref = to_face(src)
    full = np.array(src, np.float32)
    rig_path = OUT / 'rig.json'
    rig = json.loads(rig_path.read_text())
    s = (FACE_CROP[2] - FACE_CROP[0]) / 1024
    sprites = {}
    report = {}
    for name in sorted({v for vs in SPRITES.values() for v in vs}):
        var = np.array(Image.open(VARIANTS / f'{name}.png').convert('RGB').resize((1024, 1024), Image.LANCZOS), np.float32)
        aligned, warp = align(var, ref)
        # 回到原图分辨率 / 坐标
        back = cv2.resize(aligned, (FACE_CROP[2] - FACE_CROP[0], FACE_CROP[3] - FACE_CROP[1]), interpolation=cv2.INTER_AREA)
        canvas = full.copy()
        canvas[FACE_CROP[1]:FACE_CROP[3], FACE_CROP[0]:FACE_CROP[2]] = back
        report[name] = {'shift_px': [round(float(warp[0, 2]) * s, 1), round(float(warp[1, 2]) * s, 1)],
                        'scale': round(float(np.sqrt(abs(np.linalg.det(warp[:, :2])))), 3)}
        for region, names in SPRITES.items():
            if name not in names:
                continue
            x0, y0, x1, y1 = REGIONS[region]
            patch = canvas[y0:y1, x0:x1]
            orig = full[y0:y1, x0:x1]
            # 色调匹配：用贴片四周一圈（表情不变的地方）求每通道的增益和偏移
            ring = np.zeros(patch.shape[:2], bool)
            ring[:4] = ring[-4:] = True
            ring[:, :4] = ring[:, -4:] = True
            for c in range(3):
                pm, ps = patch[..., c][ring].mean(), patch[..., c][ring].std() + 1e-3
                om, os_ = orig[..., c][ring].mean(), orig[..., c][ring].std() + 1e-3
                patch[..., c] = (patch[..., c] - pm) * min(1.3, max(0.7, os_ / ps)) + om
            h, w = patch.shape[:2]
            yy, xx = np.mgrid[0:h, 0:w]
            edge = np.minimum.reduce([xx, yy, w - 1 - xx, h - 1 - yy]).astype(np.float32)
            a = np.clip(edge / FEATHER, 0, 1)
            a = a * a * (3 - 2 * a)
            rgba = np.dstack([np.clip(patch, 0, 255), a * 255]).astype(np.uint8)
            key = f'{region}_{name}'
            Image.fromarray(rgba, 'RGBA').save(OUT / 'parts' / f'{key}.png')
            # 坐标存成相对头部部件的位置
            sprites[key] = {'file': f'parts/{key}.png', 'x': x0, 'y': y0, 'w': w, 'h': h}
    rig['face'] = {'regions': REGIONS, 'sprites': sprites}
    rig_path.write_text(json.dumps(rig, indent=2, ensure_ascii=False, default=int))
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
