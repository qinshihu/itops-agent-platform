# 监控模块 (`monitor/`)

> **DDD 限界上下文**：监控仪表盘、报表、成本分析、Prometheus/Zabbix 主动查询
> **聚合根**：`Dashboard`、`Report`、`CostEntry`
> **最后刷新**：2026-07-22（修复 READ-ME-001 后）

## 职责
系统监控、健康检查、报表统计、成本分析、Prometheus / Zabbix 主动查询。

## 内部结构
```
monitor/
├── routes.ts                    # 模块路由聚合入口（挂 6 个子路由：dashboard / docker-monitor / cost-analysis / reports / monitor/prometheus / monitor/zabbix）
├── routes/                      # 6 个子路由文件（全部已挂载）
│   ├── dashboardRoutes.ts       # GET /dashboard/*          ← 已挂载
│   ├── monitorRoutes.ts         # GET /docker-monitor/*     ← 已挂载（命名含义：Docker 容器监控）
│   ├── costAnalysisRoutes.ts    # GET /cost-analysis/*      ← 已挂载
│   ├── reportRoutes.ts          # GET/POST /reports/*       ← 已挂载
│   ├── prometheusRoutes.ts      # POST /monitor/prometheus/query|query-range|series|test  ← 已挂载（2026-07-22 修复 READ-ME-001）
│   └── zabbixRoutes.ts          # POST /monitor/zabbix/test|hosts|items|history|triggers|problems  ← 已挂载（2026-07-22 修复 READ-ME-001）
├── services/                    # 业务服务
│   ├── healthService.ts         ← 健康检查（被 app.ts /health 端点使用）
│   ├── reportService.ts         ← 报表
│   ├── dashboardCrudService.ts  ← 大屏数据聚合（dashboardRoutes 内部使用）
│   ├── selfMonitorService.ts    ← 自监控（serviceRegistry 注册）
│   ├── prometheusService.ts     ← Prometheus PromQL 主动查询（PROM/Zabbix 主动查询能力，详见 zabbixRoutes.ts 注释）
│   ├── zabbixService.ts         ← Zabbix JSON-RPC 主动查询（hosts/items/history/triggers/problems）
│   └── ...
├── index.ts                     # 模块导出（export { default as routes } from './routes'）
└── README.md
```

## ⚠️ 代码 ↔ 文档不一致（2026-07-22 已修复）

> **READ-ME-001（✅ 已修复 2026-07-22）**：`monitor/routes.ts` 此前只挂载了 4 个子路由，`routes/prometheusRoutes.ts` 和 `routes/zabbixRoutes.ts` 已存在但未挂载，导致 `POST /api/v1/monitor/prometheus/*` 与 `POST /api/v1/monitor/zabbix/*` 全部 404。
>
> **修复**：在 `routes.ts` 第 6-7 行添加 import，在第 16-17 行添加挂载：
> ```typescript
> router.use('/monitor/prometheus', prometheusRoutes);
> router.use('/monitor/zabbix', zabbixRoutes);
> ```
>
> 修复后 `monitor/routes.ts` 共挂载 6 个子路由（dashboard / docker-monitor / cost-analysis / reports / monitor/prometheus / monitor/zabbix），与 README 第 9-16 行的路由文件清单完全对齐。本节保留作为修复记录。

## 路由端点（受保护）

| 前缀 | 来源 routes 文件 | HTTP 端点 | 说明 |
|------|------------------|-----------|------|
| `/dashboard/*` | `dashboardRoutes.ts` | GET stats / alert-trends / task-trends / agent-stats / task-distribution / remediation-stats / server-metrics / sla-stats / full | 大屏 Dashboard 数据聚合 |
| `/docker-monitor/*` | `monitorRoutes.ts` | GET containers / :id / :id/stats / :id/stats-stream | Docker 容器实时监控（WebSocket） |
| `/cost-analysis/*` | `costAnalysisRoutes.ts` | GET/POST 成本分析 | 成本统计 |
| `/reports/*` | `reportRoutes.ts` | GET/POST 报表 | 报告模板 / 生成 / 历史 |
| `/monitor/prometheus/*` | `prometheusRoutes.ts` ⚠️未挂载 | POST query / query-range / series / test | PromQL 主动查询（已存在但 404） |
| `/monitor/zabbix/*` | `zabbixRoutes.ts` ⚠️未挂载 | POST test / hosts / items / history / triggers / problems | Zabbix JSON-RPC 主动查询（已存在但 404） |

## 依赖关系
- 依赖 `servers/`、`containers/`、`network/` 采集数据
- 依赖 `repositories/analyticsRepository` 提供 dashboard 聚合数据
- 前端对应 `frontend/src/modules/monitor/`（含大屏 Dashboard + Prometheus/Zabbix 主动查询）
