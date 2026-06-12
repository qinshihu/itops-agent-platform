import db from '../models/database';
import { logger } from '../utils/logger';
import { randomUUID } from 'crypto';
import jwt from 'jsonwebtoken';

interface CachedToken {
  token: string;
  expiresAt: Date;
}

const blacklistedTokenCache = new Map<string, CachedToken>();
const CACHE_CLEANUP_INTERVAL = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 10000;

class TokenBlacklistService {
  private cleanupExpiredCache(): void {
    const now = new Date();
    let cleanedCount = 0;
    
    for (const [token, cached] of blacklistedTokenCache.entries()) {
      if (cached.expiresAt < now) {
        blacklistedTokenCache.delete(token);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.info(`Cleaned ${cleanedCount} expired tokens from cache`);
    }
  }

  private enforceCacheLimit(): void {
    if (blacklistedTokenCache.size > MAX_CACHE_SIZE) {
      const now = new Date();
      const entries = Array.from(blacklistedTokenCache.entries());
      
      // 先清理所有过期token
      const expiredTokens = entries.filter(([, cached]) => cached.expiresAt < now);
      expiredTokens.forEach(([token]) => {
        blacklistedTokenCache.delete(token);
      });
      
      // 如果仍然超过限制，清理最早的一半条目
      if (blacklistedTokenCache.size > MAX_CACHE_SIZE) {
        const remainingEntries = Array.from(blacklistedTokenCache.entries())
          .sort((a, b) => a[1].expiresAt.getTime() - b[1].expiresAt.getTime());
        const toRemove = remainingEntries.slice(0, Math.ceil(blacklistedTokenCache.size / 2));
        toRemove.forEach(([token]) => {
          blacklistedTokenCache.delete(token);
        });
      }
      
      logger.info(`Enforced cache limit, current size: ${blacklistedTokenCache.size}`);
    }
  }

  addToBlacklist(token: string, reason?: string, userId?: string): void {
    try {
      const decoded = jwt.decode(token) as { exp?: number } | null;
      let expiresAt: Date;
      
      if (decoded && decoded.exp) {
        expiresAt = new Date(decoded.exp * 1000);
      } else {
        expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      }
      
      blacklistedTokenCache.set(token, { token, expiresAt });
      this.enforceCacheLimit();
      
      db.prepare(`
        INSERT OR IGNORE INTO token_blacklist (id, token, user_id, reason, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        randomUUID(),
        token,
        userId || null,
        reason || null,
        expiresAt.toISOString()
      );
    } catch (error) {
      logger.error('Failed to add token to blacklist:', error);
    }
  }

  isBlacklisted(token: string): boolean {
    const cached = blacklistedTokenCache.get(token);
    if (cached && cached.expiresAt > new Date()) {
      return true;
    }
    
    if (cached) {
      blacklistedTokenCache.delete(token);
    }
    
    try {
      const result = db.prepare(`
        SELECT 1 FROM token_blacklist 
        WHERE token = ? AND expires_at > datetime('now','localtime')
      `).get(token);
      
      const isBlacklisted = !!result;
      if (isBlacklisted) {
        try {
          const decoded = jwt.decode(token) as { exp?: number } | null;
          const expiresAt = decoded?.exp 
            ? new Date(decoded.exp * 1000) 
            : new Date(Date.now() + 24 * 60 * 60 * 1000);
          
          blacklistedTokenCache.set(token, { token, expiresAt });
          this.enforceCacheLimit();
        } catch (decodeError) {
          logger.warn('Failed to decode token for cache, using default expiration:', decodeError);
          blacklistedTokenCache.set(token, { 
            token, 
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) 
          });
        }
      }
      
      return isBlacklisted;
    } catch (error) {
      logger.error('Failed to check token blacklist:', error);
      return false;
    }
  }

  cleanExpiredTokens(): void {
    try {
      this.cleanupExpiredCache();
      
      const result = db.prepare(`
        DELETE FROM token_blacklist 
        WHERE expires_at < datetime('now','localtime')
      `).run();
      
      logger.info(`Cleaned up ${result.changes} expired tokens from blacklist`);
    } catch (error) {
      logger.error('Failed to clean expired tokens:', error);
    }
  }
}

// 导出单例
export const tokenBlacklist = new TokenBlacklistService();

// 启动时清理过期token，并定期清理
export function initTokenBlacklist(): void {
  tokenBlacklist.cleanExpiredTokens();
  
  // 每 10 分钟清理一次过期token（比之前更频繁）
  const cleanupInterval = setInterval(() => {
    tokenBlacklist.cleanExpiredTokens();
  }, CACHE_CLEANUP_INTERVAL);
  
  // 确保进程退出时清理定时器
  cleanupInterval.unref();
}
