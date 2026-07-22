# 数据库模块（前端）

## 职责
数据库连接管理：外部数据库连接配置、连接测试、查询浏览。

## 内部结构
```
database/
├── routes.ts                             # 模块路由
├── api.ts                                # API 类型与调用
├── pages/
│   └── DbConnections.tsx                 # 数据库连接管理（v2.29 拆分后精简主入口 95 行）
│       └── db-connections/                # 子模块（v2.29 新建）
│           ├── types.ts                          # DbConnection + FormData + Payload + DB_TYPE_COLORS（70）
│           ├── useDbConnectionsData.ts           # 7 state + 1 query + 4 mutation + 6 handler（326）
│           ├── DbConnectionsHeader.tsx           # header + 4 统计卡 + 搜索（108）
│           ├── DbConnectionCard.tsx              # 单连接卡（含类型 color + 操作）（92）
│           ├── DbConnectionFormModal.tsx         # 创建/编辑 modal + 测试连接（232）
│           ├── DeleteDbConnectionModal.tsx       # 删除确认（63）
│           └── index.ts                          # barrel（27）
└── index.ts
```

## 对应后端
`backend/src/modules/database/`

## 刷新记录
- **2026-07-22**：核对 v2.29 拆分后的 DbConnections 子模块结构