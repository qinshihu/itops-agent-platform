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

## 对应后端
`backend/src/modules/backup/`