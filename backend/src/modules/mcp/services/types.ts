/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * MCP (Model Context Protocol) 类型定义
 *
 * 参照 MCP 规范 2025-03-26，基于 JSON-RPC 2.0
 * 使用 Zod 做运行时校验 + 类型推导
 */

import { z } from 'zod';

// ============================================================
// 语义化类型别名
// ============================================================

/** MCP 工具输入参数（动态键值对，运行时由 Zod Schema 校验） */
export type ToolInput = Record<string, any>;

/** MCP 工具结构化输出数据（动态键值对） */
export type ToolOutput = Record<string, unknown>;

/** JSON Schema 属性节点值 */
export type JsonSchemaNode = Record<string, unknown>;

// ============================================================
// 协议常量
// ============================================================

export const MCP_PROTOCOL_VERSION = '2025-03-26';
export const MCP_CLIENT_INFO = {
  name: 'daima-aiops',
  version: '1.0.0',
};

export const MCP_TOOL_NAME_MAX_CHARS = 64;
export const MCP_TOOL_DESCRIPTION_MAX_CHARS = 1200;
export const MCP_RESULT_TEXT_MAX_CHARS = 800;
export const MCP_RATE_LIMIT_PER_MINUTE = 60;

// ============================================================
// 安全注解
// ============================================================

/** 风险等级 */
export enum RiskLevel {
  /** 只读，无副作用 */
  READONLY = 'readonly',
  /** 低风险，可能产生少量数据 */
  LOW = 'low',
  /** 中等风险，需要审批 */
  MEDIUM = 'medium',
  /** 高风险，必须人工确认 */
  HIGH = 'high',
  /** 破坏性操作，严格限制 */
  DESTRUCTIVE = 'destructive',
}

/** 工具安全注解 */
export interface ToolSecurityAnnotations {
  /** 是否为只读操作 */
  readOnlyHint: boolean;
  /** 是否为破坏性操作 */
  destructiveHint: boolean;
  /** 是否幂等 */
  idempotentHint: boolean;
  /** 风险等级 */
  riskLevel: RiskLevel;
  /** 是否需要审批 */
  requiresApproval: boolean;
}

// ============================================================
// JSON-RPC 2.0 基础类型
// ============================================================

export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string(),
  params: z.record(z.unknown()).optional(),
});

export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;

export const JsonRpcResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  result: z.unknown().optional(),
  error: z
    .object({
      code: z.number(),
      message: z.string(),
      data: z.unknown().optional(),
    })
    .optional(),
});

export type JsonRpcResponse = z.infer<typeof JsonRpcResponseSchema>;

// ============================================================
// MCP 协议方法
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace MCPMethod {
  export const INITIALIZE = 'initialize';
  export const TOOLS_LIST = 'tools/list';
  export const TOOLS_CALL = 'tools/call';
  export const PING = 'ping';
}

// ============================================================
// initialize 请求/响应
// ============================================================

export const InitializeParamsSchema = z.object({
  protocolVersion: z.string(),
  capabilities: z.record(z.unknown()).optional(),
  clientInfo: z
    .object({
      name: z.string(),
      version: z.string(),
    })
    .optional(),
});

export type InitializeParams = z.infer<typeof InitializeParamsSchema>;

export const InitializeResultSchema = z.object({
  protocolVersion: z.string(),
  serverInfo: z.object({
    name: z.string(),
    version: z.string(),
  }),
  capabilities: z.object({
    tools: z.object({
      listChanged: z.boolean().default(false),
    }),
  }),
});

export type InitializeResult = z.infer<typeof InitializeResultSchema>;

// ============================================================
// tools/list 请求/响应
// ============================================================

export const ToolDefinitionSchema = z.object({
  name: z.string().max(MCP_TOOL_NAME_MAX_CHARS),
  title: z.string().optional(),
  description: z.string().max(MCP_TOOL_DESCRIPTION_MAX_CHARS),
  inputSchema: z.object({
    type: z.literal('object'),
    properties: z.record(z.unknown()),
    required: z.array(z.string()).optional(),
  }),
  annotations: z
    .object({
      readOnlyHint: z.boolean(),
      destructiveHint: z.boolean(),
      idempotentHint: z.boolean(),
      riskLevel: z.nativeEnum(RiskLevel),
    })
    .optional(),
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

export const ToolsListResultSchema = z.object({
  tools: z.array(ToolDefinitionSchema),
});

export type ToolsListResult = z.infer<typeof ToolsListResultSchema>;

// ============================================================
// tools/call 请求/响应
// ============================================================

export const ToolCallParamsSchema = z.object({
  name: z.string(),
  arguments: z.record(z.unknown()).default({}),
});

export type ToolCallParams = z.infer<typeof ToolCallParamsSchema>;

/** MCP Content 类型（text / image / resource） */
export interface McpTextContent {
  type: 'text';
  text: string;
}

export interface McpImageContent {
  type: 'image';
  data: string; // base64
  mimeType: string;
}

export interface McpResourceContent {
  type: 'resource';
  resource: {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string; // base64
  };
}

export type McpContent = McpTextContent | McpImageContent | McpResourceContent;

export const ToolCallResultSchema = z.object({
  tool: ToolDefinitionSchema.optional(),
  content: z.array(
    z.object({
      type: z.enum(['text', 'image', 'resource']),
      text: z.string().optional(),
      data: z.string().optional(),
      mimeType: z.string().optional(),
      resource: z
        .object({
          uri: z.string(),
          mimeType: z.string().optional(),
          text: z.string().optional(),
          blob: z.string().optional(),
        })
        .optional(),
    })
  ),
  structuredContent: z.record(z.unknown()).optional(),
  isError: z.boolean().default(false),
});

export type ToolCallResult = z.infer<typeof ToolCallResultSchema>;

// ============================================================
// Manifest（清单）
// ============================================================

export interface McpManifest {
  name: string;
  title: string;
  version: string;
  description: string;
  auth: {
    type: 'token' | 'none';
    header?: string;
  };
  rateLimit: {
    perMinute: number;
  };
  tools: ToolDefinition[];
}

// ============================================================
// 内部工具注册类型
// ============================================================

/** 工具处理器签名 */
export type ToolHandler = (
  args: ToolInput,
  context: ToolCallContext
) => Promise<ToolCallResult>;

/** 工具调用上下文 */
export interface ToolCallContext {
  /** 调用者信息 */
  userId?: string;
  username?: string;
  /** 会话 ID */
  sessionId?: string;
  /** 请求追踪 ID */
  traceId?: string;
  /** 是否已通过安全门 */
  securityChecked: boolean;
  /** 原始请求参数 */
  rawParams?: ToolInput;
}

/** 注册到 Registry 的工具定义 */
export interface RegisteredTool {
  /** 全局唯一工具名 */
  name: string;
  /** 人类可读标题 */
  title: string;
  /** 工具描述（给 LLM 看的） */
  description: string;
  /** Zod 输入 Schema */
  inputSchema: z.ZodObject<any>;
  /** 所属 Specialist 领域 */
  domain?: string;
  /** 安全注解 */
  annotations: ToolSecurityAnnotations;
  /** 工具处理器 */
  handler: ToolHandler;
  /** 是否启用 */
  enabled: boolean;
}

// ============================================================
// JSON-RPC 错误码
// ============================================================

export const JSONRPC_ERRORS = {
  PARSE_ERROR: { code: -32700, message: 'Parse error' },
  INVALID_REQUEST: { code: -32600, message: 'Invalid Request' },
  METHOD_NOT_FOUND: { code: -32601, message: 'Method not found' },
  INVALID_PARAMS: { code: -32602, message: 'Invalid params' },
  INTERNAL_ERROR: { code: -32603, message: 'Internal error' },

  // 自定义错误码
  TOOL_NOT_FOUND: { code: -32001, message: 'Tool not found' },
  TOOL_EXECUTION_ERROR: { code: -32002, message: 'Tool execution error' },
  RATE_LIMIT_EXCEEDED: { code: -32003, message: 'Rate limit exceeded' },
  PERMISSION_DENIED: { code: -32004, message: 'Permission denied' },
  APPROVAL_REQUIRED: { code: -32005, message: 'Approval required for destructive operation' },
  SECURITY_VIOLATION: { code: -32006, message: 'Security policy violation' },
} as const;
