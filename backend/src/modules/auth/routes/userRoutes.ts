/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response } from 'express';
import { Router } from 'express';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { createAuditLog } from '../../audit/services/auditService';
import { requireRole, authenticateToken, invalidateUserCache } from '../../../middleware/auth';
import { validatePassword } from '../../../utils/passwordPolicy';
import { userCrudService } from '../services/userCrudService';

const router = Router();

router.use(authenticateToken);

router.get('/', (_req: Request, res: Response) => {
  try {
    const users = userCrudService.listUsers();
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const user = userCrudService.getUserByIdSafe(req.params.id);
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

    if (userCrudService.existsByUsername(username)) {
      return res.status(400).json({ success: false, error: 'Username already exists' });
    }

    const id = randomUUID();
    const hashedPassword = await bcrypt.hash(password, 12);

    userCrudService.createUser({
      id,
      username,
      hashedPassword,
      email: email || null,
      role,
      enabled: enabled ? 1 : 0,
    } as any);

    const reqUser = (req as { user?: { id: string } }).user;
    createAuditLog({
      user_id: reqUser?.id || 'system',
      action: 'create_user',
      resource_type: 'user',
      resource_id: id,
      details: { username, email, role },
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

    const user = userCrudService.getUserById(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const updates: Record<string, unknown> = {};
    if (username) updates.username = username;
    if (email !== undefined) updates.email = email;

    // 2026-07-21 P0-4：role 字段强制白名单（避免越权提权）
    if (role !== undefined) {
      const ALLOWED_ROLES = ['admin', 'operator', 'viewer'];
      if (!ALLOWED_ROLES.includes(role)) {
        return res.status(400).json({
          success: false,
          error: `无效的 role 字段。允许值：${ALLOWED_ROLES.join(', ')}`,
        });
      }
      // 2026-07-21 P0-4：拒绝最后一个 admin 被降级/禁用/删除
      const isRoleChange = user.role === 'admin' && role !== 'admin';
      const isDisabled = enabled === false && user.role === 'admin';
      if (isRoleChange || isDisabled) {
        const adminCount = userCrudService.listUsers().filter((u: { role: string; enabled: number }) => u.role === 'admin' && u.enabled !== 0).length;
        if (adminCount <= 1) {
          return res.status(409).json({
            success: false,
            error: '不能修改/禁用最后一个 admin 账号',
          });
        }
      }
      updates.role = role;
    }

    if (enabled !== undefined) updates.enabled = enabled ? 1 : 0;
    if (password) {
      const passwordCheck = validatePassword(password);
      if (!passwordCheck.valid) {
        return res.status(400).json({ success: false, error: passwordCheck.message });
      }
      updates.password = await bcrypt.hash(password, 12);
    }

    if (Object.keys(updates).length > 0) {
      userCrudService.updateUser(id, updates as any);
      invalidateUserCache(id);
    }

    const reqUser = (req as { user?: { id: string } }).user;
    createAuditLog({
      user_id: reqUser?.id || 'system',
      action: 'update_user',
      resource_type: 'user',
      resource_id: id,
      details: { username, email, role, enabled },
    });

    res.json({ success: true, message: 'User updated' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/:id/unlock', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const username = userCrudService.getUsername(req.params.id);
    if (!username) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    userCrudService.unlockUser(req.params.id);
    invalidateUserCache(req.params.id);

    const reqUser = (req as { user?: { id: string } }).user;
    createAuditLog({
      user_id: reqUser?.id || 'system',
      action: 'unlock_user',
      resource_type: 'user',
      resource_id: req.params.id,
      details: { username },
    });

    res.json({ success: true, message: 'User account unlocked' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/:id', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const username = userCrudService.getUsername(req.params.id);
    if (!username) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // 2026-07-21 P0-4：拒绝删除最后一个 admin
    const userToDelete = userCrudService.getUserById(req.params.id);
    if (userToDelete && userToDelete.role === 'admin') {
      const adminCount = userCrudService.listUsers().filter((u: { role: string; enabled: number }) => u.role === 'admin' && u.enabled !== 0).length;
      if (adminCount <= 1) {
        return res.status(409).json({
          success: false,
          error: '不能删除最后一个 admin 账号',
        });
      }
    }

    userCrudService.deleteUser(req.params.id);
    invalidateUserCache(req.params.id);

    const reqUser = (req as { user?: { id: string } }).user;
    createAuditLog({
      user_id: reqUser?.id || 'system',
      action: 'delete_user',
      resource_type: 'user',
      resource_id: req.params.id,
      details: { username },
    });

    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
