/**
 * 兜底 + 安全合规 preset policies（3 项，2026-07-21 拆分）
 *
 * 包含：
 * - Elasticsearch 日志异常
 * - 未匹配告警兜底
 * - 安全基线合规自动修复
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import { v4 as uuidv4 } from 'uuid';
import type { ExtraPolicy, WorkflowIds } from './specialPolicies';

export function buildCatchAllPolicies(
  ids: WorkflowIds,
  now: string,
  fallbackWorkflowId: string | null,
): ExtraPolicy[] {
  const {
    faultDiagId,
    alertHandleId,
    changeExecId,
    healthCheckId,
    logAnalysisId,
    fullFlowId,
  } = ids;

  return [
    // ===== Elasticsearch 日志异常 =====
    {
      id: uuidv4(),
      name: 'ES 日志异常自动分析修复',
      description: 'Elasticsearch 日志异常/错误率飙升自动分析修复完整流程',
      alert_source: 'elasticsearch',
      alert_severity: null,
      alert_keywords: JSON.stringify(['error', 'exception', '异常', '错误', 'timeout', '超时', 'reject', '拒绝', 'refused', 'failed', 'failure', '失败', 'crash', '崩溃']),
      alert_tags: JSON.stringify(['log', 'elasticsearch']),
      execution_mode: 'auto',
      workflow_id: fullFlowId || logAnalysisId || null,
      workflow_params: JSON.stringify({
        server_id: '{{alert.host}}',
        log_index: '{{alert.index}}',
        search_pattern: '{{alert.pattern}}',
        time_range_minutes: 30,
        top_error_count: 20,
      }),
      max_executions_per_hour: 3,
      cooldown_seconds: 900,
      enable_verification: 0,
      verification_workflow_id: null,
      verification_params: JSON.stringify({}),
      verification_timeout_seconds: 120,
      enable_rollback: 0,
      rollback_workflow_id: null,
      rollback_on_failure: 0,
      enabled: 1,
      created_by: 'system',
      created_at: now,
      updated_at: now,
    },

    // ===== 兜底：未匹配告警（来源不限，级别不限） =====
    {
      id: uuidv4(),
      name: '未匹配告警兜底诊断修复',
      description: '未匹配到任何特定策略的告警，自动执行通用诊断修复完整流程',
      alert_source: '*',
      alert_severity: null,
      alert_keywords: JSON.stringify(['__catch_all__']),
      alert_tags: JSON.stringify(['__catch_all__']),
      execution_mode: 'suggestion',
      workflow_id:
        fullFlowId || alertHandleId || changeExecId || faultDiagId || fallbackWorkflowId,
      workflow_params: JSON.stringify({
        collect_basic_metrics: true,
        check_recent_logs: true,
        generate_suggestion: true,
      }),
      max_executions_per_hour: 5,
      cooldown_seconds: 1800,
      enable_verification: 0,
      verification_workflow_id: null,
      verification_params: JSON.stringify({}),
      verification_timeout_seconds: 60,
      enable_rollback: 0,
      rollback_workflow_id: null,
      rollback_on_failure: 0,
      enabled: 1,
      created_by: 'system',
      created_at: now,
      updated_at: now,
    },

    // ===== 合规违规自动修复 =====
    {
      id: uuidv4(),
      name: '安全基线合规自动诊断修复',
      description: '检测到安全基线偏离时，自动执行诊断修复完整流程',
      alert_source: 'custom',
      alert_severity: 'high',
      alert_keywords: JSON.stringify(['compliance', 'baseline', 'security', '合规', '基线', '安全']),
      alert_tags: JSON.stringify(['security', 'compliance', 'baseline']),
      execution_mode: 'approval',
      workflow_id: fullFlowId || changeExecId || null,
      workflow_params: JSON.stringify({
        server_id: '{{alert.host}}',
        fix_type: 'compliance',
        apply_fixes: true,
        verify_after: true,
      }),
      max_executions_per_hour: 2,
      cooldown_seconds: 3600,
      enable_verification: 1,
      verification_workflow_id: healthCheckId || null,
      verification_params: JSON.stringify({ server_id: '{{alert.host}}', check_compliance: true }),
      verification_timeout_seconds: 180,
      enable_rollback: 1,
      rollback_workflow_id: changeExecId || null,
      rollback_on_failure: 1,
      enabled: 1,
      created_by: 'system',
      created_at: now,
      updated_at: now,
    },
  ];
}
