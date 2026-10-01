"""拆件检查图：各部件 / 重组对比 / 动起来的极限姿势（检查接缝）。"""
import json, math, sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
RIG = ROOT / 'packages/widget/public/huinuo-pseudo'
out = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
rig = json.loads((RIG / 'rig.json').read_text())
W, H = rig['canvas']['w'], rig['canvas']['h']

def checker(w, h, s=16):
    a = (np.indices((h, w)).sum(0) // s) % 2
    c = np.where(a[..., None], [205, 210, 215], [235, 238, 240]).astype(np.uint8)
    return Image.fromarray(c).convert('RGBA')

def compose(pose, bg):
    canvas = bg.copy()
    for name in rig['order']:
        p = rig['parts'][name]
        img = Image.open(RIG / p['file']).convert('RGBA')
        dx, dy, rot = pose.get(name, (0, 0, 0))
        layer = Image.new('RGBA', (W, H))
        layer.paste(img, (p['x'], p['y']))
        if rot:
            px, py = p.get('pivot', (p['x'] + p['w'] // 2, p['y'] + p['h'] // 2))
            layer = layer.rotate(rot, resample=Image.BICUBIC, center=(px, py))
        # 耳朵挂在头上：先自转，再跟着头一起转
        if name.startswith('ear') and 'head' in pose:
            hdx, hdy, hrot = pose['head']
            hx, hy = rig['parts']['head']['pivot']
            layer = layer.rotate(hrot, resample=Image.BICUBIC, center=(hx, hy), translate=(hdx, hdy))
        if not name.startswith('ear') and (dx or dy):
            layer = layer.transform(layer.size, Image.AFFINE, (1, 0, -dx, 0, 1, -dy), resample=Image.BICUBIC)
        canvas.alpha_composite(layer)
    return canvas

crop = (300, 0, 780, 1080)
sheets = []
# 1) 各部件
row = Image.new('RGBA', (1500, 330), (255, 255, 255, 255))
x = 10
for name in rig['order']:
    p = rig['parts'][name]
    img = Image.open(RIG / p['file']).convert('RGBA')
    sc = min(280 / img.width, 300 / img.height, 1.6)
    img = img.resize((int(img.width * sc), int(img.height * sc)))
    bg = checker(img.width, img.height)
    bg.alpha_composite(img)
    row.paste(bg, (x, 20))
    ImageDraw.Draw(row).text((x, 4), name, fill=(0, 0, 0, 255))
    x += img.width + 20
row.save(out / 'parts-row.png')

dark = Image.new('RGBA', (W, H), (40, 50, 60, 255))
poses = {
    'rest': {},
    'head left + tilt': {'head': (-6, 0, 6), 'ear_l': (0, 0, 8)},
    'head right + tilt': {'head': (6, 2, -6), 'ear_r': (0, 0, -8)},
    'ears + tail swing': {'ear_l': (0, 0, 14), 'ear_r': (0, 0, -14), 'tail': (0, 0, -18)},
}
tiles = []
for label, pose in poses.items():
    img = compose(pose, dark).crop(crop)
    img = img.resize((img.width // 2, img.height // 2))
    ImageDraw.Draw(img).text((6, 6), label, fill=(255, 255, 0, 255))
    tiles.append(img)
grid = Image.new('RGBA', (sum(t.width for t in tiles), tiles[0].height))
xx = 0
for t in tiles:
    grid.paste(t, (xx, 0)); xx += t.width
grid.save(out / 'poses.png')

# 近景：头部转动时的脖子 / 下巴接缝
close = []
for label, pose in list(poses.items())[:3]:
    img = compose(pose, dark).crop((380, 20, 680, 360)).resize((450, 510))
    ImageDraw.Draw(img).text((6, 6), label, fill=(255, 255, 0, 255))
    close.append(img)
g2 = Image.new('RGBA', (1350, 510)); [g2.paste(c, (i * 450, 0)) for i, c in enumerate(close)]
g2.save(out / 'neck-closeup.png')

# 重组误差
orig = Image.open(ROOT / rig['source'] if (ROOT / rig['source']).exists() else ROOT / 'design/final' / rig['source']).convert('RGB')
white = Image.new('RGBA', (W, H), (255, 255, 255, 255))
re = np.array(compose({}, white).convert('RGB')).astype(int)
diff = np.abs(re - np.array(orig).astype(int)).max(axis=2)
print('重组与原图最大差异 >40 的像素数:', int((diff > 40).sum()))
