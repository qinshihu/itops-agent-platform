/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Migration } from './migrationFramework';
import { logger } from '../../utils/logger';

/**
 * Migration v059 — DC U 位多态外键 + 设备存在性 trigger
 *
 * 背景：dc_rack_slots.device_id 是多态外键
 *   device_type = 'server'          → device_id ∈ servers.id
 *   device_type = 'network_device'  → device_id ∈ network_devices.id
 *   device_type = 'vm_host'         → device_id ∈ virtual_machines.id
 *   device_type = 'pdu'/'ups'       → device_id ∈ dc_pdus.id
 *
 * SQLite 不支持多态外键。本 migration 用 3 个 trigger 模拟"插入/更新/U 位分配时验证 device 存在"
 * 和"删除 server/network_device/vm/pdu 时级联删除 U 位"
 *
 * 实际作用：
 *   - 防止 device_id 指向已删除的设备（孤儿数据）
 *   - 删除设备时自动清理对应 U 位
 */
const v059DcPolymorphicFk: Migration = {
  id: '20250101000059',
  version: 59,
  name: 'dc_polymorphic_fk',
  description: 'Polymorphic FK + device_id validation triggers for dc_rack_slots (servers/network_devices/virtual_machines/dc_pdus)',

  up: async (db: any) => {
    logger.info('🔄 Adding polymorphic FK triggers for dc_rack_slots...');

    // ── 1) 插入 U 位时验证 device 存在 ──
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_dc_rack_slots_validate_insert
      BEFORE INSERT ON dc_rack_slots
      FOR EACH ROW
      WHEN
        (NEW.device_type = 'server'
          AND NOT EXISTS (SELECT 1 FROM servers WHERE id = NEW.device_id))
        OR (NEW.device_type = 'network_device'
          AND NOT EXISTS (SELECT 1 FROM network_devices WHERE id = NEW.device_id))
        OR (NEW.device_type = 'vm_host'
          AND NOT EXISTS (SELECT 1 FROM virtual_machines WHERE id = NEW.device_id))
        OR (NEW.device_type IN ('pdu', 'ups')
          AND NOT EXISTS (SELECT 1 FROM dc_pdus WHERE id = NEW.device_id))
        OR NEW.device_type NOT IN ('server','network_device','vm_host','pdu','ups','other')
      BEGIN
        SELECT RAISE(ABORT, 'dc_rack_slots: device_id not found in corresponding table or device_type invalid');
      END;
    `);

    // ── 2) 设备删除时级联清理 U 位 ──
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_servers_delete_clear_slots
      AFTER DELETE ON servers
      FOR EACH ROW
      BEGIN
        DELETE FROM dc_rack_slots WHERE device_type = 'server' AND device_id = OLD.id;
      END;
    `);
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_network_devices_delete_clear_slots
      AFTER DELETE ON network_devices
      FOR EACH ROW
      BEGIN
        DELETE FROM dc_rack_slots WHERE device_type = 'network_device' AND device_id = OLD.id;
      END;
    `);
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_vms_delete_clear_slots
      AFTER DELETE ON virtual_machines
      FOR EACH ROW
      BEGIN
        DELETE FROM dc_rack_slots WHERE device_type = 'vm_host' AND device_id = OLD.id;
      END;
    `);
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS trg_pdus_delete_clear_slots
      AFTER DELETE ON dc_pdus
      FOR EACH ROW
      BEGIN
        DELETE FROM dc_rack_slots WHERE device_type IN ('pdu','ups') AND device_id = OLD.id;
      END;
    `);

    // ── 3) 索引优化：device_id + device_type 联合索引（已存在则跳过）──
    db.exec(`CREATE INDEX IF NOT EXISTS idx_dc_rack_slots_device ON dc_rack_slots(device_type, device_id);`);

    logger.info('✅ DC polymorphic FK triggers added');
  },

  down: async (db: any) => {
    db.exec(`DROP TRIGGER IF EXISTS trg_dc_rack_slots_validate_insert;`);
    db.exec(`DROP TRIGGER IF EXISTS trg_servers_delete_clear_slots;`);
    db.exec(`DROP TRIGGER IF EXISTS trg_network_devices_delete_clear_slots;`);
    db.exec(`DROP TRIGGER IF EXISTS trg_vms_delete_clear_slots;`);
    db.exec(`DROP TRIGGER IF EXISTS trg_pdus_delete_clear_slots;`);
    db.exec(`DROP INDEX IF EXISTS idx_dc_rack_slots_device;`);
  },
};

export default v059DcPolymorphicFk;
