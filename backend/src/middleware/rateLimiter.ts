import { Request, Response, NextFunction } from 'express';
import { env } from '../utils/env';
import { logger } from '../utils/logger';

interface RateLimitEntry {
  count: number;
  resetTime: number;
  lastAccess: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const MAX_STORE_SIZE = 10000;
const CLEANUP_INTERVAL_MS = 60 * 1000; // 每分钟清理

// 路由限流配置
interface RateLimitConfig {
  [key: string]: {
    windowMs: number;
    max: number;
  };
}

const rateLimitConfig: RateLimitConfig = {
  '/api/auth/login': { windowMs: 15 * 60 * 1000, max: 5 },
  '/api/auth': { windowMs: 60 * 1000, max: 20 },
  '/api/copilot': { windowMs: 60 * 1000, max: 30 },
  '/api/settings/api-keys': { windowMs: 60 * 1000, max: 10 },
  '/api/webhooks': { windowMs: 1000, max: 10 },
};

const ipWhitelist: readonly string[] = env.WEBHOOK_IP_WHITELIST
  ? env.WEBHOOK_IP_WHITELIST.split(',').map(ip => ip.trim())
  : [];

function isIpWhitelisted(ip: string | undefined): boolean {
  if (ipWhitelist.length === 0) return true;
  if (!ip) return false;

  const clientIp = ip.replace(/^::ffff:/, '');
  return ipWhitelist.some(whitelistedIp => {
    if (whitelistedIp.includes('/')) {
      return isIpInCidr(clientIp, whitelistedIp);
    }
    return clientIp === whitelistedIp || whitelistedIp === '*';
  });
}

function isIpInCidr(ip: string, cidr: string): boolean {
  const [network, prefixLenStr] = cidr.split('/');
  const prefixLen = parseInt(prefixLenStr, 10);
  if (isNaN(prefixLen) || prefixLen < 0 || prefixLen > 32) return false;

  const ipNum = ipToNumber(ip);
  const networkNum = ipToNumber(network);
  const mask = prefixLen === 0 ? 0 : (~0 << (32 - prefixLen)) >>> 0;

  return (ipNum & mask) === (networkNum & mask);
}

function ipToNumber(ip: string): number {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) return 0;
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

const DEFAULT_CONFIG = { windowMs: 60 * 1000, max: 100 };

function getClientKey(req: Request): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `${ip}:${req.method}:${req.path}`;
}

function findMatchingConfig(path: string): { windowMs: number; max: number } {
  for (const [routePath, cfg] of Object.entries(rateLimitConfig)) {
    if (path.startsWith(routePath)) {
      return cfg;
    }
  }
  return DEFAULT_CONFIG;
}

/**
 * LRU 淘汰：移除最久未访问的条目直到低于容量阈值（容量的80%）
 */
function evictLRU(): void {
  if (rateLimitStore.size < MAX_STORE_SIZE) return;

  const entries = Array.from(rateLimitStore.entries())
    .sort((a, b) => a[1].lastAccess - b[1].lastAccess);

  const targetSize = Math.floor(MAX_STORE_SIZE * 0.8);
  const toDelete = rateLimitStore.size - targetSize;

  for (let i = 0; i < toDelete && i < entries.length; i++) {
    rateLimitStore.delete(entries[i][0]);
  }

  logger.warn(`Rate limiter store full, evicted ${toDelete} oldest entries (LRU)`);
}

/**
 * 清理所有过期的条目
 */
function cleanupExpired(): number {
  const now = Date.now();
  let deleted = 0;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
      deleted++;
    }
  }
  return deleted;
}

export function webhookIpFilter(req: Request, res: Response, next: NextFunction) {
  const clientIp = req.ip || req.socket.remoteAddress;

  if (ipWhitelist.length > 0 && req.path.startsWith('/api/webhooks')) {
    if (!isIpWhitelisted(clientIp)) {
      logger.warn(`Webhook request blocked: IP ${clientIp} not in whitelist`, {
        path: req.path,
        method: req.method,
      });
      return res.status(403).json({
        success: false,
        message: 'IP not allowed',
      });
    }
  }

  next();
}

export function rateLimiter(req: Request, res: Response, next: NextFunction) {
  if (isIpWhitelisted(req.ip || req.socket.remoteAddress)) {
    return next();
  }

  const config = findMatchingConfig(req.path);
  const key = getClientKey(req);
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetTime) {
    // 如果 Map 满了，先尝试清理过期条目，必要时 LRU 淘汰
    if (rateLimitStore.size >= MAX_STORE_SIZE) {
      const cleaned = cleanupExpired();
      if (cleaned === 0) {
        evictLRU();
      }
    }

    entry = {
      count: 0,
      resetTime: now + config.windowMs,
      lastAccess: now,
    };
    rateLimitStore.set(key, entry);
  }

  entry.count++;
  entry.lastAccess = now;

  res.setHeader('X-RateLimit-Limit', config.max.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - entry.count).toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString());

  if (entry.count > config.max) {
    return res.status(429).json({
      success: false,
      message: '请求过于频繁，请稍后再试',
      retryAfter: Math.ceil((entry.resetTime - now) / 1000),
    });
  }

  next();
}

// 定时清理过期条目
setInterval(() => {
  const count = cleanupExpired();
  if (count > 0) {
    logger.debug(`Rate limiter cleanup: removed ${count} expired entries (remaining: ${rateLimitStore.size})`);
  }
}, CLEANUP_INTERVAL_MS);
