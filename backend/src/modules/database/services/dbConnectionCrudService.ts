/**
 * 数据库连接 CRUD service（2026-07-23 补：P1-5 迁移时遗漏，routes 直访 Repository 违反 architecture.md §3.2）
 *
 * 路由层（routes/dbConnectionsRoutes.ts）现已改为只调本 service，不再 import repositories/。
 * 业务规则（密码加密/抹空/解密）与之前保持一致。
 */
import { randomUUID } from 'crypto';
import { dbConnectionRepository, type DbConnectionRecord } from '../../../repositories';
import { encrypt, decrypt } from '../../auth/services/encryptionService';
import { executeDbskiter } from './dbskiterService';

export interface DbConnectionInput {
  name: string;
  db_type?: string;
  host: string;
  port?: number;
  username: string;
  password?: string;
  database: string;
  description?: string | null;
  tags?: string[] | null;
  enabled?: boolean;
}

export interface DbConnectionPublic extends Omit<DbConnectionRecord, 'password'> {
  password: ''; // 返回时始终抹空
}

function maskPassword(rec: DbConnectionRecord): DbConnectionPublic {
  return { ...rec, password: '' };
}

export const dbConnectionCrudService = {
  listConnections(): DbConnectionPublic[] {
    return dbConnectionRepository.listAll().map(maskPassword);
  },

  getConnection(id: string): DbConnectionPublic | null {
    const row = dbConnectionRepository.getById(id);
    return row ? maskPassword(row) : null;
  },

  createConnection(input: DbConnectionInput): { id: string } {
    const id = randomUUID();
    dbConnectionRepository.insert({
      id,
      name: input.name,
      db_type: input.db_type || 'mysql',
      host: input.host,
      port: input.port || 3306,
      username: input.username,
      password: encrypt(input.password || ''),
      database: input.database,
      description: input.description ?? null,
      tags: input.tags ? JSON.stringify(input.tags) : null,
      enabled: 1,
    });
    return { id };
  },

  updateConnection(id: string, input: DbConnectionInput & { enabled?: boolean }): boolean {
    const existing = dbConnectionRepository.getById(id);
    if (!existing) return false;

    dbConnectionRepository.update(id, {
      name: input.name || existing.name,
      db_type: input.db_type || existing.db_type,
      host: input.host || existing.host,
      port: input.port || existing.port,
      username: input.username || existing.username,
      // 三态：undefined=保留旧密码 / ''=不更新（与 update 语义对齐）/ string=加密更新
      password: input.password ? encrypt(input.password) : existing.password,
      database: input.database || existing.database,
      description: input.description !== undefined ? input.description : existing.description,
      tags: input.tags ? JSON.stringify(input.tags) : existing.tags,
      enabled: input.enabled !== undefined ? (input.enabled ? 1 : 0) : existing.enabled,
    });
    return true;
  },

  deleteConnection(id: string): void {
    dbConnectionRepository.deleteById(id);
  },

  /**
   * 测试已保存的连接
   * 返回结构：{ ok: true, duration, connection: { name, host, port, database } }
   *         | { ok: false, error: 'not_found' | 'decrypt_failed' | 'connect_failed', detail? }
   */
  async testSavedConnection(
    id: string,
  ): Promise<
    | { ok: true; duration: number; connection: { name: string; host: string; port: number; database: string } }
    | { ok: false; error: 'not_found' | 'decrypt_failed' | 'connect_failed'; detail?: string }
  > {
    const row = dbConnectionRepository.getById(id);
    if (!row) return { ok: false, error: 'not_found' };

    let decryptedPassword: string;
    try {
      decryptedPassword = decrypt(row.password);
    } catch {
      return { ok: false, error: 'decrypt_failed', detail: '密码解密失败，请重新配置该数据库连接的密码' };
    }

    const result = await executeDbskiter({
      connection: {
        dialect: row.db_type,
        host: row.host,
        port: row.port,
        user: row.username,
        password: decryptedPassword,
        database: row.database,
      },
      operation: 'monitor',
      subCommand: 'health',
      timeout: 15000,
    });

    if (!result.success) {
      return { ok: false, error: 'connect_failed', detail: result.error || result.stderr };
    }
    return {
      ok: true,
      duration: result.duration,
      connection: {
        name: row.name,
        host: row.host,
        port: row.port,
        database: row.database,
      },
    };
  },

  /**
   * 直接测试连接（不保存，用于创建前验证）
   */
  async testAdHocConnection(input: {
    db_type?: string;
    host: string;
    port?: number;
    username: string;
    password: string;
    database: string;
  }): Promise<
    { ok: true; duration: number } | { ok: false; error: 'connect_failed'; detail?: string }
  > {
    const result = await executeDbskiter({
      connection: {
        dialect: input.db_type || 'mysql',
        host: input.host,
        port: input.port || 3306,
        user: input.username,
        password: input.password,
        database: input.database,
      },
      operation: 'monitor',
      subCommand: 'health',
      timeout: 15000,
    });

    if (!result.success) {
      return { ok: false, error: 'connect_failed', detail: result.error || result.stderr };
    }
    return { ok: true, duration: result.duration };
  },
};