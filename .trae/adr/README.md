# Architecture Decision Records (ADR)

本目录记�?ITops Agent 平台的所有关键技术决策，按编号排序�?

## ADR 列表

| 编号 | 标题                                                                                             | 架构�?           | 状�?                  |
| ---- | ------------------------------------------------------------------------------------------------ | ---------------- | --------------------- |
| 001  | [TypeScript + Express 技术栈](001-typescript-express.md)                                         | 技术架构层       | Accepted              |
| 002  | [SQLite 数据库](002-sqlite-database.md)                                                          | 数据架构�?       | Accepted              |
| 003  | [ServiceContainer 依赖注入](003-servicecontainer-di.md)                                          | 技术架构层       | Accepted              |
| 004  | [Repository 模式](004-repository-pattern.md)                                                     | 数据架构�?       | Accepted              |
| 005  | [DDD 模块边界（已 Superseded）](005-module-boundaries.md)                                        | 应用架构�?       | Superseded by ADR-017 |
| 006  | [SSH 命令安全过滤（已 Deprecated）](006-command-filter.md)                                       | �?               | Deprecated 2026-07-06 |
| 007  | [前后�?1:1 映射](007-frontend-backend-mapping.md)                                                | 应用架构�?       | Accepted              |
| 008  | [MCP Agent 通信协议](008-mcp-agent-communication.md)                                             | 技术架构层       | Accepted              |
| 009  | [前端状态管理：React Query + React Context](009-frontend-state-management.md)                    | 技术架构层       | Accepted              |
| 010  | [认证与授权：JWT + 3 �?RBAC](010-authentication-authorization.md)                                | 业务架构�?       | Accepted              |
| 011  | [WebSocket 事件协议：Socket.io 房间模式](011-websocket-event-protocol.md)                        | 技术架构层       | Accepted              |
| 012  | [虚拟机平台适配器策略](012-vm-platform-adapter-strategy.md)                                      | 应用架构�?       | Accepted              |
| 013  | [AI 模型 Provider 抽象：providerAdapters + CircuitBreaker](013-ai-model-provider-abstraction.md) | 业务架构�?       | Accepted              |
| 014  | [mcp 模块路由文件命名例外（routes.tsx）](014-mcp-routes-tsx-exception.md)                        | 应用架构�?       | Accepted              |
| 015  | [自动伸缩真实实现](015-autoscale-real-impl.md)                                                   | 应用架构�?       | Accepted              |
| 016  | [路由�?�?Service 层抽象（Routes Service Abstraction）](016-routes-service-abstraction.md)        | 应用架构�?       | Accepted              |
| 017  | [infra 模块按业务子域拆分（Infra Subdomain Splitting）](017-infra-subdomain-splitting.md)        | 应用架构�?       | Accepted              |
| 018  | [enhancedNodeExecutor 按节点类型拆分](018-enhanced-node-executor-splitting.md)                   | 应用架构�?       | Accepted              |
| 019  | [.trae/adr + .trae/rules + .trae/documents 同步�?git 跟踪](019-trae-adr-git-tracking.md)         | 文档与工程治理层 | Accepted              |
| 020  | [Agent 工具增加风险等级与审计追踪](020-agent-tool-risk-audit.md)                                 | 应用架构�?       | Accepted              |
| 021  | [双工具系统（agentToolRegistry vs mcp/toolRegistry）是有意设计](021-dual-tool-system-design.md)  | 应用架构�?       | Accepted              |
| 022  | [�?depcruise �?lint-staged 到兼�?Node 20 的版本](022-node20-dep-pin.md)                          | 文档与工程治理层 | Accepted              |
| 023  | [SSH 命令注入修复（agentToolRegistry 4 处）](023-ssh-command-injection-fix.md)                   | 应用架构�?       | Accepted              |
| 024  | [P0 全部闭环（CI 链路 + 5 个安全漏�?+ lint 全清）](024-p0-batch-fixes.md)                        | 文档与工程治理层 | Accepted              |
| 025  | [P1 第一�?+ #15 完整 + #16a 启动](025-p1-batch-fixes.md)                                         | 应用架构�?       | In Progress           |
| 026  | [1.md �?top-rules.md 重构决策](026-top-rules-refactor.md)                                        | 文档与工程治理层 | Accepted              |
| 031  | [v2.x 大文件拆分完整方法论�?2 次实战沉淀）](031-v2-large-file-splitting-methodology.md)          | 文档与工程治理层 | Accepted              |
| 034  | [v001 migration 拆分�? chunk + 2 sqlBuilder）](034-v001-migration-splitting.md)                  | 数据架构�?       | Accepted              |
| 035  | [修复 main CI 失败（eslint 配置 + 动�?import）](035-ci-eslint-fix.md)                            | 工具�?           | Accepted              |

## 已废弃的 ADR

| 编号 | 标题             | 废弃日期   | 废弃原因                                                                                                                                                                                                |
| ---- | ---------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 006  | SSH 命令安全过滤 | 2026-07-06 | `middleware/commandFilter.ts` 已删除。按 [rules/top-rules.md §六](../rules/top-rules.md) 规则，SSH 执行不做任何命令过滤；安全由服务器端账号权限控制。详�?[006-command-filter.md](006-command-filter.md) |

## 按架构层分类

**业务架构�?*（领域规则与流程�?

- 010: 认证与授�?
- 013: AI Model Provider 抽象

**应用架构�?*（模块编排与功能实现�?

- 005: DDD 模块边界（Superseded by 017�?
- 007: 前后�?1:1 映射
- 012: VM 平台适配器策�?
- 014: mcp 模块路由文件命名例外（routes.tsx�?
- 015: 自动伸缩真实实现
- 016: 路由�?�?Service 层抽象（**P1-5 完成后确�?*�?
- 017: infra 模块按业务子域拆�?
- 018: enhancedNodeExecutor 按节点类型拆�?
- 020: Agent 工具风险等级与审计追�?
- 021: 双工具系统是有意设计（详�?ADR-021�?

**数据架构�?*（存储与持久化）:

- 002: SQLite 数据�?
- 004: Repository 模式
- 034: v001 migration 拆分

**技术架构层**（基础设施与公共能力）:

- 001: TypeScript + Express 技术栈
- 003: ServiceContainer DI
- 008: MCP Agent 通信协议
- 009: 前端状态管�?
- 011: WebSocket 事件协议

**文档与工程治理层**:

- 019: `.trae/{adr,rules,documents}/` 同步�?git 跟踪
- 022: devDependencies 锁版本兼�?Node 20

---

## 按主题反向索引（2026-07-21 新增 · v2 报告 §9.2 P1-#23�?

> 当你遇到一�?*具体主题/场景**时，从这里找 ADR；比按编号翻找快 5 倍�?

### 🔐 安全相关

| 主题                                                          | ADR                                     |
| ------------------------------------------------------------- | --------------------------------------- |
| SSH 命令注入防护                                              | 023（修复）�?006（已 Deprecated，过时） |
| SSH 命令过滤策略（不做！靠服务端权限�?                        | 006（Deprecated�?                       |
| 认证 / 授权 / RBAC                                            | 010                                     |
| Agent 工具风险等级 + 审计                                     | 020                                     |
| 双工具系统的安全边界（agentToolRegistry vs mcp/toolRegistry�? | 021                                     |

### 🏗�?架构边界

| 主题                                                  | ADR               |
| ----------------------------------------------------- | ----------------- |
| DDD 模块边界（已 Superseded�?                         | 005 �?017（替代） |
| 路由�?�?Service 层抽象（禁止 routes 直访 repository�? | 016               |
| 前后�?1:1 映射                                        | 007               |
| infra 模块按子域拆�?                                  | 017               |
| enhancedNodeExecutor 按节点类型拆�?                   | 018               |
| mcp 模块 routes.tsx 命名例外                          | 014               |

### 🤖 AI / MCP / Agent

| 主题                                                    | ADR |
| ------------------------------------------------------- | --- |
| MCP Agent 通信协议                                      | 008 |
| AI Model Provider 抽象 + CircuitBreaker                 | 013 |
| 双工具系统设计（agentToolRegistry vs mcp/toolRegistry�? | 021 |
| Agent 工具风险等级 + 审计追踪                           | 020 |
| 自动伸缩真实实现                                        | 015 |

### 🛠�?技术栈与基础设施

| 主题                        | ADR |
| --------------------------- | --- |
| TypeScript + Express 技术栈 | 001 |
| ServiceContainer DI         | 003 |
| VM 平台适配器策�?           | 012 |
| WebSocket 事件协议          | 011 |
| 前端状态管�?                | 009 |

### 🗃�?数据 / 数据�?

| 主题            | ADR |
| --------------- | --- |
| SQLite 选型     | 002 |
| Repository 模式 | 004 |

### 📋 流程与治�?

| 主题                                     | ADR |
| ---------------------------------------- | --- |
| `.trae/{adr,rules,documents}/` 同步�?git | 019 |
| devDependencies 锁版本兼�?Node 20        | 022 |
| P0 批量闭环（CI + 安全 + lint�?          | 024 |
| P1 批量修复（持续）                      | 025 |

### 🛠�?批量修复�?ADR�?026-07-21 v6.4 新增分类�?

> **与决策类 ADR 的区�?\*：批量修复类 ADR 记录"v2 报告 §9 列举�?P0/P1 必修�?*逐个修复**的过�?�?_不包含新的架构选择_*。读者应理解�?修复记录"而非"决策背景"�?

| 编号 | 标题                                        | 状�?        | 关联决策�?ADR             |
| ---- | ------------------------------------------- | ----------- | ------------------------- |
| 024  | P0 全部闭环（CI + 5 个安全漏�?+ lint 全清�? | Accepted    | ADR-022、ADR-023、ADR-010 |
| 025  | P1 第一�?+ #15 完整 + #16a 启动             | In Progress | ADR-016、ADR-017          |

### 📜 已废�?被替�?

| ADR                  | 取代�?               | 原因                          |
| -------------------- | -------------------- | ----------------------------- |
| 005 DDD 模块边界     | 017 infra 按子域拆�? | 设计演进                      |
| 006 SSH 命令安全过滤 | 023 SSH 命令注入修复 | �?middleware/commandFilter.ts |

---

## 快速决策树（新�?· 2026-07-21�?

当你接到开发任务，先问自己 3 个问题：

### Q1: 这是新功能还�?Bug 修复�?

- **新功�?*：从 [§4 步骤模式](AGENTS.md#4) �?AGENTS.md
- **Bug 修复**：看 [§铁律 1-3](AGENTS.md#2)

### Q2: 涉及哪个模块�?

- 24 后端模块 + 23 前端模块清单�?[`.trae/rules/architecture.md` §1.2](../rules/architecture.md)
- 不确定？搜索 `[module name]` 关键�?

### Q3: 改动是否触及"分层"边界�?

- �?普通业务逻辑 �?�?ADR-016、ADR-017
- ⚠️ AI/Agent/MCP �?�?ADR-013、ADR-020、ADR-021
- ⚠️ 安全相关（命令注入、认证、SSRF）→ �?ADR-006（已 Deprecated）、ADR-023（修复）
- ⚠️ 数据�?schema �?�?ADR-002、ADR-004
- ⚠️ 跨模块依赖方�?�?�?ADR-016、ADR-017、ADR-021

---

**最后更�?_�?026-07-22 �?�?ADR-034 �?+ 数据架构层分�?
**维护�?_：项目作�?+ AI 协作（Trae�?
