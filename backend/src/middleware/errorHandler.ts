import type { Request, Response, NextFunction } from 'express';
import { env } from '../utils/env';
import { logger } from '../utils/logger';
import type { AppError} from '../types/errors';
import { ErrorCode, getErrorMessage, createAppError } from '../types/errors';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  const appError = err as AppError;
  const isOperational = appError.isOperational === true;
  
  const statusCode = appError.statusCode || 500;
  const errorCode = appError.code || ErrorCode.SERVER_ERROR;
  
  const traceId = (req as any).traceId;
  
  if (isOperational) {
    logger.warn(`[${errorCode}] ${appError.message}`, {
      traceId,
      code: errorCode,
      statusCode,
      details: appError.details,
      path: req.path,
      method: req.method
    });
  } else {
    logger.error(`Unexpected error: ${err.message}`, err, {
      traceId,
      path: req.path,
      method: req.method,
      stack: err.stack
    });
  }

  const response: Record<string, unknown> = {
    success: false,
    code: errorCode,
    message: isOperational ? appError.message : getErrorMessage(ErrorCode.SERVER_ERROR),
    traceId
  };

  if (appError.details && isOperational) {
    response.details = appError.details;
  }

  if (env.NODE_ENV !== 'production' && !isOperational) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(createAppError(
    ErrorCode.NOT_FOUND,
    `Route ${req.method} ${req.path} not found`,
    404
  ));
}
