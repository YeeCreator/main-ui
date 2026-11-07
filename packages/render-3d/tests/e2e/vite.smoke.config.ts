import { defineConfig } from 'vite';
import { resolve } from 'node:path';

/**
 * 冒烟诊断页的 Vite 配置。
 *
 * 独立的 root（`tests/e2e/fixtures`）而非复用 demo：诊断页要能在
 * **不依赖整个工作台**的前提下复现后端问题 —— 少一层就少一个可疑变量。
 *
 * 用 `@main-ui/core` 的源码入口（`src`）而非 dist，这样改完 core 立刻生效，
 * 不必先 build 一遍再验。
 */
export default defineConfig({
  root: resolve(__dirname, 'fixtures'),
  server: {
    port: 4187,
    strictPort: true,
    host: '127.0.0.1',
  },
  resolve: {
    alias: {
      '@main-ui/core/primitives': resolve(__dirname, '../../../core/src/primitives/index.ts'),
      '@main-ui/core/rendering': resolve(__dirname, '../../../core/src/rendering/index.ts'),
      '@main-ui/core': resolve(__dirname, '../../../core/src/index.ts'),
    },
  },
  build: {
    outDir: resolve(__dirname, '../.smoke-dist'),
    emptyOutDir: true,
  },
});
