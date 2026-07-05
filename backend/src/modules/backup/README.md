# Backup 模块

## 职责
数据库备份与恢复：自动备份、手动备份、加密备份、备份恢复。

## 内部结构
```
backup/
├── routes.ts                  # 模块路由聚合
├── routes/
│   └── backupRoutes.ts        # 备份管理 API
├── services/
│   ├── index.ts               # BackupService 主类
│   ├── backupTypes.ts         # 类型定义
│   ├── backupCrypto.ts        # 加密/解密/压缩
│   └── backupStorage.ts       # 备份存储与恢复
├── index.ts
└── README.md
```

## 依赖
- `utils/logger` — 日志
- `utils/env` — 环境配置
- `repositories/` — 数据库仓储
- `modules/infra/services/restartService` — 恢复后重启（注册关闭钩子）

## 被依赖
- `serviceRegistry.ts` — 服务初始化注册
- `modules/infra/services/restartService` — 优雅关闭时停止自动备份
