import { Router, Request, Response } from 'express';
import multer from 'multer';
import { qanythingService } from '../services/qanythingService';
import { authenticateToken } from '../middleware/auth';
import { logger } from '../utils/logger';
import db from '../models/database';

const router = Router();

function maskApiKey(key: string): string {
  if (!key || key.length < 12) return key.substring(0, 4) + '****';
  return key.substring(0, 8) + '...' + key.substring(key.length - 4);
}

function validateQAnythingConfig(config: any): string | null {
  if (config.enabled) {
    if (!config.apiBase || !config.apiBase.trim()) {
      return 'API 地址不能为空';
    }
    if (!config.kbId || !config.kbId.trim()) {
      return '知识库 ID 不能为空';
    }
    if (!config.apiKey || !config.apiKey.trim()) {
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
    const setting = db.prepare(
      "SELECT value FROM settings WHERE key = 'qanything_config'"
    ).get() as { value: string } | undefined;

    if (!setting) {
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

    const config = JSON.parse(setting.value);
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

    const config = {
      enabled: enabled || false,
      apiBase: apiBase || '',
      apiKey: apiKey || '',
      kbId: kbId || '',
      mode: mode || 'cloud',
      topK: topK || 5,
    };

    const validationError = validateQAnythingConfig(config);
    if (validationError) {
      return res.status(400).json({ success: false, error: validationError });
    }

    db.prepare(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('qanything_config', ?)"
    ).run(JSON.stringify(config));

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
  } catch (error: any) {
    logger.error('Failed to upload document:', error);
    res.status(500).json({ success: false, error: error.message });
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

    const results = [];
    for (const file of files) {
      try {
        const result = await qanythingService.uploadDocument(file.buffer, file.originalname);
        results.push({
          fileName: file.originalname,
          fileId: result.fileId,
          status: result.status,
          success: true,
        });
      } catch (error: any) {
        results.push({
          fileName: file.originalname,
          success: false,
          error: error.message,
        });
      }
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
  } catch (error: any) {
    logger.error('Failed to batch upload documents:', error);
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    logger.error('Failed to get document status:', error);
    res.status(500).json({ success: false, error: error.message });
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
  } catch (error: any) {
    logger.error('Failed to delete document:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
