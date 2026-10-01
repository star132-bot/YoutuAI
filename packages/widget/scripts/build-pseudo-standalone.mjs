// 把伪 Live2D 渲染器打包成单个 IIFE（全局 HuinuoPseudo），PixiJS 6.5.10 由页面从 CDN 引入（全局 PIXI）。
// 用法：node packages/widget/scripts/build-pseudo-standalone.mjs [输出文件]
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const outfile = process.argv[2] ?? `${root}packages/widget/dist/huinuo-pseudo.js`;
await build({
  entryPoints: [`${root}packages/widget/src/pseudo/standalone.ts`],
  bundle: true,
  format: 'iife',
  globalName: 'HuinuoPseudo',
  minify: true,
  target: 'es2020',
  alias: { '@huinuo/shared': `${root}packages/shared/src/index.ts` },
  plugins: [{
    name: 'pixi-global',
    setup(b) {
      b.onResolve({ filter: /^pixi\.js$/ }, () => ({ path: 'pixi', namespace: 'global' }));
      b.onLoad({ filter: /.*/, namespace: 'global' }, () => ({ contents: 'module.exports = window.PIXI', loader: 'js' }));
    },
  }],
  outfile,
});
console.log('已生成', outfile);
