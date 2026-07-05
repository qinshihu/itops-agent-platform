/**
 * MCP (Model Context Protocol) 模块路由入口
 *
 * MCP 路由实现位于 services/mcp/gateway.ts，该文件已是一个完整的 Express Router，
 * 包含所有 `/api/v1/mcp/*` 端点：
 *   - REST: health, manifest, call
 *   - JSON-RPC: rpc
 *   - SSE: sse, message
 *   - 外部服务器管理: external/status, external/register, external/start, external/stop
 *   - 审批票据: approval/create, approval/approve, approval/:ticketId
 *   - 审计与安全: audit, security/config
 *
 * 本文件仅做薄包装，将 gateway Router 按模块规范导出并注册。
 */

import mcpGatewayRouter from './services/gateway';

export default mcpGatewayRouter;
