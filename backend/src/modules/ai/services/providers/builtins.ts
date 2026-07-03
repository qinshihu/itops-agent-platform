import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from '../../../../utils/logger';
import type { Provider, ProviderResult } from './types';
import { getErrorMessage } from '../../../../utils/errorHelpers';

/**
 * HTTP Provider
 */
export const httpProvider: Provider = {
  name: 'http',
  description: 'HTTP 请求 Provider',
  version: '1.0.0',
  methods: [
    {
      name: 'get',
      description: '发送 GET 请求',
      inputs: [
        { name: 'url', type: 'string', description: '请求 URL', required: true },
        { name: 'headers', type: 'object', description: '请求头' },
        { name: 'params', type: 'object', description: 'URL 参数' }
      ],
      outputs: [
        { name: 'status', type: 'number' },
        { name: 'data', type: 'any' },
        { name: 'headers', type: 'object' }
      ],
      examples: [
        {
          title: '获取 JSON 数据',
          inputs: { url: 'https://api.example.com/data' }
        }
      ]
    },
    {
      name: 'post',
      description: '发送 POST 请求',
      inputs: [
        { name: 'url', type: 'string', description: '请求 URL', required: true },
        { name: 'data', type: 'any', description: '请求体' },
        { name: 'headers', type: 'object', description: '请求头' }
      ],
      outputs: [
        { name: 'status', type: 'number' },
        { name: 'data', type: 'any' }
      ],
      examples: []
    }
  ]
};

// 实现 HTTP Provider 方法
export const httpMethods = {
  async get(params: any): Promise<ProviderResult> {
    try {
      const response = await fetch(params.url, {
        method: 'GET',
        headers: params.headers || {}
      });
      const data: any = await response.json();

      return {
        success: true,
        data: {
          status: response.status,
          data,
          headers: Object.fromEntries(response.headers.entries())
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  },

  async post(params: any): Promise<ProviderResult> {
    try {
      const response = await fetch(params.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...params.headers
        },
        body: JSON.stringify(params.data)
      });
      const data: any = await response.json();

      return {
        success: true,
        data: {
          status: response.status,
          data
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
 * 通知 Provider
 */
export const notifyProvider: Provider = {
  name: 'notify',
  description: '通知 Provider',
  version: '1.0.0',
  methods: [
    {
      name: 'send',
      description: '发送通知',
      inputs: [
        { name: 'channel', type: 'string', description: '通知渠道: slack, webhook, email', required: true },
        { name: 'title', type: 'string', description: '标题', required: true },
        { name: 'message', type: 'string', description: '消息内容', required: true },
        { name: 'level', type: 'string', description: '级别: info, warning, error' }
      ],
      outputs: [
        { name: 'sent', type: 'boolean' }
      ],
      examples: [
        {
          title: '发送错误通知',
          inputs: {
            channel: 'webhook',
            title: '系统告警',
            message: '检测到异常',
            level: 'error'
          }
        }
      ]
    }
  ]
};

// 通知方法实现
export const notifyMethods = {
  async send(params: any): Promise<ProviderResult> {
    logger.info(`[NotifyProvider] Sending notification: ${params.title}`);
    // 简化实现，实际应该集成通知服务
    return {
      success: true,
      data: { sent: true }
    };
  }
};

/**
 * 脚本执行 Provider
 */
export const scriptProvider: Provider = {
  name: 'script',
  description: '脚本执行 Provider',
  version: '1.0.0',
  methods: [
    {
      name: 'exec',
      description: '执行命令/脚本',
      inputs: [
        { name: 'command', type: 'string', description: '要执行的命令', required: true },
        { name: 'args', type: 'array', description: '命令参数' },
        { name: 'cwd', type: 'string', description: '工作目录' },
        { name: 'timeout', type: 'number', description: '超时(ms)' }
      ],
      outputs: [
        { name: 'stdout', type: 'string' },
        { name: 'stderr', type: 'string' },
        { name: 'code', type: 'number' }
      ],
      examples: []
    }
  ]
};

// 脚本方法实现
export const scriptMethods = {
  async exec(params: any): Promise<ProviderResult> {
    const execPromise = promisify(exec);

    try {
      const { stdout, stderr } = await execPromise(
        params.command,
        {
          cwd: params.cwd,
          timeout: params.timeout
        }
      );

      return {
        success: true,
        data: { stdout, stderr, code: 0 }
      };
    } catch (error: unknown) {
      const execError = error as { stdout?: string; stderr?: string; code?: number };
      return {
        success: false,
        error: getErrorMessage(error),
        data: {
          stdout: execError.stdout,
          stderr: execError.stderr,
          code: execError.code
        }
      };
    }
  }
};

/**
 * 数据库 Provider
 */
export const databaseProvider: Provider = {
  name: 'database',
  description: '数据库操作 Provider',
  version: '1.0.0',
  methods: [
    {
      name: 'query',
      description: '执行 SQL 查询',
      inputs: [
        { name: 'connectionId', type: 'string', description: '数据库连接 ID', required: true },
        { name: 'query', type: 'string', description: 'SQL 查询语句', required: true },
        { name: 'params', type: 'array', description: '查询参数' }
      ],
      outputs: [
        { name: 'rows', type: 'array' },
        { name: 'columns', type: 'array' }
      ],
      examples: []
    }
  ]
};

// 数据库方法实现
export const databaseMethods = {
  async query(_params: any): Promise<ProviderResult> {
    // 简化实现
    return {
      success: true,
      data: {
        rows: [],
        columns: []
      }
    };
  }
};

/**
 * 注册所有内置 Provider
 */
export function registerBuiltinProviders(registry: any): void {
  registry.register(httpProvider, httpMethods);
  registry.register(notifyProvider, notifyMethods);
  registry.register(scriptProvider, scriptMethods);
  registry.register(databaseProvider, databaseMethods);
}
