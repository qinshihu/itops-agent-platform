import type { Request, Response } from 'express';
import { Router } from 'express';
import { serverRepository } from '../../../repositories';
import { randomUUID, createHash } from 'crypto';
import { encrypt } from '../../auth/services/encryptionService';
import { validateBody, validateParams } from '../../../middleware/validation';
import { requireRole } from '../../../middleware/auth';
import { z } from 'zod';

const router = Router();

const sshKeyIdSchema = z.object({ id: z.string().uuid('无效的SSH密钥ID') });

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
    const keys = serverRepository.sshKeys.list();
    res.json({ success: true, data: keys });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get SSH keys' });
  }
});

router.get('/:id', validateParams(sshKeyIdSchema), (req: Request, res: Response) => {
  try {
    const key = serverRepository.sshKeys.getById(req.params.id);
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
    const servers = serverRepository.sshKeys.listServersByKey(req.params.id);
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

    const existing = serverRepository.sshKeys.findByName(name);
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

      serverRepository.sshKeys.createKey({
        id, name, key_type: keyType, fingerprint, private_key: encryptedKey, description: description || null
      });
    } else {
      const encryptedPassword = encrypt(password);
      serverRepository.sshKeys.createPassword({
        id, name, username, password: encryptedPassword, description: description || null
      });
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
    const key = serverRepository.sshKeys.getById(req.params.id);
    if (!key) {
      return res.status(404).json({ success: false, error: 'SSH key not found' });
    }

    const { name, auth_type, username, password, private_key, description } = req.body as Record<string, string>;

    if (name) {
      const existing = serverRepository.sshKeys.findByNameExcludeId(name as string, req.params.id);
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

    serverRepository.sshKeys.update(req.params.id, {
      name: name as string | undefined,
      auth_type: auth_type as string | undefined,
      key_type: newKeyType,
      fingerprint: newFingerprint,
      username: username as string | null | undefined,
      password: encryptedPassword,
      private_key: encryptedKey,
      description: description as string | null | undefined,
    });

    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update SSH key' });
  }
});

router.delete('/:id', requireRole('admin'), validateParams(sshKeyIdSchema), (req: Request, res: Response) => {
  try {
    if (!serverRepository.sshKeys.existsById(req.params.id)) {
      return res.status(404).json({ success: false, error: 'SSH key not found' });
    }

    const usageCount = serverRepository.sshKeys.countUsage(req.params.id);
    if (usageCount > 0) {
      return res.status(409).json({
        success: false,
        error: `该密钥正在被 ${usageCount} 台服务器使用，无法删除。请先解除关联后再删除。`
      });
    }

    serverRepository.sshKeys.delete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete SSH key' });
  }
});

export default router;
