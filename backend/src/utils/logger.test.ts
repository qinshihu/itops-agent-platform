import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger, LogLevel, LogEntry } from './logger';

describe('Logger', () => {
  let logStats: any;
  let consoleSpy: any;

  beforeEach(() => {
    logStats = logger.getStats();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy?.mockRestore();
  });

  describe('log levels', () => {
    it('should log debug messages', () => {
      expect(() => logger.debug('test debug message')).not.toThrow();
    });

    it('should log info messages', () => {
      expect(() => logger.info('test info message')).not.toThrow();
    });

    it('should log warn messages', () => {
      expect(() => logger.warn('test warn message')).not.toThrow();
    });

    it('should log error messages', () => {
      expect(() => logger.error('test error message')).not.toThrow();
    });

    it('should log error messages with error object', () => {
      const error = new Error('Test error');
      expect(() => logger.error('test error with object', error)).not.toThrow();
    });

    it('should log with metadata', () => {
      const meta = { key: 'value', count: 42 };
      expect(() => logger.info('test with meta', meta)).not.toThrow();
    });
  });

  describe('timer functionality', () => {
    it('should create and end a timer', () => {
      const timer = logger.startTimer('test operation');
      expect(timer).toHaveProperty('end');
      expect(() => timer.end()).not.toThrow();
    });

    it('should end timer with success flag', () => {
      const timer = logger.startTimer('test operation');
      expect(() => timer.end(true)).not.toThrow();
      expect(() => timer.end(false)).not.toThrow();
    });
  });

  describe('statistics', () => {
    it('should track log statistics', () => {
      const beforeStats = logger.getStats();
      logger.info('test stat tracking');
      const afterStats = logger.getStats();
      
      expect(afterStats.total).toBeGreaterThanOrEqual(beforeStats.total);
      expect(afterStats.byLevel.info).toBeGreaterThanOrEqual(beforeStats.byLevel.info);
    });

    it('should track error count separately', () => {
      const beforeStats = logger.getStats();
      logger.error('test error tracking');
      const afterStats = logger.getStats();
      
      expect(afterStats.errors).toBeGreaterThanOrEqual(beforeStats.errors);
    });

    it('should track warning count separately', () => {
      const beforeStats = logger.getStats();
      logger.warn('test warning tracking');
      const afterStats = logger.getStats();
      
      expect(afterStats.warnings).toBeGreaterThanOrEqual(beforeStats.warnings);
    });
  });

  describe('performance tracking', () => {
    it('should track performance metrics', () => {
      logger.info('performance test', { durationMs: 100 });
      const metrics = logger.getPerformanceMetrics();
      
      expect(metrics).toBeDefined();
    });
  });

  describe('child logger', () => {
    it('should create a child logger with requestId', () => {
      const childLogger = logger.child({ requestId: 'test-123' });
      expect(childLogger).toBeDefined();
      expect(() => childLogger.info('test child log')).not.toThrow();
    });

    it('should create a child logger with userId', () => {
      const childLogger = logger.child({ userId: 'user-456' });
      expect(childLogger).toBeDefined();
      expect(() => childLogger.info('test child log with user')).not.toThrow();
    });

    it('should create a child logger with custom service name', () => {
      const childLogger = logger.child({ service: 'test-service' });
      expect(childLogger).toBeDefined();
      expect(() => childLogger.info('test child log with service')).not.toThrow();
    });
  });

  describe('error listeners', () => {
    it('should call error listeners when error is logged', () => {
      let listenerCalled = false;
      let receivedEntry: LogEntry | null = null;
      
      const listener = (entry: LogEntry) => {
        listenerCalled = true;
        receivedEntry = entry;
      };
      
      logger.onError(listener);
      logger.error('test error for listener');
      
      expect(listenerCalled).toBe(true);
      expect(receivedEntry).not.toBeNull();
      expect((receivedEntry as unknown as LogEntry)?.level).toBe('error');
    });
  });
});
