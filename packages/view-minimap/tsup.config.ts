import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/index.css'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // 样式单独产出 `dist/index.css`（由 `./styles.css` 子路径导出给宿主），
  // 不注入到 JS bundle：宿主若不需要缩略图就不该被迫加载它的样式。
  external: ['vue', /^@main-ui\/core/],
});
