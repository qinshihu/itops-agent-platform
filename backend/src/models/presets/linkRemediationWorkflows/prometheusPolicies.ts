/**
 * Prometheus 系列 preset policies（2 项，2026-07-21 拆分）
 *
 * 包含：
 * - Prometheus NodeExporter 节点资源诊断
 * - Prometheus Kube 容器异常诊断
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import { v4 as uuidv4 } from 'uuid';
import type { ExtraPolicy, WorkflowIds } from './specialPolicies';

export function buildPrometheusPolicies(
  ids: WorkflowIds,
  now: string,
): ExtraPolicy[] {
  const { faultDiagId, healthCheckId, fullFlowId } = ids;
  const fallbackWf = fullFlowId || faultDiagId || null;

  return [
    // ===== Prometheus Node 资源告警 =====
    {
      id: uuidv4(),
      name: 'Prometheus 节点资源诊断修复',
      description: 'Prometheus NodeExporter CPU/内存/磁盘告警诊断修复完整流程',
      alert_source: 'prometheus',
      alert_severity: null,
      alert_keywords: JSON.stringify(['Node', 'node', 'cpu', 'memory', '磁盘', 'disk', 'high utilization', 'load', 'iowait', 'mem', 'swap', 'filesystem']),
      alert_tags: JSON.stringify(['prometheus', 'node']),
      execution_mode: 'auto',
      workflow_id: fallbackWf,
      workflow_params: JSON.stringify({
        server_id: '{{alert.host}}',
        collect_top_processes: true,
        check_disk_usage: true,
        check_memory_usage: true,
        save_report: true,
      }),
      max_executions_per_hour: 3,
      cooldown_seconds: 600,
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

    // ===== Prometheus Kube 告警 =====
    {
      id: uuidv4(),
      name: 'Kubernetes 容器异常诊断修复',
      description: 'Kube pod 崩溃/容器重启/节点异常自动诊断修复完整流程',
      alert_source: 'prometheus',
      alert_severity: null,
      alert_keywords: JSON.stringify(['Kube', 'kube', 'pod', 'container', '容器', 'deployment', 'statefulset', 'crash', 'restart', 'OOMKill', 'OOM', 'Evicted', 'NotReady', 'NodeNotReady', '调度', 'scheduler']),
      alert_tags: JSON.stringify(['kubernetes', 'kube']),
      execution_mode: 'auto',
      workflow_id: fallbackWf,
      workflow_params: JSON.stringify({
        cluster: '{{alert.cluster}}',
        namespace: '{{alert.namespace}}',
        pod_name: '{{alert.pod}}',
        check_pod_logs: true,
        check_node_status: true,
        check_resource_quota: true,
      }),
      max_executions_per_hour: 5,
      cooldown_seconds: 300,
      enable_verification: 1,
      verification_workflow_id: healthCheckId || null,
      verification_params: JSON.stringify({ cluster: '{{alert.cluster}}', check_pod_healthy: true }),
      verification_timeout_seconds: 120,
      enable_rollback: 0,
      rollback_workflow_id: null,
      rollback_on_failure: 0,
      enabled: 1,
      created_by: 'system',
      created_at: now,
      updated_at: now,
    },
  ];
}
