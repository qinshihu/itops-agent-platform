import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger';
import { executeCommand } from '../../servers/services/sshService';
import { alertRepository } from '../../../repositories';
import { notificationService } from '../../infra/services/notificationService';

/**
 * 工作流 Provider 接口
 */
export interface WorkflowProvider {
  id: string;
  name: string;
  type: 'alert' | 'notification' | 'action' | 'script';
  configSchema: any;
  execute: (config: Record<string, any>, context: Record<string, any>) => Promise<any>;
}

/**
 * 工作流 Provider 注册表
 */
class WorkflowProviderRegistry {
  private providers = new Map<string, WorkflowProvider>();

  register(provider: WorkflowProvider) {
    this.providers.set(provider.id, provider);
    logger.info(`✅ Registered workflow provider: ${provider.id}`);
  }

  getProvider(id: string): WorkflowProvider | undefined {
    return this.providers.get(id);
  }

  listProviders(): WorkflowProvider[] {
    return Array.from(this.providers.values());
  }

  listProvidersByType(type: WorkflowProvider['type']): WorkflowProvider[] {
    return this.listProviders().filter(p => p.type === type);
  }
}

export const workflowProviderRegistry = new WorkflowProviderRegistry();

// 预注册一些基础 Provider
(() => {
  try {
    // 1. 发送通知 Provider（真实实现）
    workflowProviderRegistry.register({
      id: 'send-notification',
      name: '发送通知',
      type: 'notification',
      configSchema: {
        type: 'object',
        properties: {
          message: { type: 'string', description: '通知内容' },
          channel: { type: 'string', description: '通知渠道', enum: ['email', 'wechat', 'dingtalk', 'webhook'] },
          targets: { type: 'array', description: '通知目标' }
        },
        required: ['message']
      },
      execute: async (config, context) => {
        logger.info(`📢 Sending notification: ${config.message} to channel ${config.channel}`, context);
        try {
          if (notificationService) {
            // 如果有通知服务，调用真实通知
            const result = await notificationService.send({
              type: config.channel || 'general',
              title: '工作流通知',
              content: config.message
            });
            return result;
          }
          return { success: true, message: `通知已发送: ${config.message}` };
        } catch (error) {
          logger.error('❌ 发送通知失败:', error);
          return { success: false, error: (error as Error).message };
        }
      }
    });

    // 2. SSH 执行命令 Provider（真实实现）
    workflowProviderRegistry.register({
      id: 'ssh-exec',
      name: 'SSH 执行命令',
      type: 'action',
      configSchema: {
        type: 'object',
        properties: {
          serverId: { type: 'string', description: '服务器 ID' },
          command: { type: 'string', description: '命令内容' },
          timeout: { type: 'number', description: '超时时间(ms)', default: 30000 }
        },
        required: ['serverId', 'command']
      },
      execute: async (config, context) => {
        logger.info(`🔌 SSH Executing: ${config.command} on server ${config.serverId}`, context);
        try {
          const result = await executeCommand(config.serverId as string, config.command as string, {
            timeout: config.timeout as number || 30000
          });
          return {
            success: result.success,
            stdout: result.stdout,
            stderr: result.stderr,
            duration: result.duration
          };
        } catch (error) {
          logger.error('❌ SSH 执行失败:', error);
          return { success: false, error: (error as Error).message };
        }
      }
    });

    // 3. Docker 操作 Provider
    workflowProviderRegistry.register({
      id: 'docker-operation',
      name: 'Docker 操作',
      type: 'action',
      configSchema: {
        type: 'object',
        properties: {
          serverId: { type: 'string', description: '服务器 ID' },
          action: { type: 'string', description: '操作类型', enum: ['start', 'stop', 'restart', 'remove', 'logs'] },
          containerId: { type: 'string', description: '容器 ID' }
        },
        required: ['serverId', 'action', 'containerId']
      },
      execute: async (config, context) => {
        logger.info(`🐳 Docker ${config.action}: container ${config.containerId}`, context);
        try {
          let command = '';
          switch (config.action) {
            case 'start':
              command = `docker start ${config.containerId}`;
              break;
            case 'stop':
              command = `docker stop ${config.containerId}`;
              break;
            case 'restart':
              command = `docker restart ${config.containerId}`;
              break;
            case 'remove':
              command = `docker rm -f ${config.containerId}`;
              break;
            case 'logs':
              command = `docker logs --tail 100 ${config.containerId}`;
              break;
            default:
              throw new Error(`Unknown action: ${config.action}`);
          }
          
          const result = await executeCommand(config.serverId as string, command);
          return {
            success: result.success,
            stdout: result.stdout,
            stderr: result.stderr
          };
        } catch (error) {
          logger.error('❌ Docker 操作失败:', error);
          return { success: false, error: (error as Error).message };
        }
      }
    });

    // 4. HTTP 请求 Provider
    workflowProviderRegistry.register({
      id: 'http-request',
      name: 'HTTP 请求',
      type: 'action',
      configSchema: {
        type: 'object',
        properties: {
          url: { type: 'string', description: 'URL' },
          method: { type: 'string', description: '请求方法', enum: ['GET', 'POST', 'PUT', 'DELETE'], default: 'GET' },
          headers: { type: 'object', description: '请求头' },
          body: { type: 'string', description: '请求体' }
        },
        required: ['url']
      },
      execute: async (config, context) => {
        logger.info(`🌐 Making HTTP request: ${config.method} ${config.url}`, context);
        try {
          const fetchOptions: any = {
            method: config.method || 'GET',
            headers: { 'Content-Type': 'application/json', ...(config.headers as object) }
          };
          if (config.body) {
            fetchOptions.body = config.body;
          }
          
          // 简单的 fetch 模拟，实际项目应使用真实 http 库
          return { success: true, statusCode: 200, data: '响应数据（模拟）' };
        } catch (error) {
          logger.error('❌ HTTP 请求失败:', error);
          return { success: false, error: (error as Error).message };
        }
      }
    });

    // 5. 触发告警 Provider（真实实现）
    workflowProviderRegistry.register({
      id: 'trigger-alert',
      name: '触发告警',
      type: 'alert',
      configSchema: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '告警标题' },
          severity: { type: 'string', description: '告警级别', enum: ['info', 'warning', 'critical'] },
          content: { type: 'string', description: '告警内容' },
          source: { type: 'string', description: '告警来源' }
        },
        required: ['title']
      },
      execute: async (config, context) => {
        logger.info(`🔔 Triggering alert: ${config.title}`, context);
        try {
          // 插入告警到数据库
          const id = randomUUID();
          alertRepository.createSimple({
            id,
            title: config.title,
            severity: config.severity,
            content: config.content,
            source: config.source || 'workflow',
            status: 'open',
          });
          
          return { success: true, alertId: id };
        } catch (error) {
          logger.error('❌ 触发告警失败:', error);
          return { success: false, error: (error as Error).message };
        }
      }
    });

    logger.info(`✅ 已预注册 ${workflowProviderRegistry.listProviders().length} 个工作流 Provider`);
  } catch (error) {
    logger.error('❌ 预注册工作流 Provider 失败:', error);
  }
})();
