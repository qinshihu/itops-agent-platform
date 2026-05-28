import { MigrationManager, Migration } from './migrationFramework';
import v001InitialSchema from './v001_initial_schema';

export const ALL_MIGRATIONS: Migration[] = [
  v001InitialSchema,
];

export function createMigrationManager(db: any): MigrationManager {
  const manager = new MigrationManager(db);
  manager.registerBatch(ALL_MIGRATIONS);
  return manager;
}

export { MigrationManager } from './migrationFramework';
export type { Migration, MigrationRecord, MigrationResult } from './migrationFramework';
