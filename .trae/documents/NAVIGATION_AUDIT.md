# 导航菜单体检记录（NAV-AUDIT）

> 按 `frontend/src/config/navigation.ts` 顺序逐组体检的持续跟踪文档。
> 每次体检/修复后更新对应行；新增 bug 在「待修复」段登记。
>
> 最后更新：2026-07-23（v5 — 第 5 组 nav.autoExecution 深度修复完成）

## 总账

| # | 分组 | 菜单项 | 状态 | 备注 |
|---|------|--------|------|------|
| 1 | nav.home | dashboard, bigScreen | ✅ | docs 已更新；体验问题（severity 多档、表头命名）已修 |
| 2 | nav.serverMgmt | servers, networkDevices, networks, snmp, networkDiscovery, dbConnections, sshKeys, terminal, remoteDesktop | ✅ | 本轮第二组深度体检 + 修复：snmpRoutes 改统一格式 / dbConnections routes→service 抽象 / serverGroup+ManagementRoutes RBAC 漏洞 / networkSubnetRoutes catch logger / 4 处死代码删除 / RemoteDesktop Socket auth token |
| 3 | nav.containersVirtualization | containers, containerMonitor, containerLogs, images, volumes, virtualMachines, compose, snapshotPolicies, vmMigrations, imageRegistry, kubernetes, costAnalysis, autoScale | ✅ | 本轮第三组深度修复：vmManagement 全部 RBAC + containerMonitor 字段对齐 + images/snapshots snapshotPolicies total + cron 校验 + containerVMRuntime shutdown 钩子（4 运行时）+ compose validate async + K8s 读端点 RBAC + logger |
| 4 | nav.dataCenter | dcManage, dataRoom | ✅ | 本轮第四组深度修复：slots routes 业务规则下沉到 dcSlotService + 13 routes 全部加 RBAC + 13 routes catch 加 logger + dcCrudService 暴露 slotsBusiness |
| 5 | nav.autoExecution | agents, agents/tools, workflows, workflows/providers, tasks, approvals, scripts, scheduledTasks, configTemplates | ✅ | tasks/retry、scripts/execute、config-templates total 均已修复 |
| 6 | nav.alertsAI | alerts, alertMappings, alertNoise, alertCorrelation, rootCauseAnalysis, aiRootCause, topology, aiInsights, alertAutoAnalysis, inspectionCenter, alerts/providers, zabbix, prometheus | ✅ | alert-provider-configs 完整 CRUD 已补；多个解包错已修 |
| 7 | nav.mcp | mcpOverview, mcpTools, mcpExternalServers, mcpTester | ✅ | 全 4 项无 bug（仅风格建议） |
| 8 | nav.autoRemediation | remediationPolicies, remediationDashboard, remediationExecutions, remediationWorkbench, aiRemediations | ✅ | aiRemediations approve/reject 已补；workbench 子代理误判 |
| 9 | nav.knowledgeReports | knowledge, audit, notifications, reports | ✅ | audit JOIN users + notifications/retry 已修；reports type 写死为 'inspection'（体验问题待后续） |
| 10 | nav.systemUsers | users, frontendTests, toolLinks, settings | ✅ | tool-links 3 端点已补 |

## 已修复 bug 总账（c01c217 commit 范围）

### P0 后端缺失端点（5 处）
- `tool-links`: GET /categories + DELETE /:id/icon
- `alert-provider-configs`: 完整 CRUD（JSON 持久化）
- `notifications`: POST /:id/retry
- `tasks`: POST /:id/retry（创建新 task 并异步执行）
- `ai-remediations`: POST /:id/approve + /reject

### P0 后端结构（3 处）
- `audit JOIN users`: list 改 LEFT JOIN 取 username
- `configTemplates total`: 嵌入 data.items
- `dc slots/batch`: 新增聚合端点（顺序：/batch 必须在 /:rackId 之前）

### P1 前端 axios 解包统一修复（10+ 处）
批量改 `const { data } = await api.get(...)` 模式，涉及 servers/queries.ts(4)+handlers(2)、alerts/*(7)、monitor/TrendCharts/ZabbixQuery/api.ts/cost-analysis、network/*(8)、notification/api.ts(3)、settings/SecuritySettings

### P1 前端硬编码 fetch 漏 /v1（3 处）
- RemoteDesktop.tsx
- BackupSettings.tsx

### P1 kubernetes 双重 /api 前缀
- useKubernetes.ts scale/restart 4 处

### P1 业务修复
- scripts runScript: 前端 setTimeout mock → 真实 POST /scripts/:id/execute
- Topology handleDiscoverDependencies: catch 吞错 → logger.warn + 失败计数

## 待修复（非阻塞 / 体验问题）

| 优先级 | 项 | 位置 | 描述 |
|--------|----|------|------|
| P2 | Approvals 评论丢失 | `frontend/src/modules/change-management/pages/Approvals.tsx:45` | approve 硬编码 '审批通过'，应加可选意见 modal |
| P2 | RemediationExecutions 分页无封顶 | `frontend/src/modules/auto/pages/RemediationExecutions.tsx:309-321` | 下一页按钮无 disabled + 限上界 |
| P2 | Reports type 写死 'inspection' | `backend/src/modules/monitor/services/reportService.ts:227,243` | getTemplates/getTemplate 丢失真实 type |
| P3 | lint-staged Windows 路径 bug | `scripts/lint-staged.cjs:31-39` | Windows 上 path.join 把绝对路径当相对路径处理 → ENOENT |
| P3 | frontend/src/modules/servers/api.ts + network/api.ts 死代码 | 含错误 `data.data` 解包且无调用方 | 建议删除 |
| P3 | DataRoom.tsx import 路径过深 | `frontend/src/modules/dc/pages/DataRoom.tsx:5` | `../../../modules/dc/...` 应为 `../components/...` |
| P3 | ComposeEditor 归属错配 | `frontend/src/modules/containers/...` | compose 实际属 config-management，不影响功能 |

## 体检方法

每组并行启动 1 个 `general-purpose-task` 子代理，做"路由可达 → 后端模块健康 → 已知 bug 信号"快速体检。子代理只回报高置信度问题。问题修复后 commit + push，再进入下一组。