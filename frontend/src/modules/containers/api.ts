/**
 * Containers 模块 API 桶导出（2026-07-21 拆分后重构）
 *
 * 拆分动机：原 api.ts 850 行混合了类型定义 + containersApi + vmMigrationApi + 后续可能
 * 还会新增，按 architecture.md §3.3.1 单文件 → 子目录拆分原则拆为 containerApi/ 子目录。
 *
 * 拆分后行为：保留 `'../api'` import 路径不变（通过本文件 barrel 重新导出全部类型 + API）。
 * 上层零改动（ComposeEditor.tsx / VMMigrations.tsx 仍可 `from '../api'`）。
 */

export * from './containerApi';
import { containersApi } from './containerApi';
export default containersApi;
