import type { Provider, ProviderResult } from './types';

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
  async sendMessage(params: Record<string, unknown>): Promise<ProviderResult> {
    try {
      const body: Record<string, unknown> = { text: params.text };
      if (params.channel) body.channel = params.channel;
      if (params.username) body.username = params.username;
      if (params.iconEmoji) body.icon_emoji = params.iconEmoji;

      const response = await fetch(params.webhook as string, {
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

  async sendBlocks(params: Record<string, unknown>): Promise<ProviderResult> {
    try {
      const body: Record<string, unknown> = { blocks: params.blocks };
      if (params.text) body.text = params.text;
      if (params.channel) body.channel = params.channel;

      const response = await fetch(params.webhook as string, {
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

  async sendAttachments(params: Record<string, unknown>): Promise<ProviderResult> {
    try {
      const body: Record<string, unknown> = { attachments: params.attachments };
      if (params.channel) body.channel = params.channel;

      const response = await fetch(params.webhook as string, {
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