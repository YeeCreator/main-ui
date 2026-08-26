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
  external: ['vue'],
});
