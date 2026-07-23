# Change-Management 模块

> **DDD 限界上下文**：IT 变更与审批
> **聚合根**：`Change`、`ApprovalTicket`
> **最后刷新**：2026-07-23（nav.autoExecution 第 5 轮：changeRoutes 全 RBAC + approvalRoutes 5 catch logger + audit user_id 真实用户）

## 职责
IT 变更管理与审批控制：变更记录、审批流转、变更历史、与工作流引擎联动（resume / reject）。

## 路由端点（受保护）

| 前缀 | 来源 | 说明 |
|------|------|------|
| `/changes/*` | `changeRoutes.ts` | 变更记录 CRUD（list/create/getByServer 等） |
| `/approvals/*` | `approvalRoutes.ts` | 审批流程（list/pending-count/detail/approve/reject） |

## 内部结构
```
change-management/
├── routes/                          # 2 路由文件
│   ├── changeRoutes.ts               ← 变更记录 CRUD（list/create/getByServer）
│   └── approvalRoutes.ts             ← 审批管理（list/pending-count/:id/approve/reject）
├── services/                         # 4 业务服务（含 2 个测试文件）
│   ├── changeService.ts              ← 变更历史记录
│   ├── changeService.test.ts         ← 变更服务测试
│   ├── approvalService.ts            ← 审批业务逻辑（状态流转）
│   ├── approvalService.test.ts       ← 审批服务测试
│   └── approvalCrudService.ts        ← 审批 CRUD（routes 抽象层）
├── routes.ts                         # 路由聚合入口
├── index.ts
└── README.md
```

## 依赖
- `repositories/approvalsRepo` — 审批表 CRUD
- `middleware/auth` — requireRole（admin/operator）
- `modules/audit/` — 审计日志写入
- `modules/workflow/services/workflowExecutor` — `resumeWorkflow`, `rejectWorkflow`（审批结果驱动工作流继续 / 终止）

## 被依赖
- `modules/ai/services/rca/` — 根因分析记录变更
- `modules/mcp/services/` — MCP 工具调用可触发审批（如自动修复审批）
- 前端 `frontend/src/modules/change-management/pages/Approvals.tsx`

## 关键说明
- **审批状态机**：`approvalService` 维护审批状态（pending → approved/rejected），与工作流 `WorkflowEngine` 联动
- **强制 requireRole**：所有审批端点需要 admin 或 operator 角色
- **`approvalRoutes` 中 `/pending/count`** 专门为前端角标提供未审批数量
- **测试覆盖**：2 个测试文件（changeService / approvalService）