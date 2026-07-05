import type { Request, Response } from 'express';
import { Router } from 'express';
import { randomUUID } from 'crypto';
import { dbConnectionRepository } from '../../../repositories';
import type { DbConnectionRecord } from '../../../repositories';
import { encrypt, decrypt } from '../../auth/services/encryptionService';
import { requireRole } from '../../../middleware/auth';
import { executeDbskiter } from '../services/dbskiterService';

const router = Router();

/** 获取所有数据库连接 */
router.get('/', (_req: Request, res: Response) => {
    try {
        const rows = dbConnectionRepository.listAll();
        const list = rows.map((r: DbConnectionRecord) => ({
            ...r,
            password: '', // 返回时抹掉密码，安全考虑
        }));
        res.json({ success: true, data: list });
    } catch (_error) {
        res.status(500).json({ success: false, error: 'Failed to get database connections' });
    }
});

/** 获取单个数据库连接 */
router.get('/:id', requireRole('admin', 'operator'), (_req: Request, res: Response) => {
    try {
        const row = dbConnectionRepository.getById(_req.params.id);
        if (!row) {
            return res.status(404).json({ success: false, error: 'Database connection not found' });
        }
        res.json({ success: true, data: { ...row, password: '' } });
    } catch (_error) {
        res.status(500).json({ success: false, error: 'Failed to get database connection' });
    }
});

/** 创建数据库连接 */
router.post('/', requireRole('admin', 'operator'), (req: Request, res: Response) => {
    try {
        const { name, db_type, host, port, username, password, database, description, tags } = req.body;
        if (!name || !host || !username || !password || !database) {
            return res.status(400).json({ success: false, error: 'Missing required fields: name, host, username, password, database' });
        }

        const id = randomUUID();
        const encryptedPassword = encrypt(password);
        dbConnectionRepository.insert({
            id,
            name,
            db_type: db_type || 'mysql',
            host,
            port: port || 3306,
            username,
            password: encryptedPassword,
            database,
            description: description ?? null,
            tags: tags ? JSON.stringify(tags) : null,
            enabled: 1,
        });

        res.json({ success: true, data: { id } });
    } catch (_error) {
        res.status(500).json({ success: false, error: 'Failed to create database connection' });
    }
});

/** 更新数据库连接 */
router.put('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
    try {
        const { name, db_type, host, port, username, password, database, description, tags, enabled } = req.body;
        const existing = dbConnectionRepository.getById(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Database connection not found' });
        }

        const encryptedPassword = password ? encrypt(password) : existing.password;
        dbConnectionRepository.update(req.params.id, {
            name: name || existing.name,
            db_type: db_type || existing.db_type,
            host: host || existing.host,
            port: port || existing.port,
            username: username || existing.username,
            password: encryptedPassword,
            database: database || existing.database,
            description: description !== undefined ? description : existing.description,
            tags: tags ? JSON.stringify(tags) : existing.tags,
            enabled: enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
        });

        res.json({ success: true, message: 'Database connection updated' });
    } catch (_error) {
        res.status(500).json({ success: false, error: 'Failed to update database connection' });
    }
});

/** 删除数据库连接 */
router.delete('/:id', requireRole('admin'), (req: Request, res: Response) => {
    try {
        dbConnectionRepository.deleteById(req.params.id);
        res.json({ success: true, message: 'Database connection deleted' });
    } catch (_error) {
        res.status(500).json({ success: false, error: 'Failed to delete database connection' });
    }
});

/** 测试数据库连接 */
router.post('/:id/test', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
    try {
        const row = dbConnectionRepository.getById(req.params.id);
        if (!row) {
            return res.status(404).json({ success: false, error: 'Database connection not found' });
        }

        let decryptedPassword: string;
        try {
            decryptedPassword = decrypt(row.password);
        } catch (_e) {
            decryptedPassword = row.password;
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

        if (result.success) {
            res.json({ success: true, message: '数据库连接成功', data: { name: row.name, host: row.host, port: row.port, database: row.database, duration: result.duration } });
        } else {
            res.status(400).json({ success: false, error: '数据库连接失败', detail: result.error || result.stderr });
        }
    } catch (_error) {
        res.status(500).json({ success: false, error: 'Failed to test connection' });
    }
});

/** 直接测试连接（不保存，用于创建前验证） */
router.post('/test-connect', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
    try {
        const { db_type, host, port, username, password, database } = req.body;
        if (!host || !username || !password || !database) {
            return res.status(400).json({ success: false, error: 'Missing required fields: host, username, password, database' });
        }

        const result = await executeDbskiter({
            connection: {
                dialect: db_type || 'mysql',
                host,
                port: port || 3306,
                user: username,
                password,
                database,
            },
            operation: 'monitor',
            subCommand: 'health',
            timeout: 15000,
        });

        if (result.success) {
            res.json({ success: true, message: '数据库连接成功', duration: result.duration });
        } else {
            res.status(400).json({ success: false, error: '数据库连接失败', detail: result.error || result.stderr });
        }
    } catch (_error) {
        res.status(500).json({ success: false, error: 'Failed to test connection' });
    }
});

export default router;
