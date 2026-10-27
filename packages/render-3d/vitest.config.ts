import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

const fromRepoRoot = (path: string) => fileURLToPath(new URL(`../../${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@main-ui\/core\/rendering$/, replacement: fromRepoRoot('packages/core/src/rendering/index.ts') },
      { find: /^@main-ui\/core\/primitives$/, replacement: fromRepoRoot('packages/core/src/primitives/index.ts') },
      { find: /^@main-ui\/core\/environment$/, replacement: fromRepoRoot('packages/core/src/environment/index.ts') },
      { find: /^@main-ui\/core$/, replacement: fromRepoRoot('packages/core/src/index.ts') },
    ],
  },
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
