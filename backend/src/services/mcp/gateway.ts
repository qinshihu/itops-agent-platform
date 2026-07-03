/**
 * MCP Gateway — JSON-RPC 2.0 网关 + SSE 传输层
 *
 * 对外暴露标准 MCP 协议接口：
 * - GET  /api/mcp/sse         SSE 传输端点（Claude Desktop / Cursor 连接入口）
 * - POST /api/mcp/rpc         JSON-RPC 2.0 消息入口
 * - POST /api/mcp/message     消息端点（SSE Session 内）
 * - GET  /api/mcp/manifest    工具清单（REST 方式）
 * - POST /api/mcp/call        工具调用（REST 方式）
 * - GET  /api/mcp/health      健康检查
 * - POST /api/mcp/approval/*  审批票据管理
 * - GET  /api/mcp/audit       安全审计日志
 *
 * 支持 MCP 客户端（Claude Desktop、Cursor 等）通过 SSE 或直接 HTTP 连接
 */

import type { Request, Response } from 'express';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { toolRegistry } from './toolRegistry';
import { securityGate } from './securityGate';
import { externalServerManager } from './externalServerManager';
import type {
  JsonRpcResponse} from './types';
import {
  JsonRpcRequestSchema,
  InitializeParamsSchema,
  ToolCallParamsSchema,
  MCPMethod,
  MCP_PROTOCOL_VERSION,
  MCP_CLIENT_INFO,
  JSONRPC_ERRORS,
  type ToolCallContext,
} from './types';
import { logger } from '../../utils/logger';

interface AuthenticatedRequest extends Request {
  user?: { id: string; username: string };
}

const router = Router();

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
// SSE 传输层（Claude Desktop / Cursor 连接入口）
// ============================================================

/**
 * GET /api/mcp/sse
 *
 * Server-Sent Events 端点
 *
 * 客户端（Claude Desktop、Cursor 等）通过此端点建立 SSE 长连接，
 * 服务端在 handshake 中返回消息端点 URL，客户端通过该 URL 发送 JSON-RPC 请求
 *
 * 用法：
 * 1. 客户端 GET /api/mcp/sse
 * 2. 服务端返回 SSE 流: 'data: {"jsonrpc":"2.0","method":"endpoint","params":{"uri":"/api/mcp/message?sessionId=xxx"}}'
 * 3. 客户端 POST /api/mcp/message?sessionId=xxx 发送 JSON-RPC 请求
 * 4. 服务端通过 SSE 推送响应或直接返回 HTTP 响应
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
  const endpointUrl = `/api/mcp/message?sessionId=${session.sessionId}`;
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
 * POST /api/mcp/message
 *
 * SSE 传输的消息端点
 * 客户端在收到 SSE endpoint 事件后，通过此端点发送 JSON-RPC 请求
 */
router.post('/message', async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const session = getSession(sessionId);

  if (!session) {
    res.status(404).json({ error: 'Session not found or expired. Reconnect via GET /api/mcp/sse' });
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

    res.json(buildSuccess(rpcRequest.id, result));
  } catch (err) {
    logger.error('MCP message error', err as Error);
    res.json(buildError(null, JSONRPC_ERRORS.INTERNAL_ERROR));
  }
});

// ============================================================
// JSON-RPC 2.0 核心处理器
// ============================================================

/**
 * POST /api/mcp/rpc
 *
 * JSON-RPC 2.0 统一入口
 *
 * 支持的方法：
 * - initialize   握手
 * - tools/list   获取工具列表
 * - tools/call   调用工具
 * - ping         心跳
 */
router.post('/rpc', async (req: Request, res: Response) => {
  try {
    // 解析 JSON-RPC 请求
    const parseResult = JsonRpcRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.json(buildError(null, JSONRPC_ERRORS.PARSE_ERROR));
      return;
    }

    const rpcRequest = parseResult.data;
    const method = rpcRequest.method;
    const params = rpcRequest.params || {};

    // 构建调用上下文
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

    // 如果是 ToolCallResult（含 isError），包装为 JSON-RPC 响应
    if (result && typeof result === 'object' && 'isError' in result) {
      const _toolResult = result as { isError: boolean };
      // 工具调用成功但业务错误 → 仍返回 200，通过 isError 标识
      res.json(buildSuccess(rpcRequest.id, result));
      return;
    }

    res.json(buildSuccess(rpcRequest.id, result));
  } catch (err) {
    logger.error('MCP JSON-RPC error', err as Error);
    res.json(buildError(null, JSONRPC_ERRORS.INTERNAL_ERROR));
  }
});

// ============================================================
// REST API（非 JSON-RPC 客户端使用）
// ============================================================

/**
 * GET /api/mcp/manifest
 *
 * 返回平台 MCP 服务清单（REST 方式）
 * 供非 MCP 客户端浏览可用工具
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
 * POST /api/mcp/call
 *
 * 直接调用工具（REST 方式）
 *
 * Body: { name: "alert.list", arguments: { severity: "critical" } }
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

  // 工具不存在 → 404
  if (result.isError && result.content[0]?.text?.includes('not found')) {
    res.status(404).json(result);
    return;
  }

  res.json(result);
});

/**
 * GET /api/mcp/health
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

// ============================================================
// 方法处理器
// ============================================================

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
      messageEndpoint: `/api/mcp/message?sessionId=${session.sessionId}`,
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
  return toolRegistry.invoke(name, args as Record<string, unknown>, context);
}

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
// 审批票据 API
// ============================================================

/**
 * POST /api/mcp/approval/create
 * 创建审批票据（用于需要审批的破坏性操作）
 */
router.post('/approval/create', (req: Request, res: Response) => {
  try {
    const { toolName, userId, reason, ttlMs } = req.body;
    if (!toolName || !userId || !reason) {
      res.status(400).json({ error: 'toolName, userId, and reason are required' });
      return;
    }
    const ticket = securityGate.createApprovalTicket(
      toolName,
      userId,
      reason,
      ttlMs
    );
    res.json({ ticketId: ticket.ticketId, expiresAt: new Date(ticket.expiresAt).toISOString() });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/mcp/approval/approve
 * 审批通过票据
 */
router.post('/approval/approve', (req: Request, res: Response) => {
  try {
    const { ticketId, approverId } = req.body;
    if (!ticketId || !approverId) {
      res.status(400).json({ error: 'ticketId and approverId are required' });
      return;
    }
    const success = securityGate.approve(ticketId, approverId);
    if (!success) {
      res.status(404).json({ error: 'Ticket not found or expired' });
      return;
    }
    res.json({ approved: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/mcp/approval/:ticketId
 * 查询审批票据状态
 */
router.get('/approval/:ticketId', (req: Request, res: Response) => {
  const ticket = securityGate.getApprovalTicket(req.params.ticketId);
  if (!ticket) {
    res.status(404).json({ error: 'Ticket not found' });
    return;
  }
  res.json({
    ticketId: ticket.ticketId,
    toolName: ticket.toolName,
    userId: ticket.userId,
    reason: ticket.reason,
    approved: ticket.approved,
    approvedBy: ticket.approvedBy,
    createdAt: new Date(ticket.createdAt).toISOString(),
    expiresAt: new Date(ticket.expiresAt).toISOString(),
  });
});

/**
 * GET /api/mcp/audit
 * 查询安全审计日志（最近 50 条）
 */
router.get('/audit', (_req: Request, res: Response) => {
  res.json(securityGate.getAuditLog(50));
});

/**
 * GET /api/mcp/security/config
 * 查询安全门配置
 */
router.get('/security/config', (_req: Request, res: Response) => {
  res.json(securityGate.getConfig());
});

// ============================================================
// 外部 MCP Server 管理 API
// ============================================================

/**
 * GET /api/mcp/external/status
 * 查询所有外部 MCP Server 的连接状态
 */
router.get('/external/status', (_req: Request, res: Response) => {
  res.json(externalServerManager.getStatus());
});

/**
 * POST /api/mcp/external/register
 * 注册外部 MCP Server 配置
 *
 * Body: ExternalServerConfig
 */
router.post('/external/register', (req: Request, res: Response) => {
  try {
    const config = req.body;
    if (!config.id || !config.namespace || !config.transport) {
      res.status(400).json({ error: 'id, namespace, and transport are required' });
      return;
    }
    externalServerManager.register(config);
    res.json({ registered: true, id: config.id });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/mcp/external/start/:id
 * 启动指定外部 MCP Server
 */
router.post('/external/start/:id', async (req: Request, res: Response) => {
  try {
    await externalServerManager.start(req.params.id);
    res.json({ started: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/mcp/external/start
 * 启动所有已注册的外部 MCP Server
 */
router.post('/external/start', async (_req: Request, res: Response) => {
  try {
    const results = await externalServerManager.startAll();
    res.json({ results });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /api/mcp/external/stop/:id
 * 停止指定外部 MCP Server
 */
router.post('/external/stop/:id', (req: Request, res: Response) => {
  try {
    externalServerManager.stop(req.params.id);
    res.json({ stopped: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * DELETE /api/mcp/external/:id
 * 注销外部 MCP Server
 */
router.delete('/external/:id', (req: Request, res: Response) => {
  try {
    externalServerManager.unregister(req.params.id);
    res.json({ unregistered: true, id: req.params.id });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ============================================================
// 导出
// ============================================================

export default router;
