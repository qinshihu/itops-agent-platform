import { logger } from '../../../utils/logger';
import { workflowMappingsRepo, workflowsRepo, tasksRepo } from '../../../repositories';
import { executeWorkflow } from '../../workflow/services/workflowExecutor';
import { randomUUID } from 'crypto';

interface AlertContext {
  id: string;
  source: string;
  severity: string;
  rawSeverity?: string;
  title: string;
  content: string;
  tags?: string | string[];
}

interface MappingResult {
  mappingId: string;
  workflowId: string;
  workflowName: string;
  taskId: string;
}

class AlertWorkflowMappingService {
  /** 根据告警匹配第一个符合条件的工作流并触发执行 */
  triggerFirstMatchingWorkflow(alert: AlertContext): MappingResult | null {
    try {
      logger.info(`[AlertWorkflowMapping] 尝试匹配告警: alertId=${alert.id}, source=${alert.source}, severity=${alert.severity}`);

      // 查询所有启用的映射，按规则优先级排序（source精确匹配 > severity匹配 > title_pattern匹配）
      const mappings = workflowMappingsRepo.findMatching(alert.source);

      // 遍历所有映射规则，找到第一个匹配的
      for (const mapping of mappings) {
        if (this.matches(alert, mapping)) {
          logger.info(`[AlertWorkflowMapping] 找到匹配的映射: mappingId=${mapping.id}, workflowId=${mapping.workflow_id}`);
          // 触发工作流
          const taskId = this.executeMappedWorkflow(alert, mapping);
          return {
            mappingId: mapping.id,
            workflowId: mapping.workflow_id,
            workflowName: (mapping as any).workflow_name || 'Mapped Workflow',
            taskId: taskId
          };
        }
      }

      logger.info('[AlertWorkflowMapping] 未找到匹配的映射');
      return null;
    } catch (error) {
      logger.error('[AlertWorkflowMapping] 匹配失败:', error);
      return null;
    }
  }

  /** 检查告警是否匹配映射规则 */
  private matches(alert: AlertContext, mapping: any): boolean {
    // 1. source匹配
    if (mapping.alert_source && mapping.alert_source !== '*' && mapping.alert_source !== alert.source) {
      return false;
    }

    // 2. severity匹配
    if (mapping.alert_severity && mapping.alert_severity !== '*') {
      const severityOrder = ['info', 'low', 'medium', 'high', 'critical'];
      const alertIndex = severityOrder.indexOf(alert.severity.toLowerCase());
      const mappingIndex = severityOrder.indexOf(mapping.alert_severity.toLowerCase());
      if (alertIndex < mappingIndex) {
        return false;
      }
    }

    // 3. title_pattern匹配（支持*通配符）
    if (mapping.alert_title_pattern && mapping.alert_title_pattern !== '*') {
      // 转换为正则表达式
      const patternRegex = mapping.alert_title_pattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      const regex = new RegExp(`^${patternRegex}$`, 'i');
      if (!regex.test(alert.title)) {
        return false;
      }
    }

    // 4. 所有条件都满足
    return true;
  }

  /** 执行映射的工作流 */
  private executeMappedWorkflow(alert: AlertContext, mapping: any): string {
    const workflow = workflowsRepo.getById(mapping.workflow_id);
    if (!workflow) {
      throw new Error(`Workflow not found: ${mapping.workflow_id}`);
    }

    // 创建任务记录
    const taskId = randomUUID();
    tasksRepo.createWithStatus({
      id: taskId,
      workflow_id: mapping.workflow_id,
      name: `Alert-triggered: ${alert.title}`,
      status: 'pending',
      context: JSON.stringify({
        alert_id: alert.id,
        alert_title: alert.title,
        alert_content: alert.content,
        alert_source: alert.source,
        alert_severity: alert.severity,
        mapping_id: mapping.id
      })
    });

    // 异步执行工作流
    const workflowParsed = {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description ?? undefined,
      nodes: JSON.parse(workflow.nodes || '[]'),
      edges: JSON.parse(workflow.edges || '[]'),
      agent_configs: JSON.parse(workflow.agent_configs || '{}'),
      is_template: workflow.is_template ? 1 : 0,
      created_at: workflow.created_at,
      updated_at: workflow.updated_at
    };

    setImmediate(async () => {
      try {
        await executeWorkflow(taskId, workflowParsed, undefined, {
          alert_id: alert.id,
          alert_title: alert.title,
          alert_content: alert.content,
          alert_source: alert.source,
          alert_severity: alert.severity
        });
        logger.info('[AlertWorkflowMapping] 工作流执行完成: taskId=', taskId);
      } catch (err) {
        logger.error('[AlertWorkflowMapping] 工作流执行失败:', err);
      }
    });

    return taskId;
  }
}

export const alertWorkflowMappingService = new AlertWorkflowMappingService();
