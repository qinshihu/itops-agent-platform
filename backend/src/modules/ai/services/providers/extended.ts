import { logger } from '../../../../utils/logger';
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
  async query(params: any): Promise<ProviderResult> {
    try {
      let url = `${params.url}/api/v1/query?query=${encodeURIComponent(params.query)}`;
      if (params.time) {
        url += `&time=${params.time}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data: any = await response.json();

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

  async queryRange(params: any): Promise<ProviderResult> {
    try {
      const url = `${params.url}/api/v1/query_range?query=${encodeURIComponent(params.query)}&start=${params.start}&end=${params.end}&step=${params.step}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      });
      const data: any = await response.json();

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

  async alerts(params: any): Promise<ProviderResult> {
    try {
      const response = await fetch(`${params.url}/api/v1/alerts`);
      const data: any = await response.json();

      return {
        success: data.status === 'success',
        data: {
          alerts: data.data.alerts,
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
  async search(params: any): Promise<ProviderResult> {
    try {
      const url = `${params.url}/${params.index}/_search`;
      const body: any = { query: params.query };
      if (params.size) body.size = params.size;
      if (params.from !== undefined) body.from = params.from;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data: any = await response.json();

      return {
        success: true,
        data: {
          hits: data.hits,
          total: data.hits.total.value || data.hits.total,
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

  async index(params: any): Promise<ProviderResult> {
    try {
      let url = `${params.url}/${params.index}/_doc`;
      if (params.id) url += `/${params.id}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params.document)
      });
      const data: any = await response.json();

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

  async count(params: any): Promise<ProviderResult> {
    try {
      const url = `${params.url}/${params.index}/_count`;
      const body = params.query ? { query: params.query } : undefined;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined
      });
      const data: any = await response.json();

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

/**
 * 钉钉 Provider
 */
export const dingtalkProvider: Provider = {
  name: 'dingtalk',
  description: '钉钉消息通知 Provider',
  version: '1.0.0',
  methods: [
    {
      name: 'sendText',
      description: '发送文本消息',
      inputs: [
        { name: 'webhook', type: 'string', description: '钉钉机器人 Webhook', required: true },
        { name: 'content', type: 'string', description: '消息内容', required: true },
        { name: 'atMobiles', type: 'array', description: '@ 手机号码列表' },
        { name: 'isAtAll', type: 'boolean', description: '@ 所有人' }
      ],
      outputs: [
        { name: 'errcode', type: 'number' },
        { name: 'errmsg', type: 'string' }
      ],
      examples: [
        {
          title: '发送告警通知',
          inputs: {
            webhook: 'https://oapi.dingtalk.com/robot/send?access_token=xxx',
            content: '⚠️ 服务器 CPU 使用率告警，请及时处理！',
            isAtAll: false
          }
        }
      ]
    },
    {
      name: 'sendMarkdown',
      description: '发送 Markdown 消息',
      inputs: [
        { name: 'webhook', type: 'string', description: '钉钉机器人 Webhook', required: true },
        { name: 'title', type: 'string', description: '标题', required: true },
        { name: 'text', type: 'string', description: 'Markdown 内容', required: true },
        { name: 'atMobiles', type: 'array', description: '@ 手机号码列表' },
        { name: 'isAtAll', type: 'boolean', description: '@ 所有人' }
      ],
      outputs: [
        { name: 'errcode', type: 'number' },
        { name: 'errmsg', type: 'string' }
      ],
      examples: []
    },
    {
      name: 'sendCard',
      description: '发送卡片消息',
      inputs: [
        { name: 'webhook', type: 'string', description: '钉钉机器人 Webhook', required: true },
        { name: 'title', type: 'string', description: '标题', required: true },
        { name: 'text', type: 'string', description: '内容', required: true },
        { name: 'singleTitle', type: 'string', description: '按钮文字' },
        { name: 'singleURL', type: 'string', description: '按钮链接' }
      ],
      outputs: [
        { name: 'errcode', type: 'number' },
        { name: 'errmsg', type: 'string' }
      ],
      examples: []
    }
  ]
};

// 钉钉方法实现
export const dingtalkMethods = {
  async sendText(params: any): Promise<ProviderResult> {
    try {
      const body = {
        msgtype: 'text',
        text: { content: params.content },
        at: {
          atMobiles: params.atMobiles || [],
          isAtAll: params.isAtAll || false
        }
      };

      const response = await fetch(params.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data: any = await response.json();

      return {
        success: data.errcode === 0,
        data: {
          errcode: data.errcode,
          errmsg: data.errmsg
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  },

  async sendMarkdown(params: any): Promise<ProviderResult> {
    try {
      const body = {
        msgtype: 'markdown',
        markdown: { title: params.title, text: params.text },
        at: {
          atMobiles: params.atMobiles || [],
          isAtAll: params.isAtAll || false
        }
      };

      const response = await fetch(params.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data: any = await response.json();

      return {
        success: data.errcode === 0,
        data: {
          errcode: data.errcode,
          errmsg: data.errmsg
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  },

  async sendCard(params: any): Promise<ProviderResult> {
    try {
      const body = {
        msgtype: 'actionCard',
        actionCard: {
          title: params.title,
          text: params.text,
          singleTitle: params.singleTitle,
          singleURL: params.singleURL
        }
      };

      const response = await fetch(params.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data: any = await response.json();

      return {
        success: data.errcode === 0,
        data: {
          errcode: data.errcode,
          errmsg: data.errmsg
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

/**
 * 企业微信 Provider
 */
export const wecomProvider: Provider = {
  name: 'wecom',
  description: '企业微信消息通知 Provider',
  version: '1.0.0',
  methods: [
    {
      name: 'sendText',
      description: '发送文本消息',
      inputs: [
        { name: 'webhook', type: 'string', description: '企业微信群机器人 Webhook', required: true },
        { name: 'content', type: 'string', description: '消息内容', required: true },
        { name: 'mentionedList', type: 'array', description: '@ 用户ID列表' },
        { name: 'mentionedMobileList', type: 'array', description: '@ 手机号列表' }
      ],
      outputs: [
        { name: 'errcode', type: 'number' },
        { name: 'errmsg', type: 'string' }
      ],
      examples: []
    },
    {
      name: 'sendMarkdown',
      description: '发送 Markdown 消息',
      inputs: [
        { name: 'webhook', type: 'string', description: '企业微信群机器人 Webhook', required: true },
        { name: 'content', type: 'string', description: 'Markdown 内容', required: true }
      ],
      outputs: [
        { name: 'errcode', type: 'number' },
        { name: 'errmsg', type: 'string' }
      ],
      examples: []
    },
    {
      name: 'sendNews',
      description: '发送图文消息',
      inputs: [
        { name: 'webhook', type: 'string', description: '企业微信群机器人 Webhook', required: true },
        { name: 'articles', type: 'array', description: '图文列表', required: true }
      ],
      outputs: [
        { name: 'errcode', type: 'number' },
        { name: 'errmsg', type: 'string' }
      ],
      examples: []
    }
  ]
};

// 企业微信方法实现
export const wecomMethods = {
  async sendText(params: any): Promise<ProviderResult> {
    try {
      const body = {
        msgtype: 'text',
        text: {
          content: params.content,
          mentioned_list: params.mentionedList || [],
          mentioned_mobile_list: params.mentionedMobileList || []
        }
      };

      const response = await fetch(params.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data: any = await response.json();

      return {
        success: data.errcode === 0,
        data: {
          errcode: data.errcode,
          errmsg: data.errmsg
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  },

  async sendMarkdown(params: any): Promise<ProviderResult> {
    try {
      const body = {
        msgtype: 'markdown',
        markdown: { content: params.content }
      };

      const response = await fetch(params.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data: any = await response.json();

      return {
        success: data.errcode === 0,
        data: {
          errcode: data.errcode,
          errmsg: data.errmsg
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  },

  async sendNews(params: any): Promise<ProviderResult> {
    try {
      const body = {
        msgtype: 'news',
        news: { articles: params.articles }
      };

      const response = await fetch(params.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data: any = await response.json();

      return {
        success: data.errcode === 0,
        data: {
          errcode: data.errcode,
          errmsg: data.errmsg
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

/**
 * Slack Provider
 */
export const slackProvider: Provider = {
  name: 'slack',
  description: 'Slack 消息通知 Provider',
  version: '1.0.0',
  methods: [
    {
      name: 'sendMessage',
      description: '发送消息',
      inputs: [
        { name: 'webhook', type: 'string', description: 'Slack Webhook URL', required: true },
        { name: 'text', type: 'string', description: '消息内容', required: true },
        { name: 'channel', type: 'string', description: '频道' },
        { name: 'username', type: 'string', description: '用户名' },
        { name: 'iconEmoji', type: 'string', description: '图标' }
      ],
      outputs: [
        { name: 'ok', type: 'boolean' }
      ],
      examples: []
    },
    {
      name: 'sendBlocks',
      description: '发送块消息',
      inputs: [
        { name: 'webhook', type: 'string', description: 'Slack Webhook URL', required: true },
        { name: 'blocks', type: 'array', description: '块内容', required: true },
        { name: 'text', type: 'string', description: '回退文本' },
        { name: 'channel', type: 'string', description: '频道' }
      ],
      outputs: [
        { name: 'ok', type: 'boolean' }
      ],
      examples: []
    },
    {
      name: 'sendAttachments',
      description: '发送附件消息',
      inputs: [
        { name: 'webhook', type: 'string', description: 'Slack Webhook URL', required: true },
        { name: 'attachments', type: 'array', description: '附件列表', required: true },
        { name: 'channel', type: 'string', description: '频道' }
      ],
      outputs: [
        { name: 'ok', type: 'boolean' }
      ],
      examples: []
    }
  ]
};

// Slack 方法实现
export const slackMethods = {
  async sendMessage(params: any): Promise<ProviderResult> {
    try {
      const body: any = { text: params.text };
      if (params.channel) body.channel = params.channel;
      if (params.username) body.username = params.username;
      if (params.iconEmoji) body.icon_emoji = params.iconEmoji;

      const response = await fetch(params.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const ok = response.ok;

      return {
        success: ok,
        data: { ok }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  },

  async sendBlocks(params: any): Promise<ProviderResult> {
    try {
      const body: any = { blocks: params.blocks };
      if (params.text) body.text = params.text;
      if (params.channel) body.channel = params.channel;

      const response = await fetch(params.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const ok = response.ok;

      return {
        success: ok,
        data: { ok }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  },

  async sendAttachments(params: any): Promise<ProviderResult> {
    try {
      const body: any = { attachments: params.attachments };
      if (params.channel) body.channel = params.channel;

      const response = await fetch(params.webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const ok = response.ok;

      return {
        success: ok,
        data: { ok }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
};

/**
 * Kubernetes Provider
 */
export const kubernetesProvider: Provider = {
  name: 'kubernetes',
  description: 'Kubernetes 管理 Provider',
  version: '1.0.0',
  methods: [
    {
      name: 'listPods',
      description: '列出 Pod',
      inputs: [
        { name: 'kubeConfig', type: 'string', description: 'Kubeconfig 内容' },
        { name: 'namespace', type: 'string', description: '命名空间' },
        { name: 'labelSelector', type: 'string', description: '标签选择器' }
      ],
      outputs: [
        { name: 'pods', type: 'array' }
      ],
      examples: []
    },
    {
      name: 'getPodLogs',
      description: '获取 Pod 日志',
      inputs: [
        { name: 'kubeConfig', type: 'string', description: 'Kubeconfig 内容' },
        { name: 'namespace', type: 'string', description: '命名空间', required: true },
        { name: 'podName', type: 'string', description: 'Pod 名称', required: true },
        { name: 'container', type: 'string', description: '容器名称' },
        { name: 'tail', type: 'number', description: '尾部行数' },
        { name: 'sinceTime', type: 'number', description: '开始时间' }
      ],
      outputs: [
        { name: 'logs', type: 'string' }
      ],
      examples: []
    },
    {
      name: 'listNodes',
      description: '列出节点',
      inputs: [
        { name: 'kubeConfig', type: 'string', description: 'Kubeconfig 内容' },
        { name: 'labelSelector', type: 'string', description: '标签选择器' }
      ],
      outputs: [
        { name: 'nodes', type: 'array' }
      ],
      examples: []
    }
  ]
};

// Kubernetes 方法实现（简化版）
export const kubernetesMethods = {
  async listPods(_params: any): Promise<ProviderResult> {
    // 简化实现，实际需要 kubernetes-client 库
    logger.info('[KubernetesProvider] listPods called');
    return {
      success: true,
      data: {
        pods: []
      }
    };
  },

  async getPodLogs(_params: any): Promise<ProviderResult> {
    logger.info('[KubernetesProvider] getPodLogs called');
    return {
      success: true,
      data: {
        logs: ''
      }
    };
  },

  async listNodes(_params: any): Promise<ProviderResult> {
    logger.info('[KubernetesProvider] listNodes called');
    return {
      success: true,
      data: {
        nodes: []
      }
    };
  }
};

/**
 * 注册所有扩展 Provider
 */
export function registerExtendedProviders(registry: any): void {
  registry.register(prometheusProvider, prometheusMethods);
  registry.register(elasticsearchProvider, elasticsearchMethods);
  registry.register(dingtalkProvider, dingtalkMethods);
  registry.register(wecomProvider, wecomMethods);
  registry.register(slackProvider, slackMethods);
  registry.register(kubernetesProvider, kubernetesMethods);
}
