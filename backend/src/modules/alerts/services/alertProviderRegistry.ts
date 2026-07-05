/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger';
import { alertRepository } from '../../../repositories';

/**
 * 告警 Provider 接口
 */
export interface AlertProvider {
  id: string;
  name: string;
  type: 'prometheus' | 'zabbix' | 'webhook' | 'grafana' | 'other';
  configSchema: any;
  fetchAlerts: (config: Record<string, any>) => Promise<any[]>;
  handleWebhook: (payload: Record<string, any>) => any[];
}

/**
 * 告警 Provider 注册表
 */
class AlertProviderRegistry {
  private providers = new Map<string, AlertProvider>();

  register(provider: AlertProvider) {
    this.providers.set(provider.id, provider);
    logger.info(`✅ Registered alert provider: ${provider.id}`);
  }

  getProvider(id: string): AlertProvider | undefined {
    return this.providers.get(id);
  }

  listProviders(): AlertProvider[] {
    return Array.from(this.providers.values());
  }

  listProvidersByType(type: AlertProvider['type']): AlertProvider[] {
    return this.listProviders().filter(p => p.type === type);
  }
}

export const alertProviderRegistry = new AlertProviderRegistry();

// 预注册一些基础 Alert Provider
(() => {
  try {
    // 1. Webhook Provider（真实实现）
    alertProviderRegistry.register({
      id: 'webhook',
      name: 'Webhook',
      type: 'webhook',
      configSchema: {
        type: 'object',
        properties: {
          endpoint: { type: 'string', description: 'Webhook 端点' }
        },
        required: ['endpoint']
      },
      fetchAlerts: async () => [],
      handleWebhook: (payload) => {
        logger.info('🔔 收到 Webhook 告警: ', payload);
        const alertData = {
          id: randomUUID(),
          title: payload.title || 'Webhook 告警',
          severity: payload.severity || 'warning',
          content: payload.content || JSON.stringify(payload),
          source: 'webhook',
          status: 'open',
          fingerprint: payload.fingerprint || `webhook-${Date.now()}`,
          created_at: new Date().toISOString()
        };

        try {
          // 存入数据库
          alertRepository.create({
            id: alertData.id,
            source: alertData.source,
            severity: alertData.severity,
            title: alertData.title,
            content: alertData.content,
            alert_fingerprint: alertData.fingerprint,
          });
          
          logger.info(`✅ 告警已存入数据库: ${alertData.id}`);
        } catch (error) {
          logger.error('❌ 告警存入数据库失败:', error);
        }
        
        return [alertData];
      }
    });

    // 2. Prometheus Provider（模拟实现）
    alertProviderRegistry.register({
      id: 'prometheus',
      name: 'Prometheus',
      type: 'prometheus',
      configSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Prometheus URL' },
          query: { type: 'string', description: '查询语句' }
        },
        required: ['url']
      },
      fetchAlerts: async (config) => {
        logger.info('📊 查询 Prometheus 告警: ', config.url);
        return [];
      },
      handleWebhook: () => []
    });

    // 3. Zabbix Provider（模拟实现）
    alertProviderRegistry.register({
      id: 'zabbix',
      name: 'Zabbix',
      type: 'zabbix',
      configSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'Zabbix URL' },
          token: { type: 'string', description: '认证 Token' }
        },
        required: ['url']
      },
      fetchAlerts: async (config) => {
        logger.info('🏠 查询 Zabbix 告警: ', config.url);
        return [];
      },
      handleWebhook: () => []
    });

    logger.info(`✅ 已预注册 ${alertProviderRegistry.listProviders().length} 个告警 Provider`);
  } catch (error) {
    logger.error('❌ 预注册告警 Provider 失败:', error);
  }
})();
