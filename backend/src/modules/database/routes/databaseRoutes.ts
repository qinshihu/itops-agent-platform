import type { Request, Response } from 'express';
import { Router } from 'express';
// eslint-disable-next-line no-restricted-imports -- admin-only DB management, inherently needs DB access
import { getDatabaseHealthStatus, getTableIndexes, getQuerySuggestions, performMaintenance } from '../../../models/database';
import { logger } from '../../../utils/logger';
import { requireRole } from '../../../middleware/auth';

const router = Router();

// 获取数据库统计信息
router.get('/stats', requireRole('admin'), (_req: Request, res: Response) => {
  try {
    const stats = getDatabaseHealthStatus();
    res.json({ success: true, data: stats });
  } catch (error) {
    logger.error('Failed to get database stats', error as Error);
    res.status(500).json({ success: false, error: 'Failed to get database stats' });
  }
});

// 执行数据库维护操作
router.post('/maintenance', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const { operation } = req.body;
    
    if (!['vacuum', 'analyze', 'integrity_check'].includes(operation)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid operation. Must be one of: vacuum, analyze, integrity_check' 
      });
    }
    
    performMaintenance(operation as 'vacuum' | 'analyze' | 'integrity_check');
    
    res.json({ 
      success: true, 
      message: `Maintenance operation '${operation}' completed successfully` 
    });
  } catch (error) {
    logger.error('Database maintenance failed', error as Error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Maintenance failed' 
    });
  }
});

// 执行所有维护操作
router.post('/maintenance/all', requireRole('admin'), (_req: Request, res: Response) => {
  try {
    const operations: Array<'vacuum' | 'analyze' | 'integrity_check'> = ['analyze', 'integrity_check', 'vacuum'];
    const results: Array<{ operation: string; success: boolean; error?: string }> = [];
    
    for (const op of operations) {
      try {
        performMaintenance(op);
        results.push({ operation: op, success: true });
      } catch (error) {
        results.push({ 
          operation: op, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }
    
    const allSuccess = results.every(r => r.success);
    
    res.json({ 
      success: allSuccess, 
      message: allSuccess ? 'All maintenance operations completed' : 'Some operations failed',
      data: results
    });
  } catch (error) {
    logger.error('Failed to execute all maintenance operations', error as Error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to execute maintenance' 
    });
  }
});

// 获取所有表的索引信息
router.get('/indexes', requireRole('admin'), (_req: Request, res: Response) => {
  try {
    const indexes = getTableIndexes();
    res.json({ success: true, data: indexes });
  } catch (error) {
    logger.error('Failed to get table indexes', error as Error);
    res.status(500).json({ success: false, error: 'Failed to get table indexes' });
  }
});

// 获取查询优化建议
router.get('/suggestions', requireRole('admin'), (_req: Request, res: Response) => {
  try {
    const suggestions = getQuerySuggestions();
    res.json({ success: true, data: suggestions });
  } catch (error) {
    logger.error('Failed to get query suggestions', error as Error);
    res.status(500).json({ success: false, error: 'Failed to get query suggestions' });
  }
});

export default router;
