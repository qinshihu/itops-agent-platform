# ADR-008: MCP 协议用于 Agent 工具通信

**状态**: 已采纳 | **日期**: 2025-Q2 | **决策者**: 项目作者

## 背景

多 Agent 系统中，Agent 需要发现和调用工具（SSH 执行、服务器查询、告警查询等）。如果每个 Agent 都硬编码工具调用方式，会导致：
1. 工具不可发现，新增工具需要修改所有 Agent
2. Agent 和工具耦合，难以扩展
3. 无法对接外部 MCP Server 生态

核心需求：
1. 工具注册与发现机制
2. 标准化的工具调用协议
3. 与外部 MCP Server 生态兼容

## 决策

采用 **MCP (Model Context Protocol)** 作为 Agent 工具通信的标准协议。

## 设计要点

### 工具注册
```typescript
// services/mcp/toolDefinitions/ 下按模块定义工具
toolRegistry.register({
  name: 'server_get_by_id',
  description: '根据 ID 查询服务器信息',
  inputSchema: z.object({
    serverId: z.string().uuid(),
  }),
  handler: async (params) => { /* 调用 serverRepository */ },
});
```

### Agent 透明发现
Agent 不关心工具的实现细节，通过 MCP 总线调用：
```typescript
const result = await mcpBus.call({
  tool: 'server_get_by_id',
  params: { serverId: 'xxx' },
});
```

### 外部 MCP Server 支持
平台自己的工具定义在 `services/mcp/toolDefinitions/` 下，同时支持连接外部 MCP Server（通过 `mcp/externalClient`）。

## 工具分类

| 分类 | 位置 | 示例 |
|------|------|------|
| AI 工具 | `toolDefinitions/aiTools.ts` | RAG 查询、知识库搜索 |
| 服务器工具 | `toolDefinitions/serverTools.ts` | 服务器查询、SSH 执行 |
| 容器工具 | `toolDefinitions/containerTools.ts` | Docker/VM 操作 |
| 基础设施工具 | `toolDefinitions/infraTools.ts` | 通知、备份、配置 |
| 监控工具 | `toolDefinitions/monitorTools.ts` | 仪表盘、健康检查 |
| 网络工具 | `toolDefinitions/networkTools.ts` | 网络设备、拓扑 |

## 后果

### 正面
- Agent 和工具解耦，新增工具无需修改 Agent 代码
- 工具通过 Zod schema 定义参数，类型安全
- 支持对接社区 MCP Server 生态（数千个可用工具）
- AI 生成的代码只需调用 MCP 工具，不直接操作底层逻辑

### 负面
- MCP 协议仍在快速演进，版本兼容性需要注意
- 工具注册初始化在服务启动阶段（`serviceRegistry.ts` 最前面），增加启动时间

### 缓解措施
- 工具定义集中在 `toolDefinitions/` 下，按模块拆分，便于维护
- MCP 层的变更限制在 `services/mcp/` 目录内，不影响业务模块

## 相关

- ADR-005: 模块边界定义（工具按模块组织）
- `services/mcp/` 目录
