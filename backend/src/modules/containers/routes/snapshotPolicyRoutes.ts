import type { Request, Response } from 'express';
import { Router } from 'express';
import { vmSnapshotSchedulerService } from '../services/vmSnapshotSchedulerService';
import { requireRole } from '../../../middleware/auth';
import { getErrorMessage } from '../../../utils/errorHelpers';

const router = Router();

// GET / — 列出所有快照策略
router.get('/', (_req: Request, res: Response) => {
  try {
    const policies = vmSnapshotSchedulerService.listPolicies();
    // 把 total 嵌入 data.items（避免被前端 axios 拦截器剥掉兄弟字段）
    res.json({ success: true, data: { items: policies, total: policies.length } });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// GET /:id — 获取策略详情
router.get('/:id', (req: Request, res: Response) => {
  try {
    const policy = vmSnapshotSchedulerService.getPolicy(req.params.id);
    if (!policy) return res.status(404).json({ success: false, message: '策略不存在' });
    res.json({ success: true, data: policy });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// 验证 cronExpression（5 段：分 时 日 月 周）；避免 service 层静默 fallback 导致用户以为配了复杂 cron
function validateCronExpression(cron: string): { valid: boolean; reason?: string } {
  if (typeof cron !== 'string' || !cron.trim()) return { valid: false, reason: 'Cron 表达式必填' };
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) {
    return {
      valid: false,
      reason: `Cron 表达式必须为 5 段（分 时 日 月 周），当前 ${parts.length} 段`,
    };
  }
  return { valid: true };
}

// POST / — 创建策略
router.post('/', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, platformId, vmId, cronExpression, retention, snapshotMemory, enabled } = req.body;
    if (!name || !platformId || !vmId || !cronExpression) {
      return res
        .status(400)
        .json({ success: false, message: '名称、平台ID、虚拟机ID、Cron表达式必填' });
    }
    const cronCheck = validateCronExpression(cronExpression);
    if (!cronCheck.valid) {
      return res
        .status(400)
        .json({ success: false, message: `Cron 表达式非法：${cronCheck.reason}` });
    }
    const policy = vmSnapshotSchedulerService.createPolicy({
      name,
      platformId,
      vmId,
      cronExpression,
      retention: retention || 7,
      snapshotMemory: snapshotMemory !== undefined ? snapshotMemory : true,
      enabled: enabled !== undefined ? enabled : true,
    });
    res.json({ success: true, data: policy });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// PUT /:id — 更新策略
router.put('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    // 更新时也校验 cronExpression（若提供）
    if (req.body?.cronExpression !== undefined) {
      const cronCheck = validateCronExpression(req.body.cronExpression);
      if (!cronCheck.valid) {
        return res
          .status(400)
          .json({ success: false, message: `Cron 表达式非法：${cronCheck.reason}` });
      }
    }
    const policy = vmSnapshotSchedulerService.updatePolicy(req.params.id, req.body);
    res.json({ success: true, data: policy });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

// DELETE /:id — 删除策略
router.delete('/:id', requireRole('admin'), (req: Request, res: Response) => {
  try {
    vmSnapshotSchedulerService.deletePolicy(req.params.id);
    res.json({ success: true, message: '已删除' });
  } catch (err: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(err) });
  }
});

export default router;
