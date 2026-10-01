"""
把一张正面立绘拆成伪 Live2D 用的部件（透明 PNG）。

用法：python tools/pseudo-live2d/build_parts.py
输入：design/final/live2d-base-front.png（白底）
输出：packages/widget/public/huinuo-pseudo/parts/*.png + rig.json

坐标都是原图像素坐标，换立绘时改 GEOMETRY 即可。
"""
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'design/final/live2d-base-front.png'
OUT = ROOT / 'packages/widget/public/huinuo-pseudo'

GEOMETRY = {
    # 下巴线：头部在这条线以上（只在脖子附近生效）
    # 只覆盖露出脖子的那一段，两端落在头发和脖子的交界上，避免切口出现在头发中间
    'jaw': [(476, 272), (485, 278), (505, 288), (525, 280), (540, 271)],
    # 头发两侧最低处（下巴线范围之外，头部延伸到这里）
    'hair_bottom': 305,
    'head_x': (360, 680),
    # 头顶轮廓：耳朵在这条线以上、以外
    'dome': [(418, 160), (428, 128), (440, 108), (456, 90), (472, 76), (490, 64), (506, 60),
             (522, 63), (540, 72), (556, 88), (570, 106), (582, 128), (592, 160)],
    'ear_l': {'center': (432, 82), 'axes': (46, 56), 'pivot': (452, 130)},
    'ear_r': {'center': (598, 82), 'axes': (46, 56), 'pivot': (578, 130)},
    # 脖子补画区域（藏在下巴后面，转头时才露出来）：比可见的脖子略窄，颜色取下巴阴影
    'neck': [(487, 250), (533, 250), (538, 306), (482, 306)],
    'neck_color': (204, 168, 158),
    # 右耳根部的花饰属于头部，不能跟着耳朵摆
    'keep_on_head': [[(552, 104), (606, 100), (614, 156), (556, 164)]],
    # 脸（皮肤）范围：不复制到身体层，免得歪头时出现两个下巴
    'face': [(448, 175), (566, 175), (562, 262), (540, 274), (505, 292), (470, 274), (450, 262)],
    'under_hair_from': 225,
    # 尾巴区域
    'tail': [(632, 772), (700, 760), (735, 820), (735, 1025), (640, 1025), (628, 900)],
    'tail_pivot': (640, 778),
    # 转头 / 歪头的支点放在下巴尖附近，下巴几乎不位移
    'head_pivot': (506, 290),
}


def load_rgba():
    src = np.array(Image.open(SRC).convert('RGB'))
    mn = src.min(axis=2).astype(np.int32)
    cand = (mn >= 246).astype(np.uint8)
    _, lab = cv2.connectedComponents(cand, connectivity=4)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    fg = (~bg).astype(np.uint8)
    dist = cv2.distanceTransform(1 - fg, cv2.DIST_L2, 3)
    soft = np.clip((250 - mn) / 30.0, 0, 1)
    a = np.where(bg, np.where(dist <= 2, soft, 0.0), 1.0).astype(np.float32)
    inner = cv2.distanceTransform(fg, cv2.DIST_L2, 3)
    halo = (~bg) & (inner <= 1.5) & (mn >= 235)
    a[halo] = np.clip((255 - mn[halo]) / 20.0, 0.15, 1)
    af = np.maximum(a[..., None], 1e-3)
    rgb = np.clip((src.astype(np.float32) - 255 * (1 - af)) / af, 0, 255)
    return rgb, a


def poly_mask(shape, pts):
    m = np.zeros(shape, np.uint8)
    cv2.fillPoly(m, [np.array(pts, np.int32)], 1)
    return m.astype(bool)


def inpaint(rgb, holes, source, radius=5):
    """只用 source 区域的像素把 holes 补出来（OpenCV Telea），不会吸进白色背景。"""
    img = rgb.astype(np.uint8).copy()
    mask = (~source).astype(np.uint8) * 255  # 除 source 外全部视为待补，保证只从 source 取色
    filled = cv2.inpaint(img, mask, radius, cv2.INPAINT_TELEA).astype(np.float32)
    return np.where(holes[..., None], filled, rgb)


def jaw_y(x, jaw):
    xs, ys = zip(*jaw)
    return np.interp(x, xs, ys)


def ellipse_mask(shape, center, axes):
    m = np.zeros(shape, np.uint8)
    cv2.ellipse(m, center, axes, 0, 0, 360, 1, -1)
    return m.astype(bool)


def save(name, rgb, a, box):
    x0, y0, x1, y1 = box
    rgba = np.dstack([rgb[y0:y1, x0:x1], a[y0:y1, x0:x1] * 255]).astype(np.uint8)
    Image.fromarray(rgba, 'RGBA').save(OUT / 'parts' / f'{name}.png')
    return {'file': f'parts/{name}.png', 'x': x0, 'y': y0, 'w': x1 - x0, 'h': y1 - y0}


def bbox(mask, pad=4):
    ys, xs = np.where(mask)
    h, w = mask.shape
    return (max(0, xs.min() - pad), max(0, ys.min() - pad), min(w, xs.max() + pad + 1), min(h, ys.max() + pad + 1))


def main():
    G = GEOMETRY
    rgb, alpha = load_rgba()
    H, W = alpha.shape
    yy, xx = np.mgrid[0:H, 0:W]
    solid = alpha > 0

    # ── 头部：下巴线以上（脖子附近），两侧到头发最低处 ──
    jx = jaw_y(xx, G['jaw'])
    in_jaw_span = (xx >= G['jaw'][0][0]) & (xx <= G['jaw'][-1][0])
    head = solid & (xx >= G['head_x'][0]) & (xx <= G['head_x'][1]) & np.where(in_jaw_span, yy < jx, yy < G['hair_bottom'])

    # ── 耳朵：椭圆内、头顶轮廓以外 ──
    dome = poly_mask((H, W), G['dome'] + [(592, 320), (418, 320)])
    parts = {}
    for side in ('ear_l', 'ear_r'):
        e = G[side]
        ell = ellipse_mask((H, W), e['center'], e['axes'])
        ear = solid & ell & ~dome
        for poly in G['keep_on_head']:
            ear &= ~poly_mask((H, W), poly)
        head &= ~ear
        # 补画：耳根藏在头发后面的部分用耳朵外侧的颜色填满，转动时不露空
        hidden = ell & dome
        ear_a = np.where(ear, alpha, 0.0)
        # 耳根被头发挡住的部分：从可见的耳朵纹理向内延伸（inpaint），转动时不会露出色块
        ear_rgb = inpaint(rgb, hidden | (ell & ~ear & ~dome), ear & (alpha > 0.9))
        ear_a = np.where(hidden, 1.0, ear_a)
        box = bbox(ear | hidden)
        parts[side] = save(side, ear_rgb, ear_a, box)
        parts[side]['pivot'] = e['pivot']

    # ── 尾巴 ──
    tail = solid & poly_mask((H, W), G['tail'])
    tail_rgb = rgb.copy()
    tail_a = np.where(tail, alpha, 0.0)
    # 尾巴根部向裙子里延长一小段，摆动时不断开
    base = np.zeros((H, W), np.uint8)
    px, py = G['tail_pivot']
    cv2.line(base, (px - 14, py - 6), (px + 4, py + 4), 1, 7)
    base = base.astype(bool) & ~tail
    tail_rgb[base] = np.median(rgb[tail & (alpha > 0.9)], axis=0)
    tail_a = np.where(base, 1.0, tail_a)
    parts['tail'] = save('tail', tail_rgb, tail_a, bbox(tail | base))
    parts['tail']['pivot'] = G['tail_pivot']

    # ── 头部 ──
    parts['head'] = save('head', rgb, np.where(head, alpha, 0.0), bbox(head))
    parts['head']['pivot'] = G['head_pivot']

    # ── 身体：其余部分 + 脖子补画 ──
    body = solid & ~head & ~tail
    for side in ('ear_l', 'ear_r'):
        e = G[side]
        ear_area = ellipse_mask((H, W), e['center'], e['axes']) & ~dome
        for poly in G['keep_on_head']:
            ear_area &= ~poly_mask((H, W), poly)
        body &= ~ear_area
    body_rgb = rgb.copy()
    body_a = np.where(body, alpha, 0.0)
    neck = poly_mask((H, W), G['neck']) & ~body
    # 从下往上略微变暗，模拟下巴阴影
    shade = np.clip((yy - 236) / 70.0, 0, 1)[..., None]
    nc = np.array(G['neck_color'], np.float32)
    body_rgb = np.where(neck[..., None], nc * (0.88 + 0.12 * shade), body_rgb)
    body_a = np.where(neck, 1.0, body_a)
    # 头发垫底：把头部下半部分的头发复制到身体层（平时被头盖住），歪头时露出的是头发而不是空洞
    face = poly_mask((H, W), G['face'])
    under = head & (yy >= G['under_hair_from']) & ~face & ~neck & (body_a < 0.5)
    under = cv2.erode(under.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
    body_rgb = np.where(under[..., None], rgb, body_rgb)
    body_a = np.where(under, alpha, body_a)
    parts['body'] = save('body', body_rgb, body_a, bbox(body | neck))

    rig = {
        'source': SRC.name,
        'canvas': {'w': W, 'h': H},
        # 绘制顺序：从后往前
        'order': ['tail', 'ear_l', 'ear_r', 'body', 'head'],
        'parts': parts,
    }
    (OUT / 'rig.json').write_text(json.dumps(rig, indent=2, ensure_ascii=False, default=int))
    print({k: (int(v['x']), int(v['y']), int(v['w']), int(v['h'])) for k, v in parts.items()})


if __name__ == '__main__':
    (OUT / 'parts').mkdir(parents=True, exist_ok=True)
    main()
