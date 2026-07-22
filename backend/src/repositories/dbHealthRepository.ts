import db from '../models/database';

export const dbHealthRepository = {
  /** 数据库连通性检查 */
  ping(): boolean {
    const row = db.prepare('SELECT 1').get();
    return !!row;
  },

  /** 数据库表数量 */
  getTableCount(): number {
    const row = db.prepare("SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'").get() as { count: number } | undefined;
    return row?.count ?? 0;
  },

  /** PRAGMA page_count */
  getPageCount(): number {
    const row = db.prepare('PRAGMA page_count').get() as { page_count: number } | undefined;
    return row?.page_count ?? 0;
  },

  /** PRAGMA page_size */
  getPageSize(): number {
    const row = db.prepare('PRAGMA page_size').get() as { page_size: number } | undefined;
    return row?.page_size ?? 0;
  },

  /** 数据库文件大小 = page_count * page_size */
  getDatabaseSize(): number {
    return this.getPageCount() * this.getPageSize();
  },

  /** 数据库完整性检查 */
  checkIntegrity(): string {
    const rows = db.prepare('PRAGMA integrity_check').all() as Array<{ integrity_check: string }>;
    return rows[0]?.integrity_check ?? 'unknown';
  },
};