/**
 * 链接修复策略与工作流 — 顶层入口（2026-07-21 拆分后精简版）
 *
 * 拆分动机：原 linkRemediationWorkflows.ts 663 行包含：
 *   - 1 个 export function linkRemediationWorkflows()
 *   - 5 个 case 链接逻辑（L1-89）
 *   - 17 个 INSERT policy 预设 + filter loop（L94-660）
 *
 * 拆分后行为：
 *   - 5 个子模块按职责分离：
 *     - bindingOps：链接 + 插入执行
 *     - specialPolicies / zabbixPolicies / prometheusPolicies / catchAllPolicies：4 类 preset 数据
 *     - index：barrel
 *   - 顶层 linkRemediationWorkflows() 编排全部 + 数据组装 + log 摘要
 *   - `import { linkRemediationWorkflows } from '../presets/linkRemediationWorkflows'` 仍兼容
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import db from '../database';
import { logger } from '../../utils/logger';
import { linkExistingPolicies, insertExtraPolicies } from './linkRemediationWorkflows/bindingOps';
import { buildSpecialPolicies, type WorkflowIds } from './linkRemediationWorkflows/specialPolicies';
import { buildZabbixPolicies } from './linkRemediationWorkflows/zabbixPolicies';
import { buildPrometheusPolicies } from './linkRemediationWorkflows/prometheusPolicies';
import { buildCatchAllPolicies } from './linkRemediationWorkflows/catchAllPolicies';

/** 主入口：链接预设策略到 workflows，并插入额外的高级 preset */
export function linkRemediationWorkflows(): void {
  // ===== 1. 查找所有预设工作流 =====
  const workflows = db
    .prepare(`SELECT id, name FROM workflows WHERE is_template = 1`)
    .all() as Array<{ id: string; name: string }>;

  const wfIds: WorkflowIds = {};
  for (const w of workflows) {
    switch (w.name) {
      case '故障诊断':
        wfIds.faultDiagId = w.id;
        break;
      case '告警处理':
        wfIds.alertHandleId = w.id;
        break;
      case '变更执行':
        wfIds.changeExecId = w.id;
        break;
      case '日常健康检查':
        wfIds.healthCheckId = w.id;
        break;
      case '日志分析':
        wfIds.logAnalysisId = w.id;
        break;
      case 'AARS 全闭环工作流':
        wfIds.fullFlowId = w.id;
        break;
    }
  }
  const fallback = workflows.length > 0 ? workflows[0].id : null;

  logger.info(
    `Found workflows: ${workflows.map((w) => `${w.name}(${w.id.slice(0, 8)})`).join(', ')}`,
  );

  // ===== 2. 读取现有策略，按名称匹配工作流 =====
  const existingPolicies = db
    .prepare('SELECT id, name, workflow_id FROM remediation_policies')
    .all() as Array<{ id: string; name: string; workflow_id: string | null }>;

  const linkResult = linkExistingPolicies(db, workflows, existingPolicies);
  logger.info(`Linked ${linkResult.linked} existing policies`);

  // ===== 3. 组装 + 插入额外的高级策略（17 项） =====
  const now = new Date().toISOString();

  const extraPolicies = [
    ...buildSpecialPolicies(wfIds, now), // 5 项
    ...buildZabbixPolicies(wfIds, now), // 6 项
    ...buildPrometheusPolicies(wfIds, now), // 2 项
    ...buildCatchAllPolicies(wfIds, now, fallback), // 3 项（含兜底）
  ];

  // 检查是否已存在同名策略，避免重复插入
  const existingNames = db.prepare('SELECT name FROM remediation_policies').all() as Array<{
    name: string;
  }>;
  const nameSet = new Set(existingNames.map((n) => n.name));

  // 用 bindingOps 提供的 transaction-based 批量插入（已对 name 去重兼容）
  const filteredPolicies = extraPolicies.filter((p) => !nameSet.has(p.name));
  const records: Array<Record<string, unknown>> = filteredPolicies.map((p) => ({ ...p }));
  const addedCount = insertExtraPolicies(db, records);
  for (const policy of filteredPolicies) {
    logger.info(`🔗 Created extra policy "${policy.name}"`);
  }

  logger.info(
    `Linked ${existingPolicies.length} existing policies, created ${addedCount} extra policies`,
  );
}
