import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

const fromPackageRoot = (path: string) => fileURLToPath(new URL(`./${path}`, import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^main-ui$/, replacement: fromPackageRoot('src/index.ts') },
      { find: /^main-ui\/core$/, replacement: fromPackageRoot('src/core/index.ts') },
      { find: /^main-ui\/vue$/, replacement: fromPackageRoot('src/vue/index.ts') },
      { find: /^main-ui\/adapters$/, replacement: fromPackageRoot('src/adapters/index.ts') },
      { find: /^main-ui\/tokens$/, replacement: fromPackageRoot('src/tokens/index.ts') },
      // @main-ui/core 子路径指向源码：vitest 不读 tsconfig paths，必须显式声明，
      // 否则测试会去解析 dist（未构建时失败）或直接找不到模块。
      { find: /^@main-ui\/core\/input$/, replacement: fromPackageRoot('../core/src/input/index.ts') },
      { find: /^@main-ui\/core\/rendering$/, replacement: fromPackageRoot('../core/src/rendering/index.ts') },
      { find: /^@main-ui\/core\/primitives$/, replacement: fromPackageRoot('../core/src/primitives/index.ts') },
      { find: /^@main-ui\/core\/environment$/, replacement: fromPackageRoot('../core/src/environment/index.ts') },
      { find: /^@main-ui\/core$/, replacement: fromPackageRoot('../core/src/index.ts') },
    ],
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
