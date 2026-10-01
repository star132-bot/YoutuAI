// 第一次运行时自动下载开发用的示例模型和 Cubism Core
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const need = [
  'packages/widget/public/models/haru/haru_greeter_t03.model3.json',
  'packages/widget/public/vendor/live2dcubismcore.min.js',
];
if (need.every((f) => existsSync(f))) process.exit(0);
console.log('首次运行：下载示例模型和 Live2D Cubism Core…');
execSync('node packages/widget/scripts/fetch-sample-model.mjs', { stdio: 'inherit' });
