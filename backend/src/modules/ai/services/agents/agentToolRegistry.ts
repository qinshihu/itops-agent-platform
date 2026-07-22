/* eslint-disable @typescript-eslint/no-explicit-any */

import { logger } from '../../../../utils/logger';
import { registerAllAgentTools } from './agentTools';

// ── 语义化类型别名 ──

/** 工具 JSON Schema 属性定义 */
export type ToolSchemaProperties = Record<string, unknown>;

/**
 * 工具风险等级
 * - readonly：只读，无副作用
 * - low：低风险
 * - medium：中等风险
 * - high：高风险（必须人工确认）
 * - destructive：破坏性操作（严格限制）
 */
export type AgentToolRiskLevel = 'readonly' | 'low' | 'medium' | 'high' | 'destructive';

/**
 * Agent 工具接口
 */
export interface AgentTool {
  id: string;
  name: string;
  description: string;
  category: 'ssh' | 'docker' | 'kubernetes' | 'system' | 'network' | 'database' | 'alerts';
  /** 风险等级（v2 2026-07-21 引入） */
  riskLevel: AgentToolRiskLevel;
  /** 是否需要写审计日志（默认 true，readonly 工具可设为 false） */
  auditEnabled: boolean;
  schema: {
    type: 'object';
    properties: ToolSchemaProperties;
    required?: string[];
  };
  execute: (args: Record<string, unknown>) => Promise<string>;
}

/**
 * 需要写审计日志的工具 ID 集合（路由层快速判定）
 */
export const AUDIT_ENABLED_DEFAULT_TOOL_IDS = new Set<string>([
  'ssh-exec',
  'view-file',
  'service-status',
  'system-logs',
  'find-large-files',
  'list-alerts',
  'database-info',
  'list-servers',
]);

/**
 * Agent 工具注册表
 */
class AgentToolRegistry {
  private tools = new Map<string, AgentTool>();

  register(tool: AgentTool): void {
    this.tools.set(tool.id, tool);
    logger.info(`Registered tool: ${tool.id} (${tool.name})`);
  }

  getTool(id: string): AgentTool | undefined {
    return this.tools.get(id);
  }

  listTools(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  listToolsByCategory(category: AgentTool['category']): AgentTool[] {
    return this.listTools().filter(t => t.category === category);
  }

  generateToolDescriptions(): string {
    const tools = this.listTools();
    if (tools.length === 0) {
      return '暂无可用工具';
    }

    return tools.map(tool => {
      return `
【${tool.id}】
- 名称: ${tool.name}
- 描述: ${tool.description}
- 分类: ${tool.category}
- 参数: ${JSON.stringify(tool.schema.properties, null, 2)}
`;
    }).join('\n');
  }
}

export const agentToolRegistry = new AgentToolRegistry();

/**
 * 预注册所有工具
 *
 * 2026-07-21 拆分后改为调用 ./agentTools/index.ts 中的 registerAllAgentTools()
 * 工具实现分散到 ./agentTools/{ssh,system,docker,k8s,other}Tools.ts
 * 拆分原则遵循 architecture.md §3.3.3 单文件 → 子目录拆分
 */
(function registerTools() {
  try {
    registerAllAgentTools();

    const allTools = agentToolRegistry.listTools();
    const auditCount = allTools.filter((t) => t.auditEnabled).length;
    const readonlyCount = allTools.filter((t) => t.riskLevel === 'readonly').length;
    const highRiskCount = allTools.filter(
      (t) => t.riskLevel === 'high' || t.riskLevel === 'destructive',
    ).length;
    logger.info(
      `已预注册 ${allTools.length} 个工具（${readonlyCount} 只读 / ${highRiskCount} 高危 / ${auditCount} 写审计）`,
    );
  } catch (error) {
    logger.error('预注册工具失败:', error);
  }
})();