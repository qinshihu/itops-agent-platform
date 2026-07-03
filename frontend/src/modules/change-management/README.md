# Change Management 模块

## 职责
IT 变更管理与审批流程。审批是变更的前置流程，两者天然聚合。

## 内部结构
```
change-management/
├── routes.ts                          # 模块路由配置
├── pages/
│   └── Approvals.tsx                  # 审批中心
├── api.ts                             # API 类型与调用
├── index.ts
└── README.md
```

## 对应后端
- `modules/change-management/` — 变更记录 + 审批流转
- API 前缀: `/api/changes`, `/api/approvals`
