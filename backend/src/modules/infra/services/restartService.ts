import type { Server } from 'http';
import type { Server as SocketIOServer } from 'socket.io';
import { logger } from '../../../utils/logger';
import { schedulerService } from '../../workflow/services/schedulerService';

const shutdownHooks: Array<() => Promise<void> | void> = [];

/**
 * 注册优雅关闭时的回调函数。
 * 用于解除 restartService 对其他服务的直接依赖（避免循环依赖）。
 */
export function registerShutdownHook(hook: () => Promise<void> | void): void {
  shutdownHooks.push(hook);
}

let httpServer: Server | null = null;
let ioInstance: SocketIOServer | null = null;
let isShuttingDown = false;

export function setServerInstances(http: Server, io: SocketIOServer): void {
  httpServer = http;
  ioInstance = io;
}

export async function gracefulRestart(): Promise<void> {
  if (isShuttingDown) {
    logger.warn('Restart already in progress, skipping');
    return;
  }

  isShuttingDown = true;
  logger.info('🔄 Starting graceful restart...');

  try {
    await new Promise<void>((resolve) => {
      httpServer?.close(() => {
        logger.info('HTTP server closed');
        resolve();
      });
    });

    await new Promise<void>((resolve) => {
      ioInstance?.close(() => {
        logger.info('WebSocket server closed');
        resolve();
      });
    });

    schedulerService.shutdown();

    // 执行所有注册的关闭钩子（如 backupService.stopAutoBackup）
    for (const hook of shutdownHooks) {
      try {
        await hook();
      } catch (err) {
        logger.error('Error in shutdown hook', err as Error);
      }
    }

    logger.info('🔄 All services stopped, preparing for restart...');
    logger.info('💡 Please restart the application manually or use process manager');
    logger.info('💡 If using PM2: pm2 restart <app-name>');
    logger.info('💡 If using systemd: systemctl restart itops-agent');

    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful restart', error as Error);
    process.exit(1);
  }
}

export function getRestartStatus(): { isShuttingDown: boolean } {
  return { isShuttingDown };
}
