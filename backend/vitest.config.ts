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
        global: {
          branches: 22,  // 当前 17% → 22%
          functions: 60, // 当前 57% → 60%
          lines: 27,     // 当前 22% → 27%
          statements: 22, // 当前 17% → 22%
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
