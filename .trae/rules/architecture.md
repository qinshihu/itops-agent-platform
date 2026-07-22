# ITops Agent 架构规则

> 本文档定义项目的 4A 分层架构 + DDD 领域边界 + 编码约束规则。
> 所有 AI 辅助开发工具（Cursor、Copilot、Claude Code）在生成/修改代码时必须遵守本规则。
> 这些规则也在 CI 中通过 dependency-cruiser 自动校验。

---

## 一、4A 架构分层

系统按 4A 模型自上而下分为四层，每层职责明确、依赖方向单向（上层依赖下层，下层绝不依赖上层）。

### 1.1 业务架构层（Business Architecture）— 领域规则与流程

**职责**：定义业务规则、流程约束、状态机、权限模型。这是系统的"宪法"，所有代码必须遵守。

**在项目中的对应**：

| 概念         | 位置                                           | 说明                                                                    |
| ------------ | ---------------------------------------------- | ----------------------------------------------------------------------- |
| 工作流状态机 | `modules/workflow/services/WorkflowEngine.ts`  | 工作流状态流转规则，外部不可直接修改状态                                |
| 告警处理规则 | `modules/alerts/services/AlertProcessor.ts`    | 告警接收→过滤→通知→自动响应的全链路规则                                 |
| 审批权限规则 | `modules/change-management/services/` 审批相关 | 谁可以审批、审批超时策略（approvalService.ts / approvalCrudService.ts） |

> 注：历史 `middleware/commandFilter.ts` 已于 2026-07-06 删除（详见 [ADR-006 Deprecated](../adr/006-command-filter.md)），SSH 安全由服务器端账号权限控制。

**约束**：

- 业务规则只能存在于本层的指定文件中，**禁止**在接口层（routes）或数据层（repository）中硬编码业务逻辑
- 新增业务规则必须先在本层定义，上层才能引用
- 修改状态机必须同步更新对应的测试文件（如 `workflowExecutor.test.ts`）

### 1.2 应用架构层（Application Architecture）— 模块编排与功能实现

**职责**：模块联动、功能编排、服务组合。把业务规则串成可执行的功能链路。

**在项目中的对应**：

| 概念     | 位置                         | 说明                                               |
| -------- | ---------------------------- | -------------------------------------------------- |
| 模块入口 | `modules/<module>/routes/`   | RESTful 路由，只做参数校验+调用服务+返回结果       |
| 应用服务 | `modules/<module>/services/` | 业务流程编排，约定 routes 内不做业务逻辑           |
| 组装层   | `serviceRegistry.ts`         | Composition Root，负责初始化所有服务、管理依赖拓扑 |
| 路由注册 | `modules/_registry.ts`       | 集中管理公开路由/受保护路由/特殊路由               |

**24 个业务模块（DDD 限界上下文）**（P1-6 后从 18 扩到 24，2026-07-07）：

| 模块                 | 领域职责                                                                                  | 核心聚合根                                                |
| -------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `ai/`                | AI 能力编排：LLM 调用、Agent 管理、RCA、知识库                                            | Agent、LLM Provider、Knowledge                            |
| `alerts/`            | 告警全生命周期：接收→过滤→关联→降噪→通知                                                  | Alert、AlertRule、AlertCorrelation                        |
| `audit/`             | **审计日志**（P1-6 新增）                                                                 | AuditLog                                                  |
| `auth/`              | 认证与授权                                                                                | User、Token、Role                                         |
| `auto/`              | 自动化运维：修复策略、自动伸缩（container/vm/k8s_deployment 三类目标）                    | RemediationPolicy、ScaleRule                              |
| `backup/`            | 数据库备份与恢复：自动备份、加密备份、手动恢复                                            | Backup、BackupConfig                                      |
| `change-management/` | IT 变更管理与审批：变更记录、审批流转                                                     | Change、ApprovalTicket                                    |
| `config-management/` | 配置管理与编排：配置模板、配置修复、Docker Compose                                        | ConfigTemplate、ComposeProject                            |
| `containers/`        | 容器与虚拟机管理（Docker 多主机 + VMware/Proxmox/KVM 三适配器 + 监控/日志/迁移/快照策略） | Container、VirtualMachine、Image、VMSnapshot、VMMigration |
| `database/`          | 数据库连接管理                                                                            | DatabaseConnection                                        |
| `dc/`                | 数据中心基础设施                                                                          | Room、Rack、Device、Power                                 |
| `import-export/`     | **CSV/JSON 导入导出**（P1-6 新增）                                                        | ImportExport                                              |
| `infra/`             | 系统级基础设施（优雅重启 + 关闭钩子注册，P1-6 后仅保留 restartService）                   | -                                                         |
| `kubernetes/`        | K8s 集群管理                                                                              | K8sContext、Pod、Node                                     |
| `linkage/`           | **联动统计/巡检中心**（P1-6 新增）                                                        | InspectionCenter                                          |
| `mcp/`               | MCP 工具协议管理：工具注册、网关、安全门、外部 Server                                     | Tool、ExternalServer、ApprovalTicket                      |
| `monitor/`           | 监控仪表盘、报告、成本分析                                                                | Dashboard、Report、CostEntry                              |
| `network/`           | 网络设备管理与发现（17 厂商适配器）                                                       | NetworkDevice、Topology、SNMP                             |
| `notification/`      | 通知发送与渠道管理：企业微信/飞书/钉钉/Telegram/Email/Webhook                             | Notification、NotificationChannel                         |
| `scripts/`           | **脚本/终端/AI 命令**（P1-6 新增）                                                        | Script、TerminalSession                                   |
| `servers/`           | 服务器生命周期管理                                                                        | Server、SSHKey、ServerGroup                               |
| `settings/`          | **系统设置**（P1-6 新增）                                                                 | Setting、AIProviderConfig                                 |
| `tool-links/`        | **工具箱 CRUD**（P1-6 新增）                                                              | ToolLink                                                  |
| `workflow/`          | 工作流编排引擎                                                                            | Workflow、Task、ScheduledTask                             |

> **前后端模块差异**：后端 24 个模块中的 `linkage/`（联动统计/巡检中心）目前**仅后端实现**，前端 23 模块尚无对应模块；按 [rules/frontend.md](./frontend.md) 注释"待后续按业务需要补建"。

**约束**：

- 模块间只能通过 services/ 跨模块通信，**禁止**直接 import 对方 routes/
- 新增模块必须在 `modules/_registry.ts` 中注册路由
- 每个模块必须有 README.md 说明职责和依赖（供 AI 理解边界）

#### 1.2.1 两套工具系统的差异化定位（[ADR-021](../adr/021-dual-tool-system-design.md)）

项目里有**两套工具注册表**，它们职责正交、刻意并存：

| 工具系统 | 归属模块 | 消费者 | Schema | 风险模型 | 入口 |
|---|---|---|---|---|---|
| `agentToolRegistry`（24 工具） | `ai/` | ai Agent 内部 Node.js 代码 | JSON Schema | `riskLevel` + `auditEnabled` | `POST /agents/tools/test` |
| `mcp/toolRegistry`（13+ 平台 + 外部） | `mcp/` | LLM Agent / 外部 MCP client | Zod | 6 层 securityGate + approvalFlow | `POST /mcp/tools/call` |

**核心区别**：agent 工具是 ai Agent **私有的执行能力**；mcp 工具是**对外开放的协议能力**。

**何时合并**：参见 [ADR-021 §四](../adr/021-dual-tool-system-design.md)。**当前不满足任一触发条件**，不合并。

**新增工具判定标准**：

1. **LLM Agent 通过 MCP 调用** → 放 `mcp/toolRegistry`（典型：跨模块查询类工具）
2. **ai Agent 内部执行** → 放 `agentToolRegistry`（典型：SSH/Docker/K8s 运维场景，必须含 `riskLevel` + `auditEnabled`）
3. **只在 routes 用一次的简单函数** → 不要做成 registry

**反例**：

- ❌ SSH 命令放到 mcp/toolRegistry（SSH 是有状态长连接）
- ❌ 跨模块查询放到 agentToolRegistry（agent 是 ai 模块私有）
- ❌ 为了"统一"硬塞到一个 registry（会破坏双方安全模型）

**桥接**：`backend/src/modules/ai/services/agents/agentMcpAdapter.ts` 已存在反向桥接（mcp 工具 → Agent 视角）。**正向桥接**（agent 工具 → mcp）按需添加，触发条件见 [ADR-021 §八](../adr/021-dual-tool-system-design.md)。

### 1.3 数据架构层（Data Architecture）— 存储与持久化

**职责**：数据存储结构、迁移管理、仓储抽象。业务逻辑不直接操作 SQL。

**在项目中的对应**（2026-07-22 全面阅读核对）：

| 概念         | 位置                                                  | 说明                                                                                                                                            |
| ------------ | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 数据库入口   | `models/database/index.ts`                            | SQLite 连接管理入口（已拆分为 `core.ts` / `maintenance.ts` / `health.ts` / `defaultData.ts` 子模块）                                            |
| 迁移脚本     | `models/migrations/`                                  | 按 `v001_*` / `v002_*` ... 版本管理，**永不修改已有迁移**（最新 v060 agent_executions_archive）                                                  |
| v001 拆分    | `models/migrations/v001_schema/`                      | v2.30 拆分后由 5 个 chunk + 2 个 sqlBuilder 组成（[ADR-034](../adr/034-v001-migration-splitting.md)）                                             |
| 仓储层       | `repositories/`                                       | 28+ 个顶层 .ts + 11 个聚合子目录，统一通过 `repositories/index.ts` barrel export，业务代码只通过 repository 访问数据                              |
| 预设数据     | `models/presets/`                                     | 初始化数据种子（agents / alertMappings / configTemplates / enhancedWorkflows / reports / scheduledTasks / scripts / workflows / linkRemediation） |

**Repository 层规则**：

- 业务代码（services、routes）**禁止**直接调用 `models/database/index.ts`，必须通过 `repositories/` 访问数据
- 测试时可通过 `container.replace()` mock repository，不需要 mock SQLite
- 大型表按子仓储拆分（如 `alertRepository/` 下有 12 个子仓库 `alertRepository/aarsLogs.ts` 等），通过聚合对象导出
- Repository 纯数据访问，**禁止包含业务判断**

**约束**：

- 新增表必须先写 migration 脚本，再创建 repository
- **禁止**在 repository 中写业务判断逻辑
- 时序数据（监控指标）不能存入主业务表，使用独立的 `baseline_metrics` 表（v042 migration）
- `v001_initial_schema.ts` 是当前 backend ESLint `max-lines` 唯一豁免文件（按 ADR-013 不拆，类型声明集中文件）

### 1.4 技术架构层（Technology Architecture）— 基础设施与公共能力

**职责**：与业务无关的基础设施，所有上层模块的共同基础。

**在项目中的对应**（2026-07-22 全面阅读核对）：

| 概念                | 位置                                                  | 说明                                                                                                                              |
| ------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| DI 容器             | `core/serviceContainer.ts`                            | 统一服务生命周期管理，拓扑排序初始化（`register()` + `initAll()` + `shutdownAll()` + `replace()` 测试 mock）                          |
| 中间件              | `middleware/`                                         | `auth`（JWT + RBAC）、`errorHandler`、`rateLimiter`（含 webhookIpFilter）、`trace`、`validation`（Zod）                              |
| Zod 校验            | `shared/schemas/apiValidation.ts`                     | 集中管理 API 输入校验 schema（包含 `prometheusSchemas`、`zabbixSchemas`、`kubernetesSchemas` 等多模块 schema）                        |
| 日志                | `utils/logger.ts`                                     | 统一日志（structured logging + sensitive mask）                                                                                    |
| WebSocket           | `shared/websocket/handler.ts` + `shared/websocket/io.ts` | Socket.io 服务端 + 房间模式（[ADR-011](../adr/011-websocket-event-protocol.md)）                                                  |
| MCP 工具系统        | `modules/mcp/services/`                               | toolRegistry / gateway / securityGate（6 层架构，10 子模块）/ externalServerManager / externalClient / toolDefinitions              |
| VNC 代理            | `modules/network/services/vncProxyService.ts`         | 注册到 socket.io（app.ts L56 `vncProxyService.initialize(io)`），为远程桌面提供 WebSocket 通道                                       |
| DC 实时状态推送     | `modules/dc/services/dcStatusService.ts`              | 5s 轮询 + 推送 `dc:status` 事件到前端（依赖 socket.io 实例，serviceRegistry L439 注入）                                            |
| 优雅关闭            | `modules/infra/services/restartService.ts`            | 注册 `SIGTERM` / `SIGINT` 关闭钩子                                                                                                |
| 前端共享            | `frontend/src/shared/` / `frontend/src/components/`   | 跨模块共享组件（ErrorBoundary / ProtectedRoute / MarkdownOutput / Layout / NotFound / FrontendTests）                                 |

**约束**：

- `core/` **绝对禁止** import `modules/` 下的任何代码（CI 强制校验）
- 通用工具函数放在 `utils/` 或 `shared/`，不得放在某个业务模块内
- 中间件与业务解耦，不得包含业务特定的判断逻辑

### 1.5 应用启动序列（实测）

```
initApp() in app.ts:
  1. initializeDatabase()                              // models/database（同步迁移）
  2. http.createServer(app) + new SocketIOServer(...)
  3. setIOInstance(io) + setupWebSocket(io)
  4. vncProxyService.initialize(io)                    // 注册 VNC 代理
  5. container.register('io', ...)                     // socket.io 实例注入 DI
  6. initAllServices()                                  // 拓扑排序所有 services（serviceRegistry.ts）
  7. registerAllModules(app)                           // 22 个模块路由挂载（_registry.ts）
  8. setupSwagger(app)                                 // API 文档（/api-docs）
  9. httpServer.listen(PORT)
```

---

## 二、DDD 领域模块边界

### 2.1 限界上下文 = 模块边界

每个模块是一个独立的限界上下文（Bounded Context），有自己的领域语言和职责边界。

**领域间通信规则**：

```
允许:
  Module A/services/ → Module B/services/    (✅ 通过服务层)
  Module A/services/ → repositories/         (✅ 通过仓储层)

禁止:
  Module A/routes/ → Module B/routes/         (❌ 路由层耦合)
  Module A/services/ → Module B/routes/{sub}  (❌ 绕过服务层直接碰路由)
  repositories/ → modules/                   (❌ 仓储层反向依赖业务层)
  core/ → modules/                           (❌ 基础设施层反向依赖业务层)
```

### 2.2 聚合根保护模式

核心聚合根的状态变更必须通过聚合根内部方法，外部不可直接修改状态。

**示例 — 工作流聚合根**：

```typescript
// ✅ 正确：通过聚合根方法修改状态
workflow.transitionTo("running");

// ❌ 错误：外部直接修改状态字段
workflow.status = "running";
```

**关键聚合根及其保护**：

| 聚合根   | 保护机制                   | 不可直接修改的字段                    |
| -------- | -------------------------- | ------------------------------------- |
| Workflow | `WorkflowEngine.ts` 状态机 | status, currentNodeId, result         |
| Agent    | Agent 执行生命周期         | status, currentStep, lastError        |
| Alert    | AlertProcessor 处理流程    | status (firing→acknowledged→resolved) |

### 2.3 统一领域语言

同一业务概念在前后端、不同模块间必须使用**一致的命名**。

| 业务概念  | 统一命名     | 禁止的别名                  |
| --------- | ------------ | --------------------------- |
| 告警      | alert        | ~~alarm~~                   |
| 工单/任务 | task         | ~~job~~（job 仅限 CI 概念） |
| 工作流    | workflow     | ~~pipeline~~                |
| 通知      | notification | ~~notice~~                  |
| 审批      | approval     | ~~review~~                  |
| 修复      | remediation  | ~~fix/repair~~              |
| 代理      | agent        | ~~bot~~                     |

---

## 三、编码约束规则

### 3.1 文件组织

每个模块必须遵循统一结构：

```
modules/<module>/
├── routes.ts              # 模块路由聚合入口，export default Router
├── routes/                # 子路由文件
├── services/              # 服务实现（含 .test.ts 测试）
├── README.md              # 模块文档（必须包含：职责、内部结构、依赖关系）
└── index.ts               # 模块导出
```

### 3.2 路由层规则

- routes 只做三件事：**参数校验**（Zod）→ **调用服务** → **返回结果**
- **禁止**在 routes 中写业务逻辑、直接操作 repository、拼 SQL
- 返回格式统一：`{ success: boolean, data?: T, error?: string }`
- 权限控制使用 `requireRole()` 中间件，不在 handler 内部手动判断

**Service 抽象模式**（P1-5 迁移后强制要求，2026-07-07 全量完成）：

- routes 严禁直接 import `repositories/`（CI 规则 `routes-禁止直访-Repository` severity: error）
- 每个 routes 文件必须通过 `services/` 中的 CRUD service 访问数据
- CRUD service 文件名约定：`<entity>CrudService.ts`（如 `agentCrudService.ts`、`settingsCrudService.ts`）
- 业务编排（cross-module 调用、状态机校验、审计日志写入）集中在 service 层
- 详细决策和实施记录见 [ADR-016 routes→service 抽象决策](../adr/016-routes-service-abstraction.md)

### 3.3 服务层规则

- 每个服务文件导出函数/对象，由 `serviceRegistry.ts` 组装
- 大型服务拆分为子目录：`services/<name>/index.ts` 作为入口
- 服务必须针对接口编程，便于测试 mock
- 模块间调用: `import { xxxService } from '../../other-module/services/xxx'`

#### 3.3.1 通用拆分原则（适用于 routes→service、infra→子域、单文件→子目录等场景）

经过 [ADR-016](../adr/016-routes-service-abstraction.md)、[ADR-017](../adr/017-infra-subdomain-splitting.md)、[ADR-018](../adr/018-enhanced-node-executor-splitting.md) 三次大型拆分实践，沉淀出 4 条通用原则：

**1. 路由路径不变策略**

任何拆分（业务子域重构、单文件拆子目录、模块拆分）必须保持 HTTP 路由前缀完全一致。

- ✅ `POST /api/v1/import-export/servers/import` 保持（即使 import-export 拆为独立模块）
- ✅ `GET  /api/v1/tool-links/` 保持（即使 tool-links 拆为独立模块）
- 原因：保证前端零改动；子域 `routes.ts` 通过 `router.use('/xxx', ...)` 复用原路径前缀

**2. service 导出方式（聚合入口）**

每个新子域 `index.ts` 集中导出 `routes` + `service`，便于 `_registry.ts` 一行导入：

```typescript
// modules/tool-links/index.ts
export { default as routes } from "./routes";
export { toolLinkCrudService } from "./services/toolLinkCrudService";
```

**3. 向后兼容的 import 路径（单文件→子目录）**

从单文件拆为子目录时，保持 import 路径兼容：

```typescript
// 原引用
import { executeVerificationNode, ... } from '../enhancedNodeExecutor';
// 新引用（只改 1 行：添加 /index 后缀）
import { executeVerificationNode, ... } from '../enhancedNodeExecutor/index';
```

Node.js ESM/CommonJS 解析规则：目录导入时既可写目录名（默认 index.ts）也可写 `目录/index`。这种"先目录再 explicit index"的双重兼容写法，避免所有调用方全面修改。

**4. import 路径深度处理（拆分注意点）**

从单文件拆到子目录时，**所有 `../` 都要 +1 层**：

```typescript
// 原文件 services/enhancedNodeExecutor.ts (深度 = 3 层)
// 新文件 services/enhancedNodeExecutor/xxx.ts (深度 = 4 层)
'../../../types'         → '../../../../types'
'../../servers/...'      → '../../../servers/...'
```

经验：第一次拆分容易按习惯少 1 层；tsc 报错"Cannot find module"信息明确，按错误提示反向追踪深度即可。

### 3.4 接口契约规则

- 所有跨模块、前后端 API 的输入类型，必须用 **Zod schema** 定义
- Zod schema 集中在 `shared/schemas/apiValidation.ts` 或模块的 routes 文件中
- 前后端共享的类型定义以后端 Zod schema 为准
- MCP 工具的 inputSchema 也使用 Zod 定义

### 3.5 测试规则

- 服务层**推荐**有 `.test.ts` 文件（探索期非强制，详见 [top-rules.md §十二](./top-rules.md) 豁免规则）
- Repository 测试通过 `container.replace()` 注入 mock
- 测试覆盖率目标（**渐进式 + 探索期豁免**）：
  - **当前阶段（2026-07-05）**：服务层核心模块 ≥ 60% functions，整体 ≥ 30% lines（**阈值实际不强制**）
  - **中期目标**：服务层 ≥ 80%，核心业务逻辑 ≥ 90%
  - **长期目标**：所有模块 ≥ 80% functions
- CI 阈值（vitest.config.ts）：
  - 后端：branches 25% / functions 60% / lines 30%（**探索期豁免**，实际不阻断 CI）
  - 前端：lines 20%（**探索期豁免**）
- 测试文件命名：`<entity>CrudService.test.ts` / `<service>.test.ts`，放在 `services/` 同级或子目录
- 主要测试覆盖的模块（2026-07-22 实测）：
  - 后端：agentRepository / alertRepository / auditLogRepository / dcRepository / infraRepository / knowledgeRepository / serverRepository / settingsRepository / snmpRepository / userRepository / workflowRepository（仓储层）+ alertService / workflowEngine / core / migrations / dbHealth / maintanence / alertCorrelation / alertNotification / loginThrottler / tokenBlacklist / encryptionService / credentialService / configParser / configTemplateService / changeService / approvalService / agentToolRegistry / agentExecutor / circuitBreaker / llmService / aiModelService / ProviderRegistry / SpecialistRegistry / Coordinator / Specialists / multiAgent index / rootCauseAnalysisService / enhancedRAGService / aiRemediationService / qanythingService / alertSeverity / logger / passwordPolicy / retry / sensitiveMask / errors（服务层）
  - 后端零测试模块（2026-07-22 实测）：audit / backup / config-management（部分） / dcSlotService 部分 / dockerService / kubernetesService / mcp / monitor / network（部分） / notification / registryService / vmMigrationService / container 部分 / 等

---

## 四、AI 开发辅助规则

以下规则专门为 AI 代码助手设计，确保 AI 在你划定的边界内工作。

### 4.1 AI 在生成代码前必须理解的上下文

1. **确定需求属于哪个模块**（参考 1.2 模块表）
2. **确定需要改动的层级**（业务规则？应用服务？数据存储？技术基础设施？）
3. **只读取相关模块的代码**，不盲目读取全量代码

### 4.2 AI 禁止的操作

- **禁止**在 routes 中写业务逻辑（AI 常犯错误：为了省事直接在接口层写判断）
- **禁止**在 routes 中直接 import `repositories/`（P1-5 强制要求，必须经过 service 层）
- **禁止**在 repository 中添加业务判断
- **禁止**在 core/ 中 import modules/ 的代码
- **禁止**跨模块直接 import 对方的 routes/ 文件
- **禁止**修改已有的 migration 脚本

### 4.3 AI 推荐的工作流

1. 阅读本文件了解全局架构
2. 阅读对应模块的 README.md 了解领域边界
3. 参考同模块内已有实现作为模板
4. 新增代码访问 repository 层（非直接操作 db）
5. 遵循统一的命名规范和返回格式
6. 提交前确认没有违反本文件的约束规则

---

## 五、参考资源

- **依赖检查配置**：`.dependency-cruiser.json` — CI 自动校验模块间依赖是否合法
- **模块 README**：每个 `modules/<module>/README.md` 说明模块职责和依赖
- **架构决策记录**：`.trae/adr/` — 记录关键技术决策及其原因
- **P1-5 迁移报告**：4 篇分批记录 — [batch1](../../docs/P1-5_migration_batch1.md) / [batch2](../../docs/P1-5_migration_batch2.md) / [batch3](../../docs/P1-5_migration_batch3.md) / [batch4](../../docs/P1-5_migration_batch4.md) — 16/16 业务模块 routes→service 抽象全过程

> **模块数量变更同步规则**：模块数量变更时，必须同步更新 `.trae/rules/`、`.trae/documents/`、`.trae/adr/README.md` 三处的模块清单，不能只更新 `rules/` 目录下的文件。

---

## 六、安全设计原则

### 6.1 SSH 功能设计原则（2026-07-21 v2.1 从 architecture.md §六迁入）

SSH 执行层面**不做任何命令过滤限制**，允许用户和 AI 输入任何命令：

- 不做：命令过滤、可识别 AI 调用、强制 AI 路径不可执行系统级命令
- 不做的原因：服务器端通过账号权限控制（Linux `sudoers` / SSH `authorized_keys` `command=`）就能解决
- 原则：先保证这个功能**能用、好用、易用**，纯前端过滤属于吃力不讨好
- 历史设计 `middleware/commandFilter.ts` 已删除

---

## 七、AI / LLM 模块设计原则

### 7.1 LLM 接入与模型管理（2026-07-21 v2.1 从 architecture.md §七迁入）

- **当前阶段**：AI 模块 LLM 接入与模型管理**不需要实际支持海外大模型**，只把国内的做好即可
- **未来扩展**：必须考虑未来可能需要支持海外大模型（架构上保留 `providerAdapters` 函数式抽象层，详见 ADR-013）
- LLM Provider 适配器位于 `modules/ai/services/llm/llmService/providerAdapters.ts`（doubao/openai/localai 三个内置适配器，函数式实现）
- 业务数据 Provider（通知/监控等非 LLM）位于 `modules/ai/services/providers/`，与 LLM 调用是两套独立体系，不要混淆

---

## 八、UI / 配置管理原则

### 8.1 UI 与配置设计原则（2026-07-21 v2.1 从 architecture.md §八迁入）

- 项目功能的实现也要遵循 **好用、易用、实用、可靠、合理、便于后期维护** 的原则
- 项目**不需要 `.env` 文件**，所有配置通过前端 UI 管理：
  - **API Key**：在 `/settings` 页面配置（写入 `settings` 表）
  - **AI 模型**：在 `/ai-models` 页面管理（写入 `ai_models` 表）
- 部署时不应依赖任何环境变量文件

---


