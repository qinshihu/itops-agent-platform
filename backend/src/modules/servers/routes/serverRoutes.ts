/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { validateBody, validateParams } from '../../../middleware/validation';
import { serverSchemas } from '../../../shared/schemas/apiValidation';
import { requireRole } from '../../../middleware/auth';
import { serverCrudService } from '../services/serverCrudService';

const router = Router();

router.get('/', (_req: Request, res: Response) => {
  try {
    const servers = serverCrudService.listServers();
    res.json({ success: true, data: servers });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get servers' });
  }
});

router.get('/:id', validateParams(serverSchemas.serverId), (req: Request, res: Response) => {
  try {
    const server = serverCrudService.getServerById(req.params.id);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }
    res.json({ success: true, data: server });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get server' });
  }
});

router.post('/', validateBody(serverSchemas.createServer), requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const result = serverCrudService.createServer(req.body as any);
    res.json(result);
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create server' });
  }
});

router.put('/:id', validateParams(serverSchemas.serverId), validateBody(serverSchemas.updateServer), requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const result = serverCrudService.updateServer(req.params.id, req.body as any);
    if (!result.success) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update server' });
  }
});

router.delete('/:id', validateParams(serverSchemas.serverId), requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    serverCrudService.deleteServer(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete server' });
  }
});

router.get('/:id/command-history', validateParams(serverSchemas.serverId), (req: Request, res: Response) => {
  try {
    const history = serverCrudService.listCommandHistory(req.params.id);
    res.json({ success: true, data: history });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get command history' });
  }
});

router.get('/:id/compliance-history', validateParams(serverSchemas.serverId), (req: Request, res: Response) => {
  try {
    const checks = serverCrudService.listComplianceChecks(req.params.id);
    res.json({ success: true, data: checks });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get compliance history' });
  }
});

router.get('/:id/command-history/export', validateParams(serverSchemas.serverId), (req: Request, res: Response) => {
  try {
    const result = serverCrudService.exportCommandHistory(req.params.id);
    if (!result.success) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="command-history-${req.params.id}-${Date.now()}.json"`);
    res.json(result.data);
  } catch {
    res.status(500).json({ success: false, error: 'Failed to export command history' });
  }
});

router.get('/:id/compliance-history/export', validateParams(serverSchemas.serverId), (req: Request, res: Response) => {
  try {
    const result = serverCrudService.exportComplianceHistory(req.params.id);
    if (!result.success) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="compliance-history-${req.params.id}-${Date.now()}.json"`);
    res.json(result.data);
  } catch {
    res.status(500).json({ success: false, error: 'Failed to export compliance history' });
  }
});

export default router;
