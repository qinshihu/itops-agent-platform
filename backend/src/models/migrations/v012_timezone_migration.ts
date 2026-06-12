import { Migration } from './migrationFramework';

/**
 * v012 — 数据库时区迁移至 UTC+8 (Asia/Shanghai)
 *
 * 背景：之前所有 `datetime('now','localtime')` 存储的是 UTC 时间，
 * 现在切换到 Asia/Shanghai 时区。
 *
 * 操作：
 * 1. 将所有已有数据的 `created_at` / `updated_at` 时间戳 +8 小时
 * 2. `applied_at` 由 migrationFramework 自身处理
 */
const migration: Migration = {
  version: 12,
  id: '20240101000012',
  name: 'Timezone migration to UTC+8',
  description: 'Shift all existing timestamps from UTC to Asia/Shanghai (UTC+8)',
  async up(db) {
    // 获取所有带时间戳列的表
    const tables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_migrations'
      ORDER BY name
    `).all() as { name: string }[];

    let totalRows = 0;
    for (const { name: tableName } of tables) {
      // 检查表是否有 created_at 或 updated_at 列
      const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
      const tsColumns = columns
        .filter(c => c.name === 'created_at' || c.name === 'updated_at' || c.name === 'applied_at' || c.name === 'executed_at' || c.name === 'received_at' || c.name === 'started_at')
        .map(c => c.name);

      if (tsColumns.length === 0) continue;

      for (const col of tsColumns) {
        try {
          const result = db.prepare(`
            UPDATE ${tableName}
            SET ${col} = datetime(${col}, '+8 hours')
            WHERE ${col} IS NOT NULL
          `).run();
          if (result.changes > 0) {
            totalRows += result.changes;
          }
        } catch (e) {
          // 某些列可能不是文本格式，跳过
        }
      }
    }

    console.log(`[migration v012] 时区迁移完成: ${totalRows} 行已转换至 Asia/Shanghai`);
  },
  async down(db) {
    const tables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_migrations'
      ORDER BY name
    `).all() as { name: string }[];

    let totalRows = 0;
    for (const { name: tableName } of tables) {
      const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
      const tsColumns = columns
        .filter(c => c.name === 'created_at' || c.name === 'updated_at' || c.name === 'applied_at' || c.name === 'executed_at' || c.name === 'received_at' || c.name === 'started_at')
        .map(c => c.name);

      if (tsColumns.length === 0) continue;

      for (const col of tsColumns) {
        try {
          const result = db.prepare(`
            UPDATE ${tableName}
            SET ${col} = datetime(${col}, '-8 hours')
            WHERE ${col} IS NOT NULL
          `).run();
          if (result.changes > 0) {
            totalRows += result.changes;
          }
        } catch (e) {
          // skip
        }
      }
    }

    console.log(`[migration v012] 时区回退: ${totalRows} 行已转换回 UTC`);
  },
};

export default migration;
