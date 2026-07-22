/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * v001 Initial Schema Migration
 *
 * ⚠️ 2026-07-21 v2.31 ADR-034 B 模式拆分：
 *   - 原 773 行单文件拆分到 v001_schema/ 子目录
 *   - SQL 字节级完全保持不变（已验证：UP 30969 bytes + DOWN 1754 bytes）
 *   - 保持 export default 不变（migrations/index.ts 零改动）
 *   - 保持 db.exec() 单次调用（保留 single-transaction 守卫）
 *
 * @see backend/src/models/migrations/v001_schema/  - 子模块
 * @see .trae/adr/034-v001-migration-splitting.md  - 拆分方法论
 */

import type { Migration } from './migrationFramework';
import { logger } from '../../utils/logger';
import { buildUpSql, buildDownSql, dropIncompleteTables } from './v001_schema';

const v001InitialSchema: Migration = {
  id: '20240101000001',
  version: 1,
  name: 'initial_schema',
  description: 'Initial database schema with all core tables',

  up: async (db: any) => {
    logger.info('🔄 Creating initial database schema...');
    await dropIncompleteTables(db);
    db.exec(buildUpSql());
    logger.info('✅ Initial database schema created successfully');
  },

  down: async (db: any) => {
    logger.info('🔄 Dropping initial database schema...');
    db.exec(buildDownSql());
    logger.info('✅ Initial database schema dropped successfully');
  },
};

export default v001InitialSchema;
