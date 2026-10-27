import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  // three 走 peer（对齐 pixi 在 view-world 的 peer 先例），不进本包产物。
  external: ['three', /^three\//, /^@main-ui\//],
});
