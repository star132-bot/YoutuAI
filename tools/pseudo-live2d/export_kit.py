"""
把灰糯的素材打包成可以导入 Live2D Cubism Editor 等软件的资料包。

用法：python tools/pseudo-live2d/export_kit.py
输出：exports/huinuo-live2d-kit/（以及同名 .zip）
"""
import json
import shutil
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image
from psd_tools import PSDImage
from psd_tools.api.layers import Group, PixelLayer

ROOT = Path(__file__).resolve().parents[2]
RIG_DIR = ROOT / 'packages/widget/public/huinuo-pseudo'
OUT = ROOT / 'exports/huinuo-live2d-kit'

# 图层名用英文（PSD 旧格式的图层名不支持中文，导入各软件也最稳）；中文对照见 KIT_README.md
LAYER_NAMES = {
    'tail': 'tail',
    'ear_l': 'ear_L',
    'ear_r': 'ear_R',
    'body': 'body',
    'head': 'head',
    'eye_l_eyes_half': 'eye_L_half',
    'eye_l_eyes_closed': 'eye_L_closed',
    'eye_r_eyes_half': 'eye_R_half',
    'eye_r_eyes_closed': 'eye_R_closed',
    'mouth_mouth_open': 'mouth_open',
    'mouth_mouth_wide': 'mouth_wide',
}


def full_canvas(img: Image.Image, x: int, y: int, w: int, h: int) -> Image.Image:
    c = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    c.paste(img, (x, y))
    return c


def main():
    rig = json.loads((RIG_DIR / 'rig.json').read_text())
    W, H = rig['canvas']['w'], rig['canvas']['h']
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / 'layers').mkdir(parents=True)

    psd = PSDImage.new('RGBA', (W, H))
    base_layers = []
    for key in rig['order']:  # 从后往前
        p = rig['parts'][key]
        img = Image.open(RIG_DIR / p['file']).convert('RGBA')
        layer = PixelLayer.frompil(img, psd, LAYER_NAMES[key], top=p['y'], left=p['x'])
        psd.append(layer)
        base_layers.append(key)
        full_canvas(img, p['x'], p['y'], W, H).save(OUT / 'layers' / f'{key}.png')

    # 表情差分：放在单独的组里，默认隐藏（绑定时可用来做眨眼 / 口型的参考，或作为切换图层）
    sprites = rig['face']['sprites']
    order = sorted(sprites, key=lambda k: (k.split('_')[0], 0 if ('half' in k or 'mouth_open' in k) else 1))
    face_layers = []
    for key in order:
        s = sprites[key]
        img = Image.open(RIG_DIR / s['file']).convert('RGBA')
        layer = PixelLayer.frompil(img, psd, LAYER_NAMES[key], top=s['y'], left=s['x'])
        layer.visible = False
        psd.append(layer)
        face_layers.append(layer)
        full_canvas(img, s['x'], s['y'], W, H).save(OUT / 'layers' / f'{key}.png')
    group = Group.group_layers(psd, face_layers, name='expressions (hidden)', open_folder=True)
    group.visible = True
    psd.save(OUT / 'huinuo.psd')

    # 校验：重新读取 PSD，合成后和原立绘比较
    check = PSDImage.open(OUT / 'huinuo.psd')
    names = [l.name for l in check.descendants()]
    comp = Image.new('RGBA', (W, H), (255, 255, 255, 255))
    comp.alpha_composite(check.composite(force=True).convert('RGBA'))
    orig = Image.open(ROOT / 'design/final/live2d-base-front.png').convert('RGB')
    diff = np.abs(np.array(comp.convert('RGB')).astype(int) - np.array(orig).astype(int)).max(axis=2)

    # 动作：标准参数 ID 的 .motion3.json
    subprocess.run(['npx', 'tsx', 'packages/widget/scripts/export-motions.ts', 'standard'], cwd=ROOT, check=True, capture_output=True)
    shutil.copytree(ROOT / 'packages/widget/motions/standard', OUT / 'motions')
    extra = RIG_DIR / 'motions'
    index = json.loads((OUT / 'motions/index.json').read_text())
    for name, file in json.loads((extra / 'index.json').read_text()).items():
        shutil.copy(extra / file, OUT / 'motions' / file)
        index[name] = {'file': file, 'duration': None, 'loop': False, 'skippedTransform': False}
    (OUT / 'motions/index.json').write_text(json.dumps(index, indent=2, ensure_ascii=False))

    # 参考图
    ref = OUT / 'reference'
    ref.mkdir()
    for f in ['live2d-base-front.png', 'character-sheet.png', 'front-with-wand.png']:
        shutil.copy(ROOT / 'design/final' / f, ref / f)
    shutil.copytree(ROOT / 'design/pseudo/face-variants', ref / 'face-variants')
    shutil.copy(ROOT / 'docs/LIVE2D-RIGGING.md', OUT / 'LIVE2D-RIGGING.md')
    shutil.copy(Path(__file__).with_name('KIT_README.md'), OUT / 'README.md')

    zip_path = shutil.make_archive(str(OUT), 'zip', OUT.parent, OUT.name)
    print(json.dumps({
        'psd_layers': names,
        'psd_vs_original_pixels_diff_gt_40': int((diff > 40).sum()),
        'motions': len(index),
        'zip': zip_path,
    }, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
