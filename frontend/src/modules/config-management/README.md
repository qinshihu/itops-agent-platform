# Config Management 模块

## 职责
配置管理与编排：配置模板管理、配置修复、Docker Compose 编排。

## 内部结构
```
config-management/
├── routes.ts                          # 模块路由配置
├── pages/
│   └── ConfigTemplates.tsx            # 配置模板管理
├── api.ts                             # API 类型与调用
├── index.ts
└── README.md
```

## 对应后端
- `modules/config-management/` — 配置模板 + 配置修复 + Compose 管理
- API 前缀: `/api/config-templates`, `/api/config-repair`, `/api/compose`
