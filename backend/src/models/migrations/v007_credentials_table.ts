import { Migration } from './migrationFramework';
import { logger } from '../../utils/logger';

const v007CredentialsTable: Migration = {
  id: '20240101000007',
  version: 7,
  name: 'credentials_table',
  description: 'Create credentials table for encrypted API key and credential storage',

  up: async (db: any) => {
    logger.info('🔄 Creating credentials table for encrypted credential storage...');

    db.exec(`
      CREATE TABLE IF NOT EXISTS credentials (
        provider TEXT PRIMARY KEY,
        encrypted_value TEXT NOT NULL,
        key_version INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime'))
      );
    `);

    logger.info('✅ Credentials table created successfully');
  },

  down: async (db: any) => {
    logger.info('🔄 Dropping credentials table...');

    db.exec(`
      DROP TABLE IF EXISTS credentials;
    `);

    logger.info('✅ Credentials table dropped successfully');
  }
};

export default v007CredentialsTable;
