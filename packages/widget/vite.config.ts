import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ command }) => ({
  resolve: {
    alias: { '@huinuo/shared': resolve(here, '../shared/src/index.ts') },
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:8787' },
  },
  build:
    command === 'build'
      ? {
          // 打包成一个文件：<script src="huinuo.js"></script> 即可使用
          lib: { entry: resolve(here, 'src/index.ts'), name: 'Huinuo', formats: ['iife', 'es'], fileName: (f) => (f === 'es' ? 'huinuo.mjs' : 'huinuo.js') },
          rollupOptions: { output: { inlineDynamicImports: true } },
          copyPublicDir: false,
        }
      : undefined,
}));
