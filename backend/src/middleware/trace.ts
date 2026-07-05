/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { logger } from '../utils/logger';

export function traceMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existingTraceId = req.headers['x-trace-id'] as string;
  const traceId = existingTraceId || randomUUID();
  
  (req as any).traceId = traceId;
  
  res.setHeader('X-Trace-Id', traceId);
  
  const startTime = Date.now();
  const method = req.method;
  const url = req.originalUrl || req.url;
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    const logMeta = {
      traceId,
      method,
      url,
      statusCode,
      durationMs: duration,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.headers['user-agent']
    };
    
    if (statusCode >= 500) {
      logger.error(`${method} ${url} - ${statusCode} (${duration}ms)`, logMeta);
    } else if (statusCode >= 400) {
      logger.warn(`${method} ${url} - ${statusCode} (${duration}ms)`, logMeta);
    } else {
      logger.info(`${method} ${url} - ${statusCode} (${duration}ms)`, logMeta);
    }
  });
  
  next();
}
