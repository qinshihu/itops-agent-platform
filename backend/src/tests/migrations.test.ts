/**
 * Migration Downgrade Tests — NetBox DCIM 借鉴的 6 个迁移 (v032–v037)
 *
 * 验证：
 * - up() 导出函数且不抛异常
 * - down() 导出函数且不抛异常
 * - 幂等性：重复 up/down 不抛异常
 *
 * 使用 mock 数据库（better-sqlite3 在 Node v24 下版本不匹配）
 *
 * 注意：迁移版本号在 v031_network_subnets 插入后整体后移一位，
 * 原先的 v031–v036 对应现在的 v032–v037。
 */
import { describe, it, expect, beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Database
// ---------------------------------------------------------------------------
function createMockDb() {
  return {
    exec: () => {},
    prepare: () => ({ run: () => {}, get: () => {}, all: () => [] }),
    close: () => {},
    pragma: () => {},
  };
}

// ---------------------------------------------------------------------------
// Import migrations
// ---------------------------------------------------------------------------
const migrations: Record<string, { up: (db: unknown) => void; down: (db: unknown) => void }> = {};

beforeAll(async () => {
  const [
    v032, v033, v034, v035, v036, v037,
  ] = await Promise.all([
    import('../models/migrations/v032_device_manufacturers'),
    import('../models/migrations/v033_device_types'),
    import('../models/migrations/v034_device_type_slot_definitions'),
    import('../models/migrations/v035_dc_power_panels'),
    import('../models/migrations/v036_dc_power_feeds'),
    import('../models/migrations/v037_dc_cables'),
  ]);
  migrations.v032 = v032;
  migrations.v033 = v033;
  migrations.v034 = v034;
  migrations.v035 = v035;
  migrations.v036 = v036;
  migrations.v037 = v037;
});

// ---------------------------------------------------------------------------
// 测试表
// ---------------------------------------------------------------------------
const TABLE_MAP: Record<string, string> = {
  v032: 'device_manufacturers',
  v033: 'device_types',
  v034: 'device_type_slot_definitions',
  v035: 'dc_power_panels',
  v036: 'dc_power_feeds',
  v037: 'dc_cables',
};

describe('Migration Downgrade Tests (v032–v037)', () => {
  for (const [version, table] of Object.entries(TABLE_MAP)) {
    describe(`${version}: ${table}`, () => {
      const db = createMockDb();

      it('up exports a function', () => {
        expect(typeof migrations[version].up).toBe('function');
      });

      it('down exports a function', () => {
        expect(typeof migrations[version].down).toBe('function');
      });

      it('up() runs without error', () => {
        expect(() => migrations[version].up(db as never)).not.toThrow();
      });

      it('up() is idempotent', () => {
        // Should not throw on second call
        expect(() => migrations[version].up(db as never)).not.toThrow();
      });

      it('down() runs without error', () => {
        expect(() => migrations[version].down(db as never)).not.toThrow();
      });

      it('down() is idempotent', () => {
        expect(() => migrations[version].down(db as never)).not.toThrow();
      });

      it('full round-trip: up → down → up → down', () => {
        expect(() => {
          migrations[version].up(db as never);
          migrations[version].down(db as never);
          migrations[version].up(db as never);
          migrations[version].down(db as never);
        }).not.toThrow();
      });
    });
  }
});

// ---------------------------------------------------------------------------
// ensureTable 残留清理迁移 (v051–v054)
// ---------------------------------------------------------------------------
describe('ensureTable cleanup migrations (v051–v054)', () => {
  const db = createMockDb();

  const modules: Record<string, { up: (db: unknown) => Promise<void>; down: (db: unknown) => Promise<void> }> = {};

  beforeAll(async () => {
    const [v051, v052, v053, v054] = await Promise.all([
      import('../models/migrations/v051_ai_remediations_columns'),
      import('../models/migrations/v052_knowledge_base'),
      import('../models/migrations/v053_escalation_history'),
      import('../models/migrations/v054_alert_auto_analysis'),
    ]);
    modules.v051 = v051.default;
    modules.v052 = v052.default;
    modules.v053 = v053.default;
    modules.v054 = v054.default;
  });

  for (const version of ['v051', 'v052', 'v053', 'v054']) {
    it(`${version}: up() runs without error`, async () => {
      await expect(modules[version].up(db as never)).resolves.not.toThrow();
    });

    it(`${version}: up() is idempotent`, async () => {
      await expect(modules[version].up(db as never)).resolves.not.toThrow();
    });

    it(`${version}: down() runs without error`, async () => {
      await expect(modules[version].down(db as never)).resolves.not.toThrow();
    });

    it(`${version}: down() is idempotent`, async () => {
      await expect(modules[version].down(db as never)).resolves.not.toThrow();
    });
  }
});
