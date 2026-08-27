import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/core/index.ts',
    'src/vue/index.ts',
    'src/main-ui/index.ts',
    'src/react-legacy/index.ts',
    'src/pixi/index.ts',
    'src/react-pixi/index.ts',
  ],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['vue', 'react', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'pixi.js'],
});
