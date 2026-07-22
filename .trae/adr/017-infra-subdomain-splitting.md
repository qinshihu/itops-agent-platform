# ADR-017: infra 模块按业务子域拆分（Infra Subdomain Splitting）

**状态**: Accepted | **日期**: 2026-07-07 | **决策者**: 项目作者 + AI 协作（Trae）

> **背景**：本 ADR 记录 ITops Agent 平台 `infra/` 模块历史上因"技术归属"聚拢了 6 路由+12 服务，最终按"业务归属"重新拆分到 6 个独立子域的决策与实施过程。
>
> **关联**：[rules/architecture.md §1.2 24 个业务模块](../rules/architecture.md) · [docs/项目全面分析报告\_v4 §6.2](../../docs/项目全面分析报告_v4.md) · ADR-016（routes→service 抽象）

---

## 一、问题与背景

### 1.1 历史现状

`infra/` 模块从 v2/v3 早期承担"系统基础设施"的统称，逐渐聚拢了 6 路由 + 12 服务：

```
infra/
├── routes/             # 6 路由文件
│   ├── auditRoutes.ts        # audit/
│   ├── importExportRoutes.ts # import-export/
│   ├── linkageRoutes.ts      # linkage/
│   ├── settingsRoutes.ts     # settings/
│   ├── toolLinkRoutes.ts     # tool-links/
│   └── ...                   # scripts/ 路由也在 infra/
└── services/           # 12 业务服务
    ├── auditService.ts + auditLogCrudService.ts  # audit/
    ├── scriptCrudService.ts + terminalService.ts + terminalAiService.ts + commandDispatcher.ts  # scripts/
    ├── settingsCrudService.ts                    # settings/
    ├── importExportService.ts + test             # import-export/
    ├── linkageService.ts                         # linkage/
    ├── toolLinkCrudService.ts                    # tool-links/
    ├── notificationChannels.test.ts              # ⚠️ 孤儿测试
    ├── reportService.ts                          # → monitor/
    └── restartService.ts                         # 留在 infra/
```

### 1.2 暴露的问题

- **业务边界模糊**：`notificationChannels.test.ts`（应属 notification 模块）误放进了 infra；`reportService`（应属 monitor）也误放进了 infra。
- **路由与服务数量过大**：infra 模块一度是项目里 routes 文件数最多的模块（6 个路由文件 + 12 个业务服务），违反"模块按限界上下文切分"的 DDD 原则。
- **新功能找不到归属**：新业务子域（监控报表、工具箱、联动统计）找不到合适模块时，容易"塞回 infra"，导致 infra 越来越臃肿。
- **导航与文档不直观**：从 routes.ts 看 infra 模块有 6 路由+12 服务，业务复杂度与技术复杂度不一致，README 已自我标注"考虑拆分子域"。

### 1.3 决策触发点

2026-07-07 v3 报告 P1-5 完成后，作者明确要求"`infra/` 模块按子域拆分"，并已在 v4 报告 README 里自我标记该建议。

---

## 二、决策

### 2.1 核心原则：按业务归属拆分，而非按技术归属

infra 历史上聚拢是**技术归属**（"系统级基础设施"），导致边界模糊。**新拆分规则按业务归属**：

- **业务子域**（有自己的数据库表、有自己的路由前缀、有自己的前端页面）→ 独立模块
- **跨业务系统服务**（如优雅重启、关闭钩子注册）→ 留在 infra 作为"系统级基础设施服务"

### 2.2 拆分矩阵

| 原 infra 文件                                                                            | 拆分后归属                      | 业务归属理由                                               |
| ---------------------------------------------------------------------------------------- | ------------------------------- | ---------------------------------------------------------- |
| `routes/auditRoutes.ts` + `services/auditService.ts` + `services/auditLogCrudService.ts` | **`modules/audit/`**            | 审计日志是独立业务域，有 `audit_logs` 表                   |
| `routes/settingsRoutes.ts` + `services/settingsCrudService.ts`                           | **`modules/settings/`**         | 系统设置是独立业务域，有 `settings` 表                     |
| `routes/scriptRoutes.ts` + 4 个 services                                                 | **`modules/scripts/`**          | 脚本/终端是独立业务域                                      |
| `routes/toolLinkRoutes.ts` + `services/toolLinkCrudService.ts`                           | **`modules/tool-links/`**       | 工具箱是独立业务域，有 `tool_links` 表                     |
| `routes/linkageRoutes.ts` + `services/linkageService.ts`                                 | **`modules/linkage/`**          | 联动统计是独立"读模式"聚合服务                             |
| `routes/importExportRoutes.ts` + `services/importExportService.ts`                       | **`modules/import-export/`**    | 导入导出是独立业务域                                       |
| `services/reportService.ts`                                                              | **`modules/monitor/services/`** | 报告生成属于监控/报表业务（业务归属比技术归属更准确）      |
| `services/restartService.ts`                                                             | **留在 `infra/`**               | 跨模块系统级基础设施（被 backup 模块使用）                 |
| `services/notificationChannels.test.ts`                                                  | **删除**                        | 孤儿测试（实际是 notification 模块的测试，前期误入 infra） |

### 2.3 拆分后 infra 模块定位

infra 拆分后从"业务混杂的 6 路由+12 服务"压缩为"系统级服务容器"：

- **0 个 HTTP 路由**
- **1 个业务服务**：`restartService.ts`（优雅重启 + 关闭钩子注册）
- **依赖方向**：被 `backup/`、`workflow/` 模块使用（通过 `gracefulRestart()` / `registerShutdownHook()`）
- **未来演进**：若新增"跨模块基础设施服务"（系统时钟同步、配置中心等），可继续放在此模块；若有路由的业务子域，应单独建模块

### 2.4 模块数量变化

| 阶段                                                                                | modules 数量 | infra 路由/服务 | 备注                 |
| ----------------------------------------------------------------------------------- | ------------ | --------------- | -------------------- |
| v3（拆分前）                                                                        | 18           | 6 路由+12 服务  | infra 过载           |
| v4 增量-3（settings 抽离）                                                          | 19           | 5 路由+11 服务  | settings → settings/ |
| v4 增量-4（scripts 抽离）                                                           | 20           | 4 路由+7 服务   | scripts → scripts/   |
| v4 增量-5（audit/tool-links/linkage/import-export 抽离 + reportService 业务重归属） | 21           | 0 路由+1 服务   | 本次 ADR 范围        |

---

## 三、拆分过程（2026-07-07 完成）

### 3.1 实施步骤（增量-5 范围）

| 阶段 | 操作                                                    | 涉及文件                                             | 验证                        |
| ---- | ------------------------------------------------------- | ---------------------------------------------------- | --------------------------- |
| 5    | 清理孤儿 `notificationChannels.test.ts`                 | -1 文件                                              | 已有 `notification/` 内测试 |
| 6    | 抽离 tool-links                                         | +5 文件 (routes/routes/services/index/README)        | tsc/depcruise/vitest        |
| 7    | 抽离 linkage                                            | +5 文件                                              | 同上                        |
| 8    | 抽离 import-export                                      | +5 文件 (含 test)                                    | 同上                        |
| 9    | reportService 业务重归属（infra → monitor）             | +1 文件、-1 文件、3 文件改 import                    | 同上                        |
| 10   | 清理 infra + 更新 `_registry.ts` + `serviceRegistry.ts` | infra 路由/服务文件删除 + \_registry 注册 18→21 模块 | 同上                        |

### 3.2 关键设计决策

#### 3.2.1 route 路径不变

为保证**前端零改动**，拆分前后 HTTP 路由前缀保持完全一致：

- `POST /api/v1/import-export/servers/import` 保持
- `GET  /api/v1/tool-links/` 保持
- `GET  /api/v1/inspection-center` 保持

子域 `routes.ts` 通过 `router.use('/xxx', ...)` 复用原路径前缀，**前端无需任何改动**。

#### 3.2.2 service 导出方式

每个新子域 `index.ts` 集中导出 `routes` + `service`，便于 `_registry.ts` 一行导入：

```typescript
// modules/tool-links/index.ts
export { default as routes } from "./routes";
export { toolLinkCrudService } from "./services/toolLinkCrudService";
```

#### 3.2.3 restartService 留在 infra

`restartService` 被 `backup/` 模块（恢复后重启）+ `schedulerService`（优雅关闭）共同使用，是**跨模块系统级基础设施**，归类到 infra 仍合理。未来若拆分更彻底，可考虑把 restartService 放到 `core/` 或独立 `system/` 模块，但当前属于"够用就好"的状态。

#### 3.2.4 reportService 业务重归属（而非技术归属）

`reportService` 历史上归 infra 是因为"报告是系统级基础设施"，但实际上：

- `monitor/routes/reportRoutes.ts` 已经在调用 `reportService`（业务归属已是 monitor）
- `workflow/services/workflowExecutor/finalizeWorkflow.ts` 调用 `reportService` 生成工作流执行报告（业务归属是 workflow+monitor 联动）
- 数据库表 `reports` / `report_schedules` 属 monitor 业务域

按**业务归属**拆分，`reportService` 迁到 `monitor/services/` 更准确。这是个反向调整：从 infra 抽回业务模块。

### 3.3 验证清单

- ✅ tsc 无新增错误（剩余 3 个错误为本次拆分前已存在：`workflowCrudService.ts`、`analyticsRepository/operationalAnalytics.ts`、`sensitiveMask.ts`，与本次重构无关）
- ✅ depcruise 通过（7 条强制规则全部满足）
- ✅ vitest：`modules/import-export/` 1 个测试通过；`tool-links/`、`linkage/` 暂无测试（迁移前也没有）；3 个失败测试文件（registryService / vmMigrationService / dcRepository）为本次拆分前已存在的 flaky tests
- ✅ 前端零改动（HTTP 路径完全保持）
- ✅ `_registry.ts` 注册模块数 18 → 21

---

## 四、影响与收益

### 4.1 直接收益

- **模块边界清晰**：21 个模块各自有清晰的业务职责
- **infra 模块瘦身**：6 路由+12 服务 → 0 路由+1 服务，从"包罗万象"变成"系统级服务容器"
- **业务归属准确**：`reportService` 正确归属 monitor；`notificationChannels.test.ts` 孤儿清理
- **导航直观**：从模块 README 一眼看清每个模块负责什么

### 4.2 间接收益

- **新功能归属明确**：开发者不再纠结"这个功能放哪个模块"——按业务归属判断即可
- **依赖方向更清晰**：模块间通过 service 通信，链路明确（如 backup → infra/restart → workflow/scheduler）
- **ADR 体系完整**：从 ADR-001（技术栈）→ ADR-016（routes→service）→ ADR-017（业务归属拆分），架构演进有完整记录

### 4.3 风险与缓解

| 风险                     | 缓解措施                                                                  |
| ------------------------ | ------------------------------------------------------------------------- |
| 拆分遗漏导致部分功能失效 | tsc + vitest + depcruise 三层校验；HTTP 路径完全保持                      |
| 模块数量增多导致心智负担 | 每个新模块有完整 README + index.ts + routes.ts 三件套                     |
| 跨模块 import 复杂度增加 | 仍遵守 ADR-016：routes → service → repository，不允许 routes → repository |

---

## 五、未来演进

### 5.1 仍可继续优化（增量-6+）

- **`monitor/` 模块 1458 行大页面**：按子域拆分（仪表盘/报表/成本分析/Prometheus/Zabbix）
- **`auto/remediationService.ts`**：1426 行，按 executionTracker / policyEngine / remediationActions 拆分
- **`network/vendorAdapter/`**：已分散到 17 个文件，可考虑进一步按协议层（SNMP/CLI/REST）聚合

### 5.2 infra 模块的最终归宿

infra 现在只剩 1 个服务，未来两个方向：

- **方向 A：保持现状**（推荐）：infra 作为"系统级服务容器"，未来若新增 cross-cutting 基础设施服务（如 configSyncService、metricsAggregator）继续放在这里
- **方向 B：彻底清理**：把 `restartService` 移到 `core/` 或 `system/`，infra 整个模块删除

当前规模下方向 A 更稳妥；方向 B 等到 infra 再次"过载"时再考虑。

---

## 六、参考资源

- **架构规则**：[rules/architecture.md](../rules/architecture.md) §1.2 24 个业务模块
- **历史报告**：[docs/项目全面分析报告\_v4.md §6.2 + §8.1](../../docs/项目全面分析报告_v4.md)
- **关联 ADR**：ADR-016（routes→service 抽象，强制依赖规则 `routes-禁止直访-Repository`）
- **dependency-cruiser**：7 条强制规则（`core-禁止依赖-modules`、`repositories-禁止依赖-modules`、`routes-禁止直访-Repository` 等）
