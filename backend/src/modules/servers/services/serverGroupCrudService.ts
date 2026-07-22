/**
 * Server Group 路由层 CRUD 抽象（v3 报告 P1-5 第二批迁移）
 *
 * 解决问题：路由层直访 Repository 违反 architecture.md §3.2。
 * 本 service 集中处理：
 *   1. 树形结构（parent_id 校验、循环引用检测）
 *   2. CRUD（创建/更新/删除）
 *   3. 服务器-分组映射（多对多）
 *   4. 删除前的"无子分组"前置校验
 */
import { randomUUID } from 'crypto';
import { serverRepository } from '../../../repositories';
import { logger } from '../../../utils/logger';

export type ServerGroupTreeNode = {
  id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  sort_order: number;
  children?: ServerGroupTreeNode[];
};

function buildTree(groups: Array<{ id: string; name: string; description: string | null; parent_id: string | null; sort_order: number }>, parentId: string | null): ServerGroupTreeNode[] {
  return groups
    .filter((g) => g.parent_id === parentId)
    .map((g) => ({ ...g, children: buildTree(groups, g.id) }));
}

export const serverGroupCrudService = {
  // ── 查询 ──

  listGroups() {
    return serverRepository.groups.list();
  },

  getGroupById(id: string) {
    return serverRepository.groups.getById(id);
  },

  /**
   * 获取完整树形结构
   */
  getGroupTree(): ServerGroupTreeNode[] {
    const groups = serverRepository.groups.listForTree() as unknown as Array<{
      id: string; name: string; description: string | null; parent_id: string | null; sort_order: number;
    }>;
    return buildTree(groups, null);
  },

  listGroupsByServer(serverId: string) {
    return serverRepository.groups.listByServer(serverId);
  },

  listServersByGroup(groupId: string) {
    return serverRepository.groups.listServersByGroup(groupId);
  },

  // ── 创建 ──

  createGroup(input: {
    name: string;
    description?: string | null;
    parent_id?: string | null;
    sort_order?: number;
  }): { success: true; data: { id: string; name: string; description: string | null; parent_id: string | null; sort_order: number } } {
    const id = randomUUID();
    serverRepository.groups.create({
      id,
      name: input.name,
      description: input.description ?? null,
      parent_id: input.parent_id ?? null,
      sort_order: input.sort_order ?? 0,
    });
    logger.info(`Server group created: ${input.name} (${id})`);
    return {
      success: true,
      data: {
        id,
        name: input.name,
        description: input.description ?? null,
        parent_id: input.parent_id ?? null,
        sort_order: input.sort_order ?? 0,
      },
    };
  },

  // ── 更新 ──

  updateGroup(id: string, input: {
    name?: string;
    description?: string | null;
    parent_id?: string | null;
    sort_order?: number;
  }): { success: true } | { success: false; error: string } {
    const group = serverRepository.groups.getById(id);
    if (!group) return { success: false, error: '分组不存在' };
    if (input.parent_id === id) return { success: false, error: '不能将分组设置为自己的子分组' };

    serverRepository.groups.update(id, {
      name: input.name,
      description: input.description !== undefined ? input.description : null,
      parent_id: input.parent_id !== undefined ? input.parent_id : null,
      sort_order: input.sort_order,
    });
    logger.info(`Server group updated: ${id}`);
    return { success: true };
  },

  /**
   * 移动分组到新父节点（保护：不能移到自己）
   */
  moveGroup(id: string, newParentId: string | null, sortOrder: number): { success: true } | { success: false; error: string } {
    const group = serverRepository.groups.getById(id);
    if (!group) return { success: false, error: '分组不存在' };
    if (newParentId === id) return { success: false, error: '不能将分组移动到自身' };
    serverRepository.groups.move(id, newParentId, sortOrder);
    logger.info(`Server group moved: ${id}`);
    return { success: true };
  },

  // ── 删除 ──

  deleteGroup(id: string): { success: true } | { success: false; error: string } {
    const group = serverRepository.groups.getById(id);
    if (!group) return { success: false, error: '分组不存在' };
    if (serverRepository.groups.countChildren(id) > 0) {
      return { success: false, error: '请先删除或移动子分组' };
    }
    serverRepository.groups.delete(id);
    logger.info(`Server group deleted: ${id}`);
    return { success: true };
  },

  // ── 映射 ──

  addMapping(serverId: string, groupId: string): { success: true } | { success: false; error: string } {
    if (!serverRepository.servers.existsById(serverId)) {
      return { success: false, error: '服务器不存在' };
    }
    if (!serverRepository.groups.existsById(groupId)) {
      return { success: false, error: '分组不存在' };
    }
    serverRepository.groups.addMapping(serverId, groupId);
    return { success: true };
  },

  removeMapping(serverId: string, groupId: string): { success: true } | { success: false; error: string } {
    if (!serverId || !groupId) {
      return { success: false, error: '缺少 server_id 或 group_id' };
    }
    serverRepository.groups.removeMapping(serverId, groupId);
    return { success: true };
  },
};
