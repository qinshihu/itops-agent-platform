# Change-Management 模块

## 职责
IT 变更管理与审批控制：变更记录、审批流转、变更历史。

## 内部结构
```
change-management/
├── routes.ts                  # 模块路由聚合
├── routes/
│   ├── changeRoutes.ts        # 变更记录 CRUD
│   └── approvalRoutes.ts      # 审批流程管理
├── services/
│   ├── changeService.ts       # 变更历史记录
│   └── approvalService.ts     # 审批业务逻辑
├── index.ts
└── README.md
```

## 依赖
- `repositories/` — approvalsRepo
- `middleware/auth` — requireRole
- `modules/workflow/services/workflowExecutor` — resumeWorkflow, rejectWorkflow

## 被依赖
- `modules/ai/services/rca/` — 根因分析记录变更
