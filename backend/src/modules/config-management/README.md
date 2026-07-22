# Config-Management 模块

> **DDD 限界上下文**：配置管理与编排
> **聚合根**：`ConfigTemplate`、`ComposeProject`
> **最后刷新**：2026-07-22

## 职责
配置管理与编排：配置模板、配置修复、Docker Compose 编排。

## 路由端点（受保护）

| 前缀 | 来源 | 说明 |
|------|------|------|
| `/config-templates/*` | `configTemplateRoutes.ts` | 配置模板管理（CRUD + 渲染） |
| `/config-repair/*` | `configRepairRoutes.ts` | 配置修复（检测 + 修复策略 + 验证） |
| `/compose/*` | `composeRoutes.ts` | Docker Compose 编排（up/down/ps） |

## 内部结构
```
config-management/
├── routes.ts                       # 模块路由聚合
├── routes/
│   ├── configTemplateRoutes.ts     # 配置模板管理
│   ├── configRepairRoutes.ts       # 配置修复
│   └── composeRoutes.ts            # Docker Compose 编排
├── services/                            # 11 业务服务（含 2 个测试文件）
│   ├── configTemplateService.ts          # 配置模板服务
│   ├── configRepairService.ts            # 配置修复服务
│   ├── configParser.ts                   # 配置解析器（精简主类 147 行）
│   │   └── configParser/                 # 5 个子模块（2026-07-21 v2.17 拆分）
│   │       ├── parseOps.ts                   (248 行：parse + parseLine + 4 个 parseXxxLine)
│   │       ├── analyzeOps.ts                 (216 行：analyze + analyzeNginx/Sysctl/Sshd)
│   │       ├── utils.ts                      (79 行：flattenBlocks + generateNewLine + getIndentLevel + generateId)
│   │       ├── types.ts                      (8 行：类型 barrel)
│   │       └── index.ts                      (8 行：barrel export)
│   ├── configBackupService.ts            # 网络设备配置备份
│   └── composeService.ts                 # Compose 管理服务
├── index.ts
└── README.md
```

## 依赖
- `repositories/`
- `utils/`
- `middleware/auth`

## 被依赖
- `modules/network/` — 网络设备配置备份
- `serviceRegistry.ts` — 服务初始化
