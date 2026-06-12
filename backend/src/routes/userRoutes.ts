import { Router, Request, Response } from 'express';
import db from '../models/database';
import { randomUUID } from 'crypto';
import bcrypt from 'bcryptjs';
import { createAuditLog } from '../services/auditService';
import { requireRole, authenticateToken, invalidateUserCache } from '../middleware/auth';
import { validatePassword } from '../utils/passwordPolicy';

const router = Router();

router.use(authenticateToken);

router.get('/', (_req: Request, res: Response) => {
  try {
    const users = db.prepare(`
      SELECT id, username, email, role, enabled, failed_login_attempts, locked_until, created_at 
      FROM users 
      ORDER BY created_at DESC
    `).all();
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = db.prepare(`
      SELECT id, username, email, role, enabled, failed_login_attempts, locked_until, created_at 
      FROM users 
      WHERE id = ?
    `).get(id);
    
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
    const { username, password, email, role = 'viewer' } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required' });
    }
    
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return res.status(400).json({ success: false, error: passwordCheck.message });
    }
    
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.status(400).json({ success: false, error: 'Username already exists' });
    }
    
    const id = randomUUID();
    const now = new Date().toISOString();
    
    // 使用bcrypt进行密码哈希
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    db.prepare(`
      INSERT INTO users (id, username, password, email, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, username, hashedPassword, email || null, role, now, now);
    
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
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const updates: string[] = [];
    const params: unknown[] = [];
    
    if (username) {
      updates.push('username = ?');
      params.push(username);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email);
    }
    if (role) {
      updates.push('role = ?');
      params.push(role);
    }
    if (enabled !== undefined) {
      updates.push('enabled = ?');
      params.push(enabled ? 1 : 0);
    }
    if (password) {
      const passwordCheck = validatePassword(password);
      if (!passwordCheck.valid) {
        return res.status(400).json({ success: false, error: passwordCheck.message });
      }
      const saltRounds = 12;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      updates.push('password = ?');
      params.push(hashedPassword);
    }
    
    if (updates.length > 0) {
      updates.push('updated_at = ?');
      params.push(new Date().toISOString(), id);
      
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...params);
      
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
    
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(id) as { username: string };
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    db.prepare(`
      UPDATE users 
      SET failed_login_attempts = 0, locked_until = NULL, updated_at = datetime('now','localtime') 
      WHERE id = ?
    `).run(id);
    
    invalidateUserCache(id);
    
    const reqUser = (req as { user?: { id: string } }).user;
    createAuditLog({
      user_id: reqUser?.id || 'system',
      action: 'unlock_user',
      resource_type: 'user',
      resource_id: id,
      details: { username: user.username }
    });
    
    res.json({ success: true, message: 'User account unlocked' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.delete('/:id', requireRole('admin'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(id) as { username: string };
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    
    invalidateUserCache(id);
    
    const reqUser = (req as { user?: { id: string } }).user;
    createAuditLog({
      user_id: reqUser?.id || 'system',
      action: 'delete_user',
      resource_type: 'user',
      resource_id: id,
      details: { username: user.username }
    });
    
    res.json({ success: true, message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
