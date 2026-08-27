import { defineConfig } from 'tsup';
import { copyFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  external: ['vue', /^main-ui/, /^@vue-flow\//],
  esbuildPlugins: [
    {
      // 内核结构样式随包分发：构建时拷到 dist，运行时经 <link> 加载
      name: 'copy-view-flow-css',
      setup(build) {
        build.onEnd(() => {
          copyFileSync(here('./src/view-flow.css'), here('./dist/view-flow.css'));
        });
      },
    },
  ],
});
