import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['vue', 'pixi.js', /^main-ui/, /^@main-ui\/viewport-2d-kit/],
});
