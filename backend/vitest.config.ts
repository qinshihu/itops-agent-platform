/* eslint-disable */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      // 渐进式提升计划：每月 +3pp，目标开源社区底线 50%/80%/55%/50%
      // 2026-07-21 ADR-020 v2.2：本轮**保持 25/60/30/25 不变**
      // - 当前实际 baseline: branches 17%, functions 57%, lines 22%, statements 17%
      // - 阈值与 baseline 留 ~10pp 余量，避免 PR 频繁 build 红
      // - 注释说明为何本轮不提升：很多新功能模块尚未补测试，下个月统一补一批后再 +3pp
      thresholds: {
        global: {
          branches: 25,
          functions: 60,
          lines: 30,
          statements: 25,
        },
      },
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.test.ts',
        '**/*.d.ts',
        'src/types/',
        'src/models/migrations/**',
        'src/**/__mocks__/**',
        'src/test-setup.ts',
      ]
    }
  }
});
