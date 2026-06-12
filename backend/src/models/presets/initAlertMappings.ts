/**
 * 预设告警映射
 * 
 * 将不同来源/级别/关键词的告警自动关联到对应的工作流。
 * 映射规则 (AND)：
 *   alert_source + alert_severity + alert_title_pattern 全部匹配 → 触发对应 workflow
 *   任意字段为 null 表示「匹配任意」
 */
import { db } from '../database';
import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger';

export function initializeAlertMappings() {
  // ── 1. 查找可用工作流 ──
  const allWorkflows = db.prepare(
    'SELECT id, name FROM workflows WHERE is_template = 1'
  ).all() as Array<{ id: string; name: string }>;

  if (!allWorkflows.length) {
    logger.info('⚠️ 未找到预设工作流，跳过告警映射初始化');
    return;
  }

  const wf = new Map<string, string>();
  for (const w of allWorkflows) {
    wf.set(w.name, w.id);
  }

  const alertWf     = wf.get('告警处理');
  const faultWf     = wf.get('故障诊断');
  const changeWf    = wf.get('变更执行');
  const healthWf    = wf.get('日常健康检查');
  const logWf       = wf.get('日志分析');
  const complianceWf= wf.get('合规检查');
  const fallback    = allWorkflows[0].id;

  // ── 2. 定义所有映射 ──
  interface MappingDef {
    source: string | null;       // alert_source
    severity: string | null;     // alert_severity
    pattern: string | null;      // alert_title_pattern (子串匹配)
    workflow: string | undefined;// workflow name → resolve to id
    label: string;               // 描述
  }

  const defs: MappingDef[] = [

    // ════════════════════════════════════════════
    // Zabbix 映射
    // ════════════════════════════════════════════

    // ── disaster (灾难级) ──
    { source: 'zabbix', severity: 'disaster', pattern: '宕机',    workflow: changeWf,   label: 'Zabbix 服务宕机 → 变更执行' },
    { source: 'zabbix', severity: 'disaster', pattern: 'down',    workflow: faultWf,    label: 'Zabbix 服务 Down → 故障诊断' },
    { source: 'zabbix', severity: 'disaster', pattern: null,      workflow: alertWf,    label: 'Zabbix 灾难级告警 → 告警处理' },

    // ── critical (严重) ──
    { source: 'zabbix', severity: 'critical', pattern: '磁盘',    workflow: faultWf,    label: 'Zabbix 磁盘故障 → 故障诊断' },
    { source: 'zabbix', severity: 'critical', pattern: 'disk',    workflow: faultWf,    label: 'Zabbix Disk → 故障诊断' },
    { source: 'zabbix', severity: 'critical', pattern: '内存',    workflow: faultWf,    label: 'Zabbix 内存故障 → 故障诊断' },
    { source: 'zabbix', severity: 'critical', pattern: 'memory',  workflow: faultWf,    label: 'Zabbix Memory → 故障诊断' },
    { source: 'zabbix', severity: 'critical', pattern: null,      workflow: alertWf,    label: 'Zabbix 严重告警 → 告警处理' },

    // ── high (高) ──
    { source: 'zabbix', severity: 'high',     pattern: 'CPU',     workflow: faultWf,    label: 'Zabbix CPU 过载 → 故障诊断' },
    { source: 'zabbix', severity: 'high',     pattern: 'cpu',     workflow: faultWf,    label: 'Zabbix cpu → 故障诊断' },
    { source: 'zabbix', severity: 'high',     pattern: '日志',    workflow: logWf,      label: 'Zabbix 日志异常 → 日志分析' },
    { source: 'zabbix', severity: 'high',     pattern: 'log',     workflow: logWf,      label: 'Zabbix log → 日志分析' },
    { source: 'zabbix', severity: 'high',     pattern: '网络',    workflow: faultWf,    label: 'Zabbix 网络异常 → 故障诊断' },
    { source: 'zabbix', severity: 'high',     pattern: 'network', workflow: faultWf,    label: 'Zabbix network → 故障诊断' },
    { source: 'zabbix', severity: 'high',     pattern: null,      workflow: alertWf,    label: 'Zabbix 高告警 → 告警处理' },

    // ── medium / warning / info ──
    { source: 'zabbix', severity: 'medium',   pattern: null,      workflow: healthWf,   label: 'Zabbix 中告警 → 健康检查' },
    { source: 'zabbix', severity: 'warning',  pattern: null,      workflow: healthWf,   label: 'Zabbix 警告 → 健康检查' },
    { source: 'zabbix', severity: 'info',     pattern: null,      workflow: healthWf,   label: 'Zabbix 信息告警 → 健康检查' },

    // ════════════════════════════════════════════
    // Prometheus 映射
    // ════════════════════════════════════════════

    { source: 'prometheus', severity: 'critical', pattern: 'CPU',     workflow: faultWf,    label: 'Prom CPU 过载 → 故障诊断' },
    { source: 'prometheus', severity: 'critical', pattern: 'Memory',  workflow: faultWf,    label: 'Prom Memory → 故障诊断' },
    { source: 'prometheus', severity: 'critical', pattern: 'Disk',    workflow: faultWf,    label: 'Prom Disk → 故障诊断' },
    { source: 'prometheus', severity: 'critical', pattern: null,      workflow: alertWf,    label: 'Prom 严重告警 → 告警处理' },

    { source: 'prometheus', severity: 'high',     pattern: 'Node',    workflow: healthWf,   label: 'Prom Node 异常 → 健康检查' },
    { source: 'prometheus', severity: 'high',     pattern: 'Kube',    workflow: faultWf,    label: 'Prom Kube 异常 → 故障诊断' },
    { source: 'prometheus', severity: 'high',     pattern: null,      workflow: alertWf,    label: 'Prom 高告警 → 告警处理' },

    { source: 'prometheus', severity: 'warning',  pattern: null,      workflow: healthWf,   label: 'Prom 警告 → 健康检查' },

    // ════════════════════════════════════════════
    // Elasticsearch / 日志告警 映射
    // ════════════════════════════════════════════

    { source: 'elasticsearch', severity: null, pattern: 'error',    workflow: logWf,      label: 'ES error → 日志分析' },
    { source: 'elasticsearch', severity: null, pattern: 'exception',workflow: logWf,      label: 'ES exception → 日志分析' },
    { source: 'elasticsearch', severity: 'high', pattern: null,     workflow: faultWf,    label: 'ES 高告警 → 故障诊断' },
    { source: 'elasticsearch', severity: null, pattern: null,       workflow: logWf,      label: 'ES 告警 → 日志分析' },

    // ════════════════════════════════════════════
    // 自定义告警映射
    // ════════════════════════════════════════════

    { source: 'custom', severity: 'critical', pattern: '合规',     workflow: complianceWf, label: '自定义合规违规 → 合规检查' },
    { source: 'custom', severity: 'critical', pattern: 'security', workflow: complianceWf, label: '自定义安全告警 → 合规检查' },
    { source: 'custom', severity: 'critical', pattern: null,       workflow: alertWf,     label: '自定义严重告警 → 告警处理' },
    { source: 'custom', severity: 'high',     pattern: null,       workflow: faultWf,     label: '自定义高告警 → 故障诊断' },
    { source: 'custom', severity: null,       pattern: null,       workflow: alertWf,     label: '自定义任意告警 → 告警处理' },

    // ════════════════════════════════════════════
    // 兜底映射 (来源/级别/标题均不限)
    // ════════════════════════════════════════════

    { source: null, severity: 'disaster', pattern: null, workflow: alertWf, label: '兜底: 灾难级告警 → 告警处理' },
    { source: null, severity: 'critical', pattern: null, workflow: alertWf, label: '兜底: 严重告警 → 告警处理' },
    { source: null, severity: 'high',     pattern: null, workflow: alertWf, label: '兜底: 高告警 → 告警处理' },
    { source: null, severity: 'medium',   pattern: null, workflow: healthWf,label: '兜底: 中告警 → 健康检查' },
    { source: null, severity: 'warning',  pattern: null, workflow: healthWf,label: '兜底: 警告 → 健康检查' },
  ];

  // ── 3. 插入到数据库 ──
  const existingCount = db.prepare(
    'SELECT COUNT(*) as count FROM alert_workflow_mappings'
  ).get() as { count: number };

  const insert = db.prepare(`
    INSERT OR IGNORE INTO alert_workflow_mappings
      (id, alert_source, alert_severity, alert_title_pattern, workflow_id, enabled)
    VALUES (?, ?, ?, ?, ?, 1)
  `);

  // 收集已存在的唯一键 (source + severity + pattern) 避免重复
  const existingRows = db.prepare(
    'SELECT alert_source, alert_severity, alert_title_pattern FROM alert_workflow_mappings'
  ).all() as Array<{ alert_source: string | null; alert_severity: string | null; alert_title_pattern: string | null }>;
  const keySet = new Set<string>();
  for (const r of existingRows) {
    keySet.add(`${r.alert_source ?? ''}|${r.alert_severity ?? ''}|${r.alert_title_pattern ?? ''}`);
  }

  let insertedCount = 0;
  const batchInsert = db.transaction(() => {
    for (const d of defs) {
      const wfId = d.workflow || fallback;
      const key = `${d.source ?? ''}|${d.severity ?? ''}|${d.pattern ?? ''}`;
      if (keySet.has(key)) continue;

      insert.run(randomUUID(), d.source, d.severity, d.pattern, wfId);
      keySet.add(key);
      insertedCount++;
      logger.info(`📌 告警映射: ${d.label}`);
    }
  });

  batchInsert();

  if (existingCount.count > 0) {
    logger.info(`✅ 已存在 ${existingCount.count} 条告警映射，新增 ${insertedCount} 条`);
  } else {
    logger.info(`✅ 首次创建 ${insertedCount} 条告警映射`);
  }
}
