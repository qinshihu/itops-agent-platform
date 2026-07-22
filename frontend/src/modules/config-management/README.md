# 配置管理模块（前端）

## 职责
配置模板管理：模板创建、编辑、版本管理、应用历史。

## 内部结构
```
config-management/
├── routes.ts                             # 模块路由
├── api.ts                                # API 类型与调用
├── pages/
│   └── ConfigTemplates.tsx               # 配置模板管理
└── index.ts
```

## 对应后端
`backend/src/modules/config-management/`

## 刷新记录
- **2026-07-22**：核对结构与路由