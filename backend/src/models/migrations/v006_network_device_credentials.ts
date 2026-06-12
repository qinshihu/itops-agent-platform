import { Migration } from './migrationFramework';
import { logger } from '../../utils/logger';

const v006NetworkDeviceCredentials: Migration = {
  id: '20240101000006',
  version: 6,
  name: 'network_device_credentials',
  description: 'Add ssh_key_id support to network_devices table for credential management',

  up: async (db: any) => {
    logger.info('🔄 Adding credential support to network_devices table...');

    // SQLite 不支持直接修改列约束，需要重建表
    db.exec(`
      CREATE TABLE network_devices_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        ip_address TEXT NOT NULL UNIQUE,
        vendor TEXT NOT NULL,
        model TEXT,
        os_version TEXT,
        ssh_port INTEGER DEFAULT 22,
        ssh_key_id TEXT,
        username TEXT,
        password TEXT,
        enable_password TEXT,
        location TEXT,
        role TEXT,
        status TEXT DEFAULT 'online',
        last_inspection_at DATETIME,
        last_inspection_result TEXT,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (ssh_key_id) REFERENCES ssh_keys(id) ON DELETE SET NULL
      );

      INSERT INTO network_devices_new (
        id, name, ip_address, vendor, model, os_version, ssh_port,
        username, password, enable_password, location, role, status,
        last_inspection_at, last_inspection_result, created_at, updated_at
      )
      SELECT
        id, name, ip_address, vendor, model, os_version, ssh_port,
        username, password, enable_password, location, role, status,
        last_inspection_at, last_inspection_result, created_at, updated_at
      FROM network_devices;

      DROP TABLE network_devices;

      ALTER TABLE network_devices_new RENAME TO network_devices;

      CREATE INDEX IF NOT EXISTS idx_network_devices_vendor ON network_devices(vendor);
      CREATE INDEX IF NOT EXISTS idx_network_devices_status ON network_devices(status);
      CREATE INDEX IF NOT EXISTS idx_network_devices_ip ON network_devices(ip_address);
      CREATE INDEX IF NOT EXISTS idx_network_devices_ssh_key ON network_devices(ssh_key_id);
    `);

    logger.info('✅ Network device credentials migration completed');
  },

  down: async (db: any) => {
    logger.info('🔄 Rolling back network_device_credentials migration...');

    db.exec(`
      CREATE TABLE network_devices_backup (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        ip_address TEXT NOT NULL UNIQUE,
        vendor TEXT NOT NULL,
        model TEXT,
        os_version TEXT,
        ssh_port INTEGER DEFAULT 22,
        username TEXT NOT NULL,
        password TEXT NOT NULL,
        enable_password TEXT,
        location TEXT,
        role TEXT,
        status TEXT DEFAULT 'online',
        last_inspection_at DATETIME,
        last_inspection_result TEXT,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime'))
      );

      INSERT INTO network_devices_backup (
        id, name, ip_address, vendor, model, os_version, ssh_port,
        username, password, enable_password, location, role, status,
        last_inspection_at, last_inspection_result, created_at, updated_at
      )
      SELECT
        id, name, ip_address, vendor, model, os_version, ssh_port,
        COALESCE(username, ''), COALESCE(password, ''), enable_password, location, role, status,
        last_inspection_at, last_inspection_result, created_at, updated_at
      FROM network_devices;

      DROP TABLE network_devices;

      ALTER TABLE network_devices_backup RENAME TO network_devices;

      CREATE INDEX IF NOT EXISTS idx_network_devices_vendor ON network_devices(vendor);
      CREATE INDEX IF NOT EXISTS idx_network_devices_status ON network_devices(status);
      CREATE INDEX IF NOT EXISTS idx_network_devices_ip ON network_devices(ip_address);
    `);

    logger.info('✅ Network device credentials rollback completed');
  }
};

export default v006NetworkDeviceCredentials;
