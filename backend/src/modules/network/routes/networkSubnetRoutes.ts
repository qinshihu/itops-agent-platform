/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { requireRole } from '../../../middleware/auth';
import { getErrorMessage } from '../../../utils/errorHelpers';
import { networkSubnetCrudService } from '../services/networkSubnetCrudService';

const router = Router();

// ==================== 子网 CRUD ====================

router.get('/', (_req: Request, res: Response) => {
  try {
    const subnets = networkSubnetCrudService.listSubnets();
    res.json({ success: true, data: subnets });
  } catch {
    res.status(500).json({ success: false, error: '获取子网列表失败' });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const subnet = networkSubnetCrudService.getSubnetById(req.params.id);
    if (!subnet) return res.status(404).json({ success: false, error: '子网不存在' });
    res.json({ success: true, data: subnet });
  } catch {
    res.status(500).json({ success: false, error: '获取子网失败' });
  }
});

router.post('/', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const result = networkSubnetCrudService.createSubnet(req.body);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({ success: true, data: result.data });
  } catch (e: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(e) || '创建子网失败' });
  }
});

router.put('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    networkSubnetCrudService.updateSubnet(req.params.id, req.body);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: '更新子网失败' });
  }
});

router.delete('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    networkSubnetCrudService.deleteSubnet(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: '删除子网失败' });
  }
});

// ==================== IP 地址管理 ====================

router.get('/:id/ips', (req: Request, res: Response) => {
  try {
    const data = networkSubnetCrudService.listSubnetIps(req.params.id, req.query as Record<string, string>);
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: '获取IP列表失败' });
  }
});

router.put('/:id/ips/:ipId', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    networkSubnetCrudService.updateIp(req.params.ipId, req.params.id, req.body);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: '更新IP失败' });
  }
});

router.post('/:id/ips/batch', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { ip_ids, ...rest } = req.body as { ip_ids: string[]; status?: string; device_name?: string; description?: string };
    const result = networkSubnetCrudService.batchUpdateIps(ip_ids, req.params.id, rest);
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({ success: true, data: { count: result.count } });
  } catch {
    res.status(500).json({ success: false, error: '批量操作失败' });
  }
});

export default router;
