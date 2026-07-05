/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * MCP Tool Registry — 工具注册中心
 *
 * 核心职责：
 * 1. 注册平台内置工具（来自 13 个模块的 Specialist 能力）
 * 2. 管理外部 MCP Server 连接的工具
 * 3. 生成 LLM function calling 格式的 tool specs
 * 4. 工具调用时做参数校验 + 安全门检查
 * 5. 自动发现：Specialist 注册时自动暴露为 MCP 工具
 */

import { z } from 'zod';
import type {
  RiskLevel} from './types';
import {
  type RegisteredTool,
  type ToolDefinition,
  type ToolCallResult,
  type ToolCallContext,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  type ToolInput,
  type JsonSchemaNode,
  MCP_TOOL_NAME_MAX_CHARS,
  MCP_TOOL_DESCRIPTION_MAX_CHARS,
  MCP_RATE_LIMIT_PER_MINUTE,
} from './types';
import { securityGate } from './securityGate';
import { logger } from '../../../utils/logger';

// ============================================================
// 速率限制
// ============================================================

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ============================================================
// Tool Registry 类
// ============================================================

export class ToolRegistry {
  /** 已注册的工具（name → RegisteredTool） */
  private tools: Map<string, RegisteredTool> = new Map();

  /** 每个工具的调用计数器（速率限制） */
  private rateLimits: Map<string, RateLimitEntry> = new Map();

  /** 全局调用计数器 */
  private globalCallCount = 0;
  private globalRateLimitResetAt = Date.now() + 60_000;

  // ============================================================
  // 注册
  // ============================================================

  /**
   * 注册一个工具
   *
   * @example
   * registry.register({
   *   name: 'alert.list',
   *   title: '查询告警列表',
   *   description: '查询告警中心只读告警事实',
   *   inputSchema: z.object({
   *     severity: z.enum(['critical', 'warning', 'info']).optional(),
   *     limit: z.number().min(1).max(100).default(20),
   *   }),
   *   domain: 'alert_handling',
   *   annotations: {
   *     readOnlyHint: true,
   *     destructiveHint: false,
   *     idempotentHint: true,
   *     riskLevel: RiskLevel.READONLY,
   *     requiresApproval: false,
   *   },
   *   handler: async (args, ctx) => { ... },
   * });
   */
  register(tool: RegisteredTool): void {
    // 校验工具名
    if (tool.name.length > MCP_TOOL_NAME_MAX_CHARS) {
      throw new Error(
        `Tool name "${tool.name}" exceeds ${MCP_TOOL_NAME_MAX_CHARS} characters`
      );
    }
    if (this.tools.has(tool.name)) {
      logger.warn(`Tool "${tool.name}" is being overwritten`);
    }

    // 校验描述长度
    if (tool.description.length > MCP_TOOL_DESCRIPTION_MAX_CHARS) {
      logger.warn(
        `Tool "${tool.name}" description exceeds ${MCP_TOOL_DESCRIPTION_MAX_CHARS} chars, truncating`
      );
      tool.description = tool.description.substring(0, MCP_TOOL_DESCRIPTION_MAX_CHARS);
    }

    this.tools.set(tool.name, tool);
    logger.debug(`MCP tool registered: ${tool.name} (${tool.annotations.riskLevel})`);
  }

  /**
   * 批量注册工具
   */
  registerAll(tools: RegisteredTool[]): void {
    for (const tool of tools) {
      this.register(tool);
    }
    logger.info(`Registered ${tools.length} MCP tools`);
  }

  /**
   * 注销工具
   */
  unregister(name: string): boolean {
    const existed = this.tools.delete(name);
    if (existed) {
      this.rateLimits.delete(name);
    }
    return existed;
  }

  // ============================================================
  // 查询
  // ============================================================

  /** 获取单个工具 */
  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /** 获取所有已启用的工具 */
  getAll(): RegisteredTool[] {
    return Array.from(this.tools.values()).filter((t) => t.enabled);
  }

  /** 按领域过滤 */
  getByDomain(domain: string): RegisteredTool[] {
    return this.getAll().filter((t) => t.domain === domain);
  }

  /** 按风险等级过滤 */
  getByRiskLevel(level: RiskLevel): RegisteredTool[] {
    return this.getAll().filter((t) => t.annotations.riskLevel === level);
  }

  /** 只获取只读工具 */
  getReadOnly(): RegisteredTool[] {
    return this.getAll().filter((t) => t.annotations.readOnlyHint);
  }

  /** 工具数量 */
  get count(): number {
    return this.getAll().length;
  }

  // ============================================================
  // MCP 协议格式输出
  // ============================================================

  /**
   * 生成 MCP tools/list 格式的工具列表
   */
  toToolDefinitions(): ToolDefinition[] {
    return this.getAll().map((tool) => this.toToolDefinition(tool));
  }

  /**
   * 将内部 RegisteredTool 转为 MCP ToolDefinition
   */
  toToolDefinition(tool: RegisteredTool): ToolDefinition {
    const zodSchema = tool.inputSchema;
    const jsonSchema = zodToJsonSchema(zodSchema);

    return {
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: jsonSchema,
      annotations: {
        readOnlyHint: tool.annotations.readOnlyHint,
        destructiveHint: tool.annotations.destructiveHint,
        idempotentHint: tool.annotations.idempotentHint,
        riskLevel: tool.annotations.riskLevel,
      },
    };
  }

  /**
   * 生成 OpenAI function calling 格式的 tool specs
   * 供 LLM Agent 使用
   */
  toOpenAIToolSpecs(): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }> {
    return this.getAll().map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: zodToJsonSchema(tool.inputSchema),
      },
    }));
  }

  // ============================================================
  // 工具调用
  // ============================================================

  /**
   * 调用工具
   *
   * @param name - 工具名
   * @param args - 工具参数
   * @param context - 调用上下文（用户、会话、追踪）
   */
  async invoke(
    name: string,
    args: Record<string, unknown>,
    context: ToolCallContext
  ): Promise<ToolCallResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: `Tool "${name}" not found` }],
        isError: true,
      };
    }

    if (!tool.enabled) {
      return {
        content: [{ type: 'text', text: `Tool "${name}" is disabled` }],
        isError: true,
      };
    }

    // 速率限制
    if (!this.checkRateLimit(name)) {
      return {
        content: [
          {
            type: 'text',
            text: `Rate limit exceeded for tool "${name}". Max ${MCP_RATE_LIMIT_PER_MINUTE} calls/min.`,
          },
        ],
        isError: true,
      };
    }

    // Zod 参数校验
    try {
      args = tool.inputSchema.parse(args) as Record<string, unknown>;
    } catch (err) {
      const zodError = err as z.ZodError;
      return {
        tool: this.toToolDefinition(tool),
        content: [
          {
            type: 'text',
            text: `Invalid arguments for tool "${name}":\n${zodError.errors
              .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
              .join('\n')}`,
          },
        ],
        isError: true,
      };
    }

    // 安全门检查（6 层防护：只读/审批/注入/隔离）
    const securityCheck = securityGate.check(tool, args, context);
    if (!securityCheck.passed) {
      return {
        tool: this.toToolDefinition(tool),
        content: [
          {
            type: 'text',
            text: `Security check failed for tool "${name}": ${securityCheck.reason}`,
          },
        ],
        isError: true,
      };
    }

    // 执行
    const startTime = Date.now();
    try {
      const result = await tool.handler(args, {
        ...context,
        securityChecked: true,
      });

      // 输出凭证检测
      const outputCheck = securityGate.checkOutput(tool, result);
      if (!outputCheck.passed) {
        // 输出中有凭证，遮蔽处理
        logger.warn(
          `[SecurityGate] Output credential detection for "${name}": ${outputCheck.reason}`
        );
      }

      const latency = Date.now() - startTime;
      logger.debug(`MCP tool "${name}" executed in ${latency}ms`);

      return {
        ...result,
        tool: result.tool ?? this.toToolDefinition(tool),
      };
    } catch (err) {
      const latency = Date.now() - startTime;
      logger.error(`MCP tool "${name}" failed after ${latency}ms`, err as Error);

      return {
        tool: this.toToolDefinition(tool),
        content: [
          {
            type: 'text',
            text: `Tool execution error: ${(err as Error).message}`,
          },
        ],
        structuredContent: {
          error: (err as Error).message,
          stack: (err as Error).stack,
          latencyMs: latency,
        },
        isError: true,
      };
    }
  }

  // ============================================================
  // 速率限制
  // ============================================================

  private checkRateLimit(toolName: string): boolean {
    const now = Date.now();

    // 全局限制
    if (now > this.globalRateLimitResetAt) {
      this.globalCallCount = 0;
      this.globalRateLimitResetAt = now + 60_000;
    }
    if (this.globalCallCount >= MCP_RATE_LIMIT_PER_MINUTE) {
      return false;
    }
    this.globalCallCount++;

    // 单工具限制（更严格：30次/分钟）
    let entry = this.rateLimits.get(toolName);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + 60_000 };
      this.rateLimits.set(toolName, entry);
    }
    if (entry.count >= Math.floor(MCP_RATE_LIMIT_PER_MINUTE / 2)) {
      return false;
    }
    entry.count++;

    return true;
  }

  // ============================================================
  // 诊断
  // ============================================================

  /**
   * 获取 Registry 诊断信息
   */
  getDiagnostics(): {
    totalTools: number;
    byDomain: Record<string, number>;
    byRiskLevel: Record<string, number>;
    readOnlyCount: number;
    destructiveCount: number;
  } {
    const tools = this.getAll();
    const byDomain: Record<string, number> = {};
    const byRiskLevel: Record<string, number> = {};

    for (const tool of tools) {
      const domain = tool.domain || 'unknown';
      byDomain[domain] = (byDomain[domain] || 0) + 1;

      const risk = tool.annotations.riskLevel;
      byRiskLevel[risk] = (byRiskLevel[risk] || 0) + 1;
    }

    return {
      totalTools: tools.length,
      byDomain,
      byRiskLevel,
      readOnlyCount: tools.filter((t) => t.annotations.readOnlyHint).length,
      destructiveCount: tools.filter((t) => t.annotations.destructiveHint).length,
    };
  }
}

// ============================================================
// 辅助：Zod schema → JSON Schema
// ============================================================

function zodToJsonSchema(schema: z.ZodObject<any>): {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
} {
  const shape = schema.shape;
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const [key, field] of Object.entries(shape) as [string, z.ZodTypeAny][]) {
    properties[key] = zodFieldToJsonSchema(field);

    // 检查是否 required（非 optional）
    if (!(field instanceof z.ZodOptional)) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {}),
  };
}

function zodFieldToJsonSchema(field: z.ZodTypeAny): JsonSchemaNode {
  // 处理 optional
  let inner = field;
  if (field instanceof z.ZodOptional) {
    inner = (field as any)._def.innerType;
  }

  // 基础类型
  if (inner instanceof z.ZodString) {
    const result: Record<string, unknown> = { type: 'string' };
    const checks = (inner as any)._def.checks || [];
    for (const check of checks) {
      if (check.kind === 'min') result.minLength = check.value;
      if (check.kind === 'max') result.maxLength = check.value;
    }
    return result;
  }

  if (inner instanceof z.ZodNumber) {
    const result: JsonSchemaNode = { type: 'number' };
    const checks = (inner as any)._def.checks || [];
    for (const check of checks) {
      if (check.kind === 'min') result.minimum = check.value;
      if (check.kind === 'max') result.maximum = check.value;
      if (check.kind === 'int') result.type = 'integer';
    }
    return result;
  }

  if (inner instanceof z.ZodBoolean) {
    return { type: 'boolean' };
  }

  if (inner instanceof z.ZodEnum) {
    return {
      type: 'string',
      enum: (inner as any)._def.values,
    };
  }

  if (inner instanceof z.ZodArray) {
    return {
      type: 'array',
      items: zodFieldToJsonSchema((inner as any)._def.type),
    };
  }

  if (inner instanceof z.ZodObject) {
    return zodToJsonSchema(inner);
  }

  // 默认
  return { type: 'string' };
}

// ============================================================
// 单例
// ============================================================

/** 全局工具注册中心实例 */
export const toolRegistry = new ToolRegistry();
