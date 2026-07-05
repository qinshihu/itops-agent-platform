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
│   ├── BigScreenDashboard.tsx            # 大屏展示 (367 行)
│   │   └── big-screen/
│   │       ├── useBigScreenData.ts       # 大屏数据 hook
│   │       └── types.ts                  # 大屏类型
│   ├── Reports.tsx                       # 报表
│   └── CostAnalysis.tsx                  # 成本分析
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