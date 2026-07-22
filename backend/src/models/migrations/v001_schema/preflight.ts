/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * v001 Initial Schema - Preflight Logic
 *
 * 拆解自 v001_initial_schema.ts 原 L11-L37。
 *
 * ⚠️ 2026-07-21 v2.31 ADR-034 B 模式拆分：
 *   - 严格保持原代码字节级不变
 *   - 字段顺序、缩进、注释保留
 *   - 仅把循环逻辑搬运到此文件，作为模块导出函数
 *
 * @see backend/src/models/migrations/v001_initial_schema.ts
 * @see .trae/adr/034-v001-migration-splitting.md
 */

import { logger } from '../../../utils/logger';

/**
 * If tables already exist but lack expected columns (from a previous failed migration),
 * drop them so we can recreate with the correct schema.
 *
 * 拆解自 v001_initial_schema.ts 原 L14-L37。
 */
export async function dropIncompleteTables(db: any): Promise<void> {
  const tableColumnChecks: Array<{ table: string; requiredColumns: string[] }> = [
    { table: 'agents', requiredColumns: ['category'] },
    { table: 'scripts', requiredColumns: ['category'] },
    { table: 'knowledge_base', requiredColumns: ['category'] },
  ];

  for (const { table, requiredColumns } of tableColumnChecks) {
    try {
      const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
      if (tableExists) {
        const columns = db.prepare(`PRAGMA table_info(${table})`).all();
        const columnNames = new Set(columns.map((col: any) => col.name));
        const missingColumns = requiredColumns.filter(c => !columnNames.has(c));
        if (missingColumns.length > 0) {
          logger.warn(`⚠️ Dropping incomplete ${table} table from previous failed migration (missing: ${missingColumns.join(', ')})`);
          db.exec(`DROP TABLE IF EXISTS ${table}`);
        }
      }
    } catch {
      // Safe to ignore
    }
  }
}
