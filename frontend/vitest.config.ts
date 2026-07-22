/* eslint-disable */
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
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    // setupFiles 暂时移除：等创建 src/test-setup.ts 后再加
    css: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // 渐进式提升计划（参考 ADR-020 v2.2 治理方案）：
      // - 2026-07-21 baseline：几乎无前端测试，覆盖率 ≈ 0%
      // - 当前**不加阈值**（加任何非零阈值都会 build 红）
      // - 下一轮：先补关键 hook/工具函数测试，达到 lines 5% 后再加阈值
      thresholds: {
        // 全 0：当前前端无测试覆盖率门槛
        global: {
          branches: 0,
          functions: 0,
          lines: 0,
          statements: 0,
        },
      },
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        'src/types/',
      ],
    },
  },
});