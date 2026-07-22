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
│   └── NotificationSettings.tsx          # 通知渠道配置（v2.26 拆分后精简主入口 133 行）
│       └── notification-settings/         # 通知设置子模块（v2.26 新建）
│           ├── types.ts                          # NotificationConfig + DEFAULT_CONFIG（68）
│           ├── useNotificationSettings.ts        # 6 state + 1 query + 1 mutation + 2 handler（193）
│           ├── helpers.ts                        # mergeNotificationConfig deep merge（44）
│           ├── ToggleSwitch.tsx                  # iOS 风开关复用组件（30）
│           ├── WebhookChannelSection.tsx         # Webhook 渠道 section（44）
│           ├── EmailChannelSection.tsx           # 邮件 SMTP 渠道 section（149）
│           ├── WechatChannelSection.tsx          # 企业微信渠道 section（89）
│           ├── DingtalkChannelSection.tsx        # 钉钉渠道 section（89）
│           ├── NotificationRulesSection.tsx      # 告警 + 任务规则 section（113）
│           └── index.ts                          # barrel（37）
└── index.ts
```

## 对应后端
`backend/src/modules/notification/`

## 刷新记录
- **2026-07-22**：核对 v2.26 拆分后的 NotificationSettings 子模块结构