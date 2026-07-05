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
│   ├── AlertProviders.tsx                # 告警源配置 (636 行)
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

## 对应后端
`backend/src/modules/alerts/`