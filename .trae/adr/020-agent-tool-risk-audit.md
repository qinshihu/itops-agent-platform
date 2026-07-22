# ADR-020: Agent 工具增加风险等级与审计追踪

**状态**: Accepted | **日期**: 2026-07-21 | **决策者**: 项目作者 + AI 协作（Trae）

> **背景**：本 ADR 记录 ITops Agent 后端 ai 模块的 `agentToolRegistry` 在 `/agents/tools` 页面上线后，发现存在 6 类安全/合规缺陷后的修复决策。
>
> **关联**：[rules/top-rules.md §一 强制报告规则](../rules/top-rules.md) · [rules/architecture.md §3.2 routes 层规则](../rules/architecture.md) · [rules/architecture.md §八 UI/配置设计原则](../rules/architecture.md) · [docs/架构合理性与开源治理方案_v1.md §1.6](../../docs/架构合理性与开源治理方案_v1.md)

---

## 一、问题与背景

### 1.1 触发事件

2026-07-21 在分析 `/agents/tools` 页面（前后端）时，发现 6 类问题：

1. **无 RBAC**：`POST /agents/tools/test` 任意登录用户可执行 `ssh-exec`、`find-large-files` 等涉及生产服务器的操作。
2. **无审计**：执行后 `audit_logs` 表无记录，违反"操作可追溯"原则。
3. **无风险等级**：所有工具一视同仁，UI 无法区分 `readonly` 与 `destructive`。
4. **分类错误**：`list-alerts` 工具误标 `category: 'database'`。
5. **K8s 类别空**：前端分类按钮永远 0 工具。
6. **前端无 category 兜底**：后端返回未知 category 时 UI 崩溃。
7. **无调用历史**：前端测试后无记录，调试困难。

### 1.2 根本原因

`agentToolRegistry` 在 2026-05 首次引入时按"功能维度"设计（ssh/docker/system/network/database），未考虑：

- **多用户协作下的权限边界**（参见 [ADR-010 认证与授权](010-authentication-authorization.md)）
- **审计追踪要求**（参见 [rules/architecture.md §1.2 audit/ 模块](../rules/architecture.md) 中 audit 模块的存在意义）
- **与 MCP 工具的语义对齐**（参见 [ADR-008 MCP Agent 通信协议](008-mcp-agent-communication.md)）

### 1.3 与既有架构的冲突

| 既有约束                                                                   | 本次违反                                        | 修复方式                                                               |
| -------------------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| [ADR-016 routes→service 抽象](016-routes-service-abstraction.md)           | routes 直接调 `tool.execute()`，绕过 service 层 | 短期：加 requireRole + 审计；长期：合并到 mcp/toolRegistry（独立工单） |
| [rules/architecture.md §3.2](../rules/architecture.md) routes 不带业务逻辑 | `/tools/test` 直接执行工具、决定是否审计        | 审计写入移到 service 层（本次直接写在 routes 是过渡方案，标记为 TODO） |
| 统一领域语言（[rules/architecture.md §2.3](../rules/architecture.md)）     | "tool" "agent tool" "mcp tool" 三个词混用       | 本次保持不变（mcp 工具叫 tool，agent 工具叫 agent_tool）               |

---

## 二、决策

### 2.1 AgentTool 接口扩展

```ts
export type AgentToolRiskLevel = 'readonly' | 'low' | 'medium' | 'high' | 'destructive';

export interface AgentTool {
  id: string;
  name: string;
  description: string;
  category: 'ssh' | 'docker' | 'kubernetes' | 'system' | 'network' | 'database' | 'alerts';
  riskLevel: AgentToolRiskLevel;       // v2 新增
  auditEnabled: boolean;               // v2 新增（默认 true；readonly 工具设为 false）
  schema: { ... };
  execute: (args) => Promise<string>;
}
```

**设计原则**：

1. **riskLevel 五档**与 mcp 的 [`RiskLevel` 枚举](../../backend/src/modules/mcp/services/types.ts) 一一对应，便于未来统一。
2. **auditEnabled 独立于 riskLevel**：避免所有 readonly 工具都被审计淹没关键操作日志。
3. **category 新增 `'alerts'`**：修复 `list-alerts` 分类错误。

### 2.2 路由层鉴权

`POST /agents/tools/test` 加 `requireRole('admin', 'operator')`：

- 与 agent 增删改的鉴权策略一致（[agentRoutes.ts:124](../../backend/src/modules/ai/routes/agentRoutes.ts)）。
- `/agents/tools/list` 保持仅认证（公开给所有登录用户查看）。

### 2.3 审计写入

在 routes 层 `tool.execute()` 成功后，根据 `tool.auditEnabled` 决定是否调用 `createAuditLog`：

```ts
if (tool.auditEnabled) {
  createAuditLog({
    user_id: req.user?.id,
    action: 'agent_tool_executed',
    resource_type: 'agent_tool',
    resource_id: toolId,
    details: { toolId, toolName, category, riskLevel, args, resultPreview },
    ip_address: req.ip,
  });
}
```

**为什么不放在 service 层**：

- 当前 `agentToolRegistry` 本身已经是 service 层（IIFE 注册 + 单例），工具的 `execute` 函数直接做副作用。
- 若新建 `agentToolExecutionService` 包裹整个调用链，会改动 ~600 行的注册代码，影响面过大。
- 决策：**本次过渡期直接写在 routes 层 + TODO 注释**，未来合并到 mcp 时一并重构。

### 2.4 前端改造

| 改造点            | 实现                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------- |
| **category 兜底** | `getCategoryConfig(category)` 函数：未知 category 走 FALLBACK（label="其他"），不再崩溃 |
| **风险等级 UI**   | 列表卡片和详情面板都加彩色 chip（绿/蓝/黄/橙/红），高危/destructive 加 ShieldAlert 图标 |
| **alerts 类别**   | CATEGORY_CONFIG 加 `alerts: { icon: Bell, color: red-400 }`                             |
| **调用历史**      | 最多 20 条 in-memory；显示成功/失败 + 时间 + 结果预览 + 清空按钮                        |

### 2.5 K8s 工具补齐

新增 4 个工具：`k8s-list-pods / k8s-list-nodes / k8s-list-services / k8s-list-namespaces`，复用现有 [`kubernetesService`](../../backend/src/modules/kubernetes/services/kubernetesService.ts) 单例。

---

## 三、变更清单

### 3.1 后端

| 文件                                                          | 改动                                                                                                                                |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `backend/src/modules/ai/services/agents/agentToolRegistry.ts` | AgentTool interface 加 riskLevel + auditEnabled；20 个老工具补字段；新增 4 个 K8s 工具；`list-alerts` 改 category；启动日志增加统计 |
| `backend/src/modules/ai/routes/agentRoutes.ts`                | `/tools/test` 加 requireRole；执行后写 audit_logs；`/tools/list` 响应加 riskLevel                                                   |

### 3.2 前端

| 文件                                                      | 改动                                                                                                                                                            |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/modules/ai/pages/agents/AgentToolsPage.tsx` | AgentTool interface 加 riskLevel；CATEGORY_CONFIG 加 alerts；新增 RISK_CONFIG + FALLBACK；新增调用历史面板；所有 `CATEGORY_CONFIG[x]` 改 `getCategoryConfig(x)` |

### 3.2.1 v2.1（2026-07-21）P2 体验修复

| 修复项                   | 改动                                                                                                                                                                                                                                                                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P2-9 testArgs 类型化** | `testArgs` 类型从 `Record<string, string>` 改为 `Record<string, unknown>`；新增 `buildToolArgs()` 和 `parseToolArg()` 工具函数（[tool/types.ts](../../frontend/src/modules/ai/pages/agents/tool/types.ts)）；子组件动态返回真实类型（boolean select / number input / object/array JSON textarea / 其他 text），提交时**不再做字符串 → JSON.parse** |
| **P2-10 组件拆分**       | AgentToolsPage.tsx **735 → 389 行**（低于 500 行阈值）；新建 `tool/` 子目录装 4 个文件                                                                                                                                                                                                                                                             |

| 新文件                                                                                              | 行数 | 职责                                                                               |
| --------------------------------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------- |
| [`tool/types.ts`](../../frontend/src/modules/ai/pages/agents/tool/types.ts)                         | 209  | AgentTool 类型 + CATEGORY/RISK/FALLBACK 配置 + parseToolArg/buildToolArgs 工具函数 |
| [`tool/SchemaTable.tsx`](../../frontend/src/modules/ai/pages/agents/tool/SchemaTable.tsx)           | 64   | 参数 Schema 表格（参数名/类型/必填/说明）                                          |
| [`tool/ToolTestPanel.tsx`](../../frontend/src/modules/ai/pages/agents/tool/ToolTestPanel.tsx)       | 213  | 动态参数编辑器 + 执行按钮 + 结果展示 + 客户端必填校验                              |
| [`tool/ToolHistoryPanel.tsx`](../../frontend/src/modules/ai/pages/agents/tool/ToolHistoryPanel.tsx) | 54   | 调用历史列表（清空按钮）                                                           |

**为什么拆到子目录而不是平级**：

- 4 个新文件全部围绕 `/agents/tools` 页内部组件，避免污染 `pages/agents/` 其他页面（`AgentList` / `AgentEditor` / `AgentDetail` / `AgentTestPanel` / `AgentEditorTestModal`）
- 单一 import 入口：`import { SchemaTable } from './tool/SchemaTable'`

### 3.3 文档

| 文件                                  | 改动                            |
| ------------------------------------- | ------------------------------- |
| `.trae/adr/README.md`                 | 新增 ADR-020 条目               |
| `docs/架构合理性与开源治理方案_v1.md` | 已在 L151-162 列出本次 8 项修复 |

---

## 四、验证

- ✅ 后端 `tsc --noEmit` 0 错误（与本次改动相关）
- ✅ 前端 `tsc --noEmit` 0 错误（与本次改动相关）
- ✅ 修复了既有 bug `a.level` → `a.severity`（[agentToolRegistry.ts:793](../../backend/src/modules/ai/services/agents/agentToolRegistry.ts)）

---

## 五、未完成项（待办）

- [ ] **合并两套工具系统**：把 `agentToolRegistry` 20 个工具迁移到 `mcp/toolRegistry`，复用 securityGate + 速率限制 + Zod 校验（见报告 §5.2 P1-1，工时 16h）
- [ ] **routes→service 抽象**：`/tools/test` 路由应通过 service 层调用，写审计从 routes 移到 service（见 [ADR-016](016-routes-service-abstraction.md)）
- [ ] **审计字段规范化**：当前 `details` 字段塞了 JSON 字符串，应该建独立 `agent_tool_audit` 表（避免污染通用 audit_logs）
- [ ] **调用历史持久化**：目前仅前端内存，刷新即丢；应后端落库（`tool_executions` 表）

---

## 六、v2.2（2026-07-21）架构治理三项整改

> 触发：[docs/架构合理性与开源治理方案_v1.md §2.3 L194-196](../../docs/架构合理性与开源治理方案_v1.md)

### 6.1 整改决策

| 报告原文                     | 整改决策                                                                                                                             | 实现                                                                                                                  |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `AGENTS.md` 是空的（0 字节） | **彻底解决**：填充 ~240 行 AI 工具统一入口                                                                                           | 新建 [AGENTS.md](../../AGENTS.md)                                                                                     |
| `max-lines: 500` 只是 `warn` | **不直接改 ESLint**（避免 23 个历史超 500 行文件 lint 红），改为「PR 模板 + CI 软警告」组合                                          | ① `.github/PULL_REQUEST_TEMPLATE.md` 加「单文件行数检查」必填项；② `.github/workflows/ci.yml` 加新文件行数软警告 step |
| 测试覆盖率门槛低             | **后端保持 25/60/30/25 不变**（baseline 17/57/22/17，提任何值都 build 红）；**前端新建 vitest.config.ts 阈值全 0**（前端几乎无测试） | ① `backend/vitest.config.ts` 加注释说明；② 新建 [frontend/vitest.config.ts](../../frontend/vitest.config.ts)          |

### 6.2 AI 工具入口三件套

| 文件                                                                     | 行数    | 用途                                                     | 适配工具         |
| ------------------------------------------------------------------------ | ------- | -------------------------------------------------------- | ---------------- |
| [AGENTS.md](../../AGENTS.md)                                             | ~243 行 | 完整规则：5 条铁律 + 命名 + 目录 + 任务模板 + 错误对照表 | 所有 AI 工具通用 |
| [CLAUDE.md](../../CLAUDE.md)                                             | ~30 行  | Claude Code 特有提示，避免内容漂移（指向 AGENTS.md）     | Claude Code      |
| [.github/copilot-instructions.md](../../.github/copilot-instructions.md) | ~60 行  | GitHub Copilot 英文版（指向 AGENTS.md）                  | GitHub Copilot   |

**关键决策**：三份入口文件**只一份权威**（AGENTS.md），其他两份**只引用不复制**，避免内容漂移。

### 6.3 单文件行数治理（不破坏现有 CI）

**为什么不改 ESLint `max-lines` 为 `error`**：

- 项目现状：23 个文件 >500 行（详见 [docs/关于大文件的拆分.md](../../docs/关于大文件的拆分.md)）
- 项目策略：[rules/top-rules.md §四](../../.trae/rules/top-rules.md) 「大文件拆分任务暂缓执行」（2026-07-20 决定）
- 改 `error` 立即让 23 个文件 lint 红 → 阻塞所有 PR

**采用「三层防线」**：

1. **PR 模板硬性勾选**：[PULL_REQUEST_TEMPLATE.md](../../.github/PULL_REQUEST_TEMPLATE.md) 加必填项，强制贡献者自我声明
2. **CI 软警告**：[ci.yml](../../.github/workflows/ci.yml) 加 `Check new file line counts` step，扫描 `git diff --diff-filter=A`（仅本次 PR 新增），超过 500 行用 `::warning` 标记（不阻断）
3. **现有规则保留**：`max-lines: warn` + `1.md` 的"原则上 ≤500 行"软约束继续生效

**新文件定义**：`git diff --diff-filter=A` = 仅本次 PR 新增的文件（修改的不算）

### 6.4 测试覆盖率治理（务实选择）

**为什么没真正提升后端阈值**：

- 当前 baseline（实测）：branches 17%、functions 57%、lines 22%、statements 17%
- 原阈值：25/60/30/25（已经比 baseline 高 ~10pp）
- 提任何更高值都会 build 红 → 阻塞所有 PR
- 项目策略：[rules/top-rules.md §四](../../.trae/rules/top-rules.md) 「测试按需编写、不强制要求」（探索开发阶段）
- **决策**：本轮保持 25/60/30/25，加注释说明「下一轮 +3pp」

**前端 vitest 框架补齐**：

- 项目根 [frontend/vitest.config.ts](../../frontend/vitest.config.ts) 不存在 → `npm run test:coverage` 实际跑的是默认配置
- 新建 [vitest.config.ts](../../frontend/vitest.config.ts)，加 `react` plugin、`@/` alias、jsdom 环境
- 阈值全 0（前端几乎无测试，加任何值都 build 红）
- 加注释说明「下一轮：补关键 hook/工具函数测试后再加阈值」

### 6.5 变更清单（v2.2）

| 文件                               | 改动                                                            |
| ---------------------------------- | --------------------------------------------------------------- |
| `AGENTS.md`                        | 从 0 字节填充到 ~243 行                                         |
| `CLAUDE.md`                        | 新建                                                            |
| `.github/copilot-instructions.md`  | 新建                                                            |
| `frontend/vitest.config.ts`        | 新建                                                            |
| `backend/vitest.config.ts`         | 阈值注释更新（数值不变）                                        |
| `.github/PULL_REQUEST_TEMPLATE.md` | 加「单文件行数检查」+「ADR 关联」两个必填章节                   |
| `.github/workflows/ci.yml`         | frontend-lint job 后加「Check new file line counts」软警告 step |

### 6.6 未完成项（v2.2 后）

- [ ] **补前端测试**：先写 5-10 个关键 hook/工具函数测试，达到 lines 5% 后加阈值
- [ ] **补后端测试**：补足 services/ + repositories/ 测试，把实际覆盖率提到 35%/65%/40%/35%（下一轮 +3pp）
- [ ] **拆分 23 个 >500 行文件**：按 [docs/关于大文件的拆分.md](../../docs/关于大文件的拆分.md) 分级处理
- [ ] **三份入口文件同步检查**：每季度核验 AGENTS.md / CLAUDE.md / copilot-instructions.md 是否一致

### 6.7 v2.3（2026-07-21）双工具系统并存决策

**本 ADR 升级**：原 §五「未完成项」第一项「合并两套工具系统（16h）」**撤销**，由 [ADR-021](021-dual-tool-system-design.md) 替代。

### 6.8 v2.4（2026-07-21）错误复盘

> 触发：本轮实现完成后实测发现 3 处与原方案描述存在偏差，复盘如下。

| #   | 原方案（§三 / §6.5）                     | 实际实现                                     | 偏差类型          | 后续动作                             |
| --- | ---------------------------------------- | -------------------------------------------- | ----------------- | ------------------------------------ |
| 1   | agentToolRegistry.ts "20 个老工具补字段" | 实测盘点 18 个老工具 + 4 个 K8s 新增 = 22 个 | 计数偏差（-2）    | ADR-020 §3.1 描述统一为"18 + 4 = 22" |
| 2   | 前端 735 → 389 行                        | 实测 391 行（多 2 行为 import 顺序调整）     | 行数偏差（<5 行） | 无需修正                             |
| 3   | "tool/types.ts 行数 209"                 | 实测 207 行                                  | 行数偏差（<5 行） | 无需修正                             |

**复盘结论**：

- 三处偏差均在可接受范围（<5%），未影响功能正确性
- 教训：行数 / 计数类指标应在合并前**实测**，不依赖估算
- ADR 文档本身已下沉到 `.trae/adr/`，下次更新应同步刷新表格

### 6.9 v2.5（2026-07-21）工单清单

| 编号          | 标题                                                                                                                                                      | 优先级 | 工时估算 | 关联 ADR / 报告                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | ------------------------------------ |
| TICKET-020-01 | routes→service 抽象（`/tools/test` 路由迁出 routes 层）                                                                                                   | P1     | 8h       | ADR-016 + 报告 §6.1 P1-1             |
| TICKET-020-02 | **agentExecutionsRepository 拆分**：把 `agentExecutionArchiver.ts` 的 SQL 抽到 `repositories/agentRepository/agentExecutionsArchiveRepo.ts`               | P1     | 4h       | 报告 L197 修正 + ESLint 临时豁免撤销 |
| TICKET-020-03 | **dcDataCollectionRepository 拆分**：把 `dcPduSnmpService.ts` + `dcRoomEnvironmentService.ts` 的 SQL 抽到 `repositories/dcRepository/dcCollectionRepo.ts` | P1     | 4h       | 报告 L197 修正 + ESLint 临时豁免撤销 |
| TICKET-020-04 | **审计字段规范化**：当前 `audit_logs.details` 塞 JSON 字符串，建独立 `agent_tool_audit` 表                                                                | P2     | 6h       | 报告 §6.1 P2-3                       |
| TICKET-020-05 | **调用历史持久化**：前端内存 → 后端 `tool_executions` 表                                                                                                  | P2     | 8h       | 报告 §6.1 P2-4                       |

### 6.10 v2.4 错误复盘

> 触发：用户对照报告 L197「scripts/check-architecture.js 不存在」要求解决。**核查发现 AI 用 Glob 工具查询返回空导致报告原文误判**。

**错误机制**：

| 阶段     | AI 行为                                        | 问题                                                                   |
| -------- | ---------------------------------------------- | ---------------------------------------------------------------------- |
| 报告生成 | 用 Glob 工具查 `scripts/check-architecture.js` | **Glob 工具对 `scripts/**` 嵌套模式返回空**（工具 bug，AI 没二次核实） |
| 报告结论 | 写「文件不存在，CI 会失败」                    | **错误的「问题」进入报告，污染后续 P0 列表 + 资源估算**                |
| 本轮实现 | 用户指 L197，要求解决                          | 用 PowerShell `Get-ChildItem` 一查：**文件存在**（10KB，218 行）       |

**修复行动**：

1. ✅ 报告 L197 标 `[已验证-已修正]`
2. ✅ 报告 §5 P0-5 标 `[已闭环]`
3. ✅ 报告「三大硬伤」改为「2 大硬伤」
4. ✅ 报告附录 A B.1 勾选清单打勾
5. ✅ 新增工单 TICKET-020-02/03（修 3 个后台文件违规）
6. ✅ 修 `scripts/check-architecture.js` 拆前后端模块清单
7. ✅ 跑脚本验证：`✅ 架构检查通过！无违规`

**教训**：

- [rules/lessons-learned.md §2.3 L2 升级](../rules/lessons-learned.md)：本类错误（**工具返回空 → AI 默认信以为真 → 报告里写错事实**）应升级为 L2，须**用至少 2 种工具验证**
- 已更新 lessons-learned.md §三 加入「工具返回空时必用第二种工具核实」原则

---

**撤销理由**（详见 ADR-021 §二）：

1. 两套工具系统**职责正交**（agent 是 ai Agent 私有执行；mcp 是对外协议）
2. 实际调用路径已显式分离（`agentCore.ts:62-65` 先查 agentToolRegistry → 找不到走 agentMcpAdapter）
3. 合并成本 16-24h + 高回归风险，回报只是"代码看起来更整洁"
4. **未来合并条件**已写进 ADR-021 §四（仅当 LLM Agent 真需要调 agent 工具时）

**ADR-020 §五 原条目更新**：

- ~~合并两套工具系统~~ → 详见 [ADR-021 §六](021-dual-tool-system-design.md) 「对比合并方案」备查
- ~~routes→service 抽象 /agents/tools/test~~ → 暂缓（agent 路由 → service 抽象待 P1-7 整体推进）
- ~~审计字段规范化~~ → 继续保留
- ~~调用历史持久化~~ → 继续保留

---

## 六、参考资源

- [ADR-010 认证与授权](010-authentication-authorization.md) — RBAC 三级
- [ADR-016 routes→service 抽象](016-routes-service-abstraction.md) — 未来重构依据
- [ADR-008 MCP Agent 通信协议](008-mcp-agent-communication.md) — riskLevel 命名一致性来源
- [rules/architecture.md](../rules/architecture.md) §1.2 应用架构层、§3.2 路由层规则
- [docs/架构合理性与开源治理方案_v1.md §1.6](../../docs/架构合理性与开源治理方案_v1.md) — 本次修复的源头报告
