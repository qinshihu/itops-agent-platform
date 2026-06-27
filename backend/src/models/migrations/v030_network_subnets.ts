import { Database } from 'better-sqlite3';

/**
 * v030_network_subnets.ts
 * 网段管理：子网表 + IP地址分配表
 */
export function up(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS network_subnets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cidr TEXT NOT NULL,
      gateway TEXT,
      vlan_id INTEGER,
      network_type TEXT DEFAULT 'lan' CHECK(network_type IN ('lan','wan','dmz','mgmt','storage','other')),
      location TEXT,
      description TEXT,
      status TEXT DEFAULT 'active' CHECK(status IN ('active','reserved','deprecated')),
      total_ips INTEGER DEFAULT 0,
      used_ips INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS network_ips (
      id TEXT PRIMARY KEY,
      subnet_id TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      status TEXT DEFAULT 'available' CHECK(status IN ('available','used','reserved')),
      device_id TEXT,
      device_name TEXT,
      mac_address TEXT,
      description TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (subnet_id) REFERENCES network_subnets(id) ON DELETE CASCADE
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_network_ips_subnet ON network_ips(subnet_id)`);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_network_ips_unique ON network_ips(subnet_id, ip_address)`);
}

export function down(db: Database) {
  db.exec(`DROP TABLE IF EXISTS network_ips`);
  db.exec(`DROP TABLE IF EXISTS network_subnets`);
}

const v030NetworkSubnets = { up, down };
export default v030NetworkSubnets;
