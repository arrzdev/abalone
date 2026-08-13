import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  build: {
    outDir: 'dist',
    // The minimax worker is emitted as a separate chunk by Vite's worker handling.
    chunkSizeWarningLimit: 900,
  },
  worker: {
    format: 'es',
  },
});
