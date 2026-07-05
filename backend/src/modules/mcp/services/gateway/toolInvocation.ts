/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * gateway/toolInvocation.ts — JSON-RPC 2.0 核心 + REST API + 方法处理器
 */

import type { Request, Response } from 'express';
import type { Router } from 'express';
import { toolRegistry } from '../toolRegistry';
import type { JsonRpcResponse } from '../types';
import {
  JsonRpcRequestSchema,
  InitializeParamsSchema,
  ToolCallParamsSchema,
  MCPMethod,
  MCP_PROTOCOL_VERSION,
  MCP_CLIENT_INFO,
  JSONRPC_ERRORS,
  type ToolCallContext,
  type ToolInput,
} from '../types';
import { logger } from '../../../../utils/logger';

// ============================================================
// JSON-RPC 响应构建
// ============================================================

function buildSuccess(
  id: string | number | undefined,
  result: unknown
): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    result,
  };
}

function buildError(
  id: string | number | null | undefined,
  error: { code: number; message: string; data?: unknown }
): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id,
    error: {
      code: error.code,
      message: error.message,
      ...(error.data ? { data: error.data } : {}),
    },
  };
}

// ============================================================
// 方法处理器
// ============================================================

/**
 * initialize — 握手
 */
function handleInitialize(params: unknown) {
  const parsed = InitializeParamsSchema.safeParse(params);
  const result: Record<string, unknown> = {
    protocolVersion: MCP_PROTOCOL_VERSION,
    serverInfo: MCP_CLIENT_INFO,
    capabilities: {
      tools: { listChanged: false },
    },
  };

  if (!parsed.success) {
    result.warning = `Client protocol version mismatch. Server: ${MCP_PROTOCOL_VERSION}`;
    return result;
  }

  logger.info(
    `MCP client connected: ${parsed.data.clientInfo?.name || 'unknown'} v${parsed.data.clientInfo?.version || '?'}`
  );

  return result;
}

/**
 * tools/list — 返回所有可用工具
 */
function handleToolsList() {
  return {
    tools: toolRegistry.toToolDefinitions(),
  };
}

/**
 * tools/call — 调用工具
 */
async function handleToolsCall(params: unknown, context: ToolCallContext) {
  const parsed = ToolCallParamsSchema.safeParse(params);
  if (!parsed.success) {
    return {
      content: [
        {
          type: 'text' as const,
          text: `Invalid tool call params: ${parsed.error.errors.map((e) => e.message).join(', ')}`,
        },
      ],
      isError: true,
    };
  }

  const { name, arguments: args } = parsed.data;
  return toolRegistry.invoke(name, args as ToolInput, context);
}

// ============================================================
// 路由注册
// ============================================================

/**
 * 注册 JSON-RPC 2.0 + REST API 路由
 */
export function registerToolInvocationRoutes(router: Router): void {
  /**
   * POST /api/v1/mcp/rpc
   *
   * JSON-RPC 2.0 统一入口
   */
  router.post('/rpc', async (req: Request, res: Response) => {
    try {
      const parseResult = JsonRpcRequestSchema.safeParse(req.body);
      if (!parseResult.success) {
        res.json(buildError(null, JSONRPC_ERRORS.PARSE_ERROR));
        return;
      }

      const rpcRequest = parseResult.data;
      const method = rpcRequest.method;
      const params = rpcRequest.params || {};

      const context: ToolCallContext = {
        userId: (req as any).user?.id,
        username: (req as any).user?.username,
        sessionId: req.headers['mcp-session-id'] as string | undefined,
        traceId: req.headers['x-trace-id'] as string | undefined,
        securityChecked: false,
        rawParams: params,
      };

      let result: unknown;
      switch (method) {
        case MCPMethod.INITIALIZE:
          result = handleInitialize(params);
          break;

        case MCPMethod.TOOLS_LIST:
          result = handleToolsList();
          break;

        case MCPMethod.TOOLS_CALL:
          result = await handleToolsCall(params, context);
          break;

        case MCPMethod.PING:
        case 'server/ping':
          result = {};
          break;

        default:
          res.json(buildError(rpcRequest.id, JSONRPC_ERRORS.METHOD_NOT_FOUND));
          return;
      }

      if (result && typeof result === 'object' && 'isError' in result) {
        res.json(buildSuccess(rpcRequest.id, result));
        return;
      }

      res.json(buildSuccess(rpcRequest.id, result));
    } catch (err) {
      logger.error('MCP JSON-RPC error', err as Error);
      res.json(buildError(null, JSONRPC_ERRORS.INTERNAL_ERROR));
    }
  });

  /**
   * GET /api/v1/mcp/manifest
   *
   * 返回平台 MCP 服务清单（REST 方式）
   */
  router.get('/manifest', (_req: Request, res: Response) => {
    res.json({
      name: MCP_CLIENT_INFO.name,
      title: 'daima AIOps Platform MCP Server',
      version: MCP_CLIENT_INFO.version,
      description: 'daima 智能运维平台 — 多 Agent 协作 MCP 工具服务',
      protocolVersion: MCP_PROTOCOL_VERSION,
      auth: {
        type: 'token' as const,
        header: 'Authorization',
      },
      rateLimit: {
        perMinute: 60,
      },
      tools: toolRegistry.toToolDefinitions(),
      diagnostics: toolRegistry.getDiagnostics(),
    });
  });

  /**
   * POST /api/v1/mcp/call
   *
   * 直接调用工具（REST 方式）
   */
  router.post('/call', async (req: Request, res: Response) => {
    const parseResult = ToolCallParamsSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: 'Invalid params',
        details: parseResult.error.errors,
      });
      return;
    }

    const { name, arguments: args } = parseResult.data;
    const context: ToolCallContext = {
      userId: (req as any).user?.id,
      username: (req as any).user?.username,
      sessionId: req.headers['mcp-session-id'] as string | undefined,
      traceId: req.headers['x-trace-id'] as string | undefined,
      securityChecked: false,
    };

    const result = await toolRegistry.invoke(name, args as Record<string, unknown>, context);

    if (result.isError && result.content[0]?.text?.includes('not found')) {
      res.status(404).json(result);
      return;
    }

    res.json(result);
  });

  /**
   * GET /api/v1/mcp/health
   *
   * MCP 服务健康检查
   */
  router.get('/health', (_req: Request, res: Response) => {
    const diag = toolRegistry.getDiagnostics();
    res.json({
      status: 'healthy',
      protocol: MCP_PROTOCOL_VERSION,
      server: MCP_CLIENT_INFO,
      tools: diag,
      uptime: process.uptime(),
    });
  });
}