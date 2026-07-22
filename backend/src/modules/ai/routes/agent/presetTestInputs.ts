/**
 * Agent 预设测试输入（2026-07-21 拆分）
 *
 * 从原 agentRoutes.ts L175-187 抽出，供 statsRoutes 与
 * agentStats/test-input 路径共用。
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

export const PRESET_TEST_INPUTS: Record<string, string> = {
  告警处理Agent: '服务器CPU使用率异常，当前值92%，阈值80%，请分析并提供处理建议',
  故障诊断Agent: '应用服务响应超时，请诊断可能的原因并提供排查步骤',
  日志分析Agent: '系统日志中有多个错误记录，请分析并找出问题根源',
  系统巡检Agent: '请执行系统健康检查，检查CPU、内存、磁盘、网络状态',
  变更执行Agent: '请执行Nginx服务重启操作',
  文档生成Agent: '请生成今天的系统运维报告',
  合规检查Agent: '请执行安全合规检查，验证系统配置是否符合安全标准',
  服务器命令执行Agent: '请检查服务器磁盘使用情况',
  自动巡检Agent: '请对所有服务器执行批量巡检',
  数据库运维Agent: '检查数据库健康状态',
};
