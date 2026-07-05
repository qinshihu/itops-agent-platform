/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Migration } from './migrationFramework';
import { logger } from '../../utils/logger';

const v040AlertProviderConfigs: Migration = {
  id: '20250101000040',
  version: 40,
  name: 'alert_provider_configs',
  description: 'Add alert provider configurations table to store webhook and other provider settings',

  up: async (db: any) => {
    logger.info('🔄 Creating alert_provider_configs table...');
    
    db.exec(`
      CREATE TABLE IF NOT EXISTS alert_provider_configs (
        id TEXT PRIMARY KEY,
        provider_id TEXT NOT NULL,
        name TEXT NOT NULL,
        config TEXT,
        enabled INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_alert_provider_configs_provider_id ON alert_provider_configs(provider_id);
      CREATE INDEX IF NOT EXISTS idx_alert_provider_configs_enabled ON alert_provider_configs(enabled);
    `);

    logger.info('✅ Alert provider configs table created successfully');
  },

  down: async (db: any) => {
    logger.info('🔄 Dropping alert_provider_configs table...');
    
    db.exec(`
      DROP TABLE IF EXISTS alert_provider_configs;
    `);

    logger.info('✅ Alert provider configs table dropped successfully');
  }
};

export default v040AlertProviderConfigs;
