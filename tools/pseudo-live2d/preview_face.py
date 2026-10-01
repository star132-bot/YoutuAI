"""把眼睛 / 嘴贴片贴回原图，检查接缝和对齐。"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
RIG = ROOT / 'packages/widget/public/huinuo-pseudo'
rig = json.loads((RIG / 'rig.json').read_text())
base = Image.open(ROOT / 'design/final/live2d-base-front.png').convert('RGBA')
out = Path(sys.argv[1])

def paste(img, keys):
    img = img.copy()
    for k in keys:
        s = rig['face']['sprites'][k]
        img.alpha_composite(Image.open(RIG / s['file']).convert('RGBA'), (s['x'], s['y']))
    return img

combos = {
    'open': [],
    'half': ['eye_l_eyes_half', 'eye_r_eyes_half'],
    'closed': ['eye_l_eyes_closed', 'eye_r_eyes_closed'],
    'wink R': ['eye_r_eyes_closed'],
    'talk': ['mouth_mouth_open'],
    'laugh': ['eye_l_eyes_closed', 'eye_r_eyes_closed', 'mouth_mouth_wide'],
}
tiles = []
for label, keys in combos.items():
    t = paste(base, keys).crop((430, 170, 600, 300)).resize((340, 260), Image.LANCZOS)
    ImageDraw.Draw(t).text((4, 4), label, fill=(200, 0, 0, 255))
    tiles.append(t)
g = Image.new('RGBA', (340 * 3, 260 * 2), 'white')
for i, t in enumerate(tiles):
    g.paste(t, ((i % 3) * 340, (i // 3) * 260))
g.save(out / 'face-check.png')
