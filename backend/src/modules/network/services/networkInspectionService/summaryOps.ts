/**
 * networkInspectionService 摘要生成子模块（2026-07-21 拆分）
 *
 * 把主类 generateSummary 私有方法抽为模块级纯函数
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import type { ParsedResult } from '../networkResultParser';

/** 根据巡检结果生成摘要文本 */
export function generateSummary(results: ParsedResult[]): string {
  const normal = results.filter((r) => r.status === 'normal').length;
  const warning = results.filter((r) => r.status === 'warning').length;
  const critical = results.filter((r) => r.status === 'critical').length;
  const error = results.filter((r) => r.status === 'error').length;

  if (critical > 0) {
    return `发现 ${critical} 个严重问题，${warning} 个警告，需要立即处理`;
  }
  if (warning > 0) {
    return `发现 ${warning} 个警告项，建议关注`;
  }
  if (error > 0) {
    return `${error} 个命令执行失败，请检查设备连接`;
  }
  return `巡检完成，${normal} 项全部正常`;
}
