import { Migration } from './migrationFramework';
import { logger } from '../../utils/logger';

const v002AddApiProvider: Migration = {
  id: '20260528000001',
  version: 2,
  name: 'add_api_provider_to_agents',
  description: 'Add api_provider field to agents table to explicitly specify which LLM provider to use',
  
  up: async (db: any) => {
    // Check if api_provider column already exists (may have been added by v001 defensive ALTER TABLE)
    try {
      const columns = db.prepare("PRAGMA table_info(agents)").all();
      const columnNames = columns.map((col: any) => col.name);
      
      if (columnNames.includes('api_provider')) {
        logger.info('✅ api_provider column already exists on agents table, skipping');
        return;
      }
    } catch {
      // Table might not exist yet, proceed with ALTER TABLE
    }

    logger.info('🔄 Adding api_provider column to agents table...');

    db.exec(`
      ALTER TABLE agents ADD COLUMN api_provider TEXT DEFAULT 'doubao';
    `);

    // 为已有数据设置默认值：如果model为null或为空，设为doubao
    db.exec(`
      UPDATE agents SET api_provider = 'doubao' WHERE api_provider IS NULL;
    `);

    logger.info('✅ api_provider column added to agents table');
  },

  down: async (db: any) => {
    logger.info('🔄 Dropping api_provider column from agents table...');

    // SQLite不支持直接DROP COLUMN，需要重建表
    db.exec(`
      CREATE TABLE agents_new AS SELECT id, name, avatar, role, system_prompt, model, temperature, enabled, is_preset, category, tags, description, usage_count, last_used_at, created_at, updated_at FROM agents;
      DROP TABLE agents;
      ALTER TABLE agents_new RENAME TO agents;
    `);

    // 重建索引
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agents_category ON agents(category);
      CREATE INDEX IF NOT EXISTS idx_agents_is_preset ON agents(is_preset);
      CREATE INDEX IF NOT EXISTS idx_agents_enabled ON agents(enabled);
      CREATE INDEX IF NOT EXISTS idx_agents_usage ON agents(usage_count);
    `);

    logger.info('✅ api_provider column dropped from agents table');
  }
};

export default v002AddApiProvider;
