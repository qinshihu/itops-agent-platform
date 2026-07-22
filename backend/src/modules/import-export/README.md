# 导入导出模块 (`import-export/`)

> **DDD 限界上下文**：跨域数据导入导出（P1-6 从 infra 抽离）
> **聚合根**：`ImportExport`
> **最后刷新**：2026-07-22

## 职责
CSV/JSON 格式的服务器/告警/审计日志/报告 导入导出，以及导入模板下载。

## 路由端点（受保护）

> `import-export/routes.ts` 自身仅挂载 `router.use('/import-export', importExportRoutes)`，所有路径来自 `importExportRoutes.ts`。

| 前缀 | 来源 | 说明 |
|------|------|------|
| `/import-export/*` | `importExportRoutes.ts` | servers/alerts/audit-logs/reports import/export + 模板下载 |

## 内部结构
```
import-export/
├── routes/                       # 1 路由文件
│   └── importExportRoutes.ts     # servers/alerts/audit-logs/reports import/export + template
├── services/                     # 1 业务服务
│   └── importExportService.ts    # 含 importServersFromCSV + exportServers/exportAlerts/...
├── routes.ts                     # 路由聚合入口
├── index.ts                      # 模块导出
└── README.md
```

## 依赖关系
- 仓储：`serversRepo`、`alertRepository`、`auditLogRepository`、`reportsRepo`
- 中间件：`requireRole('admin')`
- 不依赖其他业务模块

## 关键说明
- 所有导入导出接口均需要 admin 角色（`requireRole('admin')`）
- 单次导入限 1000 行（`MAX_IMPORT_ROWS`），单字段长度限 500（`MAX_FIELD_LENGTH`）
- 模板路由（`/template/servers`）无需角色控制（任何用户可下载模板）
- 阶段：P1-6 infra 按子域拆分阶段 8（2026-07-07），从 `modules/infra/` 抽离
