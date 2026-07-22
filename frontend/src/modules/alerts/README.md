# 告警模块（前端）

## 职责
告警管理与巡检：告警源配置、告警降噪、关联分析、自动分析、巡检中心。

## 内部结构
```
alerts/
├── routes.ts                             # 模块路由
├── api.ts                                # API 类型与调用 (428 行)
├── pages/
│   ├── Alerts.tsx                        # 告警入口（1 行，re-export）
│   ├── alerts/
│   │   ├── index.tsx                     # 告警主页面
│   │   ├── AlertList.tsx                 # 告警列表
│   │   ├── AlertDetailPanel.tsx          # 告警详情面板
│   │   ├── AlertFilterBar.tsx            # 告警筛选栏
│   │   ├── useAlertSocket.ts             # WebSocket 实时推送 hook
│   │   ├── AutomationLogPanel.tsx        # 自动化日志面板
│   │   └── types.ts                      # 子模块类型
│   ├── AlertProviders.tsx                # 告警源配置（精简主入口 163 行）
│   │   └── alert-providers/
│   │       ├── types.ts                       # 接口（51 行）
│   │       ├── providerGuides.ts              # PROVIDER_GUIDES + getFormFields（79 行）
│   │       ├── useAlertProvidersData.ts       # 全部 hooks + handlers（293 行）
│   │       ├── ConfiguredAlertSourceList.tsx  # 已配置 list（141 行）
│   │       ├── AvailableProviderGrid.tsx      # 可用 provider grid（135 行）
│   │       ├── EditConfigModal.tsx            # 编辑 modal（310 行）
│   │       └── index.ts                       # barrel（10 行）
│   ├── AlertMappings.tsx                 # 告警映射
│   ├── AlertCorrelationGroups.tsx        # 关联规则
│   ├── AlertAutoAnalysis.tsx             # 自动分析
│   ├── AlertNoiseManagement.tsx          # 告警降噪
│   └── InspectionCenter.tsx              # 巡检中心
└── components/
    ├── InspectionHistory.tsx             # 巡检历史
    ├── InspectionResult.tsx              # 巡检结果
    └── ImpactChain.tsx                   # 影响链
```

**最后刷新**：2026-07-22

## 对应后端
`backend/src/modules/alerts/`