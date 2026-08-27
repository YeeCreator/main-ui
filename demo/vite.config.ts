import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

const fromRepoRoot = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));

export default defineConfig({
  root: __dirname,
  plugins: [vue()],
  resolve: {
    alias: [
      { find: /^main-ui$/, replacement: fromRepoRoot('packages/main-ui/src/index.ts') },
      { find: /^main-ui\/core$/, replacement: fromRepoRoot('packages/main-ui/src/core/index.ts') },
      { find: /^main-ui\/vue$/, replacement: fromRepoRoot('packages/main-ui/src/vue/index.ts') },
      { find: /^main-ui\/adapters$/, replacement: fromRepoRoot('packages/main-ui/src/adapters/index.ts') },
      { find: /^main-ui\/tokens$/, replacement: fromRepoRoot('packages/main-ui/src/tokens/index.ts') },
      { find: /^main-ui\/styles\.css$/, replacement: fromRepoRoot('packages/main-ui/src/vue/styles/main-ui.css') },
      { find: /^@main-ui\/viewport-2d-kit\/vue$/, replacement: fromRepoRoot('packages/viewport-2d-kit/src/vue/index.ts') },
      { find: /^@main-ui\/viewport-2d-kit\/main-ui$/, replacement: fromRepoRoot('packages/viewport-2d-kit/src/main-ui/index.ts') },
      { find: /^@main-ui\/viewport-2d-kit\/core$/, replacement: fromRepoRoot('packages/viewport-2d-kit/src/core/index.ts') },
      { find: /^@main-ui\/viewport-2d-kit\/pixi$/, replacement: fromRepoRoot('packages/viewport-2d-kit/src/pixi/index.ts') },
      { find: /^@main-ui\/viewport-2d-kit$/, replacement: fromRepoRoot('packages/viewport-2d-kit/src/index.ts') },
      { find: /^@main-ui\/view-tree$/, replacement: fromRepoRoot('packages/view-tree/src/index.ts') },
      { find: /^@main-ui\/view-inspector$/, replacement: fromRepoRoot('packages/view-inspector/src/index.ts') },
      { find: /^@main-ui\/view-2d$/, replacement: fromRepoRoot('packages/view-2d/src/index.ts') },
      { find: /^@main-ui\/view-table$/, replacement: fromRepoRoot('packages/view-table/src/index.ts') },
      { find: /^@main-ui\/core$/, replacement: fromRepoRoot('packages/core/src/index.ts') },
      { find: /^@main-ui\/view-form$/, replacement: fromRepoRoot('packages/view-form/src/index.ts') },
      { find: /^@main-ui\/view-node$/, replacement: fromRepoRoot('packages/view-node/src/index.ts') },
      { find: /^@main-ui\/view-console$/, replacement: fromRepoRoot('packages/view-console/src/index.ts') },
      { find: /^@main-ui\/preset-views$/, replacement: fromRepoRoot('packages/preset-views/src/index.ts') },
    ],
  },
  build: {
    outDir: '../demo-dist',
    emptyOutDir: true,
  },
  server: {
    host: '127.0.0.1',
    port: 4183,
    strictPort: true,
    fs: {
      allow: ['..'],
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4183,
  },
});
