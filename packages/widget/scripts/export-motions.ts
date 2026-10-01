// 把程序化动作导出成 Cubism 标准 .motion3.json
// 用法：npm run export-motions [-- 档案名]   （默认 standard，即灰糯原创模型的标准参数命名）
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toMotion3Json } from '../src/motion/export';
import { MOTION_LIBRARY } from '../src/motion/library';
import { PROFILES } from '../src/motion/profiles';

const profileName = process.argv[2] ?? 'standard';
const profile = PROFILES[profileName];
if (!profile) {
  console.error(`未知档案 ${profileName}，可选：${Object.keys(PROFILES).join(', ')}`);
  process.exit(1);
}
const out = join(dirname(fileURLToPath(import.meta.url)), `../motions/${profileName}`);
await mkdir(out, { recursive: true });

const index: Record<string, { file: string; duration: number; loop: boolean; skippedTransform: boolean }> = {};
for (const [name, def] of Object.entries(MOTION_LIBRARY)) {
  const json = toMotion3Json(def, profile);
  const file = `${name}.motion3.json`;
  await writeFile(join(out, file), JSON.stringify(json, null, 2));
  index[name] = { file, duration: def.duration, loop: !!def.loop, skippedTransform: !!def.transform };
}
await writeFile(join(out, 'index.json'), JSON.stringify(index, null, 2));
console.log(`已导出 ${Object.keys(index).length} 个动作 → ${out}`);
const skipped = Object.entries(index).filter(([, v]) => v.skippedTransform).map(([k]) => k);
if (skipped.length) console.log(`提示：这些动作含整体位移/旋转，导出文件里只保留了模型参数部分：${skipped.join(', ')}`);
