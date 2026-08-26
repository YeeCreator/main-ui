import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

const fromPackageRoot = (path: string) => fileURLToPath(new URL(`./${path}`, import.meta.url));
const fromRepoRoot = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^main-ui$/, replacement: fromPackageRoot('src/index.ts') },
      { find: /^main-ui\/core$/, replacement: fromPackageRoot('src/core/index.ts') },
      { find: /^main-ui\/vue$/, replacement: fromPackageRoot('src/vue/index.ts') },
      { find: /^main-ui\/adapters$/, replacement: fromPackageRoot('src/adapters/index.ts') },
      { find: /^main-ui\/tokens$/, replacement: fromPackageRoot('src/tokens/index.ts') },
      { find: /^@main-ui\/viewport-2d-kit\/vue$/, replacement: fromRepoRoot('packages/viewport-2d-kit/src/vue/index.ts') },
      { find: /^@main-ui\/viewport-2d-kit\/main-ui$/, replacement: fromRepoRoot('packages/viewport-2d-kit/src/main-ui/index.ts') },
      { find: /^@main-ui\/viewport-2d-kit$/, replacement: fromRepoRoot('packages/viewport-2d-kit/src/index.ts') },
    ],
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
