# MCP 模块 (`mcp/`)

> **DDD 限界上下文**：MCP (Model Context Protocol) 工具协议
> **聚合根**：`Tool`、`ExternalServer`、`ApprovalTicket`
> **最后刷新**：2026-07-22

## 职责
MCP (Model Context Protocol) 工具协议管理：工具注册与发现、JSON-RPC 网关、外部 MCP Server 生命周期管理、安全门控、审批票据。

## 内部结构
```
mcp/
├── routes.ts              # 模块路由入口（透穿到 services/mcp/gateway.ts）
├── services/              # 23 业务服务（含 1 个测试文件，无 routes/ 子目录）
│   ├── gateway.ts          ← JSON-RPC + REST + SSE 主入口
│   ├── externalServerManager.ts
│   ├── securityGate.ts     ← 工具调用安全门（精简主类 178 行）
│   │   └── securityGate/   ← 10 个子模块（2026-07-21 v2.18 拆分，按 6 层架构）
│   │       ├── layer1ReadOnly.ts          (L1：只读模式 42 行)
│   │       ├── layer2Approval.ts         (L2：审批票据 131 行)
│   │       ├── layer3Injection.ts        (L3：Prompt Injection 52 行)
│   │       ├── layer4CredentialLeak.ts   (L4：凭证泄露 42 行)
│   │       ├── layer5Isolation.ts        (L5：上下文隔离 36 行)
│   │       ├── layer6Audit.ts            (L6：审计日志 77 行)
│   │       ├── orchestrator.ts           (check + checkOutput 6 层编排 105 行)
│   │       ├── patterns.ts               (INJECTION_PATTERNS + CREDENTIAL_PATTERNS 81 行)
│   │       ├── types.ts                  (类型 barrel 74 行)
│   │       └── index.ts                  (barrel export 37 行)
│   ├── toolRegistry.ts     ← 工具注册中心
│   ├── externalClient/     ← Stdio / SSE 传输适配
│   ├── gateway/            ← approvalFlow / routeRegistration / toolInvocation
│   └── toolDefinitions/    ← ai / container / infra / monitor / network / server / shared
├── index.ts               # 模块导出
└── README.md
```

路由实现位于 `services/mcp/gateway.ts`，该文件是完整的 Express Router，包含所有 MCP 协议端点。

## API 端点（受保护，路径前缀 `/api/v1/mcp/*`）
- `GET  /api/v1/mcp/health`              健康检查
- `GET  /api/v1/mcp/manifest`            工具清单
- `POST /api/v1/mcp/call`                工具调用（REST）
- `POST /api/v1/mcp/rpc`                 JSON-RPC 2.0 入口
- `GET  /api/v1/mcp/sse`                 SSE 传输端点
- `POST /api/v1/mcp/message`             SSE 消息端点
- `GET  /api/v1/mcp/external/status`     外部服务器状态
- `POST /api/v1/mcp/external/register`   注册外部服务器
- `POST /api/v1/mcp/external/start/:id`  启动外部服务器
- `POST /api/v1/mcp/external/start`      启动所有外部服务器
- `POST /api/v1/mcp/external/stop/:id`   停止外部服务器
- `DELETE /api/v1/mcp/external/:id`      注销外部服务器
- `POST /api/v1/mcp/approval/create`     创建审批票据
- `POST /api/v1/mcp/approval/approve`    审批通过
- `GET  /api/v1/mcp/approval/:ticketId`  查询票据状态
- `GET  /api/v1/mcp/audit`               审计日志
- `GET  /api/v1/mcp/security/config`     安全门配置

> **路径前缀**：`backend/src/modules/_registry.ts` 第 80 行 `{ path: '/api/v1/mcp', router: mcpRoutes }` —— **注意 MCP 模块的 mount path 是 `/api/v1/mcp`，与 `ai/` 模块 routes.ts 第 22 行 `router.use('/mcp', mcpGateway)` 组合后在 `/api/v1/mcp/mcp/*` 形成双前缀路径，AI 内部使用此路径**。详见 [`backend/src/modules/ai/README.md`](../ai/README.md)。

## 依赖关系
- 依赖 `services/mcp/` 下的 toolRegistry, securityGate, externalServerManager, gateway
- 被前端 `modules/mcp/` 通过 REST API 调用
- 可被外部 MCP 客户端（Claude Desktop、Cursor 等）通过 SSE/JSON-RPC 连接
