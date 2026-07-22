/**
 * 通用工具：延时
 *
 * 从原 enhancedNodeExecutor.ts 拆分（2026-07-08 P1-7 拆分）。
 * 用于 verification 节点的 retry interval 等待。
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
