# 通知模块（前端）

## 职责
通知管理：通知记录查看、通知渠道配置（企业微信、飞书、钉钉、Telegram、Email、Webhook）。

## 内部结构
```
notification/
├── routes.ts                             # 模块路由
├── api.ts                                # API 类型定义与调用
├── pages/
│   ├── Notifications.tsx                 # 通知记录列表
│   └── NotificationSettings.tsx          # 通知渠道配置
└── index.ts
```

## 对应后端
`backend/src/modules/notification/`