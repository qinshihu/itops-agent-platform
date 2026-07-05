import { describe, it, expect, vi, beforeAll } from 'vitest';

// ============================================================
// 核心模块基础测试（重构后路径更新）
// ============================================================

// Mock all dependencies to avoid side effects from native modules
vi.mock('better-sqlite3', () => ({
  default: vi.fn(() => ({
    prepare: vi.fn(() => ({ get: vi.fn(), all: vi.fn(), run: vi.fn() })),
    close: vi.fn(),
    pragma: vi.fn(),
  })),
}));

vi.mock('../models/database', () => {
  const mockDb = {
    prepare: vi.fn(() => ({
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn(),
    })),
    close: vi.fn(),
    pragma: vi.fn(),
  };
  return { default: mockDb, db: mockDb, initializeDatabase: vi.fn(), setIOInstance: vi.fn(), getIOInstance: vi.fn() };
});

vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

vi.mock('../utils/env', () => ({
  env: { JWT_SECRET: 'test-secret', NODE_ENV: 'test', DATABASE_PATH: ':memory:' },
}));

vi.mock('../shared/websocket/handler', () => ({
  emitToDC: vi.fn(),
  emitToAlerts: vi.fn(),
  emitToTask: vi.fn(),
  setupWebSocket: vi.fn(),
}));

vi.mock('../modules/auth/services/tokenBlacklist', () => ({
  tokenBlacklist: { isBlacklisted: vi.fn(() => false), add: vi.fn(), remove: vi.fn() },
}));

describe('Auth Routes', () => {
  it('should have login validation schema', async () => {
    const { authSchemas } = await import('../shared/schemas/apiValidation');
    const result = authSchemas.login.safeParse({ username: 'test', password: 'pass' });
    expect(result.success).toBe(true);
  });

  it('should reject empty login', async () => {
    const { authSchemas } = await import('../shared/schemas/apiValidation');
    const result = authSchemas.login.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe('DC Status Service', () => {
  it('should export startDCStatusPush and stopDCStatusPush', async () => {
    const mod = await import('../modules/dc/services/dcStatusService');
    expect(typeof mod.startDCStatusPush).toBe('function');
    expect(typeof mod.stopDCStatusPush).toBe('function');
  });
});

describe('MultiAgent System (Coordinator + Specialist)', () => {
  let multiAgent: typeof import('../modules/ai/services/multiAgent');

  beforeAll(async () => {
    multiAgent = await import('../modules/ai/services/multiAgent');
  }, 30000);

  it('should initialize and return a coordinator', () => {
    const coordinator = multiAgent.initializeMultiAgentSystem();
    expect(coordinator).toBeDefined();
    expect(coordinator.id).toBeDefined();
    expect(multiAgent.getCoordinator()).toBe(coordinator);
  });

  it('should register specialists after initialization', () => {
    multiAgent.initializeMultiAgentSystem();
    const specialists = multiAgent.specialistRegistry.getAll();
    expect(specialists.length).toBeGreaterThan(0);
  });
});

describe('Response Helper', () => {
  it('should format success response', async () => {
    const { respond } = await import('../shared/utils/response');
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res = { status } as any;
    respond(res, { hello: 'world' });
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({ success: true, data: { hello: 'world' } });
  });

  it('should format error response', async () => {
    const { respondError } = await import('../shared/utils/response');
    const json = vi.fn();
    const status = vi.fn(() => ({ json }));
    const res = { status } as any;
    respondError(res, 'test error');
    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ success: false, error: 'test error' });
  });
});
