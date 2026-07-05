# Notification 模块

## 职责
通知发送与渠道管理：企业微信、飞书、钉钉、Telegram、Email、Webhook。

## 内部结构
```
notification/
├── routes.ts                        # 模块路由聚合（notifications + notification-config）
├── routes/
│   ├── notificationRoutes.ts        # 通知记录 CRUD + createNotification 函数
│   └── notificationConfigRoutes.ts  # 通知渠道配置管理
├── services/
│   ├── notificationService.ts       # 通知发送核心（多通道发送 + 历史管理）
│   └── notificationChannels.ts      # 渠道适配器（飞书/企业微信/钉钉/Telegram/Webhook）
├── index.ts
└── README.md
```

## 依赖
- `repositories/` — settingsRepository, infraRepository, notificationsRepo
- `middleware/auth` — requireRole
- `modules/auth/services/credentialService` — SMTP 凭据加解密
- `shared/websocket/io` — WebSocket 实时推送通知

## 被依赖
- `modules/workflow/` — 工作流执行完成后发送通知
- `modules/alerts/` — 告警触发时发送通知
- `modules/auto/` — 自动修复执行完成后发送通知
- `serviceRegistry.ts` — 服务初始化注册
