import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // Replace "sketchup-to-pdf-converter"
  // if you ever rename your GitHub repository.
  base: '/sketchup-to-pdf-converter/',

  server: {
    host: '127.0.0.1',
    port: 5173,
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});