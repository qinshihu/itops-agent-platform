/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Agent MCP 适配器
 * 
 * 将 MCP toolRegistry 桥接到 Agent (agentExecutor) 的工具调用系统
 * 
 * 核心功能：
 * 1. 将 MCP 工具转换为 Agent 兼容的格式
 * 2. 提供与 agentToolRegistry 一致的接口
 * 3. 通过 MCP 安全门 + 速率限制执行工具
 * 
 * 使用方式：
 *   import { agentMcpAdapter } from './agentMcpAdapter';
 *   
 *   // 生成工具描述（供 System Prompt 使用）
 *   const toolDesc = agentMcpAdapter.generateToolDescriptions();
 *   
 *   // 执行工具
 *   const result = await agentMcpAdapter.executeTool('alert.list', { severity: 'critical' });
 */

import { toolRegistry } from '../../../mcp/services/toolRegistry';
import type { RegisteredTool, ToolCallResult } from '../../../mcp/services/types';
import { logger } from '../../../../utils/logger';

// ── 语义化类型别名 ──

/** OpenAI Function Calling 工具参数 Schema */
type OpenAIToolParameters = Record<string, unknown>;
/** 工具执行输入参数 */
type ToolInputArgs = Record<string, unknown>;

// ============================================================
// 类型定义
// ============================================================

/** Agent 工具执行结果 */
export interface AgentMcpToolResult {
  success: boolean;
  toolId: string;
  result: string;
  error?: string;
}

// ============================================================
// AgentMCPAdapter
// ============================================================

class AgentMcpAdapter {
  /** MCP 工具缓存 */
  private cachedTools: RegisteredTool[] = [];
  private lastCacheTime = 0;
  private cacheTtlMs = 60_000; // 1 分钟缓存

  // ============================================================
  // 工具列表
  // ============================================================

  /** 获取所有 MCP 工具 */
  getTools(): RegisteredTool[] {
    if (Date.now() - this.lastCacheTime < this.cacheTtlMs && this.cachedTools.length > 0) {
      return this.cachedTools;
    }
    this.cachedTools = toolRegistry.getAll();
    this.lastCacheTime = Date.now();
    return this.cachedTools;
  }

  /** 按名称查找工具 */
  getTool(name: string): RegisteredTool | undefined {
    return this.getTools().find((t) => t.name === name);
  }

  /** 按领域筛选工具 */
  getToolsByDomain(domain: string): RegisteredTool[] {
    return this.getTools().filter((t) => t.domain === domain);
  }

  // ============================================================
  // 生成 Agent 提示词
  // ============================================================

  /**
   * 生成工具描述文本（供 System Prompt 使用）
   * 格式与 agentToolRegistry.generateToolDescriptions() 一致
   */
  generateToolDescriptions(): string {
    const tools = this.getTools();
    if (tools.length === 0) {
      return '';
    }

    return tools
      .map((tool) => {
        const props = tool.inputSchema
          ? (tool.inputSchema as any)._def?.shape
            ? Object.entries((tool.inputSchema as any)._def.shape())
                .map(([k, v]: [string, any]) => {
                  const desc = v.description ? ` (${v.description})` : '';
                  const type = v._def?.typeName || 'string';
                  return `    "${k}": ${type}${desc}`;
                })
                .join(',\n')
            : JSON.stringify((tool.inputSchema as any).shape || {})
          : '{}';

        const riskTag = tool.annotations.readOnlyHint 
          ? '[只读]' 
          : tool.annotations.requiresApproval 
            ? '[需审批]' 
            : '[可写]';

        return `
【MCP:${tool.name}】
- 标题: ${tool.title || tool.name}
- 描述: ${tool.description} ${riskTag}
- 领域: ${tool.domain || '通用'}
- 参数: {
${props}
  }`;
      })
      .join('\n');
  }

  /**
   * 生成 OpenAI function calling 格式的工具列表
   * 用于升级 LLM API 调用到原生 function calling
   */
  toOpenAITools(): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: OpenAIToolParameters;
    };
  }> {
    return toolRegistry.toOpenAIToolSpecs();
  }

  // ============================================================
  // 工具执行
  // ============================================================

  /**
   * 执行 MCP 工具
   * 
   * @param toolName MCP 工具名（如 'alert.list'）
   * @param args 参数对象
   * @param context 执行上下文（userId, sessionId 等）
   * @returns Agent 兼容的执行结果
   */
  async executeTool(
    toolName: string,
    args: ToolInputArgs,
    context?: { userId?: string; sessionId?: string }
  ): Promise<AgentMcpToolResult> {
    const startTime = Date.now();
    logger.info(`[AgentMCP] 执行工具: ${toolName}`, { argsSize: JSON.stringify(args).length });

    try {
      const result: ToolCallResult = await toolRegistry.invoke(toolName, args, {
        userId: context?.userId,
        sessionId: context?.sessionId,
        securityChecked: false,
      });

      const elapsed = Date.now() - startTime;
      const textOutput = result.content
        ?.filter((c: { text?: string }) => c.text)
        .map((c: { text?: string }) => c.text!)
        .join('\n') || JSON.stringify(result.structuredContent || {});

      if (result.isError) {
        logger.warn(`[AgentMCP] 工具返回错误: ${toolName} (${elapsed}ms)`);
        return {
          success: false,
          toolId: toolName,
          result: textOutput,
          error: 'Tool returned error',
        };
      }

      logger.info(`[AgentMCP] 工具执行成功: ${toolName} (${elapsed}ms)`);
      return {
        success: true,
        toolId: toolName,
        result: textOutput,
      };
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const errorMessage = (err as Error).message;
      logger.error(`[AgentMCP] 工具执行异常: ${toolName} (${elapsed}ms)`, err as Error);
      return {
        success: false,
        toolId: toolName,
        result: '',
        error: errorMessage,
      };
    }
  }

  // ============================================================
  // 健康检查
  // ============================================================

  /** 检查 MCP 工具系统是否可用 */
  isAvailable(): boolean {
    try {
      const tools = toolRegistry.getAll();
      return tools.length > 0;
    } catch {
      return false;
    }
  }

  /** 获取统计信息 */
  getStats(): { totalTools: number; domains: string[]; readOnly: number } {
    const tools = this.getTools();
    return {
      totalTools: tools.length,
      domains: [...new Set(tools.map((t) => t.domain || 'unknown'))],
      readOnly: tools.filter((t) => t.annotations.readOnlyHint).length,
    };
  }
}

// ============================================================
// 单例
// ============================================================

export const agentMcpAdapter = new AgentMcpAdapter();
export { AgentMcpAdapter };
