// 开发用：下载 Live2D 官方示例模型 Haru 到 public/models/haru，
// 以及 Cubism Core 到 public/vendor（两者都不提交到 Git）。
// 示例模型受 Live2D「Free Material License」约束，详见 https://www.live2d.com/eula/live2d-free-material-license-agreement_en.html
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display/test/assets/haru/';
const FILES = [
  'haru_greeter_t03.model3.json',
  'haru_greeter_t03.moc3',
  'haru_greeter_t03.physics3.json',
  'haru_greeter_t03.pose3.json',
  'haru_greeter_t03.2048/texture_00.png',
  'haru_greeter_t03.2048/texture_01.png',
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((i) => `expressions/F0${i}.exp3.json`),
  ...['idle', 'm05', 'm07', 'm14', 'm15'].map((m) => `motion/haru_g_${m}.motion3.json`),
];
const out = join(dirname(fileURLToPath(import.meta.url)), '../public/models/haru');

async function get(file, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(BASE + file, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      if (i >= tries) throw new Error(`${file}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
    }
  }
}

for (const file of FILES) {
  const buf = await get(file);
  const dest = join(out, file);
  await mkdir(dirname(dest), { recursive: true });
  if (file.endsWith('model3.json')) {
    // 示例模型引用了不存在的音效文件，去掉以免 404
    const json = JSON.parse(buf.toString('utf8'));
    for (const group of Object.values(json.FileReferences.Motions)) for (const m of group) delete m.Sound;
    delete json.FileReferences.DisplayInfo;
    await writeFile(dest, JSON.stringify(json, null, 2));
  } else {
    await writeFile(dest, buf);
  }
  console.log('✓', file);
}
console.log(`\n示例模型已下载到 ${out}`);

// Cubism Core：受 Live2D Proprietary Software License 约束，只在本地缓存，不随仓库分发
const coreUrl = 'https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js';
const coreOut = join(dirname(fileURLToPath(import.meta.url)), '../public/vendor/live2dcubismcore.min.js');
const coreRes = await fetch(coreUrl, { signal: AbortSignal.timeout(30_000) });
if (!coreRes.ok) throw new Error(`Cubism Core: HTTP ${coreRes.status}`);
await mkdir(dirname(coreOut), { recursive: true });
await writeFile(coreOut, Buffer.from(await coreRes.arrayBuffer()));
console.log(`Cubism Core 已缓存到 ${coreOut}`);
