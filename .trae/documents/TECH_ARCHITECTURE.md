# IT 运维多 Agent 自动化平台 - 技术架构文档（精简版）

>
> **本文档定位**：架构设计意图 + 决策背景（为什么这样做）。
> **编码约束与具体规则**：.trae/rules/architecture.md（必须遵守）。

---

## 1. 架构决策概要

| 决策 | 选择 | 理由 | ADR |
|------|------|------|-----|
| 后端框架 | Express 4.18 + TypeScript 5.3 | 简单稳定，生态丰富 | ADR-001 |
| 数据库 | SQLite + better-sqlite3 (WAL) | 零运维，单文件备份 | ADR-002 |
| DI 容器 | 自研 serviceContainer.ts | 拓扑排序初始化，container.replace() 支持测试 mock | ADR-003 |
| 数据访问 | Repository 模式 + 子仓储聚合 | 业务代码不碰 SQL，便于测试 | ADR-004 |
| 模块边界 | 24 个 DDD 限界上下文 | 模块间通过 services 通信，禁止 routes 互调 | ADR-005 |
| 状态管理 | React Context（前端） | Auth/Theme/Toast 三个轻量级 context | ADR-009 |
| LLM Provider | 函数式适配器（doubao/openai/localai） | 函数式实现，无类依赖 | ADR-013 |
| routes→service | P1-5 强制抽象（CI 拦截） | routes 严禁直访 repository | ADR-016 |
| Infra 子域拆分 | 优雅重启 + 关闭钩子独立 | 避免大文件 | ADR-017 |
| 增强节点执行器拆分 | 5 文件 4 文件拆 | 单文件 >500 行必须拆 | ADR-018 |
| ADR git 跟踪 | .trae/adr/ 入库 | 决策共享 | ADR-019 |
| Agent 工具风险审计 | riskLevel + auditEnabled | 高危操作强制审计 | ADR-020 |
| 双工具系统 | agentToolRegistry + mcp/toolRegistry | 私有执行 vs 对外协议 | ADR-021 |
| Node 20 dep pin | depcruise 锁 Node 20 | 保证 CI 一致性 | ADR-022 |
| SSH 命令注入修复 | 全局正则过滤 | 阻断注入 | ADR-023 |
| 大文件拆分方法论 | 12 模式 + 15 错误案例 | 探索期沉淀 | ADR-031 |
| v001 migration 拆分 | 5 chunk + 2 sqlBuilder | 类型声明集中文件 | ADR-034 |

**完整决策背景**：见 [.trae/adr/README.md](README.md)

---

## 2. 数据流（端到端示例）

### 2.1 告警触发自动修复（跨 4 模块）

```
外部告警 Webhook
  ↓
modules/alerts/routes/webhookRoutes.ts                (Zod 校验 + webhookIpFilter)
  ↓
modules/alerts/services/webhookService.ts             (5 标准源 + verifySignature + processNormalizedAlert)
  ↓
modules/alerts/services/alertService.ts               (业务编排：过滤/关联/通知) → AlertProcessor
  ↓
modules/alerts/services/alertAutoResponse/alertAutoResponseService.ts (AARS 自适应自动化)
  ↓
modules/auto/services/remediationService/             (跨模块调用：policyCrud + executionOrchestration + verificationRollback)
  ↓
modules/servers/services/sshService.ts                (远程执行)
  ↓
modules/audit/services/auditService.ts                (审计日志记录)
```

### 2.2 AI Agent 调用工具（双工具系统）

```
LLM Agent (modules/ai/services/agents/)
  ├── 内部执行（SSH/Docker/K8s 运维）→ agentToolRegistry (24 个工具，riskLevel + auditEnabled)
  └── MCP 协议调用（跨模块查询）   → mcp/toolRegistry (13+ 平台 + 外部，6 层 securityGate + approvalFlow)
                                   ↓
                                  反向桥接：mcp → Agent（agentMcpAdapter.ts）
```

详见 [ADR-021 双工具系统](021-dual-tool-system-design.md)

---

## 3. 模块全景（24 后端 + 23 前端）

完整模块表见 [.trae/rules/architecture.md §1.2](../rules/architecture.md)。

**后端 24 模块**：ai / alerts / audit / auth / auto / backup / change-management / config-management / containers / database / dc / import-export / infra / kubernetes / linkage / mcp / monitor / network / notification / scripts / servers / settings / tool-links / workflow

**前端 23 模块**：少 linkage（前端待补建）

**模块标准结构**：

```
modules/<module>/
├── routes.ts              # 模块路由聚合入口
├── routes/                # 子路由文件
├── services/              # 业务逻辑（含 .test.ts）
├── [前端] pages/, components/, api.ts
└── README.md              # 必填
```

**实际模块注册情况**（2026-07-22 实测 `_registry.ts`）：

- 22 个模块挂载到 `/api/v1/*`（含 mcp）
- 1 个挂载到 `/api/v1/users`（userRouter）
- 3 个特殊命名 export：`alertAutoRouter`、`alertCorrelationRouter`、`networkDiscoveryRouter`（也挂到 `/api/v1`）
- 2 个公开路由：`/api/v1/auth`（authOnlyRouter）、`/api/v1/webhooks`（webhookRouter）

---

## 4. 数据库设计原则

| 原则 | 实现 | 详见 |
|------|------|------|
| **永不修改已有 migration** | 新功能新建 v0XX_*.ts（最新 v060） | [ADR-019](019-trae-adr-git-tracking.md) |
| **业务代码不碰 SQL** | 全部经 repository | [architecture.md §1.3](../rules/architecture.md) |
| **Repository 纯数据访问** | 禁止业务判断 | [architecture.md §1.3](../rules/architecture.md) |
| **WAL 模式** | better-sqlite3 自动启用 | [architecture.md §1.3](../rules/architecture.md) |
| **每日 4:00 wal_checkpoint** | `maintenance.ts` | [AGENTS.md §10.3](../../AGENTS.md) |
| **v001 schema 拆分** | 5 chunk + 2 sqlBuilder + index + preflight | [ADR-034](034-v001-migration-splitting.md) |

---

## 5. 安全架构（六层防御）

```
Layer 1: HTTPS + Helmet
Layer 2: CORS 白名单（app.ts L20-30：FRONTEND_URL env + localhost:3000/5173）
Layer 3: Rate Limiter + Webhook IP 过滤（rateLimiter 中间件 + webhookIpFilter）
Layer 4: JWT 认证 + 角色鉴权（viewer/operator/admin，middleware/auth.ts）
Layer 5: MCP Security Gate（6 层 securityGate/layer1ReadOnly...layer6Audit + orchestrator）
Layer 6: 审计日志（所有操作留痕，modules/audit/services/auditLogCrudService.ts）
```

> 历史 Layer "SSH 命令过滤" 已于 2026-07-06 删除（详见 [ADR-006 Deprecated](006-command-filter.md)），SSH 安全由服务器端账号权限控制（参考 [architecture.md §六](../rules/architecture.md)）。

---

## 6. 部署架构（2026-07-22 全面阅读实测）

### 6.1 三种开发模式（[top-rules.md §4](../rules/top-rules.md)）

| 模式 | 命令 | 端口 | 适用场景 |
|------|------|------|---------|
| 宿主机直接运行 | `cd backend; npm run dev` + `cd frontend; npm run dev` | 3001 + 3000 | 日常编码调试（最快） |
| local-dev Docker | `cd local-dev; docker compose up -d` | 5173 + 3001 + 9229 | 调试/演示（环境与生产一致） |
| 生产镜像 | `docker build -f docker/Dockerfile.backend` | — | 仅验证部署（严禁日常开发） |

### 6.2 健康检查端点

| 路径 | 用途 | 实现 |
|------|------|------|
| `/health` | 综合健康检查（healthy/degraded/unhealthy） | `monitor/services/healthService.ts` |
| `/health/live` | 存活探针 | app.ts L142（直接 200） |
| `/health/ready` | 就绪探针 | app.ts L146（healthy/degraded 才 200） |

### 6.3 后端启动序列

详见 [architecture.md §1.5](../rules/architecture.md#15-应用启动序列实测)。

```
initApp() in app.ts:
  1. initializeDatabase()                              // models/database（同步迁移）
  2. http.createServer(app) + new SocketIOServer(...)
  3. setIOInstance(io) + setupWebSocket(io) + vncProxyService.initialize(io)
  4. container.register('io', ...)
  5. initAllServices()                                  // 拓扑排序所有 services（serviceRegistry.ts）
  6. registerAllModules(app)                           // 22 个模块路由挂载（_registry.ts）
  7. setupSwagger(app)                                 // API 文档（/api-docs）
  8. httpServer.listen(PORT=3001)
```

### 6.4 服务注册清单（serviceRegistry.ts 实测 46 项）

| 类别 | 服务数 | 列表 |
|------|--------|------|
| 平台基础 | 4 | encryptionMigration / credentialService / tokenBlacklist / providers |
| Repository（DI 注册） | 18 | alertRepository / agentExecutionRepository / dcRepository / settingsRepository / serverRepository / agentRepository / networkDeviceRepository / workflowRepository / knowledgeRepository / userRepository / remediationPolicyRepository / remediationAuditRepository / virtualMachineRepository / dbConnectionRepository / infraRepository / analyticsRepository / snmpRepository / networkSubnetRepository |
| 核心业务 | 9 | alertService / reportService / copilotService / rootCauseAnalysisService / multiAgentSystem / schedulerService / notificationService / remediationService / backupService |
| 异步任务 | 2 | queueService / selfMonitorService |
| 监控与轮询 | 7 | snmpPollingService / snmpTrapService / alertAutoAnalyzer / alertCorrelationService / alertAutoResponseService / alertProcessor / knowledgeEngine |
| 容器与虚拟化 | 3 | dockerService / configTemplateService / containerVMRuntime（含 k8s + autoScale + vm + vmSnapshotScheduler + multiHostDocker） |
| 基础设施 | 3 | terminalService / circuitBreaker / dcStatusPush（含 dcStatus + dcEnvironment + dcPduSnmp + agentExecutionArchive） |

---

## 7. 文档体系索引

| 文档 | 位置 | 说明 |
|------|------|------|
| 架构规则（编码约束） | [.trae/rules/architecture.md](../rules/architecture.md) | 4A+DDD 编码约束（AI 必须遵守） |
| 顶层规则（开发方式） | [.trae/rules/top-rules.md](../rules/top-rules.md) | 强制报告 + 代码位置 + 开发方式 |
| 测试规范 | [.trae/rules/testing.md](../rules/testing.md) | 后端 + 前端测试编写规范 |
| PowerShell 安全 | [.trae/rules/powershell.md](../rules/powershell.md) | 文件操作编码安全 |
| 前端规范 | [.trae/rules/frontend.md](../rules/frontend.md) | 23 模块前端编码规范 |
| 错误复盘流程 | [.trae/rules/lessons-learned.md](../rules/lessons-learned.md) | L1/L2/L3 分级处理 |
| ADR 决策记录 | [.trae/adr/](README.md) | 26 份架构决策（001-024、025 In Progress、026、031、034） |
| 项目全面分析 | `docs/项目全面分析报告_v8.md`（如本地存在，已被 .gitignore 排除） | 全模块深度分析（2026-07-22 v8） |
| PRD 产品需求 | [.trae/documents/PRD.md](PRD.md) | 产品需求 |
| 大文件拆分方法论 | [.trae/adr/031-v2-large-file-splitting-methodology.md](../adr/031-v2-large-file-splitting-methodology.md) | ADR-031 方法论 + ADR-034 v001 拆分 |

---

## 8. 全面阅读发现的代码 ↔ 文档不一致（2026-07-22）

| # | 模块 | 不一致点 | 严重度 | 文档位置 |
|---|---|---|---|---|
| 1 | backend monitor | `routes.ts` 只挂载 4 个子路由，但 `routes/prometheusRoutes.ts` 与 `routes/zabbixRoutes.ts` **存在但未挂载**——前端 Prometheus/Zabbix 主动查询页面调用会 404 | 🟡 **P0 待修复** | [monitor/README.md §⚠️](../../src/modules/monitor/README.md) |
| 2 | backend alerts | README 简略描述的 `alertAutoAnalyzer` 与实际 `routes.ts` 拆分结构略偏差，但不影响功能 | 🟢 已对齐 | — |
| 3 | backend mcp | README 路径前缀 `/api/mcp/*` 应更新为 `/api/v1/mcp/*`（基于 `_registry.ts`） | 🟢 已修复 | [mcp/README.md](../../src/modules/mcp/README.md) |
| 4 | backend ai | README 路径表需补充 `/mcp` 代理挂载（与 mcp 模块独立路由等价） | 🟢 已修复 | [ai/README.md](../../src/modules/ai/README.md) |
| 5 | backend auto | README 服务列表需补充 11 个文件（含 1 个测试）的精确清单 | 🟢 已修复 | [auto/README.md](../../src/modules/auto/README.md) |
| 6 | frontend auth | README 提到 `useAuth` 但未描述 refreshToken 401 自动刷新逻辑 | 🟢 已修复 | [frontend.md §九](../rules/frontend.md) |

---
