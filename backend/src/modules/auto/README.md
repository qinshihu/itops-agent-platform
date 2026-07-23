# 自动修复模块 (`auto/`)

> **DDD 限界上下文**：自动修复与自动伸缩
> **聚合根**：`RemediationPolicy`、`ScaleRule`
> **最后刷新**：2026-07-23（nav.autoExecution 第 5 轮：remediationExecutionRoutes 全 RBAC + autoScaleService shutdown + autoScale 8 catch logger）

## 职责
自动修复策略管理、策略编排、修复执行记录、修复大盘、自动伸缩。

## 内部结构（2026-07-22 核对代码现状）
```
auto/
├── routes.ts                  # 模块路由聚合入口（挂 4 个子路由）
├── routes/                    # 4 路由文件
│   ├── remediationPolicyRoutes.ts    ← 策略 CRUD（/remediation-policies/*）
│   ├── remediationExecutionRoutes.ts ← 执行追踪（/remediation-executions/*）
│   ├── remediationAuditRoutes.ts     ← 审计（/remediation-audits/*）
│   └── autoScaleRoutes.ts            ← 自动伸缩（/auto-scale/*，ADR-015 真实实现）
├── services/                  # 11 服务文件（含 1 个测试文件 = 非测试 10 个 + 1 个测试）
│   ├── remediationService/    ← 修复编排核心（**已按子域拆分**）
│   │   ├── index.ts                       (115 行 聚合入口 + 类型 barrel)
│   │   ├── policyCrud.ts                  (CRUD: createPolicy / updatePolicy / deletePolicy / getPolicy / listPolicies / togglePolicy)
│   │   ├── executionOrchestration.ts      (执行编排: triggerRemediation / executeWorkflow / resolveParams / requestApproval / sendSuggestion)
│   │   ├── verificationRollback.ts        (验证与回滚: verifyResult / rollbackExecution / approveExecution / retryExecution)
│   │   └── types.ts                       (领域类型)
│   ├── remediation/          ← 修复策略 mixin（按业务方法混入 RemediationService 实例）
│   │   ├── policyEngine.ts               (policyEngineMixin)
│   │   ├── executionTracker.ts           (executionTrackerMixin)
│   │   └── remediationActions.ts         (remediationActionsMixin)
│   ├── autoScaleService.ts                ← 自动伸缩（ADR-015 真实实现，三类目标）
│   ├── remediationExecutionService.ts    ← 修复执行追踪
│   └── remediationService.test.ts        ← 1 个测试文件
├── index.ts
└── README.md
```

## 路由端点（受保护）

| 前缀 | 来源 routes 文件 | 说明 |
|------|------------------|------|
| `/remediation-policies/*` | `remediationPolicyRoutes.ts` | 修复策略 CRUD + toggle |
| `/remediation-executions/*` | `remediationExecutionRoutes.ts` | 执行记录查询 |
| `/remediation-audits/*` | `remediationAuditRoutes.ts` | 审计追踪 |
| `/auto-scale/*` | `autoScaleRoutes.ts` | 自动伸缩规则 CRUD + 历史 |

## 依赖关系
- 依赖 `ai/`（修复建议生成）、`workflow/`（修复流程编排）、`notification/`（执行结果通知）
- 被 `alerts/` 触发（AARS 自动响应链路）

## 关键说明
- `remediationService/` 子目录是 P1 阶段按职责拆分的成果：原 `remediationService.ts`（1426 行单文件）拆为 5 个文件（CRUD / 编排 / 验证回滚 / 类型 / 聚合入口）+ 3 个 mixin 文件
- 修复策略引擎已设计 HITL（人在回路）审批模式（`requestApproval` / `approveExecution`）
- AutoScale 真实实现（ADR-015）：container / vm / k8s_deployment 三类目标自适应伸缩
- **聚合根保护**：`remediationService` 是聚合根，状态变更必须通过 `triggerRemediation` / `approveExecution` / `rollbackExecution` 等显式方法，外部不可直接改字段