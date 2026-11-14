import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // The Monaco editor is bundled locally and loaded only on the workspace page, so that chunk is large on purpose.
    chunkSizeWarningLimit: 3500,
  },
  server: {
    // Vite's default address. The backend's CORS_ORIGIN must be http://localhost:5173 (spec section 6).
    port: 5173,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
    css: false,
  },
});
