/**
 * vmMigrationApi 对象（2026-07-21 拆分）
 * 把原 api.ts L817-846 的虚拟机迁移 API 抽出
 *
 * 2026-07-21 工作区新增功能（未提交到 git HEAD），拆分时按 §3.3.1 原则保留全部代码
 */
import api from '@/lib/api';
import type { VmMigration, VmMigrationInput } from './types';

export const vmMigrationApi = {
  /** 列出迁移任务（可按 vmId 过滤） */
  async listMigrations(vmId?: string): Promise<VmMigration[]> {
    const { data } = await api.get('/vm-migrations', {
      params: vmId ? { vmId } : undefined,
    });
    return data.data || [];
  },

  /** 列出正在进行的迁移 */
  async listActiveMigrations(): Promise<VmMigration[]> {
    const { data } = await api.get('/vm-migrations/active');
    return data.data || [];
  },

  /** 获取迁移详情 */
  async getMigration(id: string): Promise<VmMigration> {
    const { data } = await api.get(`/vm-migrations/${id}`);
    return data.data;
  },

  /** 启动迁移 */
  async startMigration(input: VmMigrationInput): Promise<VmMigration> {
    const { data } = await api.post('/vm-migrations', input);
    return data.data;
  },

  /** 取消迁移 */
  async cancelMigration(id: string): Promise<void> {
    await api.post(`/vm-migrations/${id}/cancel`);
  },
};
