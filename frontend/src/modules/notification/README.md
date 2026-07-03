# Notification 模块

## 职责
通知发送记录查看与通知渠道配置管理（企业微信、飞书、钉钉、Telegram、Email、Webhook）。

## 内部结构
```
notification/
├── routes.ts                          # 模块路由配置
├── pages/
│   ├── Notifications.tsx              # 通知记录列表
│   └── NotificationSettings.tsx       # 通知渠道配置
├── api.ts                             # API 类型定义与调用
├── index.ts
└── README.md
```

## 对应后端
- `modules/notification/` — 通知发送服务 + 通知渠道管理
- API 前缀: `/api/notifications`, `/api/notification-config`
