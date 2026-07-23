# 数据库模块 (`database/`)

> **DDD 限界上下文**：数据库连接管理 + 平台自身 SQLite 健康
> **聚合根**：`DatabaseConnection`（外部） + 平台 `settings/health`（内部）
> **最后刷新**：2026-07-23（dbConnectionCrudService 抽离完成，routes 直访 Repository 漏洞修复）

## 职责

两个独立子域：

1. **数据库连接管理（db-connections）**：外部数据库（MySQL/PostgreSQL 等）连接配置、加密存储、连接测试、健康检查
2. **数据库健康与维护（database）**：平台自身 SQLite 数据库的统计、维护（vacuum/analyze/integrity_check）、索引信息、查询优化建议

## 内部结构

```
database/
├── routes/                       # 2 路由文件
│   ├── databaseRoutes.ts         # SQLite 平台健康（stats/maintenance/indexes/suggestions）
│   └── dbConnectionsRoutes.ts    # 外部 DB 连接 CRUD + test（routes→service 抽象 2026-07-23 完成）
├── services/                     # 2 业务服务
│   ├── dbskiterService.ts        # 数据库连接测试执行器（封装执行 + 健康检查子命令）
│   └── dbConnectionCrudService.ts # 外部 DB 连接 CRUD service（2026-07-23 新建；前 routes 直访 Repository 已修）
├── routes.ts                     # 路由聚合入口
├── index.ts                      # 模块导出
└── README.md
```

## 路由端点（受保护）

### 数据库健康与维护（SQLite 平台自身）

| 路径                        | 方法 | 权限  | 说明                                       |
| --------------------------- | ---- | ----- | ------------------------------------------ |
| `/database/stats`           | GET  | admin | 平台 SQLite 健康统计                       |
| `/database/maintenance`     | POST | admin | 单项维护（vacuum/analyze/integrity_check） |
| `/database/maintenance/all` | POST | admin | 全量维护                                   |
| `/database/indexes`         | GET  | admin | 所有表的索引信息                           |
| `/database/suggestions`     | GET  | admin | 查询优化建议                               |

### 数据库连接管理（外部 DB）

| 路径                           | 方法   | 权限           | 说明                     |
| ------------------------------ | ------ | -------------- | ------------------------ |
| `/db-connections`              | GET    | 受保护         | 列出所有连接（密码脱敏） |
| `/db-connections/:id`          | GET    | admin/operator | 详情（密码脱敏）         |
| `/db-connections`              | POST   | admin/operator | 创建连接（密码加密存储） |
| `/db-connections/:id`          | PUT    | admin/operator | 更新连接                 |
| `/db-connections/:id`          | DELETE | admin          | 删除连接                 |
| `/db-connections/:id/test`     | POST   | admin/operator | 测试已保存连接           |
| `/db-connections/test-connect` | POST   | admin/operator | 直接测试连接（不保存）   |

## 依赖

- `repositories/dbConnectionRepository` — `db_connections` 表（v016/v020 migration）
- `modules/auth/services/encryptionService` — 连接密码 AES 加密
- `models/database` — 平台自身 SQLite 健康/维护接口
- `middleware/auth` — `requireRole` 权限控制
- **2026-07-23**：完成 routes→service 抽象，与其他 23 模块对齐，**已不再豁免 ADR-016**

## 被依赖

- 前端 `frontend/src/modules/database/pages/DbConnections.tsx`
- 平台运维入口（数据库健康监控）

## 关键说明

- **测试覆盖缺口**：当前 0 个测试文件，建议补充连接 CRUD + 加密 + 测试连接的核心场景
- 密码字段：返回前端时永远脱敏（`password: ''`），存储时 AES 加密
- **密码解密失败安全策略**（2026-07-20 P0-1 修复）：`POST /db-connections/:id/test` 解密失败时返回 500 错误并记录 `logger.error`，**绝不 fallback 到 `row.password` 明文密码**。前端应提示用户重新配置该连接的密码
- 数据库类型（`db_type`）默认 `mysql`，可扩展 postgres / oracle / sqlserver
- `executeDbskiter` 调用 `dbskiter` 子进程执行真实连接测试（带 15s 超时）

### 2026-07-23 变更

- **dbConnectionCrudService.ts** 新建，封装 list/get/create/update/delete + testSaved/testAdHoc
- **dbConnectionsRoutes.ts** 改为 routes→service 抽象（之前 4 个端点直接 `dbConnectionRepository.xxx()`，违反 architecture.md §3.2）
- **service 层 `password` 字段三态语义**：更新时 `undefined` = 保留旧密码 / `''` = 保留 / `string` = 加密更新（与 serverCrudService.description 对齐）
