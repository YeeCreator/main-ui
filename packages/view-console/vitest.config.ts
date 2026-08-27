import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

const fromRepoRoot = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^main-ui$/, replacement: fromRepoRoot('packages/main-ui/src/index.ts') },
      { find: /^main-ui\/core$/, replacement: fromRepoRoot('packages/main-ui/src/core/index.ts') },
      { find: /^main-ui\/vue$/, replacement: fromRepoRoot('packages/main-ui/src/vue/index.ts') },
    ],
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
