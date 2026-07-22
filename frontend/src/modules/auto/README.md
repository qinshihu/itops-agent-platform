# 自动修复模块（前端）

## 职责
自动化运维：自动伸缩、修复策略管理、修复执行、修复大盘、修复工作台。

## 内部结构
```
auto/
├── routes.ts                             # 模块路由
├── api.ts                                # API 类型与调用 (403 行)
├── pages/
│   ├── AutoScale.tsx                     # 自动伸缩
│   ├── RemediationPolicies.tsx           # 修复策略列表
│   ├── RemediationPolicyEditor.tsx       # 修复策略编辑
│   ├── RemediationExecutions.tsx         # 修复执行记录
│   ├── RemediationDashboard.tsx          # 修复大盘
│   └── RemediationWorkbench.tsx          # 修复工作台
└── index.ts
```

## 对应后端
`backend/src/modules/auto/`

## 刷新记录
- **2026-07-22**：核对结构与 api.ts 规模（403 行）