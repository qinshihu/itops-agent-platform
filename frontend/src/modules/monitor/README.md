# 监控模块（前端）

## 职责
监控仪表盘：监控面板、大屏展示、报表、成本分析。

## 内部结构
```
monitor/
├── routes.ts                             # 模块路由
├── api.ts                                # API 类型与调用
├── pages/
│   ├── Dashboard.tsx                     # 监控面板
│   ├── BigScreenDashboard.tsx            # 大屏展示主入口 (121 行)
│   │   └── big-screen/
│   │       ├── CriticalAlertBanner.tsx    # 顶部严重告警条 (77)
│   │       ├── BigScreenHeader.tsx        # 主标题 / 快捷入口 / 资源统计 (222)
│   │       ├── BigScreenLeftColumn.tsx    # 系统资源监控 + 趋势图 + 自动修复 (336)
│   │       ├── BigScreenStatCardRow.tsx   # 4 StatCard + 4 SLA mini-card (104)
│   │       ├── BigScreenTrendCharts.tsx   # CPU/内存/网络/磁盘 4 趋势图 (66)
│   │       ├── BigScreenRecentTasksList.tsx # 最近任务列表 (90)
│   │       ├── BigScreenRightColumn.tsx   # 告警 / Agent 统计 / 任务分布 (186)
│   │       ├── BigScreenFooter.tsx        # 底部状态栏 (50)
│   │       ├── BigScreenStatCard.tsx      # StatCard 单一组件 + 颜色 helper (116)
│   │       ├── useBigScreenData.ts        # 大屏数据 hook (444)
│   │       └── types.ts                   # 大屏类型 (176)
│   ├── Reports.tsx                       # 报表
│   ├── CostAnalysis.tsx                  # 成本分析
│   ├── PrometheusQuery.tsx               # Prometheus 主动查询 (后端 /monitor/prometheus/*)
│   │   └── prometheus/
│   │       ├── types.ts                  # 类型定义
│   │       ├── format.ts                 # 时间/值格式化与请求体构造
│   │       └── ResultsTable.tsx          # 结果渲染（vector/matrix/scalar/string）
│   └── ZabbixQuery.tsx                   # Zabbix 主动查询 (后端 /monitor/zabbix/*)
│       └── zabbix/
│           ├── types.ts                  # 类型/常量/列定义
│           └── ResultsTable.tsx          # 结果表格
├── components/
│   ├── AnimatedBarChart.tsx              # 动态柱状图
│   ├── AnimatedLineChart.tsx             # 动态折线图
│   ├── CircularProgress.tsx              # 环形进度
│   ├── ParticleBackground.tsx            # 粒子背景
│   └── TrendCharts.tsx                   # 趋势图
└── index.ts
```

## 对应后端
`backend/src/modules/monitor/`

## 刷新记录
- **2026-07-22**：标记 READ-ME-001（后端 prometheus/zabbix 路由挂载）已修复

## ⚠️ READ-ME-001 关联（2026-07-22 已修复）

`frontend/src/modules/monitor/routes.ts` 已注册 `prometheus` 与 `zabbix` 两个前端路由：

```typescript
{ path: 'prometheus', element: PrometheusQuery },
{ path: 'zabbix', element: ZabbixQuery },
```

此前 `backend/src/modules/monitor/routes.ts` **未挂载 `prometheusRoutes` 与 `zabbixRoutes`**（参见 `backend/src/modules/monitor/README.md` ⚠️ READ-ME-001），导致前端 API 404。

- **状态**：✅ **已修复**（2026-07-22），后端 routes.ts 第 16-17 行添加 `router.use('/monitor/prometheus', prometheusRoutes)` 与 `router.use('/monitor/zabbix', zabbixRoutes)`，前后端对齐

## 主动查询能力
- `PrometheusQuery.tsx`：PromQL 即时/范围查询，对接 `/monitor/prometheus/test|query|query-range`
- `ZabbixQuery.tsx`：Zabbix JSON-RPC 主动查询，支持 Hosts / Items / Triggers / Problems / History，对接 `/monitor/zabbix/test|hosts|items|triggers|problems|history`