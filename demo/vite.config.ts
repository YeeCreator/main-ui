import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

const fromRepoRoot = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const fromProjectRoot = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

export default defineConfig({
  root: __dirname,
  plugins: [vue()],
  resolve: {
    alias: [
      { find: /^main-ui$/, replacement: fromRepoRoot('src/index.ts') },
      { find: /^main-ui\/core$/, replacement: fromRepoRoot('src/core/index.ts') },
      { find: /^main-ui\/vue$/, replacement: fromRepoRoot('src/vue/index.ts') },
      { find: /^main-ui\/adapters$/, replacement: fromRepoRoot('src/adapters/index.ts') },
      { find: /^main-ui\/tokens$/, replacement: fromRepoRoot('src/tokens/index.ts') },
      { find: /^viewport-2d-kit\/vue$/, replacement: fromProjectRoot('viewport-2d-kit/src/vue/index.ts') },
      { find: /^viewport-2d-kit\/main-ui$/, replacement: fromProjectRoot('viewport-2d-kit/src/main-ui/index.ts') },
      { find: /^viewport-2d-kit$/, replacement: fromProjectRoot('viewport-2d-kit/src/index.ts') },
    ],
  },
  build: {
    outDir: '../demo-dist',
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port: 4173,
    fs: {
      allow: ['..', '../viewport-2d-kit'],
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
  },
});