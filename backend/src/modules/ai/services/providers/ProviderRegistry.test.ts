/**
 * ProviderRegistry 测试
 *
 * 验证：
 *   - register/get 存取 Provider
 *   - getAll/getEnabled 过滤
 *   - isEnabled 默认 true，config 可覆盖
 *   - execute 找不到/禁用/方法不存在 三种异常
 *   - setConfig/getConfig 配置存取
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProviderRegistry } from './ProviderRegistry';

vi.mock('../../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

function makeProvider(name: string, version = '1.0.0') {
  return { name, version, initialize: vi.fn() } as never;
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
  });

  describe('register + get', () => {
    it('注册后可通过 name 获取', () => {
      const p = makeProvider('foo');
      registry.register(p);
      expect(registry.get('foo')).toBe(p);
    });

    it('未注册返回 undefined', () => {
      expect(registry.get('missing')).toBeUndefined();
    });
  });

  describe('getAll / getEnabled', () => {
    it('getAll 返回所有已注册 Provider', () => {
      registry.register(makeProvider('a'));
      registry.register(makeProvider('b'));
      expect(registry.getAll()).toHaveLength(2);
    });

    it('getEnabled 排除 enabled=false 的 Provider', () => {
      registry.register(makeProvider('a'));
      registry.register(makeProvider('b'));
      registry.setConfig('b', { enabled: false, config: {} } as never);
      const enabled = registry.getEnabled();
      expect(enabled).toHaveLength(1);
      expect(enabled[0].name).toBe('a');
    });
  });

  describe('isEnabled', () => {
    it('无配置时默认 true', () => {
      registry.register(makeProvider('a'));
      expect(registry.isEnabled('a')).toBe(true);
    });

    it('配置 enabled=false 后返回 false', () => {
      registry.register(makeProvider('a'));
      registry.setConfig('a', { enabled: false, config: {} } as never);
      expect(registry.isEnabled('a')).toBe(false);
    });
  });

  describe('execute', () => {
    it('Provider 不存在时抛出', async () => {
      await expect(registry.execute('missing', 'method', {})).rejects.toThrow('Provider not found');
    });

    it('Provider 禁用时抛出', async () => {
      registry.register(makeProvider('a'));
      registry.setConfig('a', { enabled: false, config: {} } as never);
      await expect(registry.execute('a', 'method', {})).rejects.toThrow('disabled');
    });

    it('方法不存在时抛出', async () => {
      registry.register(makeProvider('a'), {} as never);
      await expect(registry.execute('a', 'missingMethod', {})).rejects.toThrow('Method not found');
    });

    it('正常调用 implementation 方法', async () => {
      const impl = { doSomething: vi.fn().mockResolvedValue('result') };
      registry.register(makeProvider('a'), impl as never);
      const result = await registry.execute('a', 'doSomething', { x: 1 });
      expect(result).toBe('result');
      expect(impl.doSomething).toHaveBeenCalledWith({ x: 1 });
    });
  });

  describe('initializeAll', () => {
    it('调用所有启用 Provider 的 initialize', async () => {
      const p1 = makeProvider('a');
      const p2 = makeProvider('b');
      registry.register(p1);
      registry.register(p2);
      await registry.initializeAll();
      expect(p1.initialize).toHaveBeenCalled();
      expect(p2.initialize).toHaveBeenCalled();
    });

    it('某个 Provider 初始化失败不影响其他', async () => {
      const p1 = makeProvider('a');
      p1.initialize = vi.fn().mockRejectedValue(new Error('init fail'));
      const p2 = makeProvider('b');
      registry.register(p1);
      registry.register(p2);
      await registry.initializeAll();
      expect(p2.initialize).toHaveBeenCalled();
    });
  });
});
