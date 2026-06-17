import { Migration } from './migrationFramework';
import { logger } from '../../utils/logger';

const v007FixUsersIdType: Migration = {
  id: '20240101000007',
  version: 7,
  name: 'fix_users_id_type',
  description: 'Change users.id from INTEGER to TEXT to support UUID values consistently',

  up: async (db: any) => {
    logger.info('🔄 Migrating users.id from INTEGER to TEXT...');

    db.exec(`
      CREATE TABLE users_new (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT,
        role TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        password_must_change INTEGER DEFAULT 0,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until DATETIME,
        last_failed_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO users_new (
        id, username, password, email, role, enabled,
        password_must_change, failed_login_attempts, locked_until,
        last_failed_login, created_at, updated_at
      )
      SELECT
        CASE
          WHEN typeof(id) = 'integer' THEN CAST(id AS TEXT)
          ELSE id
        END,
        username, password, email, role, enabled,
        password_must_change, failed_login_attempts, locked_until,
        last_failed_login, created_at, updated_at
      FROM users;

      DROP TABLE users;

      ALTER TABLE users_new RENAME TO users;

      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    `);

    logger.info('✅ users.id type migration completed (INTEGER → TEXT)');
  },

  down: async (db: any) => {
    logger.info('🔄 Rolling back users.id type migration...');

    db.exec(`
      CREATE TABLE users_backup (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT,
        role TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        password_must_change INTEGER DEFAULT 0,
        failed_login_attempts INTEGER DEFAULT 0,
        locked_until DATETIME,
        last_failed_login DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO users_backup (
        username, password, email, role, enabled,
        password_must_change, failed_login_attempts, locked_until,
        last_failed_login, created_at, updated_at
      )
      SELECT
        username, password, email, role, enabled,
        password_must_change, failed_login_attempts, locked_until,
        last_failed_login, created_at, updated_at
      FROM users;

      DROP TABLE users;

      ALTER TABLE users_backup RENAME TO users;

      CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
    `);

    logger.info('✅ users.id type rollback completed (TEXT → INTEGER)');
  }
};

export default v007FixUsersIdType;
