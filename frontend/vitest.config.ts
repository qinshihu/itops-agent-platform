import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    testTimeout: 60000,
    css: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/*.d.ts',
        'src/**/*.{test,spec}.{ts,tsx}',
      ],
      thresholds: {
        // 当前覆盖率: branches 15%, functions 15%, lines 15%, statements 15%
        // 目标: 逐月提升 5%，最终达到 50%
        global: {
          branches: 20,
          functions: 20,
          lines: 20,
          statements: 20,
        },
      },
    },
  },
});
