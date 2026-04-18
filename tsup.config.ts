import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/layout/index.ts',
    'src/data/index.ts',
    'src/form/index.ts',
    'src/navigation/index.ts',
    'src/command/index.ts',
    'src/tokens/index.ts',
    'src/adapters/index.ts',
  ],
  dts: true,
  format: ['esm'],
  sourcemap: true,
  clean: true,
  target: 'es2022',
});
