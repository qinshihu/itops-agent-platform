import { Router } from 'express';
import { randomUUID } from 'crypto';
import { serverRepository } from '../../../repositories';
import { logger } from '../../../utils/logger';

const router = Router();

router.get('/', (_req, res) => {
  const groups = serverRepository.groups.list();
  res.json({ success: true, data: groups });
});

router.get('/tree', (_req, res) => {
  const groups = serverRepository.groups.listForTree() as unknown as Array<{ id: string; name: string; description: string | null; parent_id: string | null; sort_order: number; children?: unknown[] }>;

  function buildTree(parentId: string | null): Array<{ id: string; name: string; description: string | null; parent_id: string | null; sort_order: number; children?: unknown[] }> {
    return groups
      .filter((g) => (g.parent_id as string | null) === parentId)
      .map((g) => ({ ...g, children: buildTree(g.id as string) }));
  }

  res.json({ success: true, data: buildTree(null) });
});

router.post('/', (req, res) => {
  const { name, description, parent_id, sort_order } = req.body as {
    name: string;
    description?: string;
    parent_id?: string | null;
    sort_order?: number;
  };

  if (!name) {
    res.status(400).json({ success: false, error: '分组名称不能为空' });
    return;
  }

  const id = randomUUID();
  serverRepository.groups.create({ id, name, description: description || null, parent_id: parent_id || null, sort_order: sort_order || 0 });

  logger.info(`Server group created: ${name} (${id})`);
  res.json({ success: true, data: { id, name, description, parent_id, sort_order } });
});

router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { name, description, parent_id, sort_order } = req.body as {
    name?: string;
    description?: string;
    parent_id?: string | null;
    sort_order?: number;
  };

  const group = serverRepository.groups.getById(id);
  if (!group) {
    res.status(404).json({ success: false, error: '分组不存在' });
    return;
  }

  if (parent_id === id) {
    res.status(400).json({ success: false, error: '不能将分组设置为自己的子分组' });
    return;
  }

  serverRepository.groups.update(id, {
    name,
    description: description !== undefined ? description : null,
    parent_id: parent_id !== undefined ? parent_id : null,
    sort_order,
  });

  logger.info(`Server group updated: ${id}`);
  res.json({ success: true });
});

router.delete('/mapping', (req, res) => {
  const { server_id, group_id } = req.query as { server_id: string; group_id: string };

  if (!server_id || !group_id) {
    res.status(400).json({ success: false, error: '缺少 server_id 或 group_id' });
    return;
  }

  serverRepository.groups.removeMapping(server_id, group_id);
  res.json({ success: true });
});

router.get('/servers/:serverId', (req, res) => {
  const { serverId } = req.params;
  const groups = serverRepository.groups.listByServer(serverId);
  res.json({ success: true, data: groups });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;

  const group = serverRepository.groups.getById(id);
  if (!group) {
    res.status(404).json({ success: false, error: '分组不存在' });
    return;
  }

  const childrenCount = serverRepository.groups.countChildren(id);
  if (childrenCount > 0) {
    res.status(400).json({ success: false, error: '请先删除或移动子分组' });
    return;
  }

  serverRepository.groups.delete(id);

  logger.info(`Server group deleted: ${id}`);
  res.json({ success: true });
});

router.post('/:id/move', (req, res) => {
  const { id } = req.params;
  const { new_parent_id, sort_order } = req.body as {
    new_parent_id?: string | null;
    sort_order?: number;
  };

  const group = serverRepository.groups.getById(id);
  if (!group) {
    res.status(404).json({ success: false, error: '分组不存在' });
    return;
  }

  if (new_parent_id === id) {
    res.status(400).json({ success: false, error: '不能将分组移动到自身' });
    return;
  }

  serverRepository.groups.move(id, new_parent_id || null, sort_order !== undefined ? sort_order : group.sort_order);

  logger.info(`Server group moved: ${id}`);
  res.json({ success: true });
});

router.post('/mapping', (req, res) => {
  const { server_id, group_id } = req.body as { server_id: string; group_id: string };

  if (!server_id || !group_id) {
    res.status(400).json({ success: false, error: '缺少 server_id 或 group_id' });
    return;
  }

  if (!serverRepository.servers.existsById(server_id)) {
    res.status(404).json({ success: false, error: '服务器不存在' });
    return;
  }

  if (!serverRepository.groups.existsById(group_id)) {
    res.status(404).json({ success: false, error: '分组不存在' });
    return;
  }

  serverRepository.groups.addMapping(server_id, group_id);

  res.json({ success: true });
});

router.get('/groups/:groupId/servers', (req, res) => {
  const { groupId } = req.params;
  const servers = serverRepository.groups.listServersByGroup(groupId);
  res.json({ success: true, data: servers });
});

export default router;
