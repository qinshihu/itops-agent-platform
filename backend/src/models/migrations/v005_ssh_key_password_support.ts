import { Migration } from './migrationFramework';
import { logger } from '../../utils/logger';

const v005SSHKeyPasswordSupport: Migration = {
  id: '20240101000005',
  version: 5,
  name: 'ssh_key_password_support',
  description: 'Add username/password support to ssh_keys table for network device authentication',

  up: async (db: any) => {
    logger.info('🔄 Adding password credential support to ssh_keys table...');

    // SQLite 不支持直接修改列约束，需要重建表
    db.exec(`
      CREATE TABLE ssh_keys_new (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        auth_type TEXT DEFAULT 'key',
        key_type TEXT,
        fingerprint TEXT,
        username TEXT,
        password TEXT,
        private_key TEXT,
        passphrase TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO ssh_keys_new (id, name, auth_type, key_type, fingerprint, private_key, passphrase, description, created_at, updated_at)
      SELECT id, name, 'key', key_type, fingerprint, private_key, NULL, description, created_at, updated_at
      FROM ssh_keys;

      DROP TABLE ssh_keys;

      ALTER TABLE ssh_keys_new RENAME TO ssh_keys;

      CREATE INDEX IF NOT EXISTS idx_ssh_keys_name ON ssh_keys(name);
      CREATE INDEX IF NOT EXISTS idx_ssh_keys_auth_type ON ssh_keys(auth_type);
    `);

    logger.info('✅ SSH key password support migration completed');
  },

  down: async (db: any) => {
    logger.info('🔄 Rolling back ssh_key_password_support migration...');

    // 回滚：重建表，恢复 private_key NOT NULL
    db.exec(`
      CREATE TABLE ssh_keys_backup (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        key_type TEXT NOT NULL,
        fingerprint TEXT,
        private_key TEXT NOT NULL,
        passphrase TEXT,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO ssh_keys_backup (id, name, key_type, fingerprint, private_key, passphrase, description, created_at, updated_at)
      SELECT id, name, COALESCE(key_type, 'unknown'), fingerprint, COALESCE(private_key, ''), passphrase, description, created_at, updated_at
      FROM ssh_keys;

      DROP TABLE ssh_keys;

      ALTER TABLE ssh_keys_backup RENAME TO ssh_keys;

      CREATE INDEX IF NOT EXISTS idx_ssh_keys_name ON ssh_keys(name);
    `);

    logger.info('✅ SSH key password support rollback completed');
  }
};

export default v005SSHKeyPasswordSupport;
