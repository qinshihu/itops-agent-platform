/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Database } from 'better-sqlite3';

/**
 * v032_device_types.ts
 * 设备型号表 — 参考 NetBox dcim.DeviceType
 * 定义具体设备型号的规格：高度(U)、深度、功耗、子设备角色等
 * 当创建设备实例时，自动从此模板继承槽位定义和默认配置
 */
export function up(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS device_types (
      id TEXT PRIMARY KEY,
      manufacturer_id TEXT NOT NULL,
      model TEXT NOT NULL,
      slug TEXT NOT NULL,
      part_number TEXT DEFAULT '',
      u_height REAL DEFAULT 1 CHECK(u_height > 0),
      is_full_depth INTEGER DEFAULT 1,
      subdevice_role TEXT DEFAULT NULL CHECK(subdevice_role IS NULL OR subdevice_role IN ('parent','child')),
      airflow TEXT DEFAULT 'front-to-rear' CHECK(airflow IN ('front-to-rear','rear-to-front','left-to-right','passive')),
      weight_kg REAL DEFAULT NULL,
      max_power_w REAL DEFAULT NULL,
      front_image_url TEXT DEFAULT '',
      rear_image_url TEXT DEFAULT '',
      description TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (manufacturer_id) REFERENCES device_manufacturers(id) ON DELETE RESTRICT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_device_types_manufacturer_model
      ON device_types(manufacturer_id, model);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_device_types_manufacturer_slug
      ON device_types(manufacturer_id, slug);
  `);

  // 给 dc_rack_slots 增加 device_type_id 外键（幂等）
  const colInfo = db.prepare(
    "SELECT COUNT(*) as cnt FROM pragma_table_info('dc_rack_slots') WHERE name = 'device_type_id'"
  ).get() as any;
  if (colInfo?.cnt === 0) {
    db.exec(`
      ALTER TABLE dc_rack_slots ADD COLUMN device_type_id TEXT REFERENCES device_types(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_dc_rack_slots_device_type ON dc_rack_slots(device_type_id);
    `);
  }

  // 预置常见型号
  db.exec(`
    INSERT OR IGNORE INTO device_types (id, manufacturer_id, model, slug, part_number, u_height, is_full_depth, max_power_w) VALUES
      -- Dell PowerEdge
      ('dt-dell-r750', 'mfg-dell', 'PowerEdge R750', 'poweredge-r750', 'E03S', 2, 1, 2400),
      ('dt-dell-r740', 'mfg-dell', 'PowerEdge R740', 'poweredge-r740', 'E14S', 2, 1, 2000),
      ('dt-dell-r650', 'mfg-dell', 'PowerEdge R650', 'poweredge-r650', 'E00S', 1, 1, 1800),
      ('dt-dell-r450', 'mfg-dell', 'PowerEdge R450', 'poweredge-r450', 'E05S', 1, 1, 1200),
      -- HPE ProLiant
      ('dt-hpe-dl380', 'mfg-hpe', 'ProLiant DL380 Gen10', 'dl380-gen10', 'P06478-B21', 2, 1, 1600),
      ('dt-hpe-dl360', 'mfg-hpe', 'ProLiant DL360 Gen10', 'dl360-gen10', 'P06477-B21', 1, 1, 1200),
      -- Huawei
      ('dt-huawei-1288h', 'mfg-huawei', 'TaiShan 1288H', 'taishan-1288h', '1288H', 1, 1, 1200),
      ('dt-huawei-2288h', 'mfg-huawei', 'TaiShan 2288H', 'taishan-2288h', '2288H', 2, 1, 2000),
      -- Inspur
      ('dt-inspur-nf5280', 'mfg-inspur', 'NF5280M6', 'nf5280m6', 'NF5280M6', 2, 1, 2000),
      ('dt-inspur-nf5270', 'mfg-inspur', 'NF5270M6', 'nf5270m6', 'NF5270M6', 2, 1, 1800),
      -- Cisco
      ('dt-cisco-c9300', 'mfg-cisco', 'Catalyst 9300', 'catalyst-9300', 'C9300-48P', 1, 1, 715),
      ('dt-cisco-c9500', 'mfg-cisco', 'Catalyst 9500', 'catalyst-9500', 'C9500-40X', 1, 1, 800),
      -- 网络设备
      ('dt-huawei-ce6850', 'mfg-huawei', 'CE6850-48S4Q-EI', 'ce6850-48s4q-ei', 'CE6850', 1, 1, 350),
      ('dt-h3c-s6805', 'mfg-h3c', 'S6805-54QT', 's6805-54qt', 'S6805', 1, 1, 450),
      -- PDU
      ('dt-pdu-basic', 'mfg-zyxel', 'Basic PDU 32A', 'basic-pdu-32a', 'PDU-32A', 0, 0, 0),
      -- UPS
      ('dt-ups-3kva', 'mfg-sugon', 'UPS 3kVA', 'ups-3kva', 'UPS-3K', 2, 1, 2700);
  `);
}

export function down(db: Database) {
  db.exec('DROP TABLE IF EXISTS device_types');
}
