import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockDb, mockAll, mockGet } = vi.hoisted(() => {
  const mockAll = vi.fn(() => []);
  const mockGet = vi.fn(() => undefined);
  const mockRun = vi.fn(() => ({ changes: 0, lastInsertRowid: 0 }));

  const mockDb = {
    prepare: vi.fn(() => ({
      all: mockAll,
      get: mockGet,
      run: mockRun,
    })),
    pragma: vi.fn(() => []),
    exec: vi.fn(),
  };

  return { mockDb, mockAll, mockGet };
});

vi.mock('./core', () => ({
  db: mockDb,
  getDbInstance: () => mockDb,
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    statSync: vi.fn(() => ({ size: 0 })),
  },
}));

vi.mock('../../utils/env', () => ({
  env: {
    DATABASE_PATH: '/test/db.sqlite',
  },
}));

import { getTableIndexes, getQuerySuggestions, getDatabaseHealthStatus } from './health';

describe('database/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // restore default mock implementations
    mockDb.prepare.mockImplementation(() => ({
      all: mockAll,
      get: mockGet,
      run: vi.fn(() => ({ changes: 0, lastInsertRowid: 0 })),
    }));
    mockDb.pragma.mockImplementation(() => []);
    mockAll.mockReturnValue([]);
    mockGet.mockReturnValue(undefined);
  });

  // ==================== getTableIndexes ====================

  describe('getTableIndexes', () => {
    it('should return empty array when no tables exist', () => {
      mockAll.mockReturnValue([]);
      const result = getTableIndexes();
      expect(result).toEqual([]);
    });

    it('should return table index information for a single table', () => {
      mockAll
        .mockReturnValueOnce([{ name: 'alerts' }])
        .mockReturnValueOnce([{ name: 'idx_alerts_status', unique: 1, origin: 'c' }])
        .mockReturnValueOnce([{ name: 'status' }]);
      mockGet.mockReturnValue({ count: 100 });

      const result = getTableIndexes();
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        tableName: 'alerts',
        indexName: 'idx_alerts_status',
        columns: 'status',
        isUnique: true,
        rowCount: 100,
      });
    });

    it('should handle multiple tables with multiple indexes', () => {
      // Two tables: 'alerts' (1 index) and 'servers' (2 indexes) = 3 total indexes
      mockAll
        .mockReturnValueOnce([{ name: 'alerts' }, { name: 'servers' }])
        // alerts indexes
        .mockReturnValueOnce([{ name: 'idx_alerts_status', unique: 1, origin: 'c' }])
        .mockReturnValueOnce([{ name: 'status' }])
        // servers indexes
        .mockReturnValueOnce([{ name: 'idx_servers_host', unique: 0, origin: 'c' }, { name: 'idx_servers_name', unique: 1, origin: 'u' }])
        .mockReturnValueOnce([{ name: 'host' }])
        .mockReturnValueOnce([{ name: 'name' }]);
      // get() is called per index, not per table: 1 + 2 = 3 calls
      mockGet
        .mockReturnValueOnce({ count: 100 })
        .mockReturnValueOnce({ count: 50 })
        .mockReturnValueOnce({ count: 50 });

      const result = getTableIndexes();
      expect(result).toHaveLength(3);
      expect(result[0].tableName).toBe('alerts');
      expect(result[1].tableName).toBe('servers');
      expect(result[2].tableName).toBe('servers');
    });

    it('should handle tables with no indexes', () => {
      mockAll
        .mockReturnValueOnce([{ name: 'empty_table' }])
        .mockReturnValueOnce([]);
      mockGet.mockReturnValue({ count: 0 });

      const result = getTableIndexes();
      expect(result).toEqual([]);
    });

    it('should handle database errors gracefully', () => {
      mockDb.prepare.mockImplementation(() => {
        throw new Error('DB error');
      });
      const result = getTableIndexes();
      expect(result).toEqual([]);
    });
  });

  // ==================== getQuerySuggestions ====================

  describe('getQuerySuggestions', () => {
    it('should return empty array when no tables exist', () => {
      mockAll.mockReturnValue([]);
      const result = getQuerySuggestions();
      expect(result).toEqual([]);
    });

    it('should not suggest for small tables', () => {
      mockAll.mockReturnValueOnce([{ name: 'small_table' }]);
      mockGet.mockReturnValue({ count: 100 });

      const result = getQuerySuggestions();
      expect(result).toEqual([]);
    });

    it('should suggest high priority for large tables with few indexes', () => {
      mockAll
        .mockReturnValueOnce([{ name: 'big_table' }])
        .mockReturnValueOnce([]); // no indexes
      mockGet.mockReturnValue({ count: 50000 });

      const result = getQuerySuggestions();
      const highPriority = result.filter(r => r.priority === 'high');
      expect(highPriority).toHaveLength(1);
      expect(highPriority[0].table).toBe('big_table');
      expect(highPriority[0].suggestion).toContain('50000');
    });

    it('should not suggest high priority when table has 2+ indexes', () => {
      mockAll
        .mockReturnValueOnce([{ name: 'big_table' }])
        .mockReturnValueOnce([{ name: 'idx1', unique: 0, origin: 'c' }, { name: 'idx2', unique: 0, origin: 'c' }]);
      mockGet.mockReturnValue({ count: 50000 });

      const result = getQuerySuggestions();
      const highPriority = result.filter(r => r.priority === 'high');
      expect(highPriority).toHaveLength(0);
    });

    it('should suggest medium priority for very large tables', () => {
      mockAll
        .mockReturnValueOnce([{ name: 'huge_table' }])
        .mockReturnValueOnce([{ name: 'idx1', unique: 0, origin: 'c' }, { name: 'idx2', unique: 0, origin: 'c' }]);
      mockGet.mockReturnValue({ count: 200000 });

      const result = getQuerySuggestions();
      const mediumPriority = result.filter(r => r.priority === 'medium');
      expect(mediumPriority).toHaveLength(1);
      expect(mediumPriority[0].suggestion).toContain('200000');
    });

    it('should give both high and medium suggestions for huge tables with few indexes', () => {
      mockAll
        .mockReturnValueOnce([{ name: 'huge_table' }])
        .mockReturnValueOnce([]); // no indexes
      mockGet.mockReturnValue({ count: 200000 });

      const result = getQuerySuggestions();
      const priorities = result.map(r => r.priority);
      expect(priorities).toContain('high');
      expect(priorities).toContain('medium');
    });

    it('should handle database errors gracefully', () => {
      mockDb.prepare.mockImplementation(() => {
        throw new Error('DB error');
      });
      const result = getQuerySuggestions();
      expect(result).toEqual([]);
    });
  });

  // ==================== getDatabaseHealthStatus ====================

  describe('getDatabaseHealthStatus', () => {
    it('should return health status with all properties', () => {
      mockDb.pragma.mockImplementation((name: string) => {
        if (name === 'page_count') return [{ page_count: 100 }];
        if (name === 'page_size') return [{ page_size: 4096 }];
        if (name === 'cache_size') return [{ cache_size: 2000 }];
        if (name === 'freelist_count') return [{ freelist_count: 5 }];
        return [];
      });
      mockGet
        .mockReturnValueOnce({ count: 10 })
        .mockReturnValueOnce({ count: 5 });

      const result = getDatabaseHealthStatus();
      expect(result).toEqual({
        pageCount: 100,
        pageSize: 4096,
        walSize: 0,
        cacheSize: 2000,
        tableCount: 10,
        indexCount: 5,
        totalSize: '400.00 KB',
        freePages: 5,
      });
    });

    it('should handle missing pragma values with defaults', () => {
      mockDb.pragma.mockImplementation(() => []);
      mockGet
        .mockReturnValueOnce({ count: 0 })
        .mockReturnValueOnce({ count: 0 });

      const result = getDatabaseHealthStatus();
      expect(result.pageCount).toBe(0);
      expect(result.pageSize).toBe(0);
      expect(result.cacheSize).toBe(0);
      expect(result.freePages).toBe(0);
      expect(result.totalSize).toBe('0 B');
    });

    it('should handle errors and return fallback values', () => {
      mockDb.pragma.mockImplementation(() => {
        throw new Error('DB error');
      });
      const result = getDatabaseHealthStatus();
      expect(result).toEqual({
        pageCount: 0,
        pageSize: 0,
        walSize: 0,
        cacheSize: 0,
        tableCount: 0,
        indexCount: 0,
        totalSize: '0 B',
        freePages: 0,
      });
    });
  });
});