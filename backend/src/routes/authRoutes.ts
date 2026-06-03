import { Router, Request, Response } from 'express';
import { db } from '../models/database';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { env } from '../utils/env';
import { tokenBlacklist } from '../services/tokenBlacklist';
import { logger } from '../utils/logger';
import { validateBody } from '../middleware/validation';
import { authSchemas } from '../schemas/apiValidation';
import { authenticateToken, invalidateUserCache } from '../middleware/auth';
import { validatePassword } from '../utils/passwordPolicy';
import { checkLoginLockout, recordFailedLogin, resetFailedLoginAttempts } from '../services/loginThrottler';

const router = Router();

// 登录
router.post('/login', validateBody(authSchemas.login), async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    const lockoutStatus = checkLoginLockout(username);
    if (lockoutStatus.locked) {
      const remainingMinutes = Math.ceil((lockoutStatus.lockoutUntil!.getTime() - new Date().getTime()) / 60000);
      return res.status(423).json({
        success: false,
        message: `账户已被锁定，请${remainingMinutes}分钟后再试`
      });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as { id: string; username: string; password: string; role: string; email: string; enabled: number; [key: string]: unknown } | undefined;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    if (!user.enabled) {
      return res.status(403).json({
        success: false,
        message: '账户已被禁用'
      });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      const result = recordFailedLogin(username);
      if (result.locked) {
        return res.status(423).json({
          success: false,
          message: `密码错误次数过多，账户已被锁定30分钟`
        });
      }
      return res.status(401).json({
        success: false,
        message: `用户名或密码错误，剩余${result.remainingAttempts}次尝试机会`
      });
    }

    resetFailedLoginAttempts(user.id);

    const accessToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email
      },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN } as SignOptions
    );

    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      env.JWT_SECRET,
      { expiresIn: '7d' } as SignOptions
    );

    db.prepare('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(user.id);

    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      randomUUID(),
      user.id,
      'login',
      'auth',
      'login',
      JSON.stringify({ username }),
      req.ip
    );

    res.json({
      success: true,
      message: '登录成功',
      data: {
        token: accessToken,
        refreshToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          passwordMustChange: Boolean((user as { password_must_change?: number }).password_must_change)
        }
      }
    });
  } catch (error) {
    logger.error('登录失败', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// 刷新token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: '请提供refresh token'
      });
    }

    if (tokenBlacklist.isBlacklisted(refreshToken)) {
      return res.status(401).json({
        success: false,
        message: 'Token已失效'
      });
    }

    const decoded = jwt.verify(refreshToken, env.JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload & { id: string; type: string };

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: '无效的refresh token'
      });
    }

    const user = db.prepare('SELECT id, username, email, role, enabled FROM users WHERE id = ?').get(decoded.id) as { id: string; username: string; email: string; role: string; enabled: number } | undefined;

    if (!user || !user.enabled) {
      return res.status(401).json({
        success: false,
        message: '用户不存在或已被禁用'
      });
    }

    const newAccessToken = jwt.sign(
      { id: user.id, username: user.username, role: user.role, email: user.email },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRES_IN } as SignOptions
    );

    const newRefreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      env.JWT_SECRET,
      { expiresIn: '7d' } as SignOptions
    );

    tokenBlacklist.addToBlacklist(refreshToken, 'token-refresh', decoded.id);

    res.json({
      success: true,
      data: {
        token: newAccessToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError || error instanceof jwt.JsonWebTokenError) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token已过期或无效'
      });
    }
    logger.error('Token刷新失败', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// 获取当前用户信息
router.get('/me', authenticateToken, async (req: Request & { user?: { id: string } }, res: Response) => {
  try {
    const user = db.prepare('SELECT id, username, email, role, enabled, created_at FROM users WHERE id = ?').get(req.user!.id) as { id: string; username: string; email: string; role: string; enabled: number; created_at: string } | undefined;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      data: user
    });
  } catch {
    return res.status(401).json({
      success: false,
      message: '无效的token'
    });
  }
});

// 退出登录
router.post('/logout', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      // 将token加入黑名单
      tokenBlacklist.addToBlacklist(token, 'user-logout', (req as { user?: { id: string } }).user?.id);
    }
    
    res.json({
      success: true,
      message: '退出成功'
    });
  } catch (error) {
    logger.error('登出失败', error);
    res.status(500).json({
      success: false,
      message: '登出过程出现错误'
    });
  }
});

// 修改密码
router.post('/change-password', authenticateToken, async (req: Request & { user?: { id: string } }, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '请提供当前密码和新密码'
      });
    }

    // 查询用户
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as { id: string; username: string; password: string; password_must_change: number } | undefined;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 验证当前密码
    const validPassword = await bcrypt.compare(currentPassword, user.password);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: '当前密码错误'
      });
    }

    // 密码强度检查
    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
      return res.status(400).json({
        success: false,
        message: passwordCheck.message
      });
    }

    // 加密新密码
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // 更新密码并清除 password_must_change 标志
    db.prepare('UPDATE users SET password = ?, password_must_change = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hashedNewPassword, user.id);
    
    // 清除用户缓存，确保下一次请求获取最新状态
    invalidateUserCache(user.id);

    // 记录审计日志
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, resource_type, resource_id, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).run(
      randomUUID(),
      user.id,
      'change_password',
      'auth',
      'password',
      JSON.stringify({ username: user.username }),
      req.ip
    );

    logger.info(`用户 ${user.username} 修改了密码`);

    res.json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error) {
    logger.error('修改密码失败', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

export default router;
