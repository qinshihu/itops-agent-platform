# 联动统计模块 (`linkage/`)

> **DDD 限界上下文**：跨域读模式聚合（巡检中心 / 联动统计 / 历史趋势）
> **聚合根**：`InspectionCenter`
> **最后刷新**：2026-07-22（前端对应模块待补建）

## 职责
跨域"读模式"聚合：巡检中心（统一合并 SNMP + SSH + AI 分析）/单设备概览/仪表盘联动统计/历史趋势。

## 路由端点（受保护）

> `linkage/routes.ts` 自身仅挂载 `router.use('/', linkageRoutes)`，所有路径来自 `linkageRoutes.ts`。

| 前缀 | 来源 | 说明 |
|------|------|------|
| `/linkage/*` | `linkageRoutes.ts` | inspection-center / overview / linkage / trends（前端模块待补建） |

> **前端 23 模块无 `linkage/` 对应实现**，仅后端提供 API；前端 AlertInspectionCenter 页面通过 `frontend/src/modules/alerts/pages/InspectionCenter.tsx` 调用，详见 [rules/frontend.md §一](./../rules/frontend.md)。

## 内部结构
```
linkage/
├── routes/                   # 1 路由文件
│   └── linkageRoutes.ts      # inspection-center / overview / linkage / trends
├── services/                 # 1 业务服务
│   └── linkageService.ts     # 路由层抽象（薄包装 analyticsRepository）
├── routes.ts                 # 路由聚合入口
├── index.ts                  # 模块导出
└── README.md
```

## 依赖关系
- 仓储：`analyticsRepository`（`repositories/index.ts`）
- 不依赖其他业务模块（纯读聚合）

## 关键说明
- 纯聚合查询，不修改任何状态
- 阶段：P1-6 infra 按子域拆分阶段 7（2026-07-07），从 `modules/infra/` 抽离
