import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En développement, les appels à /api sont redirigés vers le serveur Express.
export default defineConfig({
  // Base configurable : '/' en dev, '/routebenin/' pour GitHub Pages (via VITE_BASE).
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
