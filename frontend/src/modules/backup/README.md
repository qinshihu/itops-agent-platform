# Backup 模块

## 职责
数据库备份与恢复管理：自动备份、加密备份、手动恢复。

## 内部结构
```
backup/
├── routes.ts                          # 模块路由配置
├── pages/
│   └── BackupSettings.tsx             # 备份管理（从 Settings 页面拆分）
├── api.ts                             # API 类型与调用
├── index.ts
└── README.md
```

## 对应后端
- `modules/backup/` — 备份服务（含 crypto, storage, types）
- API 前缀: `/api/backups`
