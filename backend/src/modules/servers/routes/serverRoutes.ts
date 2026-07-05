import type { Request, Response } from 'express';
import { Router } from 'express';
import { serverRepository } from '../../../repositories';
import { randomUUID } from 'crypto';
import { encrypt } from '../../auth/services/encryptionService';
import { safeError } from '../../../utils/sensitiveMask';
import { validateBody, validateParams } from '../../../middleware/validation';
import { serverSchemas } from '../../../shared/schemas/apiValidation';
import { requireRole } from '../../../middleware/auth';

const router = Router();

// Get all servers
router.get('/', (_req: Request, res: Response) => {
  try {
    const servers = serverRepository.servers.list();
    const processedServers = servers.map(server => {
      const groups = serverRepository.groups.listByServer(server.id).map(g => ({ id: g.id, name: g.name }));
      return { ...server, tags: server.tags ? JSON.parse(server.tags) : [], groups };
    });
    res.json({ success: true, data: processedServers });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get servers' });
  }
});

// Get single server
router.get('/:id', validateParams(serverSchemas.serverId), (req: Request, res: Response) => {
  try {
    const server = serverRepository.servers.getById(req.params.id);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }
    const { password: _password, private_key: _private_key, ...safeServer } = server;
    res.json({
      success: true,
      data: { ...safeServer, tags: safeServer.tags ? JSON.parse(safeServer.tags) : [] }
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get server' });
  }
});

// Create server
router.post('/', validateBody(serverSchemas.createServer), requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const { name, hostname, port, username, password, private_key, use_ssh_key, description, os_type, ssh_key_id } = req.body;
    const tags = (req.body as { tags?: string[] }).tags;
    const tagsJson = tags ? JSON.stringify(tags) : null;

    const encryptedPassword = password ? encrypt(password) : null;
    const encryptedPrivateKey = private_key ? encrypt(private_key) : null;

    const id = randomUUID();
    serverRepository.servers.create({
      id, name, hostname, port: port || 22, username,
      password: encryptedPassword, private_key: encryptedPrivateKey,
      use_ssh_key: use_ssh_key ? 1 : 0, description: description || null,
      tags: tagsJson, os_type: os_type || 'linux', ssh_key_id: ssh_key_id || null
    });

    res.json({ success: true, data: { id } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create server' });
  }
});

// Update server
router.put('/:id', validateParams(serverSchemas.serverId), validateBody(serverSchemas.updateServer), requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    const server = serverRepository.servers.getById(req.params.id);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    const { name, hostname, port, username, password, private_key, use_ssh_key, description, enabled, os_type, ssh_key_id } = req.body as Record<string, string | number | boolean | undefined>;
    const tags = (req.body as { tags?: string[] }).tags;
    const tagsJson = tags ? JSON.stringify(tags) : undefined;

    let encryptedPassword: string | null | undefined;
    let encryptedPrivateKey: string | null | undefined;

    if (password !== undefined && typeof password === 'string') {
      encryptedPassword = password ? encrypt(password) : null;
    }

    if (private_key !== undefined && typeof private_key === 'string') {
      encryptedPrivateKey = private_key ? encrypt(private_key) : null;
    }

    serverRepository.servers.update(req.params.id, {
      name: name as string | undefined,
      hostname: hostname as string | undefined,
      port: port as number | undefined,
      username: username as string | undefined,
      password: encryptedPassword,
      private_key: encryptedPrivateKey,
      use_ssh_key: use_ssh_key !== undefined ? (use_ssh_key ? 1 : 0) : undefined,
      description: description as string | null | undefined,
      tags: tagsJson,
      enabled: enabled as number | undefined,
      os_type: os_type as string | undefined,
      ssh_key_id: ssh_key_id !== undefined ? (ssh_key_id as string | null) : undefined,
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update server' });
  }
});

// Delete server
router.delete('/:id', validateParams(serverSchemas.serverId), requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    serverRepository.servers.delete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete server' });
  }
});

// Get server command history
router.get('/:id/command-history', validateParams(serverSchemas.serverId), (req: Request, res: Response) => {
  try {
    const history = serverRepository.servers.listCommandHistory(req.params.id);
    res.json({ success: true, data: history });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get command history' });
  }
});

// Get compliance history
router.get('/:id/compliance-history', validateParams(serverSchemas.serverId), (req: Request, res: Response) => {
  try {
    const checks = serverRepository.servers.listComplianceChecks(req.params.id);
    res.json({ success: true, data: checks });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get compliance history' });
  }
});

// Export command history
router.get('/:id/command-history/export', validateParams(serverSchemas.serverId), (req: Request, res: Response) => {
  try {
    const serverId = req.params.id;
    const server = serverRepository.servers.getById(serverId);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }
    const history = serverRepository.servers.listCommandHistory(serverId, 0);
    const exportData = {
      server: { id: server.id, name: server.name, hostname: server.hostname, exportTime: new Date().toISOString() },
      commandHistory: history
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="command-history-${serverId}-${Date.now()}.json"`);
    res.json(exportData);
  } catch (error) {
    safeError('Failed to export command history:', error);
    res.status(500).json({ success: false, error: 'Failed to export command history' });
  }
});

// Export compliance history
router.get('/:id/compliance-history/export', validateParams(serverSchemas.serverId), (req: Request, res: Response) => {
  try {
    const serverId = req.params.id;
    const server = serverRepository.servers.getById(serverId);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }
    const checks = serverRepository.servers.listComplianceChecks(serverId, 0);
    const exportData = {
      server: { id: server.id, name: server.name, hostname: server.hostname, exportTime: new Date().toISOString() },
      complianceHistory: checks
    };
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="compliance-history-${serverId}-${Date.now()}.json"`);
    res.json(exportData);
  } catch (error: unknown) {
    safeError('Failed to export compliance history:', error);
    res.status(500).json({ success: false, error: 'Failed to export compliance history' });
  }
});

export default router;
