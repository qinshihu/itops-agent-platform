/**
 * MCP External Client — 让 daima 作为 MCP 客户端连接外部 MCP Server
 *
 * 支持两种传输方式：
 * 1. SSE  (HTTP)  — 连接远程 HTTP MCP Server（如 Keep、holmesgpt 等）
 * 2. stdio (进程) — 连接本地进程 MCP Server（如 npx 启动的工具服务器）
 *
 * 架构：
 *
 *   daima Agent
 *       │
 *       ▼
 *   toolRegistry
 *       │
 *   ┌───┴───┬──────────┬──────────┐
 *   │ 内置   │ Ext: A   │ Ext: B   │ Ext: C
 *   │ 25 个  │ fs.read  │ db.query │ k8s.pod  ← 命名空间隔离
 *   └───────┴────┬──────┴────┬──────┴────┬─────┘
 *                │           │           │
 *           ┌────▼────┐ ┌───▼────┐ ┌───▼────┐
 *           │ MCP Srv │ │ MCP Srv│ │ MCP Srv│
 *           │ (SSE)   │ │ (SSE)  │ │(stdio) │
 *           └─────────┘ └────────┘ └────────┘
 */

export { ExternalMCPClient } from './ExternalMCPClient';
export type { ExternalServerConfig, TransportType, ConnectionState, ExternalToolRef } from './types';