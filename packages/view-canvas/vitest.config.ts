import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

const fromPackageRoot = (path: string) => fileURLToPath(new URL(`./${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@main-ui\/core\/input$/, replacement: fromPackageRoot('../core/src/input/index.ts') },
      { find: /^@main-ui\/core\/rendering$/, replacement: fromPackageRoot('../core/src/rendering/index.ts') },
      { find: /^@main-ui\/core\/environment$/, replacement: fromPackageRoot('../core/src/environment/index.ts') },
      { find: /^@main-ui\/core$/, replacement: fromPackageRoot('../core/src/index.ts') },
    ],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
