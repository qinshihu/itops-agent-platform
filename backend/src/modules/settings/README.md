# 设置模块 (`settings/`)

> **DDD 限界上下文**：系统设置（P1-6 第一个从 infra 抽离的子域）
> **聚合根**：`Setting`、`AIProviderConfig`
> **最后刷新**：2026-07-22

## 职责
系统级 KV 配置 + AI Provider（豆包/OpenAI/Local AI）配置 + 预设 Agent 模型同步。
原 P1-5 阶段位于 `modules/infra/`，P1-6 阶段作为 `infra/` 按子域拆分的第一个子域抽离出来（2026-07-07）。

## 路由端点（受保护）

> `settings/routes.ts` 自身仅挂载 `router.use('/', settingsRoutes)`，所有路径来自 `settingsRoutes.ts`。

| 前缀 | 来源 | 说明 |
|------|------|------|
| `/settings/*` | `settingsRoutes.ts` | 设置 KV + AI Provider CRUD + 模型列表 |

## 内部结构
```
settings/
├── routes/                       # 1 路由文件
│   └── settingsRoutes.ts         # 设置 REST API（含 API Key/Model CRUD）
├── services/                     # 1 业务服务
│   └── settingsCrudService.ts    # 设置 CRUD + AI Provider 持久化 + Agent 模型同步
├── routes.ts                     # 模块路由聚合
├── index.ts                      # 模块导出
└── README.md
```

## 路由端点（受保护）

| 路径 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/settings` | GET | admin | 获取全部 settings |
| `/settings` | PUT | 受保护 | 批量 upsert |
| `/settings/api-keys` | GET | admin | 获取 AI Provider 配置（脱敏） |
| `/settings/api-keys` | PUT | admin | 保存 AI Provider 配置 |
| `/settings/api-keys/:provider` | DELETE | admin | 删除指定 provider |
| `/settings/models` | GET | 受保护 | 获取可用模型列表 |

## 依赖
- `repositories/settingsRepository` — settings 表的读写
- `repositories/agentRepository` — preset Agent 模型同步（`updatePresetModel`/`clearPresetModel`）
- `auth/credentialService` — AI Provider 凭据加解密
- `utils/apiConfig` + `utils/sensitiveMask` — 模型/API key 工具函数
- `middleware/auth` — `requireRole` 权限控制

## 被依赖
- `ai/`（agents 初始化时读取 AI provider 配置）
- 前端 `frontend/src/modules/infra/pages/Settings.tsx`（聚合页 Tab「models」「qanything」）

## 关键说明
- `settingsCrudService.syncPresetAgentModel()` 会在 AI Provider 增删后**自动同步**所有预设 Agent 的 model 字段
- `VALID_KEY = /^[a-zA-Z0-9_-]{1,100}$/` 防止非法 key 注入
- API Key 走 `credentialService` 加密存储（不裸存 settings 表）
