import { Router, Request, Response } from 'express';
import db from '../models/database';
import { randomUUID } from 'crypto';
import { encrypt } from '../services/encryptionService';
import { safeError } from '../utils/sensitiveMask';
import { validateBody, validateParams } from '../middleware/validation';
import { serverSchemas } from '../schemas/apiValidation';
import { requireRole } from '../middleware/auth';

const router = Router();

// Get all servers
router.get('/', (_req: Request, res: Response) => {
  try {
    const servers = db.prepare('SELECT * FROM servers ORDER BY created_at DESC').all();
    const processedServers = (servers as Array<{ id: string; tags?: string; [key: string]: unknown }>).map(server => {
      const groups = db.prepare(
        `SELECT sg.id, sg.name FROM server_groups sg
         JOIN server_group_mapping sgm ON sg.id = sgm.group_id
         WHERE sgm.server_id = ?`
      ).all(server.id);
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
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }
    const { password: _password, private_key: _private_key, ...safeServer } = server as { password?: string; private_key?: string; tags?: string; [key: string]: unknown };
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
    const tags = (req.body as Record<string, unknown>).tags;
    const tagsJson = tags ? JSON.stringify(tags) : null;

    const encryptedPassword = password ? encrypt(password) : null;
    const encryptedPrivateKey = private_key ? encrypt(private_key) : null;

    const id = randomUUID();
    db.prepare(
      `INSERT INTO servers (id, name, hostname, port, username, password, private_key, use_ssh_key, description, tags, os_type, ssh_key_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, name, hostname, port || 22, username, encryptedPassword, encryptedPrivateKey, use_ssh_key ? 1 : 0, description || null, tagsJson, os_type || 'linux', ssh_key_id || null);

    res.json({ success: true, data: { id } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create server' });
  }
});

// Update server
router.put('/:id', validateParams(serverSchemas.serverId), validateBody(serverSchemas.updateServer), (req: Request, res: Response) => {
  try {
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(req.params.id);
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }

    const { name, hostname, port, username, password, private_key, use_ssh_key, description, enabled, os_type, ssh_key_id } = req.body as Record<string, unknown>;
    const tags = (req.body as Record<string, unknown>).tags;
    const tagsJson = tags ? JSON.stringify(tags) : undefined;

    let encryptedPassword: string | null | undefined;
    let encryptedPrivateKey: string | null | undefined;

    if (password !== undefined && typeof password === 'string') {
      encryptedPassword = password ? encrypt(password) : null;
    }

    if (private_key !== undefined && typeof private_key === 'string') {
      encryptedPrivateKey = private_key ? encrypt(private_key) : null;
    }

    db.prepare(
      `UPDATE servers
       SET name = COALESCE(?, name),
           hostname = COALESCE(?, hostname),
           port = COALESCE(?, port),
           username = COALESCE(?, username),
           password = CASE WHEN ? IS NOT NULL THEN ? ELSE password END,
           private_key = CASE WHEN ? IS NOT NULL THEN ? ELSE private_key END,
           use_ssh_key = COALESCE(?, use_ssh_key),
           description = COALESCE(?, description),
           tags = COALESCE(?, tags),
           enabled = COALESCE(?, enabled),
           os_type = COALESCE(?, os_type),
           ssh_key_id = COALESCE(?, ssh_key_id),
           updated_at = datetime('now','localtime')
       WHERE id = ?`
    ).run(
      name, hostname, port, username,
      password !== undefined ? encryptedPassword : undefined,
      password !== undefined ? encryptedPassword : undefined,
      private_key !== undefined ? encryptedPrivateKey : undefined,
      private_key !== undefined ? encryptedPrivateKey : undefined,
      use_ssh_key !== undefined ? (use_ssh_key ? 1 : 0) : undefined,
      description, tagsJson, enabled, os_type, ssh_key_id !== undefined ? ssh_key_id : undefined, req.params.id
    );

    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update server' });
  }
});

// Delete server
router.delete('/:id', validateParams(serverSchemas.serverId), requireRole('admin', 'operator'), (req: Request, res: Response) => {
  try {
    db.prepare('DELETE FROM servers WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete server' });
  }
});

// Get server command history
router.get('/:id/command-history', validateParams(serverSchemas.serverId), (req: Request, res: Response) => {
  try {
    const history = db.prepare(
      `SELECT * FROM server_command_history WHERE server_id = ? ORDER BY executed_at DESC LIMIT 50`
    ).all(req.params.id);
    res.json({ success: true, data: history });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get command history' });
  }
});

// Get compliance history
router.get('/:id/compliance-history', validateParams(serverSchemas.serverId), (req: Request, res: Response) => {
  try {
    const checks = db.prepare(
      `SELECT * FROM compliance_checks WHERE server_id = ? ORDER BY created_at DESC LIMIT 20`
    ).all(req.params.id);
    res.json({ success: true, data: checks });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get compliance history' });
  }
});

// Export command history
router.get('/:id/command-history/export', validateParams(serverSchemas.serverId), (req: Request, res: Response) => {
  try {
    const serverId = req.params.id;
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as { id: string; name: string; hostname: string; [key: string]: unknown } | undefined;
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }
    const history = db.prepare(
      `SELECT * FROM server_command_history WHERE server_id = ? ORDER BY executed_at DESC`
    ).all(serverId);
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
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as { id: string; name: string; hostname: string } | undefined;
    if (!server) {
      return res.status(404).json({ success: false, error: 'Server not found' });
    }
    const checks = db.prepare(
      `SELECT * FROM compliance_checks WHERE server_id = ? ORDER BY created_at DESC`
    ).all(serverId);
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
