/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Migration } from './migrationFramework';
import { logger } from '../../utils/logger';

/**
 * Migration v058 — DC 表 CHECK 约束 + 外键
 *
 * 修复报告 §十三 P1 Bug：
 *   1) dc_rack_slots.device_type 缺 CHECK 约束（v028 注释定义但 SQL 漏写）
 *   2) dc_racks.room_id 缺 FOREIGN KEY 约束（孤儿数据风险）
 *   3) dc_pdus.rack_id 缺 FOREIGN KEY 约束
 *   4) dc_pdus.snmp_community 加密（不在本 migration 范围，单独处理）
 *
 * SQLite 不支持 ALTER TABLE ADD CONSTRAINT，所以采用"重建表"方式：
 *   1) rename old table to _backup
 *   2) create new table with constraints
 *   3) copy data
 *   4) drop _backup
 */
const v058DcConstraints: Migration = {
  id: '20250101000058',
  version: 58,
  name: 'dc_constraints',
  description: 'Add CHECK/FK constraints to DC tables (slot device_type, rack room_id, pdu rack_id)',

  up: async (db: any) => {
    logger.info('🔄 Adding CHECK/FK constraints to DC tables...');

    // ── 1) dc_rack_slots.device_type CHECK 约束（v028 漏写）──
    // SQLite 不支持 ALTER CHECK，只能用重建表
    const slotsHasCheck = (db.prepare(`
      SELECT sql FROM sqlite_master WHERE type='table' AND name='dc_rack_slots'
    `).get() as { sql: string } | undefined)?.sql || '';
    if (!slotsHasCheck.includes('CHECK')) {
      logger.info('  → Rebuilding dc_rack_slots with CHECK constraint');
      db.exec(`
        ALTER TABLE dc_rack_slots RENAME TO _dc_rack_slots_backup;

        CREATE TABLE dc_rack_slots (
          id TEXT PRIMARY KEY,
          rack_id TEXT NOT NULL,
          device_id TEXT NOT NULL,
          device_type TEXT NOT NULL CHECK(device_type IN ('server','network_device','vm_host','pdu','ups','other')),
          device_type_id TEXT,
          start_u INTEGER NOT NULL,
          end_u INTEGER NOT NULL,
          position_face TEXT DEFAULT 'front',
          notes TEXT DEFAULT '',
          created_at TEXT DEFAULT (datetime('now','localtime')),
          updated_at TEXT DEFAULT (datetime('now','localtime')),
          FOREIGN KEY (rack_id) REFERENCES dc_racks(id) ON DELETE CASCADE,
          FOREIGN KEY (device_type_id) REFERENCES device_types(id) ON DELETE SET NULL
        );

        CREATE INDEX IF NOT EXISTS idx_dc_racks_room ON dc_racks(room_id);
        CREATE INDEX IF NOT EXISTS idx_dc_rack_slots_rack ON dc_rack_slots(rack_id);
        CREATE INDEX IF NOT EXISTS idx_dc_rack_slots_device ON dc_rack_slots(device_id);

        INSERT INTO dc_rack_slots SELECT * FROM _dc_rack_slots_backup;
        DROP TABLE _dc_rack_slots_backup;
      `);
    } else {
      logger.info('  ✓ dc_rack_slots already has CHECK');
    }

    // ── 2) dc_racks.room_id FOREIGN KEY 约束 ──
    const racksHasFk = (db.prepare(`
      SELECT sql FROM sqlite_master WHERE type='table' AND name='dc_racks'
    `).get() as { sql: string } | undefined)?.sql || '';
    if (!racksHasFk.toUpperCase().includes('REFERENCES DC_ROOMS')) {
      logger.info('  → Rebuilding dc_racks with FK to dc_rooms');
      db.exec(`
        ALTER TABLE dc_racks RENAME TO _dc_racks_backup;

        CREATE TABLE dc_racks (
          id TEXT PRIMARY KEY,
          room_id TEXT NOT NULL,
          name TEXT NOT NULL,
          label TEXT DEFAULT '',
          row_number INTEGER DEFAULT 1,
          position_x REAL DEFAULT 0,
          position_z REAL DEFAULT 0,
          total_u INTEGER DEFAULT 42,
          pdu_count INTEGER DEFAULT 2,
          max_power_w REAL DEFAULT 4000,
          status TEXT DEFAULT 'normal',
          sort_order INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now','localtime')),
          updated_at TEXT DEFAULT (datetime('now','localtime')),
          FOREIGN KEY (room_id) REFERENCES dc_rooms(id) ON DELETE CASCADE
        );

        INSERT INTO dc_racks SELECT * FROM _dc_racks_backup;
        DROP TABLE _dc_racks_backup;
      `);
    } else {
      logger.info('  ✓ dc_racks already has FK to dc_rooms');
    }

    // ── 3) dc_pdus.rack_id FOREIGN KEY 约束（可选 SET NULL 以保留历史 PDU）──
    const pdusHasFk = (db.prepare(`
      SELECT sql FROM sqlite_master WHERE type='table' AND name='dc_pdus'
    `).get() as { sql: string } | undefined)?.sql || '';
    if (!pdusHasFk.toUpperCase().includes('REFERENCES DC_RACKS')) {
      logger.info('  → Rebuilding dc_pdus with FK to dc_racks (SET NULL)');
      db.exec(`
        ALTER TABLE dc_pdus RENAME TO _dc_pdus_backup;

        CREATE TABLE dc_pdus (
          id TEXT PRIMARY KEY,
          name TEXT,
          type TEXT CHECK(type IN ('pdu', 'ups')),
          status TEXT CHECK(status IN ('active', 'inactive', 'fault', 'maintenance')),
          rack_id TEXT,
          power_capacity_w REAL,
          current_load_w REAL,
          input_voltage REAL,
          output_sockets INTEGER,
          model TEXT,
          ip_address TEXT,
          snmp_community TEXT,
          notes TEXT,
          created_at TEXT DEFAULT (datetime('now','localtime')),
          updated_at TEXT DEFAULT (datetime('now','localtime')),
          FOREIGN KEY (rack_id) REFERENCES dc_racks(id) ON DELETE SET NULL
        );

        INSERT INTO dc_pdus SELECT * FROM _dc_pdus_backup;
        DROP TABLE _dc_pdus_backup;
      `);
    } else {
      logger.info('  ✓ dc_pdus already has FK to dc_racks');
    }

    logger.info('✅ DC constraints added successfully');
  },

  down: async (_db: any) => {
    // SQLite 不支持 DROP CONSTRAINT，down 仅记录意图
    logger.warn('v058 down: cannot remove CHECK/FK constraints in SQLite, manual intervention required');
  },
};

export default v058DcConstraints;
