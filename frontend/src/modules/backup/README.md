# 备份模块（前端）

## 职责
数据库备份与恢复：自动备份配置、加密备份、手动恢复。

## 内部结构
```
backup/
├── routes.ts                             # 模块路由
├── api.ts                                # API 类型与调用
├── pages/
│   └── BackupSettings.tsx                # 备份管理
└── index.ts
```

## ⚠️ READ-ME-002（2026-07-22 已修复）

`backupRoutes` 已在 `frontend/src/modules/backup/routes.ts` 中定义（path: `backups`），但此前 **未在 `frontend/src/modules/_routes.tsx` 中 import / 展开**。

- **影响**：备份管理页面不可达（前端路由 `/backups` 不存在）
- **状态**：✅ **已修复**（2026-07-22），在 `_routes.tsx` 第 27 行添加 `import { backupRoutes } from './backup/routes';`，并在 `protectedRoutes` 数组第 59 行展开 `...backupRoutes`

## 对应后端
`backend/src/modules/backup/`

## 刷新记录
- **2026-07-22**：标记 READ-ME-002（路由挂载问题）已修复