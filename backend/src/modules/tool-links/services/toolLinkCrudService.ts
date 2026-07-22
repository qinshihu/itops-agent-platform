/**
 * Tool Link 路由层 CRUD 抽象（v3 报告 P1-5 第三批迁移）
 *
 * 解决问题：路由层直访 Repository 违反 architecture.md §3.2。
 * 本 service 集中：
 *   1. CRUD（list/create/update/delete/updateIcon）
 *   2. ID 生成（randomUUID）
 *
 * 注意：图标上传/存储/静态服务（multer/fs 路径）保持 routes 层（属于 IO 处理）
 *
 * 模块归属：P1-6 infra 按子域拆分阶段 6（2026-07-07）
 * 原位置：modules/infra/services/toolLinkCrudService.ts
 */
import { randomUUID } from 'crypto';
import { toolLinksRepo } from '../../../repositories';

export const toolLinkCrudService = {
  // ── 查询 ──

  listLinks() {
    return toolLinksRepo.list();
  },

  getLinkById(id: string) {
    return toolLinksRepo.getById(id);
  },

  // ── 创建 ──

  createLink(input: { name: string; url: string; description?: string; category?: string }) {
    const id = randomUUID();
    toolLinksRepo.create({ id, ...input });
    return toolLinksRepo.getById(id);
  },

  // ── 更新 ──

  updateLink(id: string, input: { name?: string; url?: string; description?: string; category?: string }): { success: true; data: unknown } | { success: false; error: string } {
    const changes = toolLinksRepo.update(id, input);
    if (changes === 0) {
      return { success: false, error: 'No fields to update' };
    }
    return { success: true, data: toolLinksRepo.getById(id) };
  },

  // ── 删除 ──

  deleteLink(id: string) {
    toolLinksRepo.delete(id);
  },

  // ── 图标（保持由 routes 接收 multer 文件，此处仅更新 DB 路径）──

  updateIcon(id: string, iconUrl: string) {
    toolLinksRepo.updateIcon(id, iconUrl);
    return toolLinksRepo.getById(id);
  },
};
