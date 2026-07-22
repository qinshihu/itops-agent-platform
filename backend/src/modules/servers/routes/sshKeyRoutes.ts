/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { validateBody, validateParams } from '../../../middleware/validation';
import { requireRole } from '../../../middleware/auth';
import { z } from 'zod';
import { sshKeyCrudService } from '../services/sshKeyCrudService';

const router = Router();

const sshKeyIdSchema = z.object({ id: z.string().uuid('无效的SSH密钥ID') });

router.get('/', (_req: Request, res: Response) => {
  try {
    const keys = sshKeyCrudService.listKeys();
    res.json({ success: true, data: keys });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to get SSH keys' });
  }
});

router.get('/:id', validateParams(sshKeyIdSchema), (req: Request, res: Response) => {
  try {
    const key = sshKeyCrudService.getKeyById(req.params.id);
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
    const usage = sshKeyCrudService.getKeyUsage(req.params.id);
    res.json({ success: true, data: usage });
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
  if (data.auth_type === 'key') return !!data.private_key;
  if (data.auth_type === 'password') return !!data.username && !!data.password;
  return false;
}, {
  message: 'SSH密钥类型必须提供私钥，用户名密码类型必须提供用户名和密码',
})), (req: Request, res: Response) => {
  try {
    const result = sshKeyCrudService.createKey(req.body);
    if (!result.success) {
      return res.status(result.status).json({ success: false, error: result.error });
    }
    res.json({ success: true, data: result.data });
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
    const result = sshKeyCrudService.updateKey(req.params.id, req.body as any);
    if (!result.success) {
      return res.status(result.status).json({ success: false, error: result.error });
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update SSH key' });
  }
});

router.delete('/:id', requireRole('admin'), validateParams(sshKeyIdSchema), (req: Request, res: Response) => {
  try {
    const result = sshKeyCrudService.deleteKey(req.params.id);
    if (!result.success) {
      return res.status(result.status).json({ success: false, error: result.error });
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete SSH key' });
  }
});

export default router;
