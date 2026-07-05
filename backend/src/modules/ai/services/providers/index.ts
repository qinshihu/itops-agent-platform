/**
 * Providers 模块
 */

export * from './types';
export * from './ProviderRegistry';
export * from './builtins';

// 扩展 Provider
export * from './prometheusProvider';
export * from './elasticsearchProvider';
export * from './dingtalkProvider';
export * from './wecomProvider';
export * from './slackProvider';
export * from './kubernetesProvider';

import { providerRegistry } from './ProviderRegistry';
import type { ProviderRegistry } from './ProviderRegistry';
import {
  httpProvider,
  httpMethods,
  notifyProvider,
  notifyMethods,
  scriptProvider,
  scriptMethods,
  databaseProvider,
  databaseMethods
} from './builtins';
import { prometheusProvider, prometheusMethods } from './prometheusProvider';
import { elasticsearchProvider, elasticsearchMethods } from './elasticsearchProvider';
import { dingtalkProvider, dingtalkMethods } from './dingtalkProvider';
import { wecomProvider, wecomMethods } from './wecomProvider';
import { slackProvider, slackMethods } from './slackProvider';
import { kubernetesProvider, kubernetesMethods } from './kubernetesProvider';

/**
 * 注册所有扩展 Provider
 */
export function registerExtendedProviders(registry: ProviderRegistry): void {
  registry.register(prometheusProvider, prometheusMethods);
  registry.register(elasticsearchProvider, elasticsearchMethods);
  registry.register(dingtalkProvider, dingtalkMethods);
  registry.register(wecomProvider, wecomMethods);
  registry.register(slackProvider, slackMethods);
  registry.register(kubernetesProvider, kubernetesMethods);
}

/**
 * 初始化所有内置 Provider
 */
export function initializeProviders(): void {
  providerRegistry.register(httpProvider, httpMethods);
  providerRegistry.register(notifyProvider, notifyMethods);
  providerRegistry.register(scriptProvider, scriptMethods);
  providerRegistry.register(databaseProvider, databaseMethods);
  registerExtendedProviders(providerRegistry);
}