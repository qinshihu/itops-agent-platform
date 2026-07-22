# 工具链接模块 (`tool-links/`)

> **DDD 限界上下文**：工具链接 / 工具箱（P1-6 从 infra 抽离）
> **聚合根**：`ToolLink`
> **最后刷新**：2026-07-22

## 职责
工具箱管理（Tool Links）：CRUD（增删改查）+ 图标上传 + 静态图标服务。

## 路由端点（受保护）

> `tool-links/routes.ts` 自身仅挂载 `router.use('/tool-links', toolLinkRoutes)`，所有路径来自 `toolLinkRoutes.ts`。

| 前缀 | 来源 | 说明 |
|------|------|------|
| `/tool-links/*` | `toolLinkRoutes.ts` | CRUD + 图标上传/静态服务 |

## 内部结构
```
tool-links/
├── routes/                    # 1 路由文件
│   └── toolLinkRoutes.ts      # CRUD + 图标上传/静态服务
├── services/                  # 1 业务服务
│   └── toolLinkCrudService.ts # 路由层抽象（避免直访 Repository）
├── routes.ts                  # 路由聚合入口
├── index.ts                   # 模块导出
└── README.md
```

## 依赖关系
- 仓储：`toolLinksRepo`（`repositories/index.ts`）
- 中间件：`requireRole`、`validateBody`、`validateParams`
- 不依赖其他业务模块

## 关键说明
- 图标上传（multer/fs）保持在 routes 层——属于 IO 传输层关注点
- 图标文件存放在 `data/uploads/tool-icons/`（可通过 `UPLOAD_DIR` 环境变量覆盖）
- 阶段：P1-6 infra 按子域拆分阶段 6（2026-07-07），从 `modules/infra/` 抽离
