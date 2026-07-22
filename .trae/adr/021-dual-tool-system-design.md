# ADR-021: 两套工具系统并存是有意设计，不是技术债

| 字段 | 值 |
|---|---|
| **状态** | ✅ Accepted（2026-07-21） |
| **作者** | 项目维护者 + AI 协作 |
| **触发来源** | [docs/架构合理性与开源治理方案_v1.md §2.3 L190-192](../../docs/架构合理性与开源治理方案_v1.md) |
| **替代方案** | ADR-016（routes→service 抽象）、ADR-008（MCP Agent 通信协议） |
| **关联 ADR** | [020-agent-tool-risk-audit.md](020-agent-tool-risk-audit.md)（v2.1 给 agent 工具加 riskLevel + audit） |

---

## 一、背景

项目里有两套看起来"重复"的工具注册表：

| 工具系统 | 位置 | 工具数 | Schema 风格 | 风险模型 |
|---|---|---|---|---|
| `agentToolRegistry` | `backend/src/modules/ai/services/agents/agentToolRegistry.ts` | 24（v2.1 后） | JSON Schema `{properties, required}` | `riskLevel` + `auditEnabled`（v2.1 由 ADR-020 加） |
| `mcp/toolRegistry` | `backend/src/modules/mcp/services/toolRegistry.ts` | 13+ 平台 + N 外部 MCP server | Zod `z.object({...})` | `annotations: {riskLevel, readOnlyHint, destructiveHint, idempotentHint, requiresApproval}` |

报告 §2.3 把这列为 🟠 高严重度问题，担心"用户认知混乱"和"维护负担翻倍"。

## 二、决策

**承认两套工具系统并存是有意设计，不合并，并显式记录它们的差异化定位。**

不做合并的理由：

1. **消费者正交**：agent 工具只给 ai 模块 Agent 用，mcp 工具给 LLM Agent / 外部 MCP 客户端用（详见 §三）
2. **风险模型不同**：mcp 必须 6 层 securityGate（参考 [ADR-008](../.trae/adr/008-mcp-agent-communication.md)），agent 工具是 ai Agent 内部执行，**不属于"对外能力"**
3. **Schema 风格不同**：agent 工具用 JSON Schema 是因为 Agent 内部代码更轻量；mcp 用 Zod 是因为需要跨语言、跨客户端解析
4. **合并成本极高**：16-24h 工时，回归风险大，回报却是"代码看起来更整洁"

## 三、差异化定位（核心）

| 维度 | agentToolRegistry | mcp/toolRegistry |
|---|---|---|
| **消费者** | ai 模块的 [agentCore.ts](../backend/src/modules/ai/services/agents/agentCore.ts) 内部 `executeToolCall`（Node.js 代码） | LLM Agent、外部 MCP client、其他模块的 Specialist |
| **入口** | `POST /agents/tools/test` | `POST /mcp/tools/call` / JSON-RPC |
| **典型工具** | ssh-exec, docker-list-containers, list-alerts（运维场景特化） | monitor.query, server.list, network.topology（跨模块通用） |
| **安全门** | `requireRole` + audit log（v2.1） | 6 层 securityGate + approvalFlow + rate limit |
| **Schema** | JSON Schema | Zod |
| **输出格式** | `string`（执行结果） | `content[]` MCP 风格 |
| **抽象层次** | 业务执行层 | 协议层 |

**核心区别**：agent 工具是"Agent 私有的执行能力"，mcp 工具是"对外开放的协议能力"。两者**职责不重叠**。

### 3.1 实际调用路径（证据）

`backend/src/modules/ai/services/agents/agentCore.ts:62-65`：

```typescript
export async function executeToolCall(toolId: string, args: Record<string, any>) {
  // 1. 先在旧工具注册表中查找（agent 私有工具）
  const tool = agentToolRegistry.getTool(toolId);
  if (tool) { /* 直接执行，无 securityGate */ }

  // 2. 找不到则走 MCP adapter（走 mcp gateway）
  return agentMcpAdapter.executeTool(toolId, args);
}
```

**含义**：

- agent 工具 = ai Agent 内部"硬编码"的执行能力（如 SSH、Docker exec）
- mcp 工具 = LLM 通过 MCP 协议调用的能力
- **两者调用路径已显式分离**，并不是"随意重复"

### 3.2 反向桥接（已存在）

`backend/src/modules/ai/services/agents/agentMcpAdapter.ts` 把 mcp 工具**暴露给 ai Agent**：

```typescript
// 注释：「将 MCP toolRegistry 桥接到 Agent 的工具调用系统」
// 用途：让 Agent 也能调用 mcp 工具
const result = await agentMcpAdapter.executeTool('alert.list', { severity: 'critical' });
```

即：**LLM 视角的工具 (mcp) → Agent 视角 (agent) 的桥接已存在**；**Agent 视角的工具 (agent) → LLM 视角 (mcp) 的桥接暂不存在**（按需添加）。

## 四、何时需要合并

**只有在以下情况同时出现时，才考虑合并**：

1. LLM Agent **真的需要**调用 ssh-exec、docker exec 等运维工具（目前 ai 模块的 Agent 不用 LLM，直接 Node.js 调 agentToolRegistry）
2. 出现两个团队的维护冲突（如同时改同一类工具）
3. 合并成本 < 200% 当前成本（< 50h）

**当前状况**：

- ✅ 条件 1：LLM Agent 不调 agent 工具（ai 模块 Agent 内部执行）
- ❌ 条件 2：只有 ai 模块维护 agentToolRegistry，无团队冲突
- ❌ 条件 3：合并成本 16-24h + 回归风险

**结论**：当前**不满足任一合并触发条件**，ADR 通过。

## 五、新增工具时的判定标准

**这是本 ADR 最重要的部分——给后续开发者/AI 工具明确的"放哪个篮子"标准。**

### 决策树

```
你的工具是给谁用的？
│
├── 1. LLM Agent 通过 MCP 协议调用 → mcp/toolRegistry
│   典型场景：monitor.query, server.list, alert.list（跨模块查询）
│   入口：backend/src/modules/mcp/services/toolDefinitions/<domain>Tools.ts
│
├── 2. AI 模块的 Agent 内部执行 → agentToolRegistry
│   典型场景：SSH 命令、Docker exec、K8s API、运维场景特化工具
│   入口：backend/src/modules/ai/services/agents/agentToolRegistry.ts
│   必须包含：riskLevel + auditEnabled（参考 ADR-020 v2.1）
│
└── 3. 只在某个 routes.ts 用一次的简单工具函数 → 不要做成 registry
    典型场景：格式化函数、数据转换、统计计算
    位置：backend/src/modules/<m>/services/<file>.ts 普通函数
```

### 反例（不要做的事）

- ❌ **不要**把 SSH 命令放到 mcp/toolRegistry（mcp 应该无状态、可水平扩展；SSH 是长连接有状态）
- ❌ **不要**把跨模块查询放到 agentToolRegistry（agent 是 ai 模块私有，不能跨模块）
- ❌ **不要**为了"统一"硬塞到一个 registry（会让两套系统的安全模型互相妥协）

## 六、对比合并方案（备查）

如果未来真的需要合并，方案对比：

| 方案 | 工时 | 风险 | 收益 | 何时选择 |
|---|---|---|---|---|
| A. 完全合并（删 agentToolRegistry） | 16-24h | 🟠 高回归风险 | 消除"重复"假象 | 永远不建议 |
| B. 保留两套 + 适配层/转发层 | 6-10h | 🟡 中（双注册） | mcp 安全门自动生效 | 当条件 1 出现 |
| **C. 明确边界 + ADR 记录** ✅ | **2-4h** | **🟢 零回归** | **架构清晰化** | **当前选** |

## 七、实施清单

- [x] 写本 ADR
- [x] 更新 [architecture.md §1.2 ai/ + mcp/ 章节](../.trae/rules/architecture.md)（说明差异化定位）
- [x] 更新 [AGENTS.md §3/§4](../AGENTS.md)（新增工具判定标准）
- [x] 在 [ADR-020 §六 v2.3](020-agent-tool-risk-audit.md) 记录本次决策

## 八、未来工作（按需触发）

- [ ] **当 LLM Agent 真需要调 SSH/Docker**：写 `agentToolsMcpBridge.ts`，把 agentToolRegistry 24 个工具**作为 mcp 工具**暴露，走 mcp gateway。**触发条件**：[ai/services/llm/llmService.ts](../backend/src/modules/ai/services/llm/llmService.ts) 有 toolCall 引用 `agentToolRegistry` 任意工具
- [ ] **当合并条件 2 或 3 满足**：重新评估方案 A/B

---

**最后更新**：2026-07-21
**维护者**：项目作者 + AI 协作（Trae）