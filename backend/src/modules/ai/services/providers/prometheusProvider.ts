import type { Provider, ProviderResult } from './types';

/**
 * Prometheus Provider
 */
export const prometheusProvider: Provider = {
  name: 'prometheus',
  description: 'Prometheus 监控 Provider',
  version: '1.0.0',
  methods: [
    {
      name: 'query',
      description: '执行 PromQL 查询',
      inputs: [
        { name: 'url', type: 'string', description: 'Prometheus 地址', required: true },
        { name: 'query', type: 'string', description: 'PromQL 查询语句', required: true },
        { name: 'time', type: 'number', description: '查询时间戳' },
        { name: 'timeout', type: 'number', description: '超时时间(ms)' }
      ],
      outputs: [
        { name: 'result', type: 'any' },
        { name: 'status', type: 'string' }
      ],
      examples: [
        {
          title: '查询 CPU 使用率',
          inputs: {
            url: 'http://localhost:9090',
            query: '100 - (avg by (instance) (irate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'
          }
        }
      ]
    },
    {
      name: 'queryRange',
      description: '执行范围查询',
      inputs: [
        { name: 'url', type: 'string', description: 'Prometheus 地址', required: true },
        { name: 'query', type: 'string', description: 'PromQL 查询语句', required: true },
        { name: 'start', type: 'number', description: '开始时间戳', required: true },
        { name: 'end', type: 'number', description: '结束时间戳', required: true },
        { name: 'step', type: 'string', description: '步长，如 15s, 1m, 5m', required: true }
      ],
      outputs: [
        { name: 'result', type: 'any' },
        { name: 'status', type: 'string' }
      ],
      examples: []
    },
    {
      name: 'alerts',
      description: '获取告警信息',
      inputs: [
        { name: 'url', type: 'string', description: 'Prometheus 地址', required: true }
      ],
      outputs: [
        { name: 'alerts', type: 'array' },
        { name: 'status', type: 'string' }
      ],
      examples: []
    }
  ]
};

// Prometheus 方法实现
export const prometheusMethods = {
  async query(params: Record<string, unknown>): Promise<ProviderResult> {
    try {
      let url = `${params.url}/api/v1/query?query=${encodeURIComponent(params.query as string)}`;
      if (params.time) {
        url += `&time=${params.time}`;
      }

      const response = await fetch(url as string, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json() as Record<string, unknown>;

      return {
        success: data.status === 'success',
        data: {
          result: data.data,
          status: data.status
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  },

  async queryRange(params: Record<string, unknown>): Promise<ProviderResult> {
    try {
      const url = `${params.url}/api/v1/query_range?query=${encodeURIComponent(params.query as string)}&start=${params.start}&end=${params.end}&step=${params.step}`;
      const response = await fetch(url as string, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json() as Record<string, unknown>;

      return {
        success: data.status === 'success',
        data: {
          result: data.data,
          status: data.status
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  },

  async alerts(params: Record<string, unknown>): Promise<ProviderResult> {
    try {
      const response = await fetch(`${params.url}/api/v1/alerts` as string);
      const data = await response.json() as Record<string, unknown>;

      return {
        success: data.status === 'success',
        data: {
          alerts: (data.data as Record<string, unknown>)?.alerts,
          status: data.status
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
};