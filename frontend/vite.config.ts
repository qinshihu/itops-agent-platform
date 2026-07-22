import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    hmr: {
      clientPort: 5173,
    },
    watch: {
      // Docker (virtiofs/gRPC-FUSE) 下 inotify 不可靠，必须 polling
      // 间隔 2s 在保证热重载敏感度的同时降低 CPU 占用（约 0.5% → 0.25%）
      usePolling: true,
      interval: 2000,
    },
    proxy: {
      '/api': {
        target: process.env.DOCKER_MODE ? 'http://backend:3001' : 'http://localhost:3001',
        changeOrigin: true,
      },
      '/socket.io': {
        target: process.env.DOCKER_MODE ? 'http://backend:3001' : 'http://localhost:3001',
        ws: true,
      },
    },
  },
});
