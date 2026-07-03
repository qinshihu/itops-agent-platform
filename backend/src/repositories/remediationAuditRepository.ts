/**
 * remediationAuditRepository — remediation_audits 表的统一数据访问层
 *
 * remediationPolicyRepository 只管 remediation_policies 表；
 * 本 repository 覆盖 remediation_audits 表，供路由层（如
 * remediationExecutionRoutes 的 rollback 前置校验）和后续业务使用。
 */

import db from '../models/database';

export interface RemediationAuditRecord {
  id: string;
  rca_id: string;
  policy_id?: string | null;
  server_id: string;
  risk_level: string;
  status?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  execution_log?: string | null;
  result?: string | null;
  is_rollback?: number | null;
  created_at?: string | null;
  completed_at?: string | null;
  [key: string]: unknown;
}

export const remediationAuditRepository = {
  /** 按 ID 查询 audit */
  getById(id: string): RemediationAuditRecord | undefined {
    return db.prepare('SELECT * FROM remediation_audits WHERE id = ?').get(id) as RemediationAuditRecord | undefined;
  },
};
