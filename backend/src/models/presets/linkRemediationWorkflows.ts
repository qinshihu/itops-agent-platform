/**
 * 关联修复策略与工作流
 * 
 * 在 initRemediationPolicies() 和 initializePresetWorkflows() 之后执行，
 * 将预设修复策略与具体的工作流 ID 绑定。
 * 
 * 同时创建额外的高级策略（带验证/回滚工作流）。
 */
import { db } from '../database';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../utils/logger';

export function linkRemediationWorkflows(): void {
  // ── 1. 查找所有预设工作流 ──
  const workflows = db.prepare(
    `SELECT id, name FROM workflows WHERE is_template = 1`
  ).all() as Array<{ id: string; name: string }>;

  const wfMap = new Map<string, string>();
  for (const w of workflows) {
    wfMap.set(w.name, w.id);
  }

  const faultDiagId     = wfMap.get('故障诊断');
  const alertHandleId   = wfMap.get('告警处理');
  const changeExecId    = wfMap.get('变更执行');
  const healthCheckId   = wfMap.get('日常健康检查');
  const logAnalysisId   = wfMap.get('日志分析');
  const fallback        = workflows.length > 0 ? workflows[0].id : null;

  logger.info(`Found workflows: ${workflows.map(w => `${w.name}(${w.id.slice(0,8)})`).join(', ')}`);

  // ── 2. 读取现有策略，按名称匹配工作流 ──
  const existingPolicies = db.prepare(
    'SELECT id, name, workflow_id FROM remediation_policies'
  ).all() as Array<{ id: string; name: string; workflow_id: string | null }>;

  const updateStmt = db.prepare(`
    UPDATE remediation_policies
    SET workflow_id = ?,
        verification_workflow_id = ?,
        rollback_workflow_id = ?,
        updated_at = datetime('now','localtime')
    WHERE id = ?
  `);

  const link = db.transaction(() => {
    for (const p of existingPolicies) {
      let wf = null;      // 主修复工作流
      let vf = null;      // 验证工作流
      let rf = null;      // 回滚工作流

      switch (p.name) {
        case '磁盘空间不足自动清理':
          wf = faultDiagId;    // 故障诊断 → 定位日志/临时文件
          vf = healthCheckId;  // 健康检查 → 验证磁盘释放
          break;

        case '服务宕机自动重启':
          wf = changeExecId;   // 变更执行 → 执行重启
          vf = faultDiagId;    // 故障诊断 → 验证服务状态
          rf = changeExecId;   // 回滚同样走变更执行
          break;

        case '高 CPU 使用率处理':
          wf = faultDiagId;    // 故障诊断 → 找高CPU进程
          vf = healthCheckId;  // 健康检查 → 验证CPU回落
          break;

        case '内存使用率过高处理':
          wf = faultDiagId;
          vf = healthCheckId;
          break;

        case '网络设备CPU告警巡检':
          wf = faultDiagId;
          vf = healthCheckId;
          break;

        default:
          wf = faultDiagId || alertHandleId;
      }

      if (wf && wf !== p.workflow_id) {
        updateStmt.run(wf, vf, rf, p.id);
        logger.info(`🔗 Linked policy "${p.name}" → workflow ${wf.slice(0,8)}`);
      }
    }
  });

  link();

  // ── 3. 创建额外的高级策略 ──

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO remediation_policies (
      id, name, description, alert_source, alert_severity,
      alert_keywords, alert_tags, execution_mode, workflow_id,
      workflow_params, max_executions_per_hour, cooldown_seconds,
      enable_verification, verification_workflow_id, verification_params,
      verification_timeout_seconds, enable_rollback, rollback_workflow_id,
      rollback_on_failure, enabled, created_by, created_at, updated_at
    ) VALUES (
      @id, @name, @description, @alert_source, @alert_severity,
      @alert_keywords, @alert_tags, @execution_mode, @workflow_id,
      @workflow_params, @max_executions_per_hour, @cooldown_seconds,
      @enable_verification, @verification_workflow_id, @verification_params,
      @verification_timeout_seconds, @enable_rollback, @rollback_workflow_id,
      @rollback_on_failure, @enabled, @created_by, @created_at, @updated_at
    )
  `);

  const now = new Date().toISOString();

  const extraPolicies = [
    // ── 审批型：高风险操作需要人工确认 ──
    {
      id: uuidv4(),
      name: '磁盘清理高危操作审批',
      description: '当主分区(/)使用率超过95%时，需要人工审批后才执行清理',
      alert_source: 'zabbix',
      alert_severity: 'disaster',
      alert_keywords: JSON.stringify(['disk', 'space', 'full', '95%', '分区', '根分区']),
      alert_tags: JSON.stringify(['storage', 'disk', 'critical']),
      execution_mode: 'approval',
      workflow_id: faultDiagId,
      workflow_params: JSON.stringify({
        server_id: '{{alert.host}}',
        cleanup_paths: ['/var/log', '/tmp', '/var/tmp'],
        threshold: 95,
        dry_run: false,
        require_approval_reason: '根分区使用率超过95%，自动清理存在风险'
      }),
      max_executions_per_hour: 1,
      cooldown_seconds: 1800,
      enable_verification: 1,
      verification_workflow_id: healthCheckId,
      verification_params: JSON.stringify({ server_id: '{{alert.host}}', check_disk_usage: true }),
      verification_timeout_seconds: 120,
      enable_rollback: 0,
      rollback_workflow_id: null,
      rollback_on_failure: 0,
      enabled: 1,
      created_by: 'system',
      created_at: now, updated_at: now
    },

    // ── 日志异常 → 自动诊断 + 日志轮转 ──
    {
      id: uuidv4(),
      name: '日志异常自动诊断',
      description: '当检测到应用错误日志激增时，自动分析日志并触发轮转',
      alert_source: 'zabbix',
      alert_severity: 'high',
      alert_keywords: JSON.stringify(['error log', 'exception', 'crash', '故障日志', '异常日志']),
      alert_tags: JSON.stringify(['log', 'application']),
      execution_mode: 'auto',
      workflow_id: logAnalysisId,
      workflow_params: JSON.stringify({
        server_id: '{{alert.host}}',
        log_paths: ['/var/log/syslog', '/var/log/messages'],
        analyze_patterns: true,
        rotate_logs: true,
        tail_lines: 200
      }),
      max_executions_per_hour: 2,
      cooldown_seconds: 900,
      enable_verification: 1,
      verification_workflow_id: healthCheckId,
      verification_params: JSON.stringify({ server_id: '{{alert.host}}', check_log_errors: true }),
      verification_timeout_seconds: 60,
      enable_rollback: 0,
      rollback_workflow_id: null,
      rollback_on_failure: 0,
      enabled: 1,
      created_by: 'system',
      created_at: now, updated_at: now
    },

    // ── 服务批量重启（审批模式） ──
    {
      id: uuidv4(),
      name: '多服务宕机批量恢复',
      description: '当同服务器上多个核心服务宕机时，需审批后统一重启',
      alert_source: 'zabbix',
      alert_severity: 'disaster',
      alert_keywords: JSON.stringify(['down', 'multiple', 'stopped', '批量宕机', '多服务']),
      alert_tags: JSON.stringify(['service', 'cluster', 'critical']),
      execution_mode: 'approval',
      workflow_id: changeExecId,
      workflow_params: JSON.stringify({
        server_id: '{{alert.host}}',
        restart_all: true,
        restart_order: ['数据库', '中间件', '应用服务'],
        health_check_after: true
      }),
      max_executions_per_hour: 2,
      cooldown_seconds: 600,
      enable_verification: 1,
      verification_workflow_id: faultDiagId,
      verification_params: JSON.stringify({ server_id: '{{alert.host}}', verify_all_services: true }),
      verification_timeout_seconds: 180,
      enable_rollback: 1,
      rollback_workflow_id: changeExecId,
      rollback_on_failure: 1,
      enabled: 1,
      created_by: 'system',
      created_at: now, updated_at: now
    },

    // ── 网络端口异常自动诊断 ──
    {
      id: uuidv4(),
      name: '网络端口连通性自动诊断',
      description: '当核心端口(80/443/22)不可达时，自动诊断网络问题',
      alert_source: 'prometheus',
      alert_severity: 'high',
      alert_keywords: JSON.stringify(['port', 'unreachable', 'timeout', '端口', '连接超时']),
      alert_tags: JSON.stringify(['network', 'port', 'connectivity']),
      execution_mode: 'auto',
      workflow_id: faultDiagId,
      workflow_params: JSON.stringify({
        server_id: '{{alert.host}}',
        check_ports: [22, 80, 443],
        check_firewall: true,
        trace_route: true,
        check_dns: true
      }),
      max_executions_per_hour: 3,
      cooldown_seconds: 300,
      enable_verification: 1,
      verification_workflow_id: healthCheckId,
      verification_params: JSON.stringify({ server_id: '{{alert.host}}', check_connectivity: true }),
      verification_timeout_seconds: 120,
      enable_rollback: 0,
      rollback_workflow_id: null,
      rollback_on_failure: 0,
      enabled: 1,
      created_by: 'system',
      created_at: now, updated_at: now
    },

    // ── 证书即将过期自动提醒 ──
    {
      id: uuidv4(),
      name: 'SSL 证书即将过期提醒',
      description: '当SSL证书剩余天数少于30天时，生成诊断报告并通知续期',
      alert_source: 'prometheus',
      alert_severity: 'warning',
      alert_keywords: JSON.stringify(['certificate', 'cert', 'expir', '证书', '过期']),
      alert_tags: JSON.stringify(['security', 'certificate', 'ssl']),
      execution_mode: 'suggestion',
      workflow_id: logAnalysisId,
      workflow_params: JSON.stringify({
        server_id: '{{alert.host}}',
        check_cert_expiry: true,
        generate_report: true,
        notify_contacts: true
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
      created_at: now, updated_at: now
    },

    // ════════════════════════════════════════════════════════
    //  全面告警场景覆盖
    // ════════════════════════════════════════════════════════

    // ── Zabbix CPU 告警（全部级别） ──
    {
      id: uuidv4(),
      name: 'CPU 过载自动诊断',
      description: 'CPU 使用率/负载/iowait 告警自动诊断，定位高占用进程',
      alert_source: 'zabbix',
      alert_severity: null,  // 匹配任何级别
      alert_keywords: JSON.stringify(['cpu', 'iowait', 'load average', '处理器', 'cpu使用率', 'cpu负载', 'cpu iowait']),
      alert_tags: JSON.stringify(['performance', 'cpu']),
      execution_mode: 'auto',
      workflow_id: faultDiagId,
      workflow_params: JSON.stringify({
        server_id: '{{alert.host}}',
        collect_top_processes: true,
        top_n: 10,
        check_load_average: true,
        check_cpu_idle: true,
        save_report: true
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
      created_at: now, updated_at: now
    },

    // ── Zabbix 内存告警 ──
    {
      id: uuidv4(),
      name: '内存/交换分区溢出自动诊断',
      description: '内存使用率/OOM/swap 告警自动诊断',
      alert_source: 'zabbix',
      alert_severity: null,
      alert_keywords: JSON.stringify(['memory', '内存', 'swap', '交换分区', 'oom', 'mem', 'out of memory', '缓存']),
      alert_tags: JSON.stringify(['performance', 'memory']),
      execution_mode: 'auto',
      workflow_id: faultDiagId,
      workflow_params: JSON.stringify({
        server_id: '{{alert.host}}',
        check_memory_usage: true,
        check_swap_usage: true,
        top_memory_processes: 10,
        check_oom_logs: true
      }),
      max_executions_per_hour: 3,
      cooldown_seconds: 1200,
      enable_verification: 0,
      verification_workflow_id: null,
      verification_params: JSON.stringify({}),
      verification_timeout_seconds: 120,
      enable_rollback: 0,
      rollback_workflow_id: null,
      rollback_on_failure: 0,
      enabled: 1,
      created_by: 'system',
      created_at: now, updated_at: now
    },

    // ── Zabbix 磁盘告警（全部级别） ──
    {
      id: uuidv4(),
      name: '磁盘空间/IO 自动诊断',
      description: '磁盘空间不足/inode满/IO延迟告警自动诊断',
      alert_source: 'zabbix',
      alert_severity: null,
      alert_keywords: JSON.stringify(['disk', '磁盘', '硬盘', 'inode', 'i/o', 'io', '读写', '存储', '分区', 'mount', '空间', 'storage']),
      alert_tags: JSON.stringify(['storage', 'disk']),
      execution_mode: 'auto',
      workflow_id: faultDiagId,
      workflow_params: JSON.stringify({
        server_id: '{{alert.host}}',
        check_disk_usage: true,
        check_inode: true,
        check_disk_io: true,
        largest_dirs: 10
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
      created_at: now, updated_at: now
    },

    // ── Zabbix 服务/进程告警 ──
    {
      id: uuidv4(),
      name: '服务/进程异常自动诊断',
      description: '服务宕机/进程死亡/端口不可达自动诊断和恢复',
      alert_source: 'zabbix',
      alert_severity: null,
      alert_keywords: JSON.stringify(['down', 'stopped', 'unreachable', '宕机', '停止', '不可达', 'process', '进程', 'service', '服务', 'dead', 'died', 'crash', '崩溃', 'not running', 'is down', '端口']),
      alert_tags: JSON.stringify(['service', 'process']),
      execution_mode: 'auto',
      workflow_id: faultDiagId,
      workflow_params: JSON.stringify({
        server_id: '{{alert.host}}',
        check_service_status: true,
        check_process_list: true,
        check_port_listen: true,
        attempt_restart: true,
        restart_command: 'systemctl restart {{alert.service}} 2>\/dev\/null || true'
      }),
      max_executions_per_hour: 5,
      cooldown_seconds: 300,
      enable_verification: 1,
      verification_workflow_id: healthCheckId,
      verification_params: JSON.stringify({ server_id: '{{alert.host}}', verify_service: true }),
      verification_timeout_seconds: 60,
      enable_rollback: 0,
      rollback_workflow_id: null,
      rollback_on_failure: 0,
      enabled: 1,
      created_by: 'system',
      created_at: now, updated_at: now
    },

    // ── Zabbix 网络告警 ──
    {
      id: uuidv4(),
      name: '网络连通性自动诊断',
      description: '网络丢包/延迟/接口故障自动诊断',
      alert_source: 'zabbix',
      alert_severity: null,
      alert_keywords: JSON.stringify(['network', '网络', 'ping', '丢包', '延迟', 'latency', 'traffic', '流量', '接口', 'interface', 'link', '链路', '带宽', 'bandwidth', '连接', 'connect']),
      alert_tags: JSON.stringify(['network', 'connectivity']),
      execution_mode: 'auto',
      workflow_id: faultDiagId,
      workflow_params: JSON.stringify({
        server_id: '{{alert.host}}',
        check_ping: true,
        check_interface_status: true,
        check_traffic: true,
        trace_route: true
      }),
      max_executions_per_hour: 5,
      cooldown_seconds: 300,
      enable_verification: 1,
      verification_workflow_id: healthCheckId,
      verification_params: JSON.stringify({ server_id: '{{alert.host}}', check_connectivity: true }),
      verification_timeout_seconds: 120,
      enable_rollback: 0,
      rollback_workflow_id: null,
      rollback_on_failure: 0,
      enabled: 1,
      created_by: 'system',
      created_at: now, updated_at: now
    },

    // ── Zabbix 系统告警（时间、温度、UPS等） ──
    {
      id: uuidv4(),
      name: '系统运行环境异常诊断',
      description: '系统时间偏差/温度/硬件/UPS 等告警诊断',
      alert_source: 'zabbix',
      alert_severity: null,
      alert_keywords: JSON.stringify(['ntp', 'time', '时间', '温度', 'temperature', 'hardware', '硬件', 'ups', '电源', 'power', '风扇', 'fan', 'battery', '电池']),
      alert_tags: JSON.stringify(['system', 'hardware']),
      execution_mode: 'auto',
      workflow_id: healthCheckId,
      workflow_params: JSON.stringify({
        server_id: '{{alert.host}}',
        check_time_sync: true,
        collect_system_info: true,
        check_dmesg_errors: true
      }),
      max_executions_per_hour: 2,
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
      created_at: now, updated_at: now
    },

    // ── Prometheus Node 资源告警 ──
    {
      id: uuidv4(),
      name: 'Prometheus 节点资源诊断',
      description: 'Prometheus NodeExporter CPU/内存/磁盘告警诊断',
      alert_source: 'prometheus',
      alert_severity: null,
      alert_keywords: JSON.stringify(['Node', 'node', 'cpu', 'memory', '磁盘', 'disk', 'high utilization', 'load', 'iowait', 'mem', 'swap', 'filesystem']),
      alert_tags: JSON.stringify(['prometheus', 'node']),
      execution_mode: 'auto',
      workflow_id: faultDiagId,
      workflow_params: JSON.stringify({
        server_id: '{{alert.host}}',
        collect_top_processes: true,
        check_disk_usage: true,
        check_memory_usage: true,
        save_report: true
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
      created_at: now, updated_at: now
    },

    // ── Prometheus Kube 告警 ──
    {
      id: uuidv4(),
      name: 'Kubernetes 容器异常诊断',
      description: 'Kube pod 崩溃/容器重启/节点异常自动诊断',
      alert_source: 'prometheus',
      alert_severity: null,
      alert_keywords: JSON.stringify(['Kube', 'kube', 'pod', 'container', '容器', 'deployment', 'statefulset', 'crash', 'restart', 'OOMKill', 'OOM', 'Evicted', 'NotReady', 'NodeNotReady', '调度', 'scheduler']),
      alert_tags: JSON.stringify(['kubernetes', 'kube']),
      execution_mode: 'auto',
      workflow_id: faultDiagId,
      workflow_params: JSON.stringify({
        cluster: '{{alert.cluster}}',
        namespace: '{{alert.namespace}}',
        pod_name: '{{alert.pod}}',
        check_pod_logs: true,
        check_node_status: true,
        check_resource_quota: true
      }),
      max_executions_per_hour: 5,
      cooldown_seconds: 300,
      enable_verification: 1,
      verification_workflow_id: healthCheckId,
      verification_params: JSON.stringify({ cluster: '{{alert.cluster}}', check_pod_healthy: true }),
      verification_timeout_seconds: 120,
      enable_rollback: 0,
      rollback_workflow_id: null,
      rollback_on_failure: 0,
      enabled: 1,
      created_by: 'system',
      created_at: now, updated_at: now
    },

    // ── Elasticsearch 日志异常 ──
    {
      id: uuidv4(),
      name: 'ES 日志异常自动分析',
      description: 'Elasticsearch 日志异常/错误率飙升自动分析',
      alert_source: 'elasticsearch',
      alert_severity: null,
      alert_keywords: JSON.stringify(['error', 'exception', '异常', '错误', 'timeout', '超时', 'reject', '拒绝', 'refused', 'failed', 'failure', '失败', 'crash', '崩溃']),
      alert_tags: JSON.stringify(['log', 'elasticsearch']),
      execution_mode: 'auto',
      workflow_id: logAnalysisId,
      workflow_params: JSON.stringify({
        server_id: '{{alert.host}}',
        log_index: '{{alert.index}}',
        search_pattern: '{{alert.pattern}}',
        time_range_minutes: 30,
        top_error_count: 20
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
      created_at: now, updated_at: now
    },

    // ── 兜底：未匹配告警（来源不限，级别不限） ──
    {
      id: uuidv4(),
      name: '未匹配告警兜底诊断',
      description: '未匹配到任何特定策略的告警，自动执行通用诊断',
      alert_source: '*',
      alert_severity: null,
      alert_keywords: JSON.stringify(['__catch_all__']),  // 特殊标记，不会在正常标题中出现
      alert_tags: JSON.stringify(['__catch_all__']),
      execution_mode: 'suggestion',
      workflow_id: alertHandleId || changeExecId || faultDiagId || fallback,
      workflow_params: JSON.stringify({
        collect_basic_metrics: true,
        check_recent_logs: true,
        generate_suggestion: true
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
      created_at: now, updated_at: now
    },

    // ── 合规违规自动修复 ──
    {
      id: uuidv4(),
      name: '安全基线合规自动修复',
      description: '检测到安全基线偏离时，自动执行修复工作流',
      alert_source: 'custom',
      alert_severity: 'high',
      alert_keywords: JSON.stringify(['compliance', 'baseline', 'security', '合规', '基线', '安全']),
      alert_tags: JSON.stringify(['security', 'compliance', 'baseline']),
      execution_mode: 'approval',
      workflow_id: changeExecId,
      workflow_params: JSON.stringify({
        server_id: '{{alert.host}}',
        fix_type: 'compliance',
        apply_fixes: true,
        verify_after: true
      }),
      max_executions_per_hour: 2,
      cooldown_seconds: 3600,
      enable_verification: 1,
      verification_workflow_id: healthCheckId,
      verification_params: JSON.stringify({ server_id: '{{alert.host}}', check_compliance: true }),
      verification_timeout_seconds: 180,
      enable_rollback: 1,
      rollback_workflow_id: changeExecId,
      rollback_on_failure: 1,
      enabled: 1,
      created_by: 'system',
      created_at: now, updated_at: now
    },
  ];

  // 检查是否已存在同名策略，避免重复插入
  const existingNames = db.prepare(
    'SELECT name FROM remediation_policies'
  ).all() as Array<{ name: string }>;
  const nameSet = new Set(existingNames.map(n => n.name));

  let addedCount = 0;
  for (const p of extraPolicies) {
    if (!nameSet.has(p.name)) {
      insertStmt.run(p);
      addedCount++;
      logger.info(`✅ Created extra policy "${p.name}"`);
    }
  }

  logger.info(`Linked ${existingPolicies.length} existing policies, created ${addedCount} extra policies`);
}
