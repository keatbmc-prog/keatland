import { defineConfig } from 'vite';
// Relative base so dist/ works from any static server or sub-path.
export default defineConfig({
  base: './',
  build: { target: 'es2020', chunkSizeWarningLimit: 1500, assetsInlineLimit: 0 },
  server: { host: true },
});
