/**
 * Vitest 全局 setup 文件
 *
 * 通过 vitest.config.ts 的 setupFiles 引入，所有测试文件执行前自动加载。
 *
 * 职责：
 * 1. 注册 @testing-library/jest-dom 扩展断言（toBeInTheDocument / toHaveClass 等）
 * 2. 后续可扩展：全局 mock（如 matchMedia / ResizeObserver / IntersectionObserver）
 */
import '@testing-library/jest-dom';
