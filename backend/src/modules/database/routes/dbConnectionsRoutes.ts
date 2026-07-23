/**
 * 数据库连接 CRUD 路由（2026-07-23 修：P1-5 迁移遗漏，改为 routes→service 抽象）
 *
 * 严格遵循 architecture.md §3.2：routes 只做参数校验 + 调 service + 返回结果，
 * 不直接 import repositories/。
 */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { requireRole } from '../../../middleware/auth';
import { logger } from '../../../utils/logger';
import { dbConnectionCrudService } from '../services/dbConnectionCrudService';

const router = Router();

/** 获取所有数据库连接（密码字段返回时抹空） */
router.get('/', (_req: Request, res: Response) => {
  try {
    const list = dbConnectionCrudService.listConnections();
    res.json({ success: true, data: list });
  } catch (error) {
    logger.error('Failed to list database connections:', error);
    res.status(500).json({ success: false, error: 'Failed to list database connections' });
  }
});

/** 获取单个数据库连接 */
router.get('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const row = dbConnectionCrudService.getConnection(req.params.id);
    if (!row) {
      return res.status(404).json({ success: false, error: 'Database connection not found' });
    }
    res.json({ success: true, data: row });
  } catch (error) {
    logger.error('Failed to get database connection:', error);
    res.status(500).json({ success: false, error: 'Failed to get database connection' });
  }
});

/** 创建数据库连接 */
router.post('/', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, db_type, host, port, username, password, database, description, tags } = req.body;
    if (!name || !host || !username || !password || !database) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, host, username, password, database',
      });
    }
    const result = dbConnectionCrudService.createConnection({
      name,
      db_type,
      host,
      port,
      username,
      password,
      database,
      description,
      tags,
    });
    res.json({ success: true, data: { id: result.id } });
  } catch (error) {
    logger.error('Failed to create database connection:', error);
    res.status(500).json({ success: false, error: 'Failed to create database connection' });
  }
});

/** 更新数据库连接 */
router.put('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, db_type, host, port, username, password, database, description, tags, enabled } =
      req.body;
    const ok = dbConnectionCrudService.updateConnection(req.params.id, {
      name,
      db_type,
      host,
      port,
      username,
      password,
      database,
      description,
      tags,
      enabled,
    });
    if (!ok) {
      return res.status(404).json({ success: false, error: 'Database connection not found' });
    }
    res.json({ success: true, message: 'Database connection updated' });
  } catch (error) {
    logger.error('Failed to update database connection:', error);
    res.status(500).json({ success: false, error: 'Failed to update database connection' });
  }
});

/** 删除数据库连接 */
router.delete('/:id', requireRole('admin'), (req: Request, res: Response) => {
  try {
    dbConnectionCrudService.deleteConnection(req.params.id);
    res.json({ success: true, message: 'Database connection deleted' });
  } catch (error) {
    logger.error('Failed to delete database connection:', error);
    res.status(500).json({ success: false, error: 'Failed to delete database connection' });
  }
});

/** 测试已保存的数据库连接 */
router.post('/:id/test', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const result = await dbConnectionCrudService.testSavedConnection(req.params.id);
    if (result.ok) {
      return res.json({
        success: true,
        message: '数据库连接成功',
        data: { name: result.connection.name, host: result.connection.host, port: result.connection.port, database: result.connection.database, duration: result.duration },
      });
    }
    if (result.error === 'not_found') {
      return res.status(404).json({ success: false, error: 'Database connection not found' });
    }
    if (result.error === 'decrypt_failed') {
      return res.status(500).json({
        success: false,
        error: '密码解密失败，请重新配置该数据库连接的密码',
        detail: result.detail,
      });
    }
    return res.status(400).json({ success: false, error: '数据库连接失败', detail: result.detail });
  } catch (error) {
    logger.error('Failed to test database connection:', error);
    res.status(500).json({ success: false, error: 'Failed to test connection' });
  }
});

/** 直接测试连接（不保存） */
router.post(
  '/test-connect',
  requireRole('admin', 'operator'),
  async (req: Request, res: Response) => {
    try {
      const { db_type, host, port, username, password, database } = req.body;
      if (!host || !username || !password || !database) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: host, username, password, database',
        });
      }
      const result = await dbConnectionCrudService.testAdHocConnection({
        db_type,
        host,
        port,
        username,
        password,
        database,
      });
      if (result.ok) {
        return res.json({ success: true, message: '数据库连接成功', duration: result.duration });
      }
      return res.status(400).json({ success: false, error: '数据库连接失败', detail: result.detail });
    } catch (error) {
      logger.error('Failed to test ad-hoc database connection:', error);
      res.status(500).json({ success: false, error: 'Failed to test connection' });
    }
  },
);

export default router;