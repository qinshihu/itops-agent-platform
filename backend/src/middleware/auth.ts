import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { userRepository } from '../repositories/userRepository';
import { env } from '../utils/env';
import { tokenBlacklist } from '../modules/auth/services/tokenBlacklist';

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
      logger.info(`🧹 Cleaned up ${expiredCount} expired user cache entries`);
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

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: '未提供认证token'
    });
  }

  const token = authHeader.substring(7);
  const user = verifyToken(token);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Token已失效或无效'
    });
  }

  req.user = user;
  next();
}

export function verifyToken(token: string): AuthUser | null {
  if (!token || tokenBlacklist.isBlacklisted(token)) return null;

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload & { id: string };

    let user: AuthUser | null = getCachedUser(decoded.id);
    if (!user) {
      const dbUser = userRepository.getCachedFields(decoded.id);
      if (dbUser) {
        user = {
          id: dbUser.id,
          username: dbUser.username,
          email: dbUser.email,
          role: dbUser.role,
          enabled: dbUser.enabled,
          password_must_change: dbUser.password_must_change ?? 0,
        };
        setCachedUser(decoded.id, user);
      }
    }

    if (!user?.enabled) return null;
    return user;
  } catch {
    return null;
  }
}

export type { AuthUser };

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
  if (req.user?.password_must_change) {
    return res.status(403).json({
      success: false,
      message: '请先修改初始密码',
      code: 'PASSWORD_MUST_CHANGE'
    });
  }
  next();
}
