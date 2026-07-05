/**
 * gateway/routeRegistration.ts — SSE 传输层路由注册 + Session 管理
 */

import type { Request, Response } from 'express';
import type { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { toolRegistry } from '../toolRegistry';
import { securityGate as _securityGate } from '../securityGate';
import type { JsonRpcResponse } from '../types';
import {
  JsonRpcRequestSchema,
  MCPMethod,
  MCP_PROTOCOL_VERSION,
  MCP_CLIENT_INFO,
  JSONRPC_ERRORS,
  type ToolCallContext,
} from '../types';
import { logger } from '../../../../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: { id: string; username: string };
}

// ============================================================
// Session 管理（SSE 传输需要）
// ============================================================

interface McpSession {
  sessionId: string;
  createdAt: number;
  lastActivity: number;
  clientInfo?: { name: string; version: string };
  /** SSE 响应对象（用于推送服务器通知） */
  sseResponse?: Response;
}

const sessions: Map<string, McpSession> = new Map();

const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 分钟

function createSession(clientInfo?: { name: string; version: string }): McpSession {
  const session: McpSession = {
    sessionId: uuidv4(),
    createdAt: Date.now(),
    lastActivity: Date.now(),
    clientInfo,
  };
  sessions.set(session.sessionId, session);
  logger.info(`MCP session created: ${session.sessionId}`);
  return session;
}

function getSession(sessionId: string): McpSession | undefined {
  const session = sessions.get(sessionId);
  if (session) session.lastActivity = Date.now();
  return session;
}

function cleanupSessions(): number {
  const now = Date.now();
  let count = 0;
  for (const [id, session] of sessions) {
    if (now - session.lastActivity > SESSION_TIMEOUT_MS) {
      sessions.delete(id);
      count++;
    }
  }
  return count;
}

// 每 5 分钟清理过期 session
setInterval(cleanupSessions, 5 * 60 * 1000);

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

import { InitializeParamsSchema } from '../types';

/**
 * initialize — 握手
 */
function handleInitialize(params: unknown, session?: McpSession) {
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
    `MCP client connected: ${parsed.data.clientInfo?.name || 'unknown'} v${parsed.data.clientInfo?.version || '?'}` +
    (session ? ` (session: ${session.sessionId})` : '')
  );

  // SSE 传输：告知客户端消息端点
  if (session) {
    (result as Record<string, unknown>)._meta = {
      sessionId: session.sessionId,
      messageEndpoint: `/api/v1/mcp/message?sessionId=${session.sessionId}`,
    };
  }

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

// ============================================================
// 路由注册
// ============================================================

/**
 * 注册 SSE 传输层路由
 */
export function registerRouteRegistrationRoutes(router: Router): void {
  /**
   * GET /api/v1/mcp/sse
   *
   * Server-Sent Events 端点
   *
   * 客户端（Claude Desktop、Cursor 等）通过此端点建立 SSE 长连接，
   * 服务端在 handshake 中返回消息端点 URL，客户端通过该 URL 发送 JSON-RPC 请求
   */
  router.get('/sse', (req: Request, res: Response) => {
    const session = createSession();

    // 设置 SSE 头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // 禁用 nginx 缓冲
      'Access-Control-Allow-Origin': '*',
    });

    // 保存 SSE 连接用于推送
    session.sseResponse = res;

    // 发送 endpoint 事件（告诉客户端消息端点 URL）
    const endpointUrl = `/api/v1/mcp/message?sessionId=${session.sessionId}`;
    res.write(`event: endpoint\ndata: ${endpointUrl}\n\n`);

    // 周期性心跳
    const heartbeat = setInterval(() => {
      res.write(': heartbeat\n\n');
    }, 30_000);

    // 客户端断开时清理
    req.on('close', () => {
      clearInterval(heartbeat);
      session.sseResponse = undefined;
      logger.debug(`MCP SSE connection closed: ${session.sessionId}`);
    });

    logger.info(`MCP SSE connection established: ${session.sessionId}`);
  });

  /**
   * POST /api/v1/mcp/message
   *
   * SSE 传输的消息端点
   * 客户端在收到 SSE endpoint 事件后，通过此端点发送 JSON-RPC 请求
   */
  router.post('/message', async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    const session = getSession(sessionId);

    if (!session) {
      res.status(404).json({ error: 'Session not found or expired. Reconnect via GET /api/v1/mcp/sse' });
      return;
    }

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
        userId: (req as AuthenticatedRequest).user?.id,
        username: (req as AuthenticatedRequest).user?.username,
        sessionId: session.sessionId,
        traceId: (req.headers['x-trace-id'] as string) || rpcRequest.id?.toString(),
        securityChecked: false,
        rawParams: params,
      };

      let result: unknown;
      switch (method) {
        case MCPMethod.INITIALIZE:
          if (params && (params as Record<string, unknown>).clientInfo) {
            session.clientInfo = (params as Record<string, unknown>).clientInfo as { name: string; version: string };
          }
          result = handleInitialize(params, session);
          break;

        case MCPMethod.TOOLS_LIST:
          result = handleToolsList();
          break;

        case MCPMethod.TOOLS_CALL:
          result = await toolRegistry.invoke(
            (params as Record<string, unknown>).name as string,
            (params as Record<string, unknown>).arguments as Record<string, unknown>,
            context
          );
          break;

        case MCPMethod.PING:
        case 'server/ping':
          result = {};
          break;

        default:
          res.json(buildError(rpcRequest.id, JSONRPC_ERRORS.METHOD_NOT_FOUND));
          return;
      }

      res.json(buildSuccess(rpcRequest.id, result));
    } catch (err) {
      logger.error('MCP message error', err as Error);
      res.json(buildError(null, JSONRPC_ERRORS.INTERNAL_ERROR));
    }
  });
}