import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/core/index.ts',
    'src/vue/index.ts',
    'src/adapters/index.ts',
    'src/tokens/index.ts',
  ],
  dts: true,
  format: ['esm'],
  sourcemap: true,
  clean: true,
  target: 'es2022',
  // `@main-ui/core` 必须外置：内联会让下游打两份副本，
  // 造成 `instanceof` 失效、绑定对象互不相等这类难查缺陷。
  external: ['vue', /^@main-ui\//],
});
