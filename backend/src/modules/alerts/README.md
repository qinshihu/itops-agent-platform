# 告警模块 (`alerts/`)

## 职责
告警全生命周期管理：告警接收、规则匹配、关联分析、降噪、通知分发。

## 内部结构
```
alerts/
├── routes/         # 6 路由文件
├── services/       # 11 服务文件
│   ├── alertService.ts        ← 告警 CRUD + 统计分析
│   ├── alertRuleEngine.ts     ← 规则匹配引擎
│   ├── alertCorrelation.ts    ← 告警关联分析
│   └── ...
```

## 依赖关系
- 上游：`alerts/` 被 `ai/`（根因分析）、`monitor/`（展示）依赖
- 基础设施：`infra/notificationChannels`

## 关键说明
- 告警规则引擎 `localRuleEngine.test.ts` 有测试覆盖
- 告警服务 `alertService.test.ts` 已完整重写并通过
