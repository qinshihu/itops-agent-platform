/**
 * Storage Volume 路由层 CRUD 抽象（v3 报告 P1-5 第三批迁移）
 */
import { randomUUID } from 'crypto';
import { storageVolumeRepository } from '../../../repositories';

export const storageVolumeCrudService = {
  listVolumes(filters: { page?: number; pageSize?: number; search?: string; host?: string; type?: string } = {}) {
    return storageVolumeRepository.list(filters);
  },

  getVolumeById(id: string) {
    return storageVolumeRepository.getById(id);
  },

  createVolume(data: Record<string, unknown>): { id: string; data: ReturnType<typeof storageVolumeRepository.getById> } {
    const id = randomUUID();
    storageVolumeRepository.create({ id, ...data } as Parameters<typeof storageVolumeRepository.create>[0]);
    return { id, data: storageVolumeRepository.getById(id) };
  },

  updateVolume(id: string, fields: Record<string, unknown>) {
    storageVolumeRepository.update(id, fields as Parameters<typeof storageVolumeRepository.update>[1]);
    return storageVolumeRepository.getById(id);
  },

  deleteVolume(id: string) {
    storageVolumeRepository.delete(id);
  },

  /**
   * 批量同步：从 docker 同步（跳过已存在）
   */
  syncVolumesFromDocker(items: Array<Record<string, unknown>>) {
    let added = 0;
    for (const item of items) {
      const id = (item as { id?: string }).id;
      if (id && storageVolumeRepository.getById(id)) continue;
      storageVolumeRepository.create({ id: id || randomUUID(), ...item } as Parameters<typeof storageVolumeRepository.create>[0]);
      added++;
    }
    return { added };
  },
};
