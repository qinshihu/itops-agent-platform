# 告警模块 (`alerts/`)

> **DDD 限界上下文**：告警全生命周期（接收→过滤→关联→降噪→通知→AARS）
> **聚合根**：`Alert`、`AlertRule`、`AlertCorrelation`
> **最后刷新**：2026-07-22

## 职责
告警全生命周期管理：告警接收、规则匹配、关联分析、降噪、通知分发、AARS 自适应自动化。

## 内部结构（2026-07-22 核对代码现状）
```
alerts/
├── routes.ts                    # 模块路由聚合入口（default = 4 个子路由 + 3 个 named export）
├── routes/                      # 7 个子路由文件
│   ├── alertRoutes.ts           # /alerts/*
│   ├── alertMappingRoutes.ts    # /alert-mappings/*  （P2 拆分）
│   ├── alertNoiseRoutes.ts      # /alert-noise/*    （P2 拆分）
│   ├── alertAutoResponseRoutes.ts # /alert-auto-response/* （P2 拆分）
│   ├── alertAutoRoutes.ts       # named export: alertAutoRouter （挂 /api/v1/alert-auto）
│   ├── alertCorrelationRoutes.ts # named export: alertCorrelationRouter （挂 /api/v1/correlation）
│   └── webhookRoutes.ts         # named export: webhookRouter （公开路由 /api/v1/webhooks）
├── services/                    # 34 服务文件（含 5 个测试文件）
│   ├── alertService.ts          ← 告警 CRUD + 统计分析
│   ├── alertCrudService.ts      ← routes 层抽象（ADR-016 routes→service）
│   ├── alertNotificationService.ts ← 通知派发
│   ├── alertMappingCrudService.ts ← 告警映射 routes 抽象
│   ├── alertWorkflowMappingService.ts ← 工作流触发
│   ├── alertProcessingPipeline.ts ← 告警处理流水线
│   ├── alertCorrelationService.ts ← 关联分组
│   ├── alertNoiseReductionService.ts ← 降噪
│   ├── alertAutoAnalyzer/      ← 自动分析（4 子模块）
│   ├── alertAutoResponse/      ← AARS 自适应响应（adaptive + diagnosis + notification + remediation）
│   ├── AlertProcessor.ts        ← 聚合处理（init 在 serviceRegistry 注册）
│   ├── webhookService.ts        ← 5 标准源 + signature + processNormalizedAlert
│   ├── alertSourceAdapters.ts   ← 源适配
│   ├── alertProviderRegistry.ts ← Provider 注册
│   ├── alertDeviceResolver.ts   ← 设备关联
│   ├── localRuleEngine.ts       ← 本地规则匹配
│   └── ...其他
└── ...
```

## 路由端点

| 前缀 | 来源 | 挂载位置 |
|------|------|---------|
| `/alerts/*` | `alertRoutes.ts`（default） | `/api/v1/alerts` |
| `/alert-mappings/*` | `alertMappingRoutes.ts`（default） | `/api/v1/alert-mappings` |
| `/alert-noise/*` | `alertNoiseRoutes.ts`（default） | `/api/v1/alert-noise` |
| `/alert-auto-response/*` | `alertAutoResponseRoutes.ts`（default） | `/api/v1/alert-auto-response` |
| `/alert-auto/*` | `alertAutoRoutes.ts`（`alertAutoRouter`） | `/api/v1/alert-auto` |
| `/correlation/*` | `alertCorrelationRoutes.ts`（`alertCorrelationRouter`） | `/api/v1/correlation` |
| `/webhooks/*` | `webhookRoutes.ts`（`webhookRouter`，**公开**） | `/api/v1/webhooks` |

## 依赖关系
- 上游：`alerts/` 被 `ai/`（根因分析）、`monitor/`（展示）、`workflow/`（触发）依赖
- 基础设施：`infra/notificationChannels`、`auth/credentialService`
- 仓储层：`alertRepository/` 12 子仓储 + `analyticsRepository`

## 关键说明
- 告警规则引擎 `localRuleEngine.test.ts` 有测试覆盖
- 告警服务 `alertService.test.ts` 已完整重写并通过
- **路由规范化（P2-7 完成）**：所有 routes 已通过 service 层访问数据
  - `alertRoutes.ts` 通过 `alertCrudService` 高层方法（`createAlertWithFullPipeline` 等）
  - `webhookRoutes.ts` 通过 `webhookService.handleStandardWebhook`（5 个标准源）+ `verifySignature` / `processNormalizedAlert`（auto/generic）
  - 业务逻辑（签名验证、噪音检查、fingerprint、通知派发、pipeline 触发）全部在 service 层
- **AARS（Alert Auto Response System）**：`alertAutoResponse/` 子目录是 P2 阶段按职责拆分的成果，包含 4 子模块（adaptive / diagnosis / notification / remediation），含 `adaptiveAutomation.ts` / `riskAssessor.ts` / `strategyRecommender.ts` / `escalationEngine.ts` 等
- **公开 webhook 路由**：`/api/v1/webhooks/*` 无需 JWT 鉴权，仅走 `webhookIpFilter` + `rateLimiter`
