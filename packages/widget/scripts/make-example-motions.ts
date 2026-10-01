// 生成两个示例 .motion3.json，演示「加一个文件 = 加一个动作」
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { toMotion3Json } from '../src/motion/export';
import { STANDARD_PROFILE } from '../src/motion/profiles';
import type { MotionDef } from '../src/motion/types';

const dir = fileURLToPath(new URL('../public/huinuo-pseudo/motions/', import.meta.url));
const motions: Record<string, MotionDef> = {
  // 打喷嚏：吸气后仰 → 眯眼 → 「哈啾」往前一点头
  sneeze: {
    duration: 2.2,
    params: {
      angleY: [[0, 0], [0.6, 14], [1.0, 16], [1.12, -22, 'out'], [1.5, -6], [2.2, 0]],
      eyeLOpen: [[0, 1], [0.6, 0.6], [1.0, 0.2], [1.1, 0], [1.6, 0], [1.9, 1]],
      eyeROpen: [[0, 1], [0.6, 0.6], [1.0, 0.2], [1.1, 0], [1.6, 0], [1.9, 1]],
      mouthOpen: [[0, 0], [0.6, 0.5], [1.0, 0.7], [1.12, 0.2], [1.5, 0], [2.2, 0]],
      bodyY: [[0, 0], [0.9, 3], [1.12, -5, 'out'], [1.6, 0]],
      cheek: [[0, 0], [1.1, 0.6], [2.2, 0]],
    },
  },
  // 偷笑：缩头、眯眼、肩膀抖
  giggle: {
    duration: 2,
    params: {
      eyeLSmile: [[0, 0], [0.2, 1], [1.7, 1], [2, 0]],
      eyeRSmile: [[0, 0], [0.2, 1], [1.7, 1], [2, 0]],
      angleY: [[0, 0], [0.2, -8], [1.7, -8], [2, 0]],
      angleZ: [[0, 0], [0.25, 6], [0.45, 2], [0.65, 6], [0.85, 2], [1.05, 6], [1.25, 2], [1.7, 4], [2, 0]],
      bodyY: [[0, 0], [0.25, -2], [0.45, 0], [0.65, -2], [0.85, 0], [1.05, -2], [1.25, 0], [2, 0]],
      mouthOpen: [[0, 0], [0.25, 0.35], [0.45, 0.1], [0.65, 0.35], [0.85, 0.1], [1.05, 0.35], [1.4, 0], [2, 0]],
      cheek: [[0, 0], [0.3, 0.7], [1.7, 0.7], [2, 0]],
    },
  },
};
const index: Record<string, string> = {};
for (const [name, def] of Object.entries(motions)) {
  await writeFile(`${dir}${name}.motion3.json`, JSON.stringify(toMotion3Json(def, STANDARD_PROFILE), null, 2));
  index[name] = `${name}.motion3.json`;
}
await writeFile(`${dir}index.json`, JSON.stringify(index, null, 2));
console.log('示例动作:', Object.keys(index).join(', '));
