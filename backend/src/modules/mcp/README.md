# MCP 模块 (`mcp/`)

## 职责
MCP (Model Context Protocol) 工具协议管理：工具注册与发现、JSON-RPC 网关、外部 MCP Server 生命周期管理、安全门控、审批票据。

## 内部结构
```
mcp/
├── routes.ts              # 模块路由入口（委托到 services/mcp/gateway.ts）
├── index.ts               # 模块导出
└── README.md
```

路由实现位于 `services/mcp/gateway.ts`，该文件是完整的 Express Router，包含所有 MCP 协议端点。

## API 端点
- `GET  /api/mcp/health`              健康检查
- `GET  /api/mcp/manifest`            工具清单
- `POST /api/mcp/call`                工具调用（REST）
- `POST /api/mcp/rpc`                 JSON-RPC 2.0 入口
- `GET  /api/mcp/sse`                SSE 传输端点
- `POST /api/mcp/message`            SSE 消息端点
- `GET  /api/mcp/external/status`     外部服务器状态
- `POST /api/mcp/external/register`   注册外部服务器
- `POST /api/mcp/external/start/:id`  启动外部服务器
- `POST /api/mcp/external/start`      启动所有外部服务器
- `POST /api/mcp/external/stop/:id`   停止外部服务器
- `DELETE /api/mcp/external/:id`      注销外部服务器
- `POST /api/mcp/approval/create`     创建审批票据
- `POST /api/mcp/approval/approve`    审批通过
- `GET  /api/mcp/approval/:ticketId`  查询票据状态
- `GET  /api/mcp/audit`               审计日志
- `GET  /api/mcp/security/config`     安全门配置

## 依赖关系
- 依赖 `services/mcp/` 下的 toolRegistry, securityGate, externalServerManager, gateway
- 被前端 `modules/mcp/` 通过 REST API 调用
- 可被外部 MCP 客户端（Claude Desktop、Cursor 等）通过 SSE/JSON-RPC 连接
