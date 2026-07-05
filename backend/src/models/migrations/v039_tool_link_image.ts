/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Migration } from './migrationFramework';

/**
 * v017: Add image_icon column to tool_links for custom image upload
 */
const migration: Migration = {
  version: 17,
  id: '20250612170000',
  name: 'Add image_icon to tool_links',
  description: 'Adds image_icon column to tool_links table for custom icon image uploads',
  up: async (db: any) => {
    const existingColumns = db.prepare("PRAGMA table_info('tool_links')").all() as Array<{ name: string }>;
    const columnNames = existingColumns.map((c: { name: string }) => c.name);
    if (!columnNames.includes('image_icon')) {
      db.prepare("ALTER TABLE tool_links ADD COLUMN image_icon TEXT").run();
    }
  },
  down: async (_db: any) => {
    // SQLite doesn't support DROP COLUMN easily
  }
};

export default migration;
