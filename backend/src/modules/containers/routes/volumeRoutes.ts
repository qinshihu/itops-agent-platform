/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 存储卷管理 - 路由
 *
 * 关键设计（修复报告 P1-1 语义冲突）：
 *   - /volumes       操作 storage_volumes 表（LVM/NFS/Ceph/本地卷）
 *   - /docker-volumes 操作 Docker daemon 的容器卷
 */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { dockerService } from '../services/dockerService';
import { storageVolumeCrudService } from '../services/storageVolumeCrudService';
import { requireRole } from '../../../middleware/auth';
import { getErrorMessage } from '../../../utils/errorHelpers';

const router = Router();

// 列表
router.get('/', (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const search = (req.query.search as string) || '';
    const host = (req.query.host as string) || '';
    const type = (req.query.type as string) || '';

    const result = storageVolumeCrudService.listVolumes({ page, pageSize, search, host, type });
    res.json({ success: true, data: (result as { data?: unknown }).data ?? result, total: (result as { total?: number }).total });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// 详情
router.get('/:id', (req: Request, res: Response) => {
  try {
    const volume = storageVolumeCrudService.getVolumeById(req.params.id);
    if (!volume) return res.status(404).json({ success: false, error: 'Volume not found' });
    res.json({ success: true, data: volume });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// 创建
router.post('/', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { id, data } = storageVolumeCrudService.createVolume(req.body);
    res.json({ success: true, data: { id, volume: data } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// 更新
router.put('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const updated = storageVolumeCrudService.updateVolume(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// 删除
router.delete('/:id', requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    storageVolumeCrudService.deleteVolume(req.params.id);
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

// 同步（从 host 上的 Docker / 存储系统拉取元数据）
router.post('/sync', requireRole('admin', 'operator'), async (req: Request, res: Response) => {
  try {
    const { host, type } = req.body as { host?: string; type?: string };
    let synced = 0;

    if (type === 'docker' && dockerService.isAvailable()) {
      const dockerVols = await dockerService.listVolumes();
      const toCreate: Array<Record<string, unknown>> = [];
      for (const vol of dockerVols) {
        if (host && vol.labels?.['storage.host'] && vol.labels['storage.host'] !== host) continue;
        const id = `docker-${vol.name}`;
        toCreate.push({
          id, name: vol.name, driver: vol.driver,
          mount_point: vol.mountpoint, size_gb: 0, used_gb: 0,
          status: 'available', host: host || 'local',
          type: 'docker', tags: JSON.stringify(vol.labels || {}),
        });
      }
      const result = storageVolumeCrudService.syncVolumesFromDocker(toCreate);
      synced = result.added;
    }

    res.json({ success: true, message: `同步完成: 新增 ${synced} 个卷`, data: { synced } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, message: getErrorMessage(error) });
  }
});

export default router;
