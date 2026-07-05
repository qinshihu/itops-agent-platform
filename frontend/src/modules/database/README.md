# 数据库模块（前端）

## 职责
数据库连接管理：外部数据库连接配置、连接测试、查询浏览。

## 内部结构
```
database/
├── routes.ts                             # 模块路由
├── api.ts                                # API 类型与调用
├── pages/
│   └── DbConnections.tsx                 # 数据库连接管理
└── index.ts
```

## 对应后端
`backend/src/modules/database/`