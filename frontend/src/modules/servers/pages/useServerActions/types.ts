/**
 * useServerActions 子模块共享类型（2026-07-21 拆分）
 *
 * 按 architecture.md §3.3.1「向后兼容的 import 路径」+ frontend.md §5.1「聚合 Hook 拆分」，
 * 把原 useServerActions.ts 中的 ApiError / ServerImportItem / ImportResult 抽出。
 *
 * 关键：保留 export，外部 `import type { ImportResult } from '../useServerActions'` 无需改。
 */

/** API 错误响应类型（简化） */
export interface ApiError {
  response?: {
    data?: {
      message?: string;
      error?: string;
    };
  };
  message?: string;
}

/** 单条服务器导入项（JSON 格式） */
export interface ServerImportItem {
  name: string;
  hostname: string;
  port: number;
  username: string;
  password?: string;
  private_key?: string;
  use_ssh_key: number;
  description: string;
  tags: string[];
  group_id?: string;
}

/** 批量导入结果（向后兼容的关键类型） */
export interface ImportResult {
  success: number;
  failed: number;
  skipped?: number;
  details?: Array<{ name: string; hostname?: string; status?: string; error?: string }>;
  errors?: string[];
}
