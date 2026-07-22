/**
 * useServerActions 桶导出（2026-07-21 拆分后重构）
 *
 * 拆分动机：原 useServerActions.ts 801 行混合了 30+ state / 4 queries / 11 mutations /
 * 15 handlers + ESC keys，违反 frontend.md §5.1「聚合 Hook 拆分原则」。
 *
 * 拆分后行为：
 * - 保留 `'../useServerActions'` import 路径不变（通过本文件 barrel 重新导出）
 * - 调用方 `pages/servers/index.tsx` 零改动（return shape 100% 保留）
 * - `import type { ImportResult } from '../useServerActions'` 仍兼容
 * - 真实实现已分散到 6 个子文件，最大单文件 ≤ 290 行
 *
 * 拆分原则遵循 architecture.md §3.3.1：
 * - 第 3 条「向后兼容的 import 路径」——上层 0 改动
 * - 第 4 条「import 路径深度处理」——所有 ../ 相对路径无需调整
 */
export * from './useServerActions/index';
