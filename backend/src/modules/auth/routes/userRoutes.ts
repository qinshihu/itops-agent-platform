import type { Request, Response } from 'express';
import { Router } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { userRepository } from '../../../repositories';
import { createAuditLog } from '../../infra/services/auditService';
import { requireRole, authenticateToken, invalidateUserCache } from '../../../middleware/auth';
import { validatePassword } from '../../../utils/passwordPolicy';

const router = Router();

router.use(authenticateToken);

router.get('/', (_req: Request, res: Response) => {
  try {
    const users = userRepository.list();
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = userRepository.getByIdSafe(id);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { username, password, email, role = 'viewer', enabled = true } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }

    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ success: false, error: passwordCheck.message });
    }

    if (userRepository.existsByUsername(username)) {
      return res.status(400).json({ success: false, error: 'Username already exists' });
    }

    const id = randomUUID();

    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    userRepository.create({
      id,
      username,
      hashedPassword,
      email: email || null,
      role,
      enabled: enabled ? 1 : 0
    });

    const reqUser = (req as { user?: { id: string } }).user;
    createAuditLog({
      user_id: reqUser?.id || 'system',
      action: 'create_user',
      resource_type: 'user',
      resource_id: id,
      details: { username, email, role }
    });

    res.status(201).json({ success: true, data: { id, username, email, role } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/:id', requireRole('admin'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { username, email, role, enabled, password } = req.body;

    const user = userRepository.getById(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const updates: Parameters<typeof userRepository.update>[1] = {};

    if (username) updates.username = username;
    if (email !== undefined) updates.email = email;
    if (role) updates.role = role;
    if (enabled !== undefined) updates.enabled = enabled ? 1 : 0;
    if (password) {
      const passwordCheck = validatePassword(password);
      if (!passwordCheck.valid) {
        return res.status(400).json({ success: false, error: passwordCheck.message });
      }
      const saltRounds = 12;
      updates.password = await bcrypt.hash(password, saltRounds);
    }

    if (Object.keys(updates).length > 0) {
      userRepository.update(id, updates);
      invalidateUserCache(id);
    }

    const reqUser = (req as { user?: { id: string } }).user;
    createAuditLog({
      user_id: reqUser?.id || 'system',
      action: 'update_user',
      resource_type: 'user',
      resource_id: id,
      details: { username, email, role, enabled }
    });

    res.json({ success: true, message: 'User updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/:id/unlock', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const username = userRepository.getUsername(id);
    if (!username) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    userRepository.unlock(id);
    invalidateUserCache(id);

    const reqUser = (req as { user?: { id: string } }).user;
    createAuditLog({
      user_id: reqUser?.id || 'system',
      action: 'unlock_user',
      resource_type: 'user',
      resource_id: id,
      details: { username }
    });

    res.json({ success: true, message: 'User account unlocked' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/:id', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const username = userRepository.getUsername(id);
    if (!username) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    userRepository.delete(id);
    invalidateUserCache(id);

    const reqUser = (req as { user?: { id: string } }).user;
    createAuditLog({
      user_id: reqUser?.id || 'system',
      action: 'delete_user',
      resource_type: 'user',
      resource_id: id,
      details: { username }
    });

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
