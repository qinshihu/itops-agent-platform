/**
 * =============================================================================
 * 配置修复 API 路由
 * =============================================================================
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { logger } from '../../../utils/logger';
import { requireRole } from '../../../middleware/auth';
import { configRepairService } from '../services/configRepairService';
import { configBackupService } from '../services/configBackupService';

const router = Router();

/**
 * 获取配置模板列表
 */
router.get('/templates', (req: Request, res: Response) => {
  try {
    const templates = configRepairService.getTemplates();
    res.json({
      success: true,
      data: templates,
    });
  } catch (error) {
    logger.error('❌ 获取模板列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取模板列表失败',
    });
  }
});

/**
 * 获取单个配置模板
 */
router.get('/templates/:templateId', (req: Request, res: Response) => {
  try {
    const template = configRepairService.getTemplate(req.params.templateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        error: '模板不存在',
      });
    }
    res.json({
      success: true,
      data: template,
    });
  } catch (error) {
    logger.error('❌ 获取模板失败:', error);
    res.status(500).json({
      success: false,
      error: '获取模板失败',
    });
  }
});

/**
 * 分析配置文件
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { deviceId, configPath, content, templateId } = req.body;

    if (!deviceId || !configPath || !content) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数',
      });
    }

    // 获取设备信息（这里简化处理）
    const _deviceName = req.body.deviceName || 'Unknown';
    const _deviceIp = req.body.deviceIp || 'Unknown';

    const analysis = await configRepairService.analyzeConfig(
      deviceId,
      configPath,
      content,
      templateId,
    );

    res.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    logger.error('❌ 分析配置失败:', error);
    res.status(500).json({
      success: false,
      error: '分析配置失败',
    });
  }
});

/**
 * 生成修复方案
 */
router.post('/plan', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const { deviceId, configPath, issues, content, _templateId } = req.body;

    if (!deviceId || !configPath || !issues || !content) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数',
      });
    }

    const deviceName = req.body.deviceName || 'Unknown';
    const deviceIp = req.body.deviceIp || 'Unknown';

    const plan = await configRepairService.generateRepairPlan(
      deviceId,
      deviceName,
      deviceIp,
      configPath,
      issues,
      content,
    );

    res.json({
      success: true,
      data: plan,
    });
  } catch (error) {
    logger.error('❌ 生成修复方案失败:', error);
    res.status(500).json({
      success: false,
      error: '生成修复方案失败',
    });
  }
});

/**
 * 执行修复
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const { deviceId, configPath, repairPlan, templateId, content, approver } = req.body;

    if (!deviceId || !configPath || !repairPlan) {
      return res.status(400).json({
        success: false,
        error: '缺少必要参数',
      });
    }

    const deviceName = req.body.deviceName || 'Unknown';
    const deviceIp = req.body.deviceIp || 'Unknown';

    // 如果有内容，先备份
    if (content) {
      await configBackupService.createBackup(deviceId, deviceName, deviceIp, configPath, content);
    }

    const record = await configRepairService.executeRepair(
      deviceId,
      deviceName,
      deviceIp,
      configPath,
      repairPlan,
      templateId,
      approver,
    );

    res.json({
      success: true,
      data: {
        recordId: record.id,
        status: record.status,
      },
    });
  } catch (error) {
    logger.error('❌ 执行修复失败:', error);
    res.status(500).json({
      success: false,
      error: '执行修复失败',
    });
  }
});

/**
 * 回滚修复
 */
router.post('/rollback', async (req: Request, res: Response) => {
  try {
    const { recordId } = req.body;

    if (!recordId) {
      return res.status(400).json({
        success: false,
        error: '缺少 recordId',
      });
    }

    const success = await configRepairService.rollbackRepair(recordId);

    res.json({
      success,
      message: success ? '回滚成功' : '回滚失败',
    });
  } catch (error) {
    logger.error('❌ 回滚修复失败:', error);
    res.status(500).json({
      success: false,
      error: '回滚修复失败',
    });
  }
});

/**
 * 获取修复记录
 */
router.get('/records/:recordId', (req: Request, res: Response) => {
  try {
    const record = configRepairService.getRepairRecord(req.params.recordId);
    if (!record) {
      return res.status(404).json({
        success: false,
        error: '记录不存在',
      });
    }
    res.json({
      success: true,
      data: record,
    });
  } catch (error) {
    logger.error('❌ 获取修复记录失败:', error);
    res.status(500).json({
      success: false,
      error: '获取修复记录失败',
    });
  }
});

/**
 * 获取修复记录列表
 */
router.get('/records', (req: Request, res: Response) => {
  try {
    const deviceId = req.query.deviceId as string | undefined;
    const limit = parseInt(req.query.limit as string) || 50;

    const records = configRepairService.listRepairRecords(deviceId, limit);
    res.json({
      success: true,
      data: records,
    });
  } catch (error) {
    logger.error('❌ 获取修复记录列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取修复记录列表失败',
    });
  }
});

/**
 * 获取备份列表
 */
router.get('/backups', (req: Request, res: Response) => {
  try {
    const deviceId = req.query.deviceId as string;
    const configPath = req.query.configPath as string | undefined;
    const limit = parseInt(req.query.limit as string) || 20;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        error: '缺少 deviceId',
      });
    }

    const backups = configBackupService.listBackups(deviceId, configPath, limit);
    res.json({
      success: true,
      data: backups,
    });
  } catch (error) {
    logger.error('❌ 获取备份列表失败:', error);
    res.status(500).json({
      success: false,
      error: '获取备份列表失败',
    });
  }
});

/**
 * 获取单个备份
 */
router.get('/backups/:backupId', (req: Request, res: Response) => {
  try {
    const backup = configBackupService.getBackup(req.params.backupId);
    if (!backup) {
      return res.status(404).json({
        success: false,
        error: '备份不存在',
      });
    }
    res.json({
      success: true,
      data: backup,
    });
  } catch (error) {
    logger.error('❌ 获取备份失败:', error);
    res.status(500).json({
      success: false,
      error: '获取备份失败',
    });
  }
});

/**
 * 从备份恢复
 */
router.post(
  '/backups/:backupId/restore',
  requireRole('admin', 'operator'),
  async (req: Request, res: Response) => {
    try {
      const result = await configBackupService.restoreBackup(req.params.backupId);
      res.json({
        success: result.success,
        data: {
          message: result.message,
        },
      });
    } catch (error) {
      logger.error('❌ 恢复备份失败:', error);
      res.status(500).json({
        success: false,
        error: '恢复备份失败',
      });
    }
  },
);

export default router;
