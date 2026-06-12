import { logger } from '../../utils/logger';
import { randomUUID } from 'crypto';

export interface Migration {
  id: string;
  version: number;
  name: string;
  description: string;
  up: (db: any) => Promise<void>;
  down: (db: any) => Promise<void>;
}

export interface MigrationRecord {
  id: string;
  version: number;
  name: string;
  applied_at: string;
  success: boolean;
  error_message?: string;
}

export interface MigrationResult {
  success: boolean;
  executedMigrations: number;
  currentVersion: number;
  failedVersion?: number;
  errorMessage?: string;
}

export class MigrationManager {
  private migrations: Migration[] = [];
  private db: any;

  constructor(db: any) {
    this.db = db;
    this.initMigrationTable();
  }

  private initMigrationTable(): void {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id TEXT PRIMARY KEY,
          version INTEGER NOT NULL UNIQUE,
          name TEXT NOT NULL,
          applied_at DATETIME DEFAULT (datetime('now','localtime')),
          success INTEGER NOT NULL DEFAULT 0,
          error_message TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_schema_migrations_version ON schema_migrations(version);
        CREATE INDEX IF NOT EXISTS idx_schema_migrations_success ON schema_migrations(success);
      `);
      logger.info('✅ schema_migrations table initialized');
    } catch (error) {
      logger.error('❌ Failed to initialize migration table:', error as Error);
      throw error;
    }
  }

  register(migration: Migration): void {
    const exists = this.migrations.find(m => m.version === migration.version);
    if (exists) {
      throw new Error(`Migration version ${migration.version} already exists: ${migration.name}`);
    }
    this.migrations.push(migration);
    this.migrations.sort((a, b) => a.version - b.version);
    logger.info(`📦 Registered migration: v${migration.version} - ${migration.name}`);
  }

  registerBatch(migrations: Migration[]): void {
    migrations.forEach(m => this.register(m));
  }

  getAppliedMigrations(): MigrationRecord[] {
    try {
      return this.db.prepare(`
        SELECT id, version, name, applied_at, success, error_message
        FROM schema_migrations
        ORDER BY version ASC
      `).all() as MigrationRecord[];
    } catch (error) {
      logger.error('❌ Failed to get applied migrations:', error as Error);
      return [];
    }
  }

  getCurrentVersion(): number {
    try {
      const result = this.db.prepare(`
        SELECT MAX(version) as max_version
        FROM schema_migrations
        WHERE success = 1
      `).get() as { max_version: number | null };
      return result.max_version ?? 0;
    } catch (error) {
      logger.error('❌ Failed to get current version:', error as Error);
      return 0;
    }
  }

  getPendingMigrations(): Migration[] {
    const applied = this.getAppliedMigrations()
      .filter(m => m.success)
      .map(m => m.version);
    return this.migrations.filter(m => !applied.includes(m.version));
  }

  async migrateTo(targetVersion: number): Promise<MigrationResult> {
    const currentVersion = this.getCurrentVersion();
    const pending = this.getPendingMigrations().filter(m => m.version <= targetVersion);

    if (pending.length === 0) {
      logger.info(`✅ No pending migrations to apply. Current version: v${currentVersion}`);
      return {
        success: true,
        executedMigrations: 0,
        currentVersion
      };
    }

    logger.info(`🔄 Starting migration from v${currentVersion} to v${targetVersion}`);
    logger.info(`📋 ${pending.length} pending migration(s) to apply`);

    let executedCount = 0;

    for (const migration of pending) {
      try {
        logger.info(`⬆️ Applying migration v${migration.version}: ${migration.name}`);
        
        this.db.exec('BEGIN TRANSACTION');
        
        try {
          await migration.up(this.db);
          
          // Clean up any previous failed record for this version before INSERT
          this.db.prepare('DELETE FROM schema_migrations WHERE version = ?').run(migration.version);

          this.db.prepare(`
            INSERT INTO schema_migrations (id, version, name, success)
            VALUES (?, ?, ?, 1)
          `).run(randomUUID(), migration.version, migration.name);

          this.db.exec('COMMIT');
          executedCount++;
          logger.info(`✅ Migration v${migration.version} applied successfully`);
        } catch (migrationError) {
          this.db.exec('ROLLBACK');
          logger.error(`❌ Migration v${migration.version} failed, rolling back`, migrationError as Error);

          // Remove any previous failed record for this version to allow retry
          this.db.prepare('DELETE FROM schema_migrations WHERE version = ?').run(migration.version);
          
          this.db.prepare(`
            INSERT INTO schema_migrations (id, version, name, success, error_message)
            VALUES (?, ?, ?, 0, ?)
          `).run(randomUUID(), migration.version, migration.name, String(migrationError));

          return {
            success: false,
            executedMigrations: executedCount,
            currentVersion: this.getCurrentVersion(),
            failedVersion: migration.version,
            errorMessage: String(migrationError)
          };
        }
      } catch (outerError) {
        logger.error(`❌ Unexpected error during migration v${migration.version}`, outerError as Error);
        
        // Remove any previous failed record for this version to allow retry
        try {
          this.db.prepare('DELETE FROM schema_migrations WHERE version = ?').run(migration.version);
        } catch {
          // Ignore if table doesn't exist
        }
        
        return {
          success: false,
          executedMigrations: executedCount,
          currentVersion: this.getCurrentVersion(),
          failedVersion: migration.version,
          errorMessage: String(outerError)
        };
      }
    }

    const finalVersion = this.getCurrentVersion();
    logger.info(`✅ Migration complete. Now at version v${finalVersion}`);
    
    return {
      success: true,
      executedMigrations: executedCount,
      currentVersion: finalVersion
    };
  }

  async migrate(): Promise<MigrationResult> {
    const latestVersion = this.migrations.length > 0 
      ? Math.max(...this.migrations.map(m => m.version))
      : 0;
    return this.migrateTo(latestVersion);
  }

  async rollback(steps: number = 1): Promise<MigrationResult> {
    const applied = this.getAppliedMigrations()
      .filter(m => m.success)
      .sort((a, b) => b.version - a.version)
      .slice(0, steps);

    if (applied.length === 0) {
      logger.info('✅ No migrations to rollback');
      return {
        success: true,
        executedMigrations: 0,
        currentVersion: this.getCurrentVersion()
      };
    }

    logger.info(`🔄 Rolling back ${applied.length} migration(s)...`);
    let rolledBackCount = 0;

    for (const record of applied) {
      const migration = this.migrations.find(m => m.version === record.version);
      if (!migration) {
        logger.warn(`⚠️ Migration v${record.version} not found, skipping rollback`);
        continue;
      }

      try {
        logger.info(`⬇️ Rolling back migration v${record.version}: ${record.name}`);
        
        this.db.exec('BEGIN TRANSACTION');
        
        try {
          await migration.down(this.db);
          
          this.db.prepare(`
            DELETE FROM schema_migrations
            WHERE version = ?
          `).run(record.version);

          this.db.exec('COMMIT');
          rolledBackCount++;
          logger.info(`✅ Migration v${record.version} rolled back successfully`);
        } catch (rollbackError) {
          this.db.exec('ROLLBACK');
          logger.error(`❌ Rollback v${record.version} failed`, rollbackError as Error);
          throw rollbackError;
        }
      } catch (outerError) {
        logger.error(`❌ Unexpected error during rollback v${record.version}`, outerError as Error);
        return {
          success: false,
          executedMigrations: rolledBackCount,
          currentVersion: this.getCurrentVersion(),
          failedVersion: record.version,
          errorMessage: String(outerError)
        };
      }
    }

    const finalVersion = this.getCurrentVersion();
    logger.info(`✅ Rollback complete. Now at version v${finalVersion}`);
    
    return {
      success: true,
      executedMigrations: rolledBackCount,
      currentVersion: finalVersion
    };
  }

  getStatus(): {
    currentVersion: number;
    latestVersion: number;
    pendingCount: number;
    appliedCount: number;
    totalMigrations: number;
    migrations: Array<{
      version: number;
      name: string;
      status: 'applied' | 'pending' | 'failed';
      appliedAt?: string;
    }>;
  } {
    const applied = this.getAppliedMigrations();
    const currentVersion = this.getCurrentVersion();
    const latestVersion = this.migrations.length > 0 
      ? Math.max(...this.migrations.map(m => m.version))
      : 0;

    const statusMap = new Map<number, 'applied' | 'failed'>();
    applied.forEach(m => {
      statusMap.set(m.version, m.success ? 'applied' : 'failed');
    });

    const migrationStatuses = this.migrations.map(m => ({
      version: m.version,
      name: m.name,
      status: (statusMap.get(m.version) || 'pending') as 'applied' | 'pending' | 'failed',
      appliedAt: applied.find(a => a.version === m.version)?.applied_at
    }));

    return {
      currentVersion,
      latestVersion,
      pendingCount: migrationStatuses.filter(m => m.status === 'pending').length,
      appliedCount: migrationStatuses.filter(m => m.status === 'applied').length,
      totalMigrations: this.migrations.length,
      migrations: migrationStatuses
    };
  }

  printStatus(): void {
    const status = this.getStatus();
    
    logger.info('=== Database Migration Status ===');
    logger.info(`  Current Version:  v${status.currentVersion}`);
    logger.info(`  Latest Version:   v${status.latestVersion}`);
    logger.info(`  Pending:          ${status.pendingCount}`);
    logger.info(`  Applied:          ${status.appliedCount}`);
    logger.info(`  Total:            ${status.totalMigrations}`);
    logger.info('');
    logger.info('  Migrations:');
    
    for (const m of status.migrations) {
      const marker = m.status === 'applied' ? '✅' : m.status === 'failed' ? '❌' : '⏳';
      logger.info(`    ${marker} v${m.version.toString().padStart(3)}: ${m.name}`);
    }
    logger.info('=================================');
  }
}

export function createMigrationManager(db: any): MigrationManager {
  return new MigrationManager(db);
}
