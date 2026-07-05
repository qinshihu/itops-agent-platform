/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Migration } from './migrationFramework';

/**
 * v016: 创建数据库连接管理表
 *
 * 功能描述：存储外部数据库连接信息，供数据库运维 Agent 调用 dbskiter 使用。
 *
 * 字段说明：
 * - id: 数据库连接唯一标识
 * - name: 连接名称（展示用）
 * - db_type: 数据库类型（mysql, postgresql, oracle, sqlite）
 * - host: 数据库主机地址
 * - port: 数据库端口
 * - username: 数据库用户名
 * - password: 数据库密码（加密存储）
 * - database: 数据库名称（即 --database 参数）
 * - description: 连接描述
 * - tags: 标签（JSON 数组）
 * - enabled: 是否启用
 * - created_at / updated_at: 时间戳
 */
const migration: Migration = {
    version: 16,
    id: '20250612000016',
    name: 'Create databases table for external DB connections',
    description: 'Creates the databases table to store connection info for dbskiter',
    up: async (db: any) => {
        db.exec(`
            CREATE TABLE IF NOT EXISTS databases (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                db_type TEXT NOT NULL DEFAULT 'mysql',
                host TEXT NOT NULL,
                port INTEGER DEFAULT 3306,
                username TEXT NOT NULL,
                password TEXT NOT NULL,
                database TEXT NOT NULL,
                description TEXT,
                tags TEXT,
                enabled INTEGER DEFAULT 1,
                created_at DATETIME DEFAULT (datetime('now','localtime')),
                updated_at DATETIME DEFAULT (datetime('now','localtime'))
            );

            CREATE INDEX IF NOT EXISTS idx_databases_enabled ON databases(enabled);
            CREATE INDEX IF NOT EXISTS idx_databases_name ON databases(name);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_databases_name_unique ON databases(name);
        `);
    },
    down: async (db: any) => {
        db.exec('DROP TABLE IF EXISTS databases;');
    }
};

export default migration;
