/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Migration } from './migrationFramework';
import { logger } from '../../utils/logger';

/**
 * Migration v051 — ai_remediations 富列补齐
 *
 * v027 创建了简化版 schema（id/title/description/alert_id/status/strategy/result），
 * 而 aiRemediationService 运行时依赖富 schema（device_id/diagnosis/risk_level 等）。
 * 本迁移通过 ALTER TABLE 补齐缺失列，消除运行时 ensureTable() 的必要性。
 *
 * SQLite 不支持 ADD COLUMN IF NOT EXISTS，用 try/catch 保证幂等。
 */
const v051AiRemediationsColumns: Migration = {
  id: '20250101000051',
  version: 51,
  name: 'ai_remediations_columns',
  description: 'Add rich columns to ai_remediations (migrated from aiRemediationService.ensureTable)',

  up: async (db: any) => {
    const addColumnIfMissing = (col: string, def: string) => {
      try {
        db.exec(`ALTER TABLE ai_remediations ADD COLUMN ${col} ${def}`);
      } catch {
        // 列已存在
      }
    };

    addColumnIfMissing('device_id', 'TEXT');
    addColumnIfMissing('device_name', 'TEXT');
    addColumnIfMissing('device_ip', 'TEXT');
    addColumnIfMissing('task_id', 'TEXT');
    addColumnIfMissing('workflow_id', 'TEXT');
    addColumnIfMissing('diagnosis', 'TEXT');
    addColumnIfMissing('remediation_commands', 'TEXT');
    addColumnIfMissing('risk_level', 'TEXT');
    addColumnIfMissing('execution_result', 'TEXT');
    addColumnIfMissing('error_message', 'TEXT');

    logger.info('✅ ai_remediations rich columns ensured');
  },

  down: async (_db: any) => {
    // SQLite 不支持 DROP COLUMN（3.35.0 前），down 为 no-op
  },
};

export default v051AiRemediationsColumns;
