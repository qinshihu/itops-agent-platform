import type { Database } from 'better-sqlite3';

/**
 * v029_dc_room_monitor.ts
 * 给 dc_rooms 表添加实时监控列: current_temperature, current_humidity
 */
export function up(db: Database) {
  // SQLite 不支持 ADD COLUMN IF NOT EXISTS，用 try-catch 兜底
  try {
    db.exec(`ALTER TABLE dc_rooms ADD COLUMN current_temperature REAL DEFAULT NULL`);
  } catch { /* column may already exist */ }
  try {
    db.exec(`ALTER TABLE dc_rooms ADD COLUMN current_humidity REAL DEFAULT NULL`);
  } catch { /* column may already exist */ }
}

export function down(_db: Database) {
  // SQLite doesn't support DROP COLUMN in older versions
  // no-op
}

const v029DcRoomMonitor = { up, down };
export default v029DcRoomMonitor;
