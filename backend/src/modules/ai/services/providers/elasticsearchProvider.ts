import type { Provider, ProviderResult } from './types';

/**
 * Elasticsearch Provider
 */
export const elasticsearchProvider: Provider = {
  name: 'elasticsearch',
  description: 'Elasticsearch 搜索 Provider',
  version: '1.0.0',
  methods: [
    {
      name: 'search',
      description: '执行搜索查询',
      inputs: [
        { name: 'url', type: 'string', description: 'Elasticsearch 地址', required: true },
        { name: 'index', type: 'string', description: '索引名称', required: true },
        { name: 'query', type: 'object', description: 'DSL 查询对象', required: true },
        { name: 'size', type: 'number', description: '返回数量' },
        { name: 'from', type: 'number', description: '起始位置' }
      ],
      outputs: [
        { name: 'hits', type: 'any' },
        { name: 'total', type: 'number' },
        { name: 'took', type: 'number' }
      ],
      examples: [
        {
          title: '搜索错误日志',
          inputs: {
            url: 'http://localhost:9200',
            index: 'logs-*',
            query: { bool: { must: [{ match: { level: 'error' } }] } }
          }
        }
      ]
    },
    {
      name: 'index',
      description: '索引文档',
      inputs: [
        { name: 'url', type: 'string', description: 'Elasticsearch 地址', required: true },
        { name: 'index', type: 'string', description: '索引名称', required: true },
        { name: 'document', type: 'object', description: '文档内容', required: true },
        { name: 'id', type: 'string', description: '文档ID' }
      ],
      outputs: [
        { name: 'result', type: 'string' },
        { name: 'id', type: 'string' }
      ],
      examples: []
    },
    {
      name: 'count',
      description: '统计文档数量',
      inputs: [
        { name: 'url', type: 'string', description: 'Elasticsearch 地址', required: true },
        { name: 'index', type: 'string', description: '索引名称', required: true },
        { name: 'query', type: 'object', description: '过滤条件' }
      ],
      outputs: [
        { name: 'count', type: 'number' }
      ],
      examples: []
    }
  ]
};

// Elasticsearch 方法实现
export const elasticsearchMethods = {
  async search(params: Record<string, unknown>): Promise<ProviderResult> {
    try {
      const url = `${params.url}/${params.index}/_search`;
      const body: Record<string, unknown> = { query: params.query };
      if (params.size) body.size = params.size;
      if (params.from !== undefined) body.from = params.from;

      const response = await fetch(url as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json() as Record<string, unknown>;

      return {
        success: true,
        data: {
          hits: data.hits,
          total: (data.hits as Record<string, unknown>)?.total,
          took: data.took
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  },

  async index(params: Record<string, unknown>): Promise<ProviderResult> {
    try {
      let url = `${params.url}/${params.index}/_doc`;
      if (params.id) url += `/${params.id}`;

      const response = await fetch(url as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params.document)
      });
      const data = await response.json() as Record<string, unknown>;

      return {
        success: true,
        data: {
          result: data.result,
          id: data._id
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  },

  async count(params: Record<string, unknown>): Promise<ProviderResult> {
    try {
      const url = `${params.url}/${params.index}/_count`;
      const body = params.query ? { query: params.query } : undefined;

      const response = await fetch(url as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await response.json() as Record<string, unknown>;

      return {
        success: true,
        data: {
          count: data.count
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