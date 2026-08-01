import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [basicSsl()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    https: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    https: true,
  },
});
