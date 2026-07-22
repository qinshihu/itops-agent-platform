/**
 * Script 路由层 CRUD 抽象（v3 报告 P1-5 第三批迁移）
 */
import { randomUUID } from 'crypto';
import { scriptsRepo } from '../../../repositories';

export const scriptCrudService = {
  // ── 查询 ──

  listScripts(filters: { category?: string; search?: string } = {}) {
    return scriptsRepo.list(filters);
  },

  listScriptCategories() {
    return scriptsRepo.listCategories();
  },

  getScriptById(id: string) {
    return scriptsRepo.getById(id);
  },

  // ── 创建 ──

  createScript(input: Record<string, unknown>) {
    const id = randomUUID();
    scriptsRepo.create({ id, ...input } as unknown as Parameters<typeof scriptsRepo.create>[0]);
    return scriptsRepo.getById(id);
  },

  // ── 更新 ──

  updateScript(id: string, input: Record<string, unknown>) {
    scriptsRepo.update(id, input as unknown as Parameters<typeof scriptsRepo.update>[1]);
    return scriptsRepo.getById(id);
  },

  // ── 删除 ──

  deleteScript(id: string): { success: true } | { success: false; error: 'not_found' } {
    const script = scriptsRepo.getById(id);
    if (!script) return { success: false, error: 'not_found' };
    scriptsRepo.delete(id);
    return { success: true };
  },
};
