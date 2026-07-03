# Config-Management 模块

## 职责
配置管理与编排：配置模板、配置修复、Docker Compose 编排。

## 内部结构
```
config-management/
├── routes.ts                       # 模块路由聚合
├── routes/
│   ├── configTemplateRoutes.ts     # 配置模板管理
│   ├── configRepairRoutes.ts       # 配置修复
│   └── composeRoutes.ts            # Docker Compose 编排
├── services/
│   ├── configTemplateService.ts    # 配置模板服务
│   ├── configRepairService.ts      # 配置修复服务
│   ├── configParser.ts             # 配置解析器
│   ├── configBackupService.ts      # 网络设备配置备份
│   └── composeService.ts           # Compose 管理服务
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
