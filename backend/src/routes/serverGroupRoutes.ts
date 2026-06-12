import { Router } from 'express';
import { randomUUID } from 'crypto';
import db from '../models/database';
import { logger } from '../utils/logger';

const router = Router();

router.get('/', (_req, res) => {
  const groups = db.prepare(`
    SELECT sg.*, 
      (SELECT COUNT(*) FROM server_group_mapping WHERE group_id = sg.id) as server_count,
      (SELECT COUNT(*) FROM server_groups WHERE parent_id = sg.id) as children_count
    FROM server_groups sg 
    ORDER BY sg.sort_order ASC, sg.created_at ASC
  `).all();
  res.json({ success: true, data: groups });
});

router.get('/tree', (_req, res) => {
  const groups = db.prepare(`
    SELECT sg.*, 
      (SELECT COUNT(*) FROM server_group_mapping WHERE group_id = sg.id) as server_count
    FROM server_groups sg 
    ORDER BY sg.sort_order ASC, sg.created_at ASC
  `).all() as Array<Record<string, unknown>>;

  function buildTree(parentId: string | null): Array<Record<string, unknown>> {
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
  db.prepare(`
    INSERT INTO server_groups (id, name, description, parent_id, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, description || null, parent_id || null, sort_order || 0);

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

  const group = db.prepare('SELECT * FROM server_groups WHERE id = ?').get(id) as { id: string; parent_id?: string; sort_order?: number; [key: string]: unknown };
  if (!group) {
    res.status(404).json({ success: false, error: '分组不存在' });
    return;
  }

  if (parent_id === id) {
    res.status(400).json({ success: false, error: '不能将分组设置为自己的子分组' });
    return;
  }

  db.prepare(`
    UPDATE server_groups 
    SET name = COALESCE(?, name),
        description = COALESCE(?, description),
        parent_id = COALESCE(?, parent_id),
        sort_order = COALESCE(?, sort_order),
        updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(name || null, description !== undefined ? description : null, parent_id !== undefined ? parent_id : null, sort_order !== undefined ? sort_order : null, id);

  logger.info(`Server group updated: ${id}`);
  res.json({ success: true });
});

router.delete('/mapping', (req, res) => {
  const { server_id, group_id } = req.query as { server_id: string; group_id: string };

  if (!server_id || !group_id) {
    res.status(400).json({ success: false, error: '缺少 server_id 或 group_id' });
    return;
  }

  db.prepare('DELETE FROM server_group_mapping WHERE server_id = ? AND group_id = ?').run(server_id, group_id);
  res.json({ success: true });
});

router.get('/servers/:serverId', (req, res) => {
  const { serverId } = req.params;
  const groups = db.prepare(`
    SELECT sg.* FROM server_groups sg
    JOIN server_group_mapping sgm ON sg.id = sgm.group_id
    WHERE sgm.server_id = ?
    ORDER BY sg.sort_order ASC
  `).all(serverId);
  res.json({ success: true, data: groups });
});

router.delete('/:id', (req, res) => {
  const { id } = req.params;

  const group = db.prepare('SELECT * FROM server_groups WHERE id = ?').get(id) as { id: string; parent_id?: string; sort_order?: number; [key: string]: unknown };
  if (!group) {
    res.status(404).json({ success: false, error: '分组不存在' });
    return;
  }

  const childrenCount = db.prepare('SELECT COUNT(*) as count FROM server_groups WHERE parent_id = ?').get(id) as { count: number };
  if (childrenCount.count > 0) {
    res.status(400).json({ success: false, error: '请先删除或移动子分组' });
    return;
  }

  db.prepare('DELETE FROM server_group_mapping WHERE group_id = ?').run(id);
  db.prepare('DELETE FROM server_groups WHERE id = ?').run(id);

  logger.info(`Server group deleted: ${id}`);
  res.json({ success: true });
});

router.post('/:id/move', (req, res) => {
  const { id } = req.params;
  const { new_parent_id, sort_order } = req.body as {
    new_parent_id?: string | null;
    sort_order?: number;
  };

  const group = db.prepare('SELECT * FROM server_groups WHERE id = ?').get(id) as { id: string; parent_id?: string; sort_order?: number; [key: string]: unknown };
  if (!group) {
    res.status(404).json({ success: false, error: '分组不存在' });
    return;
  }

  if (new_parent_id === id) {
    res.status(400).json({ success: false, error: '不能将分组移动到自身' });
    return;
  }

  db.prepare(`
    UPDATE server_groups 
    SET parent_id = ?, sort_order = ?, updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(new_parent_id || null, sort_order !== undefined ? sort_order : group.sort_order, id);

  logger.info(`Server group moved: ${id}`);
  res.json({ success: true });
});

router.post('/mapping', (req, res) => {
  const { server_id, group_id } = req.body as { server_id: string; group_id: string };

  if (!server_id || !group_id) {
    res.status(400).json({ success: false, error: '缺少 server_id 或 group_id' });
    return;
  }

  const server = db.prepare('SELECT id FROM servers WHERE id = ?').get(server_id);
  if (!server) {
    res.status(404).json({ success: false, error: '服务器不存在' });
    return;
  }

  const group = db.prepare('SELECT id FROM server_groups WHERE id = ?').get(group_id);
  if (!group) {
    res.status(404).json({ success: false, error: '分组不存在' });
    return;
  }

  db.prepare(`
    INSERT OR IGNORE INTO server_group_mapping (server_id, group_id)
    VALUES (?, ?)
  `).run(server_id, group_id);

  res.json({ success: true });
});

router.get('/groups/:groupId/servers', (req, res) => {
  const { groupId } = req.params;
  const servers = db.prepare(`
    SELECT s.* FROM servers s
    JOIN server_group_mapping sgm ON s.id = sgm.server_id
    WHERE sgm.group_id = ?
    ORDER BY s.name ASC
  `).all(groupId);
  res.json({ success: true, data: servers });
});

export default router;
