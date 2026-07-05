/* eslint-disable no-console */
/**
 * 前端日志工具
 * 统一封装 console 方法，便于后续替换为远程日志收集
 */

type LogData = Record<string, unknown>;

export const logger = {
  error(message: string, ...args: unknown[]): void {
    console.error(message, ...args);
  },

  warn(message: string, ...args: unknown[]): void {
    console.warn(message, ...args);
  },

  info(message: string, ...args: unknown[]): void {
    console.log(message, ...args);
  },

  debug(message: string, ...args: unknown[]): void {
    console.debug(message, ...args);
  },

  /** 结构化日志 */
  event(event: string, data?: LogData): void {
    console.log(`[${event}]`, data ?? '');
  },
};

export default logger;