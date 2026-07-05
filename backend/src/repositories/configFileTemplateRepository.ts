import db from '../models/database';

export interface ConfigFileTemplate {
  id: string;
  name: string;
  path: string;
  parser: string;
  validator?: string;
  reload_cmd?: string;
  backup_dir: string;
  description?: string;
  is_preset: number;
  created_at: string;
}

export const configFileTemplateRepository = {
  getById(id: string): ConfigFileTemplate | undefined {
    return db.prepare('SELECT * FROM config_file_templates WHERE id = ?').get(id) as ConfigFileTemplate | undefined;
  },

  create(template: ConfigFileTemplate): void {
    db.prepare(`
      INSERT INTO config_file_templates 
      (id, name, path, parser, validator, reload_cmd, backup_dir, description, is_preset, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      template.id,
      template.name,
      template.path,
      template.parser,
      template.validator ?? null,
      template.reload_cmd ?? null,
      template.backup_dir,
      template.description ?? null,
      template.is_preset,
      template.created_at
    );
  },
};