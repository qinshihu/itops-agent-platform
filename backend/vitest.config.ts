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
      // 渐进式提升计划：每月 +5%，目标 50%/80%/55%/50%
      thresholds: {
        // 当前覆盖率: branches 17%, functions 57%, lines 22%, statements 17%
        // 目标: 逐月提升 5%，最终达到 60%
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
