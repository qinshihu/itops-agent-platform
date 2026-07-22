/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import multer from 'multer';
import { qanythingService } from '../services/knowledge/qanythingService';
import { qanythingConfigService } from '../services/qanythingConfigService';
import { authenticateToken } from '../../../middleware/auth';
import { logger } from '../../../utils/logger';

const router = Router();

function maskApiKey(key: string | undefined): string {
  if (!key || key.length === 0) return '';
  if (key.length < 8) return key.substring(0, 2) + '****';
  if (key.length < 16) return key.substring(0, 4) + '****' + key.substring(key.length - 2);
  return key.substring(0, 8) + '...' + key.substring(key.length - 4);
}

interface QAnythingConfig {
  enabled: boolean;
  apiBase: string;
  apiKey: string;
  kbId: string;
  mode: string;
  topK: number;
}

function validateQAnythingConfig(config: QAnythingConfig): string | null {
  if (config.enabled) {
    if (!config.apiBase?.trim()) {
      return 'API 地址不能为空';
    }
    if (!config.kbId?.trim()) {
      return '知识库 ID 不能为空';
    }
    // 本地部署模式可以不要求 API Key
    if (config.mode === 'cloud' && (!config.apiKey?.trim())) {
      return 'API Key 不能为空';
    }
  }
  return null;
}

// 配置内存存储上传文件（不写入磁盘）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/markdown',
      'text/plain',
      'text/csv',
      'image/jpeg',
      'image/png',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${file.mimetype}`));
    }
  },
});

// 所有路由需要认证
router.use(authenticateToken);

/**
 * 获取 QAnything 配置
 */
router.get('/config', (req: Request, res: Response) => {
  try {
    const settingValue = qanythingConfigService.getConfig();

    if (!settingValue) {
      return res.json({
        success: true,
        data: {
          enabled: false,
          apiBase: '',
          apiKey: '',
          kbId: '',
          mode: 'cloud' as const,
          topK: 5,
        },
      });
    }

    const config = JSON.parse(settingValue);
    // 不返回完整的 API Key，只显示部分
    const maskedApiKey = config.apiKey
      ? maskApiKey(config.apiKey)
      : '';

    res.json({
      success: true,
      data: {
        ...config,
        apiKey: maskedApiKey, // 脱敏显示
      },
    });
  } catch (error) {
    logger.error('Failed to get QAnything config:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * 保存 QAnything 配置
 */
router.post('/config', (req: Request, res: Response) => {
  try {
    const { enabled, apiBase, apiKey, kbId, mode, topK } = req.body;

    // 获取已有配置中的原始 API Key
    const existingSettingValue = qanythingConfigService.getConfig();

    let originalApiKey = '';
    if (existingSettingValue) {
      try {
        const existingConfig = JSON.parse(existingSettingValue);
        originalApiKey = existingConfig.apiKey || '';
      } catch {
        // 忽略解析错误
      }
    }

    // 如果传入的 API Key 是脱敏值（包含 **** 或 ... 模式），保留原始值
    const isMasked = apiKey && (apiKey.includes('****') || apiKey.includes('...'));
    const finalApiKey = isMasked ? originalApiKey : (apiKey || '');

    const config = {
      enabled: enabled || false,
      apiBase: apiBase || '',
      apiKey: finalApiKey,
      kbId: kbId || '',
      mode: mode || 'cloud',
      topK: topK || 5,
    };

    const validationError = validateQAnythingConfig(config);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    qanythingConfigService.saveConfig(config);

    qanythingService.clearConfigCache();

    logger.info('✅ QAnything configuration saved');
    res.json({ success: true, message: '配置已保存' });
  } catch (error) {
    logger.error('Failed to save QAnything config:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * 测试 QAnything 连接
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const result = await qanythingService.testConnection();
    res.json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    logger.error('Failed to test QAnything connection:', error);
    res.status(500).json({
      success: false,
      message: (error as Error).message,
    });
  }
});

/**
 * 上传文档到 QAnything 知识库
 */
router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '未上传文件' });
    }

    const result = await qanythingService.uploadDocument(
      req.file.buffer,
      req.file.originalname
    );

    res.json({
      success: true,
      data: {
        fileId: result.fileId,
        status: result.status,
        fileName: req.file.originalname,
      },
    });
  } catch (error) {
    logger.error('Failed to upload document:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * 批量上传文档
 */
router.post('/upload-batch', upload.array('files', 10), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: '未上传文件' });
    }

    // 限制并发上传数为 3，避免内存耗尽
    const CONCURRENCY_LIMIT = 3;
    const results: any[] = [];
    
    for (let i = 0; i < files.length; i += CONCURRENCY_LIMIT) {
      const batch = files.slice(i, i + CONCURRENCY_LIMIT);
      const batchResults = await Promise.all(batch.map(async (file) => {
        try {
          const result = await qanythingService.uploadDocument(file.buffer, file.originalname);
          return {
            fileName: file.originalname,
            fileId: result.fileId,
            status: result.status,
            success: true,
          };
        } catch (error) {
          return {
            fileName: file.originalname,
            success: false,
            error: (error as Error).message,
          };
        }
      }));
      results.push(...batchResults);
    }

    res.json({
      success: true,
      data: results,
      summary: {
        total: files.length,
        success: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
      },
    });
  } catch (error) {
    logger.error('Failed to batch upload documents:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * 查询文档解析状态
 */
router.get('/document/:fileId', async (req: Request, res: Response) => {
  try {
    const result = await qanythingService.getDocumentStatus(req.params.fileId);
    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('Failed to get document status:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

/**
 * 删除文档
 */
router.delete('/document/:fileId', async (req: Request, res: Response) => {
  try {
    await qanythingService.deleteDocument(req.params.fileId);
    res.json({
      success: true,
      message: '文档已删除',
    });
  } catch (error) {
    logger.error('Failed to delete document:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
