import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import db from '../models/database';
import { env } from '../utils/env';
import { tokenBlacklist } from '../services/tokenBlacklist';

interface AuthUser {
  id: string;
  username: string;
  email: string | null;
  role: string;
  enabled: number;
  password_must_change: number;
}

const userCache = new Map<string, { user: AuthUser; expiresAt: number }>();
const USER_CACHE_TTL = 10 * 1000;
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000;

function startCacheCleanup(): void {
  const interval = setInterval(() => {
    const now = Date.now();
    let expiredCount = 0;
    
    for (const [userId, cacheEntry] of userCache.entries()) {
      if (cacheEntry.expiresAt < now) {
        userCache.delete(userId);
        expiredCount++;
      }
    }
    
    if (expiredCount > 0) {
      console.log(`🧹 Cleaned up ${expiredCount} expired user cache entries`);
    }
  }, CACHE_CLEANUP_INTERVAL);
  interval.unref();
}

startCacheCleanup();

function getCachedUser(userId: string): AuthUser | null {
  const cached = userCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.user;
  }
  if (cached) {
    userCache.delete(userId);
  }
  return null;
}

function setCachedUser(userId: string, user: AuthUser): void {
  userCache.set(userId, { user, expiresAt: Date.now() + USER_CACHE_TTL });
  if (userCache.size > 1000) {
    const oldestKey = userCache.keys().next().value;
    if (oldestKey) {
      userCache.delete(oldestKey);
    }
  }
}

export function clearUserCache(userId?: string): void {
  if (userId) {
    userCache.delete(userId);
  } else {
    userCache.clear();
  }
}

export function invalidateUserCache(userId: string): void {
  userCache.delete(userId);
}

export function authenticateToken(req: Request & { user?: AuthUser }, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: '未提供认证token'
    });
  }

  const token = authHeader.substring(7);

  if (tokenBlacklist.isBlacklisted(token)) {
    return res.status(401).json({
      success: false,
      message: 'Token已失效'
    });
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload & { id: string };
    
    let user: AuthUser | null = getCachedUser(decoded.id);
    if (!user) {
      const dbUser = db.prepare('SELECT id, username, email, role, enabled, password_must_change FROM users WHERE id = ?').get(decoded.id) as AuthUser | undefined;
      if (dbUser) {
        user = dbUser;
        setCachedUser(decoded.id, user);
      }
    }
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户不存在'
      });
    }

    if (!user.enabled) {
      return res.status(403).json({
        success: false,
        message: '账户已被禁用'
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({
        success: false,
        message: 'Token已过期'
      });
    }
    return res.status(401).json({
      success: false,
      message: '无效的token'
    });
  }
}

export function requireRole(...allowedRoles: string[]) {
  return (req: Request & { user?: AuthUser }, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: '未认证'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: '权限不足'
      });
    }

    next();
  };
}

export function requirePasswordChange(req: Request & { user?: AuthUser }, res: Response, next: NextFunction) {
  if (req.user && req.user.password_must_change) {
    return res.status(403).json({
      success: false,
      message: '请先修改初始密码',
      code: 'PASSWORD_MUST_CHANGE'
    });
  }
  next();
}
