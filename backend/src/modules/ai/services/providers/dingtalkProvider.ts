import type { Provider, ProviderResult } from './types';

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
  async sendText(params: Record<string, unknown>): Promise<ProviderResult> {
    try {
      const body = {
        msgtype: 'text',
        text: { content: params.content },
        at: {
          atMobiles: params.atMobiles || [],
          isAtAll: params.isAtAll || false
        }
      };

      const response = await fetch(params.webhook as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json() as Record<string, unknown>;

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

  async sendMarkdown(params: Record<string, unknown>): Promise<ProviderResult> {
    try {
      const body = {
        msgtype: 'markdown',
        markdown: { title: params.title, text: params.text },
        at: {
          atMobiles: params.atMobiles || [],
          isAtAll: params.isAtAll || false
        }
      };

      const response = await fetch(params.webhook as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json() as Record<string, unknown>;

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

  async sendCard(params: Record<string, unknown>): Promise<ProviderResult> {
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

      const response = await fetch(params.webhook as string, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await response.json() as Record<string, unknown>;

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