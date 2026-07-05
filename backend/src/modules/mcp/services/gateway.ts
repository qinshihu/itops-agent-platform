/**
 * MCP Gateway — JSON-RPC 2.0 网关 + SSE 传输层
 *
 * 对外暴露标准 MCP 协议接口：
 * - GET  /api/v1/mcp/sse         SSE 传输端点（Claude Desktop / Cursor 连接入口）
 * - POST /api/v1/mcp/rpc         JSON-RPC 2.0 消息入口
 * - POST /api/v1/mcp/message     消息端点（SSE Session 内）
 * - GET  /api/v1/mcp/manifest    工具清单（REST 方式）
 * - POST /api/v1/mcp/call        工具调用（REST 方式）
 * - GET  /api/v1/mcp/health      健康检查
 * - POST /api/v1/mcp/approval/*  审批票据管理
 * - GET  /api/v1/mcp/audit       安全审计日志
 *
 * 支持 MCP 客户端（Claude Desktop、Cursor 等）通过 SSE 或直接 HTTP 连接
 *
 * 实现已拆分至 gateway/ 子目录：
 * - routeRegistration.ts  SSE 传输 + Session 管理
 * - toolInvocation.ts     JSON-RPC 2.0 + REST API + 方法处理器
 * - approvalFlow.ts       审批票据 + 安全审计 + 外部 MCP Server 管理
 */

import { Router } from 'express';
import { registerRouteRegistrationRoutes } from './gateway/routeRegistration';
import { registerToolInvocationRoutes } from './gateway/toolInvocation';
import { registerApprovalFlowRoutes } from './gateway/approvalFlow';

const router = Router();

// 注册各模块路由
registerRouteRegistrationRoutes(router);
registerToolInvocationRoutes(router);
registerApprovalFlowRoutes(router);

export default router;