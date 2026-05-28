import { Request, Response, NextFunction } from 'express';
import { env } from '../utils/env';
import { logger } from '../utils/logger';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const MAX_STORE_SIZE = 10000;

// 配置不同路由的限制策略
interface RateLimitConfig {
  [key: string]: {
    windowMs: number;    // 时间窗口（毫秒）
    max: number;         // 最大请求数
  };
}

const rateLimitConfig: RateLimitConfig = {
  // 登录接口限制：15分钟内最多5次
  '/api/auth/login': { windowMs: 15 * 60 * 1000, max: 5 },
  // 认证相关接口：每分钟最多20次
  '/api/auth': { windowMs: 60 * 1000, max: 20 },
  // Copilot接口：每分钟最多30次
  '/api/copilot': { windowMs: 60 * 1000, max: 30 },
  // API密钥配置：每分钟最多10次
  '/api/settings/api-keys': { windowMs: 60 * 1000, max: 10 },
  // Webhook 接收：每秒最多10次，允许批量推送
  '/api/webhooks': { windowMs: 1000, max: 10 },
};

const ipWhitelist = env.WEBHOOK_IP_WHITELIST
  ? env.WEBHOOK_IP_WHITELIST.split(',').map(ip => ip.trim())
  : [];

function isIpWhitelisted(ip: string | undefined): boolean {
  if (ipWhitelist.length === 0) return true;
  if (!ip) return false;

  const clientIp = ip.replace(/^::ffff:/, '');
  return ipWhitelist.some(whitelistedIp => {
    if (whitelistedIp.includes('/')) {
      return clientIp.startsWith(whitelistedIp.split('/')[0]);
    }
    return clientIp === whitelistedIp || whitelistedIp === '*';
  });
}

// 默认策略：每分钟最多100次
const DEFAULT_CONFIG = { windowMs: 60 * 1000, max: 100 };

function getClientKey(req: Request): string {
  // 使用 IP 地址作为标识符
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `${ip}:${req.method}:${req.path}`;
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
  // 白名单IP跳过速率限制
  if (isIpWhitelisted(req.ip || req.socket.remoteAddress)) {
    return next();
  }

  // 查找匹配的配置
  let config = DEFAULT_CONFIG;
  for (const [path, cfg] of Object.entries(rateLimitConfig)) {
    if (req.path.startsWith(path)) {
      config = cfg;
      break;
    }
  }

  const key = getClientKey(req);
  const now = Date.now();

  // 获取或创建条目
  let entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetTime) {
    // 如果条目不存在，先清理过期条目
    if (!entry) {
      cleanupRateLimitStore();
    }
    
    // 如果仍然超过限制，删除最早的条目
    if (!entry && rateLimitStore.size >= MAX_STORE_SIZE) {
      // 尝试清理过期条目
      cleanupRateLimitStore();
      
      // 如果仍然超限，删除最早的一个条目
      if (rateLimitStore.size >= MAX_STORE_SIZE) {
        const oldestKey = rateLimitStore.keys().next().value;
        if (oldestKey) {
          rateLimitStore.delete(oldestKey);
        }
      }
    }
    
    entry = {
      count: 0,
      resetTime: now + config.windowMs
    };
    rateLimitStore.set(key, entry);
  }

  // 增加计数
  entry.count++;

  // 设置响应头
  res.setHeader('X-RateLimit-Limit', config.max.toString());
  res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - entry.count).toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString());

  if (entry.count > config.max) {
    return res.status(429).json({
      success: false,
      message: '请求过于频繁，请稍后再试',
      retryAfter: Math.ceil((entry.resetTime - now) / 1000)
    });
  }

  next();
}

// 清理过期条目（定期运行）
export function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// 每5分钟清理一次
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
