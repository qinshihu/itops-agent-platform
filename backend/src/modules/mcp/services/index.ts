/**
 * MCP (Model Context Protocol) 模块
 *
 * daima 的 MCP 实现：
 * - 遵循 JSON-RPC 2.0 + MCP 2025-03-26 规范
 * - 工具注册中心自动发现 Specialist 能力
 * - 支持外部 MCP 客户端（Claude Desktop、Cursor 等）连接
 * - 安全门：只读过滤、凭证检测、注入防护、速率限制
 */

export { toolRegistry, ToolRegistry } from './toolRegistry';
export { default as mcpGateway } from './gateway';
export { registerAllPlatformTools, PLATFORM_TOOLS } from './toolDefinitions';
export { securityGate, SecurityGate } from './securityGate';
export { ExternalMCPClient } from './externalClient';
export { externalServerManager, ExternalServerManager } from './externalServerManager';
export type { SecurityCheckResult, SecurityGateConfig, ApprovalTicket } from './securityGate';
export type { ExternalServerConfig, TransportType, ConnectionState } from './externalClient';
export * from './types';
