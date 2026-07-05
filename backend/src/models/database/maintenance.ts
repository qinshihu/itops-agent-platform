import { logger } from '../../utils/logger';
import { db } from './core';
import { getDatabaseHealthStatus } from './health';

let maintenanceTimer: NodeJS.Timeout | null = null;
let isMaintenanceRunning = false;

/**
 * 执行数据库维护操作
 * @param operation - 维护操作类型：vacuum（释放空间）、analyze（更新统计信息）、integrity_check（完整性检查）
 * 委托给 performVacuum / performAnalyze / performIntegrityCheck 实现，避免逻辑重复
 */
export function performMaintenance(operation: 'vacuum' | 'analyze' | 'integrity_check'): void {
  switch (operation) {
    case 'vacuum':
      performVacuum();
      break;
    case 'analyze':
      performAnalyze();
      break;
    case 'integrity_check':
      performIntegrityCheck();
      break;
  }
}

// ==================== 数据库定期维护任务 ====================

/**
 * 执行 VACUUM 操作：重建数据库文件，释放未使用空间
 * 注意：此操作会锁定数据库，建议在低峰期执行
 */
export function performVacuum(): void {
  const timer = logger.startTimer('Database VACUUM');
  try {
    db.exec('VACUUM');
    logger.info('✅ VACUUM completed - reclaimed unused space');
    timer.end(true);
  } catch (error) {
    logger.error('❌ VACUUM failed', error as Error);
    timer.end(false);
    throw error;
  }
}

/**
 * 执行 ANALYZE 操作：更新查询优化器统计信息
 * 提高查询计划质量，建议每周执行一次
 */
export function performAnalyze(): void {
  const timer = logger.startTimer('Database ANALYZE');
  try {
    db.exec('ANALYZE');
    logger.info('✅ ANALYZE completed - updated query optimizer statistics');
    timer.end(true);
  } catch (error) {
    logger.error('❌ ANALYZE failed', error as Error);
    timer.end(false);
    throw error;
  }
}

/**
 * 执行完整性检查：验证数据库文件完整性
 * 发现损坏时记录错误并告警
 */
export function performIntegrityCheck(): { ok: boolean; result: string } {
  const timer = logger.startTimer('Database Integrity Check');
  try {
    const result = db.pragma('integrity_check') as Array<{ integrity_check: string }>;
    const isOk = result[0]?.integrity_check === 'ok';
    
    if (isOk) {
      logger.info('✅ Integrity check passed - database is healthy');
      timer.end(true);
      return { ok: true, result: 'ok' };
    } else {
      logger.error('❌ Integrity check failed', undefined, { result });
      timer.end(false);
      return { ok: false, result: result[0]?.integrity_check || 'unknown' };
    }
  } catch (error) {
    logger.error('❌ Integrity check failed with error', error as Error);
    timer.end(false);
    return { ok: false, result: (error as Error).message };
  }
}

/**
 * 执行 WAL 检查点：强制将 WAL 文件数据写入主数据库文件
 * 可手动触发以减少 WAL 文件大小
 */
export function performCheckpoint(): void {
  const timer = logger.startTimer('WAL Checkpoint');
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
    logger.info('✅ WAL checkpoint completed - WAL file truncated');
    timer.end(true);
  } catch (error) {
    logger.error('❌ WAL checkpoint failed', error as Error);
    timer.end(false);
    throw error;
  }
}

/**
 * 执行完整的数据库维护流程
 * 包含：完整性检查、ANALYZE、WAL 检查点、VACUUM（可选）
 */
export function performFullMaintenance(options: { vacuum: boolean } = { vacuum: false }): void {
  if (isMaintenanceRunning) {
    logger.warn('⚠️ Database maintenance already in progress, skipping');
    return;
  }

  isMaintenanceRunning = true;
  const timer = logger.startTimer('Full Database Maintenance');

  try {
    logger.info('🔧 Starting full database maintenance...');
    
    // 1. 先执行完整性检查
    const integrity = performIntegrityCheck();
    if (!integrity.ok) {
      throw new Error(`Database integrity check failed: ${integrity.result}`);
    }

    // 2. 更新统计信息
    performAnalyze();

    // 3. WAL 检查点
    performCheckpoint();

    // 4. 可选：VACUUM（耗时较长）
    if (options.vacuum) {
      performVacuum();
    }

    const status = getDatabaseHealthStatus();
    logger.info('📊 Database status after maintenance', status);
    
    timer.end(true);
    logger.info('✅ Full database maintenance completed successfully');
  } catch (error) {
    logger.error('❌ Full database maintenance failed', error as Error);
    timer.end(false);
    throw error;
  } finally {
    isMaintenanceRunning = false;
  }
}

/**
 * 启动数据库定期维护任务
 * 执行频率：
 * - 每日：WAL 检查点（凌晨 4 点）
 * - 每周：ANALYZE（周日凌晨 4 点）
 * - 每月：VACUUM + 完整维护（每月 1 号凌晨 4 点）
 */
export function startDatabaseMaintenance(): void {
  if (maintenanceTimer) {
    logger.info('Database maintenance scheduler already running');
    return;
  }

  // 每小时检查一次是否需要执行维护任务
  maintenanceTimer = setInterval(() => {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay(); // 0 = 周日
    const dayOfMonth = now.getDate();

    // 凌晨 4 点执行维护任务（低峰期，避开凌晨 3 点的应用定期重启）
    if (hour === 4) {
      // 每日：WAL 检查点
      try {
        performCheckpoint();
      } catch (error) {
        logger.error('Daily WAL checkpoint failed', error as Error);
      }

      // 每周日：ANALYZE + 完整性检查
      if (dayOfWeek === 0) {
        try {
          performAnalyze();
          performIntegrityCheck();
          logger.info('✅ Weekly maintenance completed');
        } catch (error) {
          logger.error('Weekly maintenance failed', error as Error);
        }
      }

      // 每月 1 号：完整维护（包含 VACUUM）
      if (dayOfMonth === 1) {
        try {
          performFullMaintenance({ vacuum: true });
          logger.info('✅ Monthly full maintenance completed');
        } catch (error) {
          logger.error('Monthly maintenance failed', error as Error);
        }
      }
    }
  }, 60 * 60 * 1000); // 每小时检查一次

  maintenanceTimer.unref(); // 不阻止进程退出

  logger.info('✅ Database maintenance scheduler started');
  logger.info('📅 Maintenance schedule: Daily(WAL checkpoint), Weekly(ANALYZE), Monthly(VACUUM)');
}

/**
 * 停止数据库维护任务调度
 */
export function stopDatabaseMaintenance(): void {
  if (maintenanceTimer) {
    clearInterval(maintenanceTimer);
    maintenanceTimer = null;
    logger.info('🛑 Database maintenance scheduler stopped');
  }
}