import { Router, Request, Response } from 'express';
import db from '../models/database';
import { randomUUID, createHash } from 'crypto';
import { encrypt } from '../services/encryptionService';
import { validateBody, validateParams } from '../middleware/validation';
import { requireRole } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const sshKeyIdSchema = z.object({ id: z.string().uuid('无效的SSH密钥ID') });

interface SSHKey {
  id: string;
  name: string;
  auth_type: 'key' | 'password';
  key_type: string;
  fingerprint: string | null;
  username: string | null;
  password: string | null;
  private_key: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

function extractKeyType(privateKey: string): string {
  if (privateKey.includes('BEGIN OPENSSH PRIVATE KEY')) return 'openssh';
  if (privateKey.includes('BEGIN RSA PRIVATE KEY')) return 'rsa';
  if (privateKey.includes('BEGIN EC PRIVATE KEY')) return 'ec';
  if (privateKey.includes('BEGIN DSA PRIVATE KEY')) return 'dsa';
  if (privateKey.includes('BEGIN PRIVATE KEY')) return 'pkcs8';
  return 'unknown';
}

function validatePrivateKey(privateKey: string): boolean {
  const trimmed = privateKey.trim();
  return trimmed.includes('BEGIN') && trimmed.includes('PRIVATE KEY') && trimmed.includes('END');
}

function extractFingerprint(privateKey: string): string {
  try {
    const hash = createHash('sha256').update(privateKey).digest('hex');
    return `SHA256:${hash.slice(0, 43)}`;
  } catch {
    return '';
  }
}

router.get('/', (_req: Request, res: Response) => {
  try {
    const keys = db.prepare(`
      SELECT sk.id, sk.name, sk.auth_type, sk.key_type, sk.fingerprint, sk.username, sk.description, sk.created_at, sk.updated_at,
             COUNT(DISTINCT s.id) as usage_count
      FROM ssh_keys sk
      LEFT JOIN servers s ON s.ssh_key_id = sk.id
      GROUP BY sk.id
      ORDER BY sk.created_at DESC
    `).all() as Array<{ id: string; name: string; auth_type: string; key_type: string; fingerprint: string | null; username: string | null; description: string | null; created_at: string; updated_at: string; usage_count: number }>;
    res.json({ success: true, data: keys });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get SSH keys' });
  }
});

router.get('/:id', validateParams(sshKeyIdSchema), (req: Request, res: Response) => {
  try {
    const key = db.prepare('SELECT id, name, auth_type, key_type, fingerprint, username, password, private_key, description, created_at, updated_at FROM ssh_keys WHERE id = ?').get(req.params.id) as SSHKey | undefined;
    if (!key) {
      return res.status(404).json({ success: false, error: 'SSH key not found' });
    }
    res.json({ success: true, data: key });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get SSH key' });
  }
});

router.get('/:id/usage', validateParams(sshKeyIdSchema), (req: Request, res: Response) => {
  try {
    const servers = db.prepare('SELECT id, name, hostname FROM servers WHERE ssh_key_id = ?').all(req.params.id);
    res.json({ success: true, data: { count: servers.length, servers } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get SSH key usage' });
  }
});

router.post('/', requireRole('admin'), validateBody(z.object({
  name: z.string().min(1, '密钥名称不能为空'),
  auth_type: z.enum(['key', 'password'], { message: '认证类型必须是 key 或 password' }),
  username: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  private_key: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
}).refine((data) => {
  if (data.auth_type === 'key') {
    return !!data.private_key;
  }
  if (data.auth_type === 'password') {
    return !!data.username && !!data.password;
  }
  return false;
}, {
  message: 'SSH密钥类型必须提供私钥，用户名密码类型必须提供用户名和密码',
})), (req: Request, res: Response) => {
  try {
    const { name, auth_type, username, password, private_key, description } = req.body;

    const existing = db.prepare('SELECT id FROM ssh_keys WHERE name = ?').get(name);
    if (existing) {
      return res.status(409).json({ success: false, error: 'SSH key name already exists' });
    }

    const id = randomUUID();

    if (auth_type === 'key') {
      if (!validatePrivateKey(private_key)) {
        return res.status(400).json({ success: false, error: '无效的 SSH 私钥格式，请确保粘贴的内容包含完整的私钥文本（从 BEGIN 到 END）' });
      }

      const keyType = extractKeyType(private_key);
      const fingerprint = extractFingerprint(private_key);
      const encryptedKey = encrypt(private_key);

      db.prepare(
        `INSERT INTO ssh_keys (id, name, auth_type, key_type, fingerprint, private_key, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(id, name, 'key', keyType, fingerprint, encryptedKey, description || null);
    } else {
      // password 类型
      const encryptedPassword = encrypt(password);
      db.prepare(
        `INSERT INTO ssh_keys (id, name, auth_type, key_type, username, password, description)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(id, name, 'password', 'password', username, encryptedPassword, description || null);
    }

    res.json({ success: true, data: { id } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create SSH key' });
  }
});

router.put('/:id', requireRole('admin'), validateParams(sshKeyIdSchema), validateBody(z.object({
  name: z.string().min(1).optional(),
  auth_type: z.enum(['key', 'password']).optional(),
  username: z.string().optional().nullable(),
  password: z.string().optional().nullable(),
  private_key: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
})), (req: Request, res: Response) => {
  try {
    const key = db.prepare('SELECT * FROM ssh_keys WHERE id = ?').get(req.params.id) as SSHKey | undefined;
    if (!key) {
      return res.status(404).json({ success: false, error: 'SSH key not found' });
    }

    const { name, auth_type, username, password, private_key, description } = req.body as Record<string, unknown>;

    if (name) {
      const existing = db.prepare('SELECT id FROM ssh_keys WHERE name = ? AND id != ?').get(name, req.params.id);
      if (existing) {
        return res.status(409).json({ success: false, error: 'SSH key name already exists' });
      }
    }

    let encryptedKey: string | undefined;
    let newKeyType: string | undefined;
    let newFingerprint: string | undefined;
    let encryptedPassword: string | undefined;

    const finalAuthType = (auth_type as string) || key.auth_type;

    if (finalAuthType === 'key' && private_key !== undefined && typeof private_key === 'string' && private_key) {
      if (!validatePrivateKey(private_key)) {
        return res.status(400).json({ success: false, error: '无效的 SSH 私钥格式，请确保粘贴的内容包含完整的私钥文本（从 BEGIN 到 END）' });
      }
      encryptedKey = encrypt(private_key);
      newKeyType = extractKeyType(private_key);
      newFingerprint = extractFingerprint(private_key);
    }

    if (finalAuthType === 'password' && password !== undefined && typeof password === 'string' && password) {
      encryptedPassword = encrypt(password);
    }

    db.prepare(
      `UPDATE ssh_keys
       SET name = COALESCE(?, name),
           auth_type = COALESCE(?, auth_type),
           key_type = COALESCE(?, key_type),
           fingerprint = COALESCE(?, fingerprint),
           username = COALESCE(?, username),
           password = CASE WHEN ? IS NOT NULL THEN ? ELSE password END,
           private_key = CASE WHEN ? IS NOT NULL THEN ? ELSE private_key END,
           description = COALESCE(?, description),
           updated_at = datetime('now','localtime')
       WHERE id = ?`
    ).run(
      name,
      auth_type,
      newKeyType,
      newFingerprint,
      username,
      password !== undefined ? encryptedPassword : undefined,
      password !== undefined ? encryptedPassword : undefined,
      private_key !== undefined ? encryptedKey : undefined,
      private_key !== undefined ? encryptedKey : undefined,
      description,
      req.params.id
    );

    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update SSH key' });
  }
});

router.delete('/:id', requireRole('admin'), validateParams(sshKeyIdSchema), (req: Request, res: Response) => {
  try {
    const key = db.prepare('SELECT id FROM ssh_keys WHERE id = ?').get(req.params.id);
    if (!key) {
      return res.status(404).json({ success: false, error: 'SSH key not found' });
    }

    const usage = db.prepare('SELECT COUNT(*) as count FROM servers WHERE ssh_key_id = ?').get(req.params.id) as { count: number };
    if (usage.count > 0) {
      return res.status(409).json({
        success: false,
        error: `该密钥正在被 ${usage.count} 台服务器使用，无法删除。请先解除关联后再删除。`
      });
    }

    db.prepare('DELETE FROM ssh_keys WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete SSH key' });
  }
});

export default router;
