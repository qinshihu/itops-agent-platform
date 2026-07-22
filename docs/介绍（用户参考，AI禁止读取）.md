AI开发工具禁止读取使用此文件来作为开发依据，只作为介绍文档给用户参考。用户可以根据此文档，自己实现对应的 AI 工具。
AI 工具禁止直接读取此文件，必须通过用户手动输入来获取。

# ITops Agent Platform 项目全面分析

---

## 一、项目一句话

**ITOps Agent** —— 一站式智能运维平台（PagerDuty + Rundeck + Portainer + vCenter 的国产开源替代），定位"告警 → 诊断 → 修复 → 审批 → 验证"全闭环。

- 后端 24 模块 / 前端 23 模块（v8 实测：backend 735 .ts / 99,817 行；frontend 474 .tsx / 68,886 行）
- 当前版本 **v3.0.5**，许可证 **MPL-2.0**（2026-05-27 后新增/修改代码；之前 MIT）

---

## 二、技术栈

| 层           | 技术                                                                                                     |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| 后端运行时   | **Node.js 20.19.5**（`.nvmrc` 锁定）+ TypeScript 5.3 + Express 4.18 + Socket.IO 4.7                      |
| 后端存储     | **better-sqlite3 11.7** + WAL 模式 + 60 个 migration（v001~v060）                                        |
| 后端核心     | JWT（jsonwebtoken 9.0）+ bcryptjs + Zod 3.23 + swagger-jsdoc                                             |
| 后端运维集成 | ssh2 1.14 / dockerode 4.0 / net-snmp 3.26 / node-schedule 2.1 / nodemailer / pdfkit                      |
| 前端         | **React 18 + Vite 5 + TypeScript 5.3**                                                                   |
| 前端 UI      | Ant Design 5.22 + Tailwind 3.4 + lucide-react                                                            |
| 前端数据     | @tanstack/react-query 5.14 + axios（401 自动 refresh）                                                   |
| 前端可视化   | three 0.170（机房 3D） + @xyflow/react 12.0（工作流编辑器） + cytoscape 3.34（拓扑） + xterm 5.3（终端） |
| 工程化       | dependency-cruiser + ESLint max-lines `error` + Prettier + Husky + lint-staged                           |

---

## 三、4A 架构 + DDD 分层（核心设计）

按 [architecture.md](file:///c:/Users/123/Desktop/daima/AIops/.trae/rules/architecture.md) 定义的四层架构（依赖方向单向）：

```
┌─────────────────────────────────────────────────────────┐
│ 1️⃣ 业务架构层（Business）                                │
│    工作流状态机 / 告警处理 / 审批权限（业务宪法）         │
├─────────────────────────────────────────────────────────┤
│ 2️⃣ 应用架构层（Application）                             │
│    24 个 DDD 模块（routes → services → repositories）    │
│    Composition Root: serviceRegistry.ts（473 行）       │
├─────────────────────────────────────────────────────────┤
│ 3️⃣ 数据架构层（Data）                                    │
│    31 顶层 repo + 90 子目录 + migrations v001~v060       │
├─────────────────────────────────────────────────────────┤
│ 4️⃣ 技术架构层（Technology）                              │
│    core/serviceContainer.ts DI 容器 + middleware +      │
│    shared/schemas (Zod) + websocket + utils/logger      │
└─────────────────────────────────────────────────────────┘
```

**关键约束（CI 强校验）**：

- `core/` ❌ 反向依赖 `modules/`
- `repositories/` ❌ 反向依赖 `modules/`
- `routes/` ❌ 直接 import `repositories/`（必须经 service 层）
- 单文件 ≤ **500 行**（ESLint `max-lines: error` 真阻断 CI）
- `v001_initial_schema.ts` 是 ESLint 唯一豁免文件

---

## 四、24 个后端 DDD 模块

来自 [architecture.md §1.2](file:///c:/Users/123/Desktop/daima/AIops/.trae/rules/architecture.md)：

| 模块                        | 领域职责                                             | 聚合根                                        |
| --------------------------- | ---------------------------------------------------- | --------------------------------------------- |
| **ai/**                     | LLM 调用 / Agent 管理 / RCA / 知识库 / 多 Agent 协同 | Agent / LLM Provider / Knowledge              |
| **alerts/**                 | 告警接收→过滤→关联→降噪→通知                         | Alert / AlertRule / AlertCorrelation          |
| **audit/** _(P1-6)_         | 审计日志                                             | AuditLog                                      |
| **auth/**                   | JWT + RBAC                                           | User / Token / Role                           |
| **auto/**                   | 修复策略 + 自动伸缩（container/vm/k8s_deployment）   | RemediationPolicy / ScaleRule                 |
| **backup/**                 | 数据库自动备份 / 加密 / 手动恢复                     | Backup / BackupConfig                         |
| **change-management/**      | 变更审批流转                                         | Change / ApprovalTicket                       |
| **config-management/**      | 配置模板 + Docker Compose                            | ConfigTemplate / ComposeProject               |
| **containers/**             | Docker 多主机 + VMware/Proxmox/KVM 三适配器          | Container / VM / Image / Snapshot / Migration |
| **database/**               | 数据库连接管理                                       | DatabaseConnection                            |
| **dc/**                     | 数据中心 3D 可视化基础设施                           | Room / Rack / Device / Power                  |
| **import-export/** _(P1-6)_ | CSV/JSON 导入导出                                    | ImportExport                                  |
| **infra/**                  | 系统级（仅保留 restartService）                      | —                                             |
| **kubernetes/**             | K8s 集群管理                                         | K8sContext / Pod / Node                       |
| **linkage/** _(仅后端)_     | 联动统计 / 巡检中心                                  | InspectionCenter                              |
| **mcp/**                    | MCP 工具协议（13+ 平台 + 外部 Server）               | Tool / ExternalServer / ApprovalTicket        |
| **monitor/**                | 仪表盘 / 大屏 / 报告 / 成本                          | Dashboard / Report / CostEntry                |
| **network/**                | 17 厂商网络设备适配器                                | NetworkDevice / Topology / SNMP               |
| **notification/**           | 企业微信/飞书/钉钉/Telegram/Email/Webhook            | Notification / Channel                        |
| **scripts/** _(P1-6)_       | 脚本/终端/AI 命令                                    | Script / TerminalSession                      |
| **servers/**                | 服务器生命周期                                       | Server / SSHKey / ServerGroup                 |
| **settings/** _(P1-6)_      | 系统设置（API Key、AI 模型配置）                     | Setting / AIProviderConfig                    |
| **tool-links/** _(P1-6)_    | 工具箱 CRUD                                          | ToolLink                                      |
| **workflow/**               | 工作流编排引擎                                       | Workflow / Task / ScheduledTask               |

> **两套工具系统并存**（[ADR-021](file:///c:/Users/123/Desktop/daima/AIops/.trae/adr/021-dual-tool-system-design.md)）：
>
> - `agentToolRegistry`（24 工具，ai Agent 私有） vs `mcp/toolRegistry`（13+ 平台 + 外部，对外协议）
> - 桥接器：[agentMcpAdapter.ts](file:///c:/Users/123/Desktop/daima/AIops/backend/src/modules/ai/services/agents/agentMcpAdapter.ts)

---

## 五、前端 23 模块（v5 实测）

来源：[frontend.md §一](file:///c:/Users/123/Desktop/daima/AIops/.trae/rules/frontend.md)：

每个模块结构：`api.ts` + `routes.ts`（`React.lazy`） + `pages/<Entity>/` + `index.ts`（仅 re-export）

技术亮点：

- **App.tsx 包裹顺序**：`ErrorBoundary → ThemeProvider → ThemedConfigProvider → AuthProvider → ToastProvider → QueryClientProvider → BrowserRouter`
- **lib/api.ts**：401 自动用 refreshToken 刷新（带失败队列）
- **路由聚合**：[`frontend/src/modules/_routes.tsx`](file:///c:/Users/123/Desktop/daima/AIops/frontend/src/modules/_routes.tsx) 统一管理
- **导航分组**：10 个 `nav.*` 分组（navigation.ts）

---

## 六、应用启动序列（实测，[app.ts](file:///c:/Users/123/Desktop/daima/AIops/backend/src/app.ts)）

```
1. initializeDatabase()        # SQLite + WAL + 同步迁移
2. http.createServer + SocketIOServer
3. setIOInstance(io) + setupWebSocket(io) + vncProxyService.initialize(io)
4. container.register('io', ...)  # socket.io 注入 DI
5. initAllServices()           # serviceRegistry.ts 拓扑排序（37 个服务）
6. registerAllModules(app)     # 22 个模块路由挂载（_registry.ts）
7. setupSwagger(app)           # /api-docs
8. httpServer.listen(3001)
```

**优雅关闭**：HTTP → Socket.io → 逆序 shutdownAllServices → 退出

---

## 七、关键能力亮点

| 能力              | 实现位置                                                                                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **多 Agent 协同** | [multiAgent/](file:///c:/Users/123/Desktop/daima/AIops/backend/src/modules/ai/services/multiAgent) — Coordinator + Specialists + ProviderRegistry                   |
| **根因分析 RCA**  | [rcaJobManager.ts](file:///c:/Users/123/Desktop/daima/AIops/backend/src/modules/ai/services/rca/rcaJobManager.ts) + 知识库                                          |
| **MCP 协议**      | [mcp/services/](file:///c:/Users/123/Desktop/daima/AIops/backend/src/modules/mcp/services) — toolRegistry + gateway + 6 层 securityGate                             |
| **告警全链路**    | [AlertProcessor.ts](file:///c:/Users/123/Desktop/daima/AIops/backend/src/modules/alerts/services/AlertProcessor.ts) → 自动响应 → 多通道通知                         |
| **机房 3D**       | frontend three.js + [dcStatusService.ts](file:///c:/Users/123/Desktop/daima/AIops/backend/src/modules/dc/services/dcStatusService.ts)（5s 轮询 + 推送 `dc:status`） |
| **终端/VNC**      | xterm 5.3 + [vncProxyService.ts](file:///c:/Users/123/Desktop/daima/AIops/backend/src/modules/network/services/vncProxyService.ts)                                  |
| **自动伸缩**      | container/vm/k8s_deployment 三类目标（[ADR-015](file:///c:/Users/123/Desktop/daima/AIops/.trae/adr/015-autoscale-real-impl.md)）                                    |
| **SQLite WAL**    | 每天 4:00 自动 `wal_checkpoint(TRUNCATE)`（[maintenance.ts](file:///c:/Users/123/Desktop/daima/AIops/backend/src/models/database/maintenance.ts)）                  |

---

## 八、配置管理与部署原则（[top-rules.md](file:///c:/Users/123/Desktop/daima/AIops/.trae/rules/top-rules.md)）

> 🚫 **不依赖 `.env` 文件**！所有配置通过前端 UI 写入 DB：
>
> - API Key → `/settings` → `settings` 表
> - AI 模型 → `/ai-models` → `ai_models` 表

部署：

- **Linux/Mac**：`deploy.sh` 一键脚本
- **Windows**：`deploy.ps1` + `docker-build-push.ps1`
- **Docker**：`docker-compose.yml` + `Dockerfile.backend` + `Dockerfile.frontend`

---

## 九、文档与治理体系

| 类别                | 数量              | 位置                                                                                                                                                                          |
| ------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ADR 决策记录**    | 24 份（accepted） | [`.trae/adr/`](file:///c:/Users/123/Desktop/daima/AIops/.trae/adr/)                                                                                                           |
| **架构规则**        | 7 文件            | [`.trae/rules/`](file:///c:/Users/123/Desktop/daima/AIops/.trae/rules/)（architecture / frontend / testing / security / powershell / top-rules / lessons-learned）            |
| **多语言 README**   | 7 份              | README.md / .en / .ja / .ko / .fr / .de / .TW                                                                                                                                 |
| **AI 工具配置派生** | 6 份              | [ai-tool-configs/](file:///c:/Users/123/Desktop/daima/AIops/ai-tool-configs/)（Cursor/Copilot/Claude/Aider/Continue/Windsurf）—— ⚠️ 非源真相，源真相是 `AGENTS.md` + `.trae/` |
| **CI 工作流**       | 3 个              | [.github/workflows/](file:///c:/Users/123/Desktop/daima/AIops/.github/workflows/)（ci.yml / release.yml / mirror.yml）                                                        |
| **Dependabot**      | 3 生态            | npm / github-actions / docker                                                                                                                                                 |

---

## 十、豁免设计（有意保留，AI 不得视为风险）

来自 [AGENTS.md §8](file:///c:/Users/123/Desktop/daima/AIops/AGENTS.md)：

| 豁免项                                          | 判定          | 理由                                             |
| ----------------------------------------------- | ------------- | ------------------------------------------------ |
| **CODEOWNERS 单点 owner**（24 模块全 `@tance`） | 🟢 有意保留   | 探索期 + CI 防线已足 + 单活跃贡献者              |
| **CodeQL 暂缓**                                 | 🟢 有意保留   | 探索期变动频繁，TS+ESLint+depcruise 三层防护已足 |
| **PR 模板人工 checklist**（9 项）               | 🟢 双重保险   | 核心 6 项已被 CI 强制                            |
| **测试覆盖率不达阈值**（< 80%）                 | 🟢 探索期豁免 | 写测试会因代码频繁变动失效                       |

---

## 十一、当前状态与遗留问题

来自 [项目全面分析报告 v8](file:///c:/Users/123/Desktop/daima/AIops/docs/项目全面分析报告_v8.md)（2026-07-22）：

✅ **架构合规度：🟢 优秀（持续保持）**

- 4A 分层零违规
- ADR-016 routes→service 抽象 100% 完成（16/16 业务模块）
- 模块 README 100% 完整（47/47）

✅ **v7 → v8 已修复**

- `engines.node` 收紧到 `>=20.19.5`（Y8 关闭）
- 6 个 backend 超 500 行文件全部达标（Y5 关闭）
- `v001_initial_schema.ts`（778 行）拆分为 `v001_schema/` 子目录（ADR-034 闭环）
- 新增 9 份 ADR（021~026、031、034）

⚠️ **遗留问题**

- **R1**：6 个 frontend 页面组件超 500 行（按 top-rules §四 决定暂缓）
- **类型债务恶化**：`as any` v7: 129 → 当前 140（+11，2 天）
- **serviceRegistry.ts** 从 296 → 473 行（+60%），接近 500 红线

---

## 十二、本地开发速查

```powershell
# 一键启动
npm run dev                    # 同时启动 backend + frontend

# 仅后端（默认端口 3001）
cd backend && npm run dev

# 仅前端（默认端口 5173）
cd frontend && npm run dev

# 架构校验（depcruise + max-lines）
npm run check:arch
npm run check:deps

# 单文件 ≤ 500 行真阻断
cd backend && npm run lint
cd frontend && npm run lint
```

**环境要求**：

- Node 20.19.5（fnm 管理）
- 包管理器：仅 npm（不用 pnpm）
- 数据库：`backend/data/app.db`（gitignore）
- Windows 上所有开发软件装在 `D:\kaifahahanfa\`

---

## 总结

**ITOps Agent** 是一个**架构纪律极强**的国产开源 AIOps 平台：

1. **架构层面**：4A + DDD 24/23 模块清晰分层，CI 通过 depcruise + ESLint max-lines 真阻断保证约束执行
2. **文档层面**：28 份 ADR + 7 份架构规则 + 47/47 模块 README + 7 份多语言 README，形成完整的决策追溯链
3. **演进层面**：处于 v3.0.5 渐进式重构期，CI 防线已成熟，3 项豁免为「有意保留」非缺陷
4. **差异化亮点**：两套工具系统（agent vs mcp）并存、MCP 协议支持、不依赖 .env 全 UI 配置

**一句话**：传统运维 + AI Agent 编排 + MCP 工具协议的"开箱即用 AIOps 平台"，对标 PagerDuty+Rundeck+Portainer+vCenter 一站式替代。
