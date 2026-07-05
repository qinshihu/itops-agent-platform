import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { mockDb, mockLogger } = vi.hoisted(() => {
  const mockDb = {
    exec: vi.fn(),
    pragma: vi.fn(() => []),
    prepare: vi.fn(),
  };

  const mockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    startTimer: vi.fn(() => ({ end: vi.fn() })),
  };

  return { mockDb, mockLogger };
});

vi.mock('./core', () => ({
  db: mockDb,
}));

vi.mock('../../utils/logger', () => ({
  logger: mockLogger,
}));

vi.mock('./health', () => ({
  getDatabaseHealthStatus: vi.fn(() => ({
    pageCount: 100,
    pageSize: 4096,
    walSize: 0,
    cacheSize: 2000,
    tableCount: 10,
    indexCount: 5,
    totalSize: '400 KB',
    freePages: 0,
  })),
}));

import {
  performVacuum,
  performAnalyze,
  performIntegrityCheck,
  performCheckpoint,
  performFullMaintenance,
  performMaintenance,
  startDatabaseMaintenance,
  stopDatabaseMaintenance,
} from './maintenance';

describe('database/maintenance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock implementations to prevent cross-test leakage
    mockDb.exec.mockReset();
    mockDb.pragma.mockReset();
    mockLogger.startTimer.mockReset();
    mockLogger.startTimer.mockImplementation(() => ({ end: vi.fn() }));
    // ensure no leftover timer
    stopDatabaseMaintenance();
  });

  afterEach(() => {
    stopDatabaseMaintenance();
  });

  // ==================== performVacuum ====================

  describe('performVacuum', () => {
    it('should execute VACUUM and log success', () => {
      mockDb.exec.mockReturnValue(undefined);
      performVacuum();
      expect(mockDb.exec).toHaveBeenCalledWith('VACUUM');
      expect(mockLogger.startTimer).toHaveBeenCalledWith('Database VACUUM');
      expect(mockLogger.info).toHaveBeenCalledWith('✅ VACUUM completed - reclaimed unused space');
    });

    it('should throw and log error on failure', () => {
      mockDb.exec.mockImplementation(() => {
        throw new Error('VACUUM failed');
      });
      expect(() => performVacuum()).toThrow('VACUUM failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // ==================== performAnalyze ====================

  describe('performAnalyze', () => {
    it('should execute ANALYZE and log success', () => {
      performAnalyze();
      expect(mockDb.exec).toHaveBeenCalledWith('ANALYZE');
      expect(mockLogger.startTimer).toHaveBeenCalledWith('Database ANALYZE');
      expect(mockLogger.info).toHaveBeenCalledWith('✅ ANALYZE completed - updated query optimizer statistics');
    });

    it('should throw and log error on failure', () => {
      mockDb.exec.mockImplementation(() => {
        throw new Error('ANALYZE failed');
      });
      expect(() => performAnalyze()).toThrow('ANALYZE failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // ==================== performIntegrityCheck ====================

  describe('performIntegrityCheck', () => {
    it('should return ok when integrity check passes', () => {
      mockDb.pragma.mockReturnValue([{ integrity_check: 'ok' }]);
      const result = performIntegrityCheck();
      expect(result).toEqual({ ok: true, result: 'ok' });
      expect(mockDb.pragma).toHaveBeenCalledWith('integrity_check');
      expect(mockLogger.info).toHaveBeenCalledWith('✅ Integrity check passed - database is healthy');
    });

    it('should return not ok when integrity check fails', () => {
      mockDb.pragma.mockReturnValue([{ integrity_check: 'corrupt' }]);
      const result = performIntegrityCheck();
      expect(result).toEqual({ ok: false, result: 'corrupt' });
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle pragma returning empty array', () => {
      mockDb.pragma.mockReturnValue([]);
      const result = performIntegrityCheck();
      expect(result.ok).toBe(false);
    });

    it('should handle errors gracefully', () => {
      mockDb.pragma.mockImplementation(() => {
        throw new Error('Check failed');
      });
      const result = performIntegrityCheck();
      expect(result).toEqual({ ok: false, result: 'Check failed' });
    });
  });

  // ==================== performCheckpoint ====================

  describe('performCheckpoint', () => {
    it('should execute WAL checkpoint and log success', () => {
      performCheckpoint();
      expect(mockDb.pragma).toHaveBeenCalledWith('wal_checkpoint(TRUNCATE)');
      expect(mockLogger.startTimer).toHaveBeenCalledWith('WAL Checkpoint');
      expect(mockLogger.info).toHaveBeenCalledWith('✅ WAL checkpoint completed - WAL file truncated');
    });

    it('should throw and log error on failure', () => {
      mockDb.pragma.mockImplementation(() => {
        throw new Error('Checkpoint failed');
      });
      expect(() => performCheckpoint()).toThrow('Checkpoint failed');
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  // ==================== performMaintenance ====================

  describe('performMaintenance', () => {
    it('should delegate to performVacuum for "vacuum" operation', () => {
      performMaintenance('vacuum');
      expect(mockDb.exec).toHaveBeenCalledWith('VACUUM');
    });

    it('should delegate to performAnalyze for "analyze" operation', () => {
      performMaintenance('analyze');
      expect(mockDb.exec).toHaveBeenCalledWith('ANALYZE');
    });

    it('should delegate to performIntegrityCheck for "integrity_check" operation', () => {
      mockDb.pragma.mockReturnValue([{ integrity_check: 'ok' }]);
      performMaintenance('integrity_check');
      expect(mockDb.pragma).toHaveBeenCalledWith('integrity_check');
    });
  });

  // ==================== performFullMaintenance ====================

  describe('performFullMaintenance', () => {
    it('should run integrity check, analyze, and checkpoint by default', () => {
      mockDb.pragma
        .mockReturnValueOnce([{ integrity_check: 'ok' }])
        .mockReturnValueOnce([]);

      performFullMaintenance();

      expect(mockDb.pragma).toHaveBeenCalledWith('integrity_check');
      expect(mockDb.exec).toHaveBeenCalledWith('ANALYZE');
      expect(mockDb.pragma).toHaveBeenCalledWith('wal_checkpoint(TRUNCATE)');
      expect(mockDb.exec).not.toHaveBeenCalledWith('VACUUM');
      expect(mockLogger.info).toHaveBeenCalledWith('✅ Full database maintenance completed successfully');
    });

    it('should run VACUUM when vacuum option is true', () => {
      mockDb.pragma
        .mockReturnValueOnce([{ integrity_check: 'ok' }])
        .mockReturnValueOnce([]);

      performFullMaintenance({ vacuum: true });

      expect(mockDb.exec).toHaveBeenCalledWith('VACUUM');
      expect(mockDb.exec).toHaveBeenCalledWith('ANALYZE');
      expect(mockDb.pragma).toHaveBeenCalledWith('wal_checkpoint(TRUNCATE)');
    });

    it('should throw when integrity check fails', () => {
      mockDb.pragma.mockReturnValue([{ integrity_check: 'corrupt' }]);

      expect(() => performFullMaintenance()).toThrow(
        'Database integrity check failed: corrupt'
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should not run subsequent steps after integrity check failure', () => {
      mockDb.pragma.mockReturnValue([{ integrity_check: 'corrupt' }]);

      expect(() => performFullMaintenance()).toThrow();
      // ANALYZE and checkpoint should not be called
      expect(mockDb.exec).not.toHaveBeenCalled();
      expect(mockDb.pragma).toHaveBeenCalledTimes(1); // only integrity_check
    });
  });

  // ==================== startDatabaseMaintenance / stopDatabaseMaintenance ====================

  describe('startDatabaseMaintenance', () => {
    it('should start the maintenance scheduler', () => {
      startDatabaseMaintenance();
      expect(mockLogger.info).toHaveBeenCalledWith('✅ Database maintenance scheduler started');
      expect(mockLogger.info).toHaveBeenCalledWith(
        '📅 Maintenance schedule: Daily(WAL checkpoint), Weekly(ANALYZE), Monthly(VACUUM)'
      );
    });

    it('should not create duplicate timer when already running', () => {
      startDatabaseMaintenance();
      vi.clearAllMocks();
      startDatabaseMaintenance();
      expect(mockLogger.info).toHaveBeenCalledWith('Database maintenance scheduler already running');
    });
  });

  describe('stopDatabaseMaintenance', () => {
    it('should stop the maintenance scheduler', () => {
      startDatabaseMaintenance();
      vi.clearAllMocks();
      stopDatabaseMaintenance();
      expect(mockLogger.info).toHaveBeenCalledWith('🛑 Database maintenance scheduler stopped');
    });

    it('should be a no-op when not running', () => {
      stopDatabaseMaintenance();
      // No error thrown, logger.info for stop not called
      expect(mockLogger.info).not.toHaveBeenCalledWith('🛑 Database maintenance scheduler stopped');
    });
  });
});