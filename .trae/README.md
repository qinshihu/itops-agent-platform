# `.trae/` 目录说明

> 本目录是项目的 **AI 协作与文档治理中心**。本项目默认 AI 工具 = **Trae CN**（详见 [top-rules.md §二](./rules/top-rules.md)）。其他 AI 工具入口已统一移到根目录 [`ai-tool-configs/`](../../ai-tool-configs/)，按需手动 `cp` 使用。
>
> **维护原则**：项目代码发生变化时，必须同步更新本目录下相关文档（[top-rules.md §六 文档同步规则](./rules/top-rules.md)）。
>
---

## 一、目录结构

```
.trae/
├── README.md          ← 本文件（索引）
├── rules/             ← 必读规则（7 份）
│   ├── top-rules.md   ← 项目顶层规则
│   ├── architecture.md ← 4A+DDD 架构规则
│   ├── frontend.md    ← 前端 23 模块编码规范
│   ├── testing.md     ← 后端/前端测试规范
│   ├── security.md    ← 安全开发规范汇总（v1.0 新建，2026-07-21）
│   ├── powershell.md  ← PowerShell 文件操作编码安全规则
│   └── lessons-learned.md ← 错误复盘与规则沉淀流程（元规则）
├── adr/               ← 架构决策记录（26 份 ADR + 1 份 README = 27 份 markdown）
│   ├── README.md      ← ADR 索引
│   ├── 001-typescript-express.md ~ 019-trae-adr-git-tracking.md
│   └── 006-command-filter.md ← 反向 ADR（状态 Deprecated，代码已删除但保留历史轨迹）；026-top-rules-refactor.md ← v6.2 重构决策
└── documents/         ← 设计文档（6 份）
    ├── PRD.md                  ← 产品需求文档
    ├── TECH_ARCHITECTURE.md    ← 技术架构文档（4A+DDD 详解）
    ├── API_REFERENCE.md        ← API 接口参考
    ├── ARCHITECTURE_COMPLIANCE_GUIDE.md ← 新贡献者架构合规指南
    ├── TYPE_SYSTEM.md          ← 类型系统速查
    ├── GITHUB_SETUP.md         ← GitHub 仓库设置指南
    └── branch-protection-setup.md ← Branch Protection 配置指南（GitHub 仓库治理，P0-10）
```

**统计**：7 份规则 + 26 份 ADR + 1 份 ADR README + 7 份设计文档 = **41 份 markdown**（v6.4 实测，2026-07-21）

---

## 二、AI 工具必读顺序

> 按 [rules/top-rules.md §一 强制报告规则](./rules/top-rules.md)，所有 AI 必须按以下顺序阅读：

1. **`rules/top-rules.md`** — 项目顶层规则（最高优先级，所有 AI 第一份必读）
2. **`rules/architecture.md`** — 4A 架构 + DDD 模块边界 + 编码约束
3. **`rules/frontend.md`** — 前端编码规范（生成/修改前端代码时必读）
4. **`rules/testing.md`** — 测试规范（生成/修改测试代码时必读）
5. **`rules/security.md`** — 安全开发规范汇总（涉及 SSH / 认证 / Agent 风险 / 双工具系统安全边界时必读）
6. **`rules/powershell.md`** — PowerShell 文件操作编码安全（Windows 环境用 PowerShell 修改文件时必读）
7. **`rules/lessons-learned.md`** — 错误复盘与规则沉淀流程（发生错误或需要形成规则时必读）
8. **当前任务所属模块的 README** — `modules/<module>/README.md`（按 [architecture.md §1.2](./rules/architecture.md) 模块表定位）

### 选读（按需）

| 场景                        | 推荐阅读                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| 写新 ADR                    | [adr/README.md §按架构层分类](./adr/README.md) + 同类 ADR 模板                                          |
| 写新规则                    | [architecture.md §三 编码约束规则](./rules/architecture.md) 风格对齐                                    |
| 写新模块 README             | 同模块目录下任一现有 README（如 `auto/README.md`）作为模板                                              |
| 排查模块归属                | [architecture.md §1.2 24 模块清单](./rules/architecture.md)                                             |
| 排查安全问题 / 写安全相关代码 | [rules/security.md](./rules/security.md)（SSH / 认证 / Agent 风险 / 双工具系统边界 + 6 条铁律）        |
| 排查 API 端点               | [documents/API_REFERENCE.md](./documents/API_REFERENCE.md)                                              |
| 排查类型/表结构             | [documents/TYPE_SYSTEM.md](./documents/TYPE_SYSTEM.md)                                                  |
| CI 配置问题                 | [architecture.md §五 参考资源](./rules/architecture.md) 提到的 `.dependency-cruiser.json`               |
| 架构大方向疑问              | [documents/TECH_ARCHITECTURE.md](./documents/TECH_ARCHITECTURE.md)                                      |
| 新人入门                    | [documents/ARCHITECTURE_COMPLIANCE_GUIDE.md](./documents/ARCHITECTURE_COMPLIANCE_GUIDE.md) "5 分钟读懂" |
| 发布到 GitHub               | [documents/GITHUB_SETUP.md](./documents/GITHUB_SETUP.md)                                                |
| 配置 Branch Protection    | [documents/branch-protection-setup.md](./documents/branch-protection-setup.md) "30 分钟手动配置"（[GITHUB_SETUP §一](./documents/GITHUB_SETUP.md) 的详细操作手册） |
| Windows PowerShell 文件操作 | [rules/powershell.md](./rules/powershell.md) 编码安全规则                                               |
| 错误复盘 / 形成规则         | [rules/lessons-learned.md](./rules/lessons-learned.md) 错误沉淀流程                                     |

---

## 三、ADR 索引

按编号排序（详见 [adr/README.md](./adr/README.md)）：

| 状态         | 数量 | 说明                                                                 |
| ------------ | :--: | -------------------------------------------------------------------- |
| Accepted     |  24  | 已采纳的有效决策（001-024、026、031、034）                           |
| In Progress  |  1   | ADR-025（P1 批量修复，持续进行中）                                  |
| Superseded   |  1   | ADR-005（被 ADR-017 取代）                                          |
| Deprecated   |  1   | ADR-006（命令过滤，代码已删除但保留历史轨迹）                       |

### 关键决策速查

| 决策                      | ADR                                                                                               | 适用场景           |
| ------------------------- | ------------------------------------------------------------------------------------------------- | ------------------ |
| TypeScript + Express      | [001](./adr/001-typescript-express.md)                                                            | 后端技术栈         |
| SQLite + better-sqlite3   | [002](./adr/002-sqlite-database.md)                                                               | 数据库             |
| ServiceContainer DI       | [003](./adr/003-servicecontainer-di.md)                                                           | 服务生命周期       |
| Repository 模式           | [004](./adr/004-repository-pattern.md)                                                            | 数据访问           |
| DDD 模块边界              | [005](./adr/005-module-boundaries.md) Superseded by [017](./adr/017-infra-subdomain-splitting.md) | 模块划分           |
| 前后端 1:1 映射           | [007](./adr/007-frontend-backend-mapping.md)                                                      | 前后端协作         |
| MCP Agent 通信            | [008](./adr/008-mcp-agent-communication.md)                                                       | Agent 工具协议     |
| React Query + Context     | [009](./adr/009-frontend-state-management.md)                                                     | 前端状态           |
| JWT + 3 级 RBAC           | [010](./adr/010-authentication-authorization.md)                                                  | 认证授权           |
| Socket.io 房间模式        | [011](./adr/011-websocket-event-protocol.md)                                                      | WebSocket          |
| VM 平台适配器             | [012](./adr/012-vm-platform-adapter-strategy.md)                                                  | KVM/Proxmox/VMware |
| Provider + 熔断           | [013](./adr/013-ai-model-provider-abstraction.md)                                                 | AI 抽象层          |
| mcp routes.tsx 例外       | [014](./adr/014-mcp-routes-tsx-exception.md)                                                      | 前端约定           |
| AutoScale 真实化          | [015](./adr/015-autoscale-real-impl.md)                                                           | 自动化运维         |
| routes→service 抽象       | [016](./adr/016-routes-service-abstraction.md)                                                    | 路由层规则         |
| infra 子域拆分            | [017](./adr/017-infra-subdomain-splitting.md)                                                     | 模块拆分           |
| enhancedNodeExecutor 拆分 | [018](./adr/018-enhanced-node-executor-splitting.md)                                              | 工作流拆分         |
| .trae/ 入库               | [019](./adr/019-trae-adr-git-tracking.md)                                                         | 文档治理           |
| Agent 工具风险审计        | [020](./adr/020-agent-tool-risk-audit.md)                                                         | Agent 安全         |
| 双工具系统设计            | [021](./adr/021-dual-tool-system-design.md)                                                       | Agent 工具/MCP     |
| Node 20 dep pin           | [022](./adr/022-node20-dep-pin.md)                                                                | 依赖版本           |
| SSH 命令注入修复          | [023](./adr/023-ssh-command-injection-fix.md)                                                     | 安全               |
| P0 批量修复               | [024](./adr/024-p0-batch-fixes.md)                                                                | 代码质量（批量修复类） |
| P1 批量修复               | [025](./adr/025-p1-batch-fixes.md)                                                                | 代码质量（批量修复类） |
| 顶层规则重构决策          | [026](./adr/026-top-rules-refactor.md)                                                            | 顶层规则重构       |
| 大文件拆分方法论          | [031](./adr/031-v2-large-file-splitting-methodology.md)                                           | 拆分方法论         |
| v001 migration 拆分       | [034](./adr/034-v001-migration-splitting.md)                                                     | migration 拆分     |

> 已废弃决策：ADR-006（SSH 命令过滤）保留历史轨迹，详见 [adr/README.md §已废弃的 ADR](./adr/README.md)。
> 进行中决策：ADR-025（P1 批量修复），详见 [adr/README.md §按架构层分类](./adr/README.md)。

---

## 四、与代码位置对应

```
.trae/ 文档                           →   代码位置
─────────────────────────────────────────────────────────
rules/architecture.md §1.2 模块表    →   backend/src/modules/<24 modules>
rules/frontend.md §0 23 模块清单    →   frontend/src/modules/<23 modules>
rules/architecture.md §2.2 聚合根    →   backend/src/modules/*/services/<Aggregate>
rules/architecture.md §1.3 仓储     →   backend/src/repositories/
rules/architecture.md §3.2 路由     →   backend/src/modules/*/routes/
rules/architecture.md §3.3 服务     →   backend/src/modules/*/services/
documents/API_REFERENCE.md          →   backend/src/modules/_registry.ts
documents/TECH_ARCHITECTURE.md §2.4 →   backend/src/core/, backend/src/middleware/
documents/TYPE_SYSTEM.md            →   backend/src/repositories/types/
```

---

## 五、变更同步规则

按 [rules/top-rules.md §五 文档同步规则](./rules/top-rules.md)：

1. **新增项目代码后，必须同步更新本目录下相关文件**（规则、ADR、模块 README）
2. **新增 ADR 时**：在 `adr/` 创建 `020-xxx.md` 或更大编号，同步更新 `adr/README.md` 索引与本 README §三
3. **新增规则文件时**：在 `rules/` 创建，同步更新本 README §一目录结构与 §二必读顺序
4. **新增设计文档时**：在 `documents/` 创建，同步更新本 README §一目录结构与 `TECH_ARCHITECTURE.md` §9 文档体系
5. **本目录已通过 [ADR-019](./adr/019-trae-adr-git-tracking.md) 入 git 跟踪**，所有变更应可追溯

---

## 六、版本说明

本目录是 .trae/ 的入口索引。新建或调整规则时同步更新 §一/§二/§六。


---
