# 变更管理模块（前端）

## 职责
IT 变更管理与审批流程：审批列表、审批操作。

## 内部结构
```
change-management/
├── routes.ts                             # 模块路由
├── api.ts                                # API 类型与调用
├── pages/
│   └── Approvals.tsx                     # 审批中心
└── index.ts
```

## 对应后端
`backend/src/modules/change-management/`