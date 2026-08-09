import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // The API (and MongoDB credentials) live only on the Node server;
      // during development Vite proxies API calls to it.
      '/api': 'http://localhost:3001',
    },
  },
});
