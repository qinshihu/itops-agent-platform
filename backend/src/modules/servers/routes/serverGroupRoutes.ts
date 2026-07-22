/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from 'express';
import { validateBody, validateParams } from '../../../middleware/validation';
import { serverGroupSchemas } from '../../../shared/schemas/apiValidation';
import { serverGroupCrudService } from '../services/serverGroupCrudService';

const router = Router();

router.get('/', (_req, res) => {
  try {
    const groups = serverGroupCrudService.listGroups();
    res.json({ success: true, data: groups });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get groups' });
  }
});

router.get('/tree', (_req, res) => {
  try {
    const tree = serverGroupCrudService.getGroupTree();
    res.json({ success: true, data: tree });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get group tree' });
  }
});

router.post('/', validateBody(serverGroupSchemas.createGroup), (req, res) => {
  try {
    const result = serverGroupCrudService.createGroup(req.body);
    res.json(result);
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create group' });
  }
});

router.put('/:id', validateParams(serverGroupSchemas.groupId), validateBody(serverGroupSchemas.updateGroup), (req, res) => {
  try {
    const result = serverGroupCrudService.updateGroup(req.params.id, req.body);
    if (!result.success) {
      const status = result.error === '分组不存在' ? 404 : 400;
      return res.status(status).json({ success: false, error: result.error });
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update group' });
  }
});

router.delete('/mapping', (req, res) => {
  try {
    const { server_id, group_id } = req.query as { server_id?: string; group_id?: string };
    const result = serverGroupCrudService.removeMapping(server_id ?? '', group_id ?? '');
    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to remove mapping' });
  }
});

router.get('/servers/:serverId', (req, res) => {
  try {
    const groups = serverGroupCrudService.listGroupsByServer(req.params.serverId);
    res.json({ success: true, data: groups });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to list groups' });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const result = serverGroupCrudService.deleteGroup(req.params.id);
    if (!result.success) {
      const status = result.error === '分组不存在' ? 404 : 400;
      return res.status(status).json({ success: false, error: result.error });
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete group' });
  }
});

router.post('/:id/move', validateParams(serverGroupSchemas.groupId), validateBody(serverGroupSchemas.moveGroup), (req, res) => {
  try {
    const { new_parent_id, sort_order } = req.body as { new_parent_id?: string | null; sort_order?: number };
    const group = serverGroupCrudService.getGroupById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, error: '分组不存在' });
    }
    const result = serverGroupCrudService.moveGroup(
      req.params.id,
      new_parent_id ?? null,
      sort_order !== undefined ? sort_order : (group as { sort_order: number }).sort_order,
    );
    if (!result.success) {
      const status = result.error === '分组不存在' ? 404 : 400;
      return res.status(status).json({ success: false, error: result.error });
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to move group' });
  }
});

router.post('/mapping', validateBody(serverGroupSchemas.groupMapping), (req, res) => {
  try {
    const { server_id, group_id } = req.body as { server_id: string; group_id: string };
    const result = serverGroupCrudService.addMapping(server_id, group_id);
    if (!result.success) {
      return res.status(404).json({ success: false, error: result.error });
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to add mapping' });
  }
});

router.get('/groups/:groupId/servers', (req, res) => {
  try {
    const servers = serverGroupCrudService.listServersByGroup(req.params.groupId);
    res.json({ success: true, data: servers });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to list servers' });
  }
});

export default router;
