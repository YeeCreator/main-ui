import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  build: {
    outDir: '../demo-dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('@tanstack/react-table')) {
            return 'tanstack-vendor';
          }

          if (id.includes('react-arborist')) {
            return 'arborist-vendor';
          }

          if (id.includes('react-hook-form') || id.includes('@hookform/resolvers') || id.includes('zod')) {
            return 'form-vendor';
          }

          if (id.includes('cmdk')) {
            return 'command-vendor';
          }

          if (id.includes('@radix-ui')) {
            return 'radix-vendor';
          }

          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
            return 'react-vendor';
          }

          return 'vendor';
        },
      },
    },
  },
  server: {
    port: 4173,
    fs: {
      allow: ['..'],
    },
  },
  preview: {
    port: 4173,
  },
});