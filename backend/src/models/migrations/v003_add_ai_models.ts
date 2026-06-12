import { Migration } from './migrationFramework';
import { logger } from '../../utils/logger';

const v003AddAIModelsTable: Migration = {
  id: '20260528000002',
  version: 3,
  name: 'add_ai_models_table',
  description: 'Add ai_models table for unified AI model pool management',
  
  up: async (db: any) => {
    logger.info('Creating ai_models table...');

    db.exec(`
      CREATE TABLE IF NOT EXISTS ai_models (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        provider_type TEXT NOT NULL,
        api_key TEXT,
        api_base TEXT,
        model_id TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        is_default INTEGER DEFAULT 0,
        tags TEXT,
        last_test_status TEXT,
        last_test_time DATETIME,
        created_at DATETIME DEFAULT (datetime('now','localtime')),
        updated_at DATETIME DEFAULT (datetime('now','localtime'))
      );

      CREATE INDEX IF NOT EXISTS idx_ai_models_enabled ON ai_models(enabled);
      CREATE INDEX IF NOT EXISTS idx_ai_models_provider ON ai_models(provider_type);
      CREATE INDEX IF NOT EXISTS idx_ai_models_sort_order ON ai_models(sort_order);
      CREATE INDEX IF NOT EXISTS idx_ai_models_default ON ai_models(is_default);
    `);

    logger.info('ai_models table created successfully');
  },

  down: async (db: any) => {
    logger.info('Dropping ai_models table...');

    db.exec(`
      DROP TABLE IF EXISTS ai_models;
    `);

    logger.info('ai_models table dropped successfully');
  }
};

export default v003AddAIModelsTable;
