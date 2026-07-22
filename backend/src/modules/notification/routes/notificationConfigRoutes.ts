import type { Request, Response } from 'express';
import { Router } from 'express';
import { logger } from '../../../utils/logger';
import { requireRole } from '../../../middleware/auth';
import { notificationConfigService } from '../services/notificationConfigService';
import { notificationChannelTestService } from '../services/notificationChannelTestService';

const router = Router();

// 获取通知配置
router.get('/', requireRole('admin'), async (_req: Request, res: Response) => {
  try {
    const config = notificationConfigService.getNotificationConfig();
    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('获取通知配置失败:', error);
    res.status(500).json({ success: false, error: '获取通知配置失败' });
  }
});

// 测试通知渠道
router.post('/test/:channel', requireRole('admin'), async (req: Request, res: Response) => {
  const { channel } = req.params;

  try {
    const result = await notificationChannelTestService.testNotificationChannel(channel, req.body);

    if (result.unknown) {
      return res.status(400).json({ success: false, error: result.error });
    }
    if (!result.success) {
      // 参数缺失（SMTP/URL）返回 400，发送失败返回 500
      const status = result.error?.includes('不能为空') ? 400 : 500;
      return res.status(status).json({ success: false, error: result.error });
    }
    return res.json({ success: true, message: result.message });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    logger.error(`通知渠道测试失败 [${channel}]:`, error as Error);
    return res.status(500).json({ success: false, error: `测试失败: ${msg}` });
  }
});

// 更新通知配置
router.put('/', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    notificationConfigService.updateNotificationConfig(req.body);
    res.json({ success: true, message: '通知配置已更新' });
  } catch (error) {
    logger.error('更新通知配置失败:', error);
    res.status(500).json({ success: false, error: '更新通知配置失败' });
  }
});

export default router;