/**
 * Virtual Machine 路由层 CRUD 抽象（v3 报告 P1-5 第三批迁移）
 */
import { randomUUID } from 'crypto';
import { virtualMachineRepository } from '../../../repositories';

export const virtualMachineCrudService = {
  // ── 统计 ──

  countAll() {
    return virtualMachineRepository.countAll();
  },

  countByStatus() {
    return virtualMachineRepository.countByStatus();
  },

  // ── 列表 / 详情 ──

  listVms(filters: { status?: string; hypervisor?: string; search?: string; limit?: number; offset?: number } = {}) {
    return virtualMachineRepository.list(filters);
  },

  countVms(filters: { status?: string; hypervisor?: string; search?: string } = {}) {
    return virtualMachineRepository.count(filters);
  },

  getVmById(id: string) {
    return virtualMachineRepository.getById(id);
  },

  // ── 创建 ──

  createVm(input: Record<string, unknown>) {
    const id = randomUUID();
    virtualMachineRepository.insert({ id, ...input } as Parameters<typeof virtualMachineRepository.insert>[0]);
    return id;
  },

  // ── 更新 ──

  updateVm(id: string, input: Record<string, unknown>) {
    virtualMachineRepository.update(id, input);
  },

  // ── 删除 ──

  deleteVm(id: string) {
    virtualMachineRepository.deleteById(id);
  },

  // ── 状态变更 ──

  startVm(id: string) {
    virtualMachineRepository.updateStatus(id, 'running');
  },

  stopVm(id: string) {
    virtualMachineRepository.updateStatus(id, 'stopped');
  },

  restartVm(id: string) {
    virtualMachineRepository.updateStatus(id, 'running');
  },

  // ── 同步 ──

  upsertFromHypervisor(data: Record<string, unknown>) {
    virtualMachineRepository.upsertFromHypervisor(data as unknown as Parameters<typeof virtualMachineRepository.upsertFromHypervisor>[0]);
  },

  insertOrReplace(data: Record<string, unknown>) {
    virtualMachineRepository.insertOrReplace(data as unknown as Parameters<typeof virtualMachineRepository.insertOrReplace>[0]);
  },
};
