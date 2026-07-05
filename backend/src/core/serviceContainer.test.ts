/**
 * ServiceContainer 测试（阶段5.3 验收 — DI 容器可替换为 mock）
 *
 * 验证：
 *   1. register + get 正常流程
 *   2. 先注册者获胜（重复 register 被跳过）
 *   3. replace() 可强制覆盖已注册服务（测试 mock 注入）
 *   4. tryGet 对未注册服务返回 undefined
 *   5. 按依赖顺序拓扑排序初始化
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServiceContainer } from './serviceContainer';

// Mock logger 避免初始化副作用
vi.mock('../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

describe('ServiceContainer', () => {
  let container: ServiceContainer;

  beforeEach(() => {
    container = new ServiceContainer();
  });

  describe('register + get', () => {
    it('注册并获取服务实例', async () => {
      const mockRepo = { findAll: () => ['a', 'b'] };
      container.register('alertRepository', () => mockRepo);
      await container.initAll();

      const result = container.get<typeof mockRepo>('alertRepository');
      expect(result).toBe(mockRepo);
      expect(result.findAll()).toEqual(['a', 'b']);
    });

    it('先注册者获胜 — 重复 register 被跳过', async () => {
      const first = { id: 'first' };
      const second = { id: 'second' };

      container.register('svc', () => first);
      container.register('svc', () => second); // 应被跳过
      await container.initAll();

      expect(container.get('svc')).toBe(first);
    });
  });

  describe('replace (测试 mock 注入)', () => {
    it('replace 可强制覆盖已注册服务', async () => {
      const realRepo = { findAll: () => ['real'] };
      const mockRepo = { findAll: vi.fn(() => ['mock']) };

      container.register('alertRepository', () => realRepo);
      await container.initAll();

      // 替换为 mock
      container.replace('alertRepository', mockRepo);

      const result = container.get<typeof mockRepo>('alertRepository');
      expect(result).toBe(mockRepo);
      expect(result.findAll()).toEqual(['mock']);
      expect(mockRepo.findAll).toHaveBeenCalledTimes(1);
    });

    it('replace 后 isInitialized 返回 true', () => {
      const mock = { test: true };
      container.replace('dcRepository', mock);

      expect(container.isInitialized('dcRepository')).toBe(true);
      expect(container.get('dcRepository')).toBe(mock);
    });

    it('replace 可覆盖尚未初始化的注册（跳过工厂）', async () => {
      const factorySpy = vi.fn(() => ({ real: true }));
      container.register('svc', factorySpy);

      // 在 initAll 之前 replace
      const mock = { mock: true };
      container.replace('svc', mock);

      const result = container.get('svc');
      expect(result).toBe(mock);
      expect(factorySpy).not.toHaveBeenCalled();
    });
  });

  describe('tryGet', () => {
    it('未注册服务返回 undefined', () => {
      expect(container.tryGet('nonexistent')).toBeUndefined();
    });

    it('已注册未初始化返回 undefined', () => {
      container.register('svc', () => ({ value: 1 }));
      expect(container.tryGet('svc')).toBeUndefined();
    });

    it('已初始化返回实例', async () => {
      const instance = { value: 42 };
      container.register('svc', () => instance);
      await container.initAll();
      expect(container.tryGet('svc')).toBe(instance);
    });
  });

  describe('拓扑排序', () => {
    it('按依赖顺序初始化', async () => {
      const order: string[] = [];
      container.register('a', () => { order.push('a'); return {}; }, ['b']);
      container.register('b', () => { order.push('b'); return {}; }, ['c']);
      container.register('c', () => { order.push('c'); return {}; });

      await container.initAll();

      // c 必须先于 b，b 必须先于 a
      expect(order).toEqual(['c', 'b', 'a']);
    });

    it('检测循环依赖', async () => {
      container.register('a', () => ({}), ['b']);
      container.register('b', () => ({}), ['a']);

      await expect(container.initAll()).rejects.toThrow(/Circular dependency/);
    });
  });
});
