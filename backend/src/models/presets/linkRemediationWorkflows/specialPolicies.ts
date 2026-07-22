/**
 * 特殊场景 preset policies（5 项，2026-07-21 拆分）
 *
 * 包含：
 * - 磁盘清理高风险（审批）
 * - 多服务宕机批量修复（审批）
 * - 日志异常自动诊断
 * - 网络端口连通性自动诊断
 * - SSL 证书即将到期提醒
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import { v4 as uuidv4 } from 'uuid';

export interface ExtraPolicy {
  id: string;
  name: string;
  description: string;
  alert_source: string;
  alert_severity: string | null;
  alert_keywords: string;
  alert_tags: string;
  execution_mode: 'auto' | 'approval' | 'suggestion';
  workflow_id: string | null;
  workflow_params: string;
  max_executions_per_hour: number;
  cooldown_seconds: number;
  enable_verification: 0 | 1;
  verification_workflow_id: string | null;
  verification_params: string;
  verification_timeout_seconds: number;
  enable_rollback: 0 | 1;
  rollback_workflow_id: string | null;
  rollback_on_failure: 0 | 1;
  enabled: 0 | 1;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowIds {
  faultDiagId?: string | null;
  alertHandleId?: string | null;
  changeExecId?: string | null;
  healthCheckId?: string | null;
  logAnalysisId?: string | null;
  fullFlowId?: string | null;
}

export function buildSpecialPolicies(
  ids: WorkflowIds,
  now: string,
): ExtraPolicy[] {
  const { faultDiagId, changeExecId, healthCheckId, logAnalysisId, fullFlowId } = ids;

  return [
    // ===== 磁盘清理高风险审批 =====
    {
      id: uuidv4(),
      name: '磁盘清理高风险操作审批',
      description: '当主分区(/)使用率超过95%时，需要人工审批后才执行清理',
      alert_source: 'zabbix',
      alert_severity: 'disaster',
      alert_keywords: JSON.stringify(['disk', 'space', 'full', '95%', '分区', '根分区']),
      alert_tags: JSON.stringify(['storage', 'disk', 'critical']),
      execution_mode: 'approval',
      workflow_id: fullFlowId || faultDiagId || null,
      workflow_params: JSON.stringify({
        server_id: '{{alert.host}}',
        cleanup_paths: ['/var/log', '/tmp', '/var/tmp'],
        threshold: 95,
        dry_run: false,
        require_approval_reason: '根分区使用率超过95%，自动清理存在风险',
      }),
      max_executions_per_hour: 1,
      cooldown_seconds: 1800,
      enable_verification: 1,
      verification_workflow_id: healthCheckId || null,
      verification_params: JSON.stringify({ server_id: '{{alert.host}}', check_disk_usage: true }),
      verification_timeout_seconds: 120,
      enable_rollback: 0,
      rollback_workflow_id: null,
      rollback_on_failure: 0,
      enabled: 1,
      created_by: 'system',
      created_at: now,
      updated_at: now,
    },

    // ===== 日志异常自动诊断 =====
    {
      id: uuidv4(),
      name: '日志异常自动诊断',
      description: '当检测到应用错误日志激增时，自动分析日志并触发轮转',
      alert_source: 'zabbix',
      alert_severity: 'high',
      alert_keywords: JSON.stringify(['error log', 'exception', 'crash', '故障日志', '异常日志']),
      alert_tags: JSON.stringify(['log', 'application']),
      execution_mode: 'auto',
      workflow_id: fullFlowId || logAnalysisId || null,
      workflow_params: JSON.stringify({
        server_id: '{{alert.host}}',
        log_paths: ['/var/log/syslog', '/var/log/messages'],
        analyze_patterns: true,
        rotate_logs: true,
        tail_lines: 200,
      }),
      max_executions_per_hour: 2,
      cooldown_seconds: 900,
      enable_verification: 1,
      verification_workflow_id: healthCheckId || null,
      verification_params: JSON.stringify({ server_id: '{{alert.host}}', check_log_errors: true }),
      verification_timeout_seconds: 60,
      enable_rollback: 0,
      rollback_workflow_id: null,
      rollback_on_failure: 0,
      enabled: 1,
      created_by: 'system',
      created_at: now,
      updated_at: now,
    },

    // ===== 多服务宕机批量修复（审批） =====
    {
      id: uuidv4(),
      name: '多服务宕机批量修复',
      description: '当同服务器上多个核心服务宕机时，需审批后统一重启',
      alert_source: 'zabbix',
      alert_severity: 'disaster',
      alert_keywords: JSON.stringify(['down', 'multiple', 'stopped', '批量宕机', '多服务']),
      alert_tags: JSON.stringify(['service', 'cluster', 'critical']),
      execution_mode: 'approval',
      workflow_id: fullFlowId || changeExecId || null,
      workflow_params: JSON.stringify({
        server_id: '{{alert.host}}',
        restart_all: true,
        restart_order: ['数据库', '中间件', '应用服务'],
        health_check_after: true,
      }),
      max_executions_per_hour: 2,
      cooldown_seconds: 600,
      enable_verification: 1,
      verification_workflow_id: healthCheckId || null,
      verification_params: JSON.stringify({ server_id: '{{alert.host}}', check_services: true }),
      verification_timeout_seconds: 180,
      enable_rollback: 0,
      rollback_workflow_id: null,
      rollback_on_failure: 0,
      enabled: 1,
      created_by: 'system',
      created_at: now,
      updated_at: now,
    },

    // ===== 网络端口连通性自动诊断 =====
    {
      id: uuidv4(),
      name: '网络端口连通性自动诊断',
      description: '当核心端口(80/443/22)不可达时，自动诊断网络问题',
      alert_source: 'prometheus',
      alert_severity: 'high',
      alert_keywords: JSON.stringify(['port', 'unreachable', 'timeout', '端口', '连接超时']),
      alert_tags: JSON.stringify(['network', 'port', 'connectivity']),
      execution_mode: 'auto',
      workflow_id: fullFlowId || faultDiagId || null,
      workflow_params: JSON.stringify({
        server_id: '{{alert.host}}',
        check_ports: [22, 80, 443],
        check_firewall: true,
        trace_route: true,
        check_dns: true,
      }),
      max_executions_per_hour: 3,
      cooldown_seconds: 300,
      enable_verification: 1,
      verification_workflow_id: healthCheckId || null,
      verification_params: JSON.stringify({ server_id: '{{alert.host}}', check_connectivity: true }),
      verification_timeout_seconds: 120,
      enable_rollback: 0,
      rollback_workflow_id: null,
      rollback_on_failure: 0,
      enabled: 1,
      created_by: 'system',
      created_at: now,
      updated_at: now,
    },

    // ===== SSL 证书即将到期提醒 =====
    {
      id: uuidv4(),
      name: 'SSL 证书即将到期提醒',
      description: '当SSL证书剩余天数少于30天时，生成诊断报告并通知续费',
      alert_source: 'prometheus',
      alert_severity: 'warning',
      alert_keywords: JSON.stringify(['certificate', 'cert', 'expir', '证书', '到期']),
      alert_tags: JSON.stringify(['security', 'certificate', 'ssl']),
      execution_mode: 'suggestion',
      workflow_id: fullFlowId || logAnalysisId || null,
      workflow_params: JSON.stringify({
        server_id: '{{alert.host}}',
        check_cert_expiry: true,
        generate_report: true,
        notify_contacts: true,
      }),
      max_executions_per_hour: 1,
      cooldown_seconds: 86400,
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
  ];
}
