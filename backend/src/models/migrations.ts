/**
 * 数据库迁移入口文件
 * 
 * 新的版本化迁移框架已在 ./migrations/ 目录下实现
 * 此文件保留用于向后兼容，确保现有代码不报错
 */

import { createMigrationManager } from './migrations/index';
import { logger } from '../utils/logger';

export { createMigrationManager } from './migrations/index';

/**
 * 运行所有待处理的迁移
 * 用于数据库初始化时自动执行
 */
export async function runMigrations(db: any): Promise<void> {
  try {
    const manager = createMigrationManager(db);
    const status = manager.getStatus();
    
    logger.info(`📊 Database migration status: Current v${status.currentVersion}, Latest v${status.latestVersion}, Pending: ${status.pendingCount}`);
    
    if (status.pendingCount > 0) {
      logger.info(`🔄 Running ${status.pendingCount} pending migration(s)...`);
      const result = await manager.migrate();
      
      if (result.success) {
        logger.info(`✅ Migration completed successfully. Now at version v${result.currentVersion}`);
      } else {
        logger.error(`❌ Migration failed at version v${result.failedVersion}: ${result.errorMessage}`);
        throw new Error(`Migration failed: ${result.errorMessage}`);
      }
    } else {
      logger.info('✅ Database is already at the latest version');
    }
  } catch (error) {
    logger.error('❌ Error during database migration', error as Error);
    throw error;
  }
}

export default {
  createMigrationManager,
  runMigrations
};
