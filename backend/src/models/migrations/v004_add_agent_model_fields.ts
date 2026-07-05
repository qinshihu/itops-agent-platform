/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Migration } from './migrationFramework';
import { logger } from '../../utils/logger';

const v004AddAgentModelFields: Migration = {
  id: '20260528000003',
  version: 4,
  name: 'add_agent_model_fields',
  description: 'Add primary_model_id and fallback_model_id to agents table',
  
  up: async (db: any) => {
    logger.info('Adding primary_model_id and fallback_model_id to agents table...');

    db.exec(`
      ALTER TABLE agents ADD COLUMN primary_model_id TEXT;
      ALTER TABLE agents ADD COLUMN fallback_model_id TEXT;
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agents_primary_model ON agents(primary_model_id);
      CREATE INDEX IF NOT EXISTS idx_agents_fallback_model ON agents(fallback_model_id);
    `);

    logger.info('Agent model fields added successfully');
  },

  down: async (db: any) => {
    logger.info('Removing primary_model_id and fallback_model_id from agents table...');

    db.exec(`
      CREATE TABLE agents_new AS SELECT id, name, avatar, role, system_prompt, model, temperature, enabled, is_preset, category, tags, description, usage_count, last_used_at, created_at, updated_at, api_provider FROM agents;
      DROP TABLE agents;
      ALTER TABLE agents_new RENAME TO agents;
    `);

    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agents_category ON agents(category);
      CREATE INDEX IF NOT EXISTS idx_agents_is_preset ON agents(is_preset);
      CREATE INDEX IF NOT EXISTS idx_agents_enabled ON agents(enabled);
      CREATE INDEX IF NOT EXISTS idx_agents_usage ON agents(usage_count);
    `);

    logger.info('Agent model fields removed successfully');
  }
};

export default v004AddAgentModelFields;
