import { logger } from '../../../../utils/logger';
import type { Provider, ProviderConfig, ProviderResult } from './types';

/** Provider 方法实现对象的类型 */
export type ProviderImplementation = Record<string, (params: Record<string, unknown>) => Promise<ProviderResult>>;

/**
 * Provider 注册器
 */
export class ProviderRegistry {
  private providers: Map<string, Provider> = new Map();
  private implementations: Map<string, ProviderImplementation> = new Map();
  private configs: Map<string, ProviderConfig> = new Map();

  /**
   * 注册 Provider
   */
  register(provider: Provider, implementation?: ProviderImplementation): void {
    this.providers.set(provider.name, provider);
    if (implementation) {
      this.implementations.set(provider.name, implementation);
    }
    logger.info(`[ProviderRegistry] Registered provider: ${provider.name} v${provider.version}`);
  }

  /**
   * 获取 Provider
   */
  get(name: string): Provider | undefined {
    return this.providers.get(name);
  }

  /**
   * 获取 Provider 实现
   */
  getImplementation(name: string): ProviderImplementation | undefined {
    return this.implementations.get(name);
  }

  /**
   * 获取所有 Provider
   */
  getAll(): Provider[] {
    return Array.from(this.providers.values());
  }

  /**
   * 获取所有启用的 Provider
   */
  getEnabled(): Provider[] {
    return this.getAll().filter(p => this.isEnabled(p.name));
  }

  /**
   * 设置 Provider 配置
   */
  setConfig(name: string, config: ProviderConfig): void {
    this.configs.set(name, config);
  }

  /**
   * 获取 Provider 配置
   */
  getConfig(name: string): ProviderConfig | undefined {
    return this.configs.get(name);
  }

  /**
   * 检查 Provider 是否启用
   */
  isEnabled(name: string): boolean {
    const config = this.configs.get(name);
    return config?.enabled ?? true;
  }

  /**
   * 执行 Provider 方法
   */
  async execute(name: string, method: string, params: Record<string, unknown>): Promise<ProviderResult> {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider not found: ${name}`);
    }

    if (!this.isEnabled(name)) {
      throw new Error(`Provider is disabled: ${name}`);
    }

    const implementation = this.implementations.get(name);
    if (!implementation || typeof implementation[method] !== 'function') {
      throw new Error(`Method not found: ${name}.${method}`);
    }

    logger.info(`[ProviderRegistry] Executing: ${name}.${method}`);
    return implementation[method](params);
  }

  /**
   * 初始化所有 Provider
   */
  async initializeAll(): Promise<void> {
    for (const provider of this.getEnabled()) {
      if (provider.initialize) {
        try {
          const config = this.configs.get(provider.name);
          await provider.initialize(config?.config || {});
          logger.info(`[ProviderRegistry] Initialized provider: ${provider.name}`);
        } catch (error) {
          logger.error(`[ProviderRegistry] Failed to initialize provider: ${provider.name}`, error);
        }
      }
    }
  }
}

// 导出单例
export const providerRegistry = new ProviderRegistry();
