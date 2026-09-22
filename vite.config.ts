import { defineConfig } from 'vite';

export default defineConfig({
  root: 'apps/web',
  base: './',
  build: { outDir: '../../dist', emptyOutDir: true },
  server: {
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/matchmake': {
        target: 'http://localhost:2567',
        changeOrigin: true,
        ws: true,
      },
      '/city_room': {
        target: 'http://localhost:2567',
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
