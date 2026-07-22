# 审计日志模块 (`audit/`)

> **DDD 限界上下文**：审计日志（P1-6 从 infra 抽离）
> **聚合根**：`AuditLog`
> **最后刷新**：2026-07-22

## 职责
全平台审计日志的写入与查询：记录关键操作（登录、配置变更、修复执行、审批等），提供分页查询与统计分析。

## 内部结构
```
audit/
├── routes/                       # 1 路由文件
│   └── auditRoutes.ts            # 列表 / 详情 / 统计 API
├── services/                     # 2 业务服务（无测试文件）
│   ├── auditService.ts           # 业务层封装（历史逻辑）
│   └── auditLogCrudService.ts    # 路由层抽象（避免直访 Repository）
├── routes.ts                     # 路由聚合入口
├── index.ts                      # 模块导出
└── README.md
```

## 路由端点（受保护）

> `audit/routes.ts` 自身仅挂载 `router.use('/', auditRoutes)`。在 `_registry.ts` 中挂载为 `/api/v1/audit`，所以**实际前缀为 `/audit`**。

| 路径 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/audit/` | GET | 受保护 | 列表（分页 + 过滤：userId/action/resourceType/from/to） |
| `/audit/:id` | GET | 受保护 | 详情 |
| `/audit/stats/summary` | GET | 受保护 | 聚合统计 |

## 依赖
- `repositories/auditLogRepository` — `audit_logs` 表的读写
- `middleware/auth` — JWT 鉴权

## 被依赖
- 几乎所有业务模块写入审计日志（auth/users/settings/workflow/auto/change-management 等）
- 前端 `frontend/src/modules/audit/pages/AuditLogs.tsx`

## 关键说明
- 阶段：P1-6 infra 按子域拆分阶段 3（2026-07-07），从 `modules/infra/` 抽离
- `auditLogCrudService` 充当 routes↔Repository 的 service 层（符合 ADR-016 强制规范）
- **测试覆盖缺口**：当前 0 个测试文件，建议补充列表过滤 / 详情 / 统计的核心场景
- 仓储层有 14 子文件的 `alertRepository/` 聚合，但 `auditLogRepository` 是单文件，结构清晰
- 历史遗留：原 `modules/infra/services/auditService.ts` 与 `auditLogCrudService.ts` 在拆分后保留两份，前者是业务层封装、后者是 routes 抽象层