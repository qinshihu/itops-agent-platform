# Notification 模块

> **DDD 限界上下文**：通知发送与渠道管理（飞书/企业微信/钉钉/Telegram/Email/Webhook）
> **聚合根**：`Notification`、`NotificationChannel`
> **最后刷新**：2026-07-22（基于代码实测全面核对）

---

## 一、职责

- **通知发送**：多通道适配（飞书、企业微信、钉钉、Telegram、Email、Webhook）
- **通知历史**：增删改查、统计、标记已发送
- **渠道配置**：各通道独立配置（webhook URL / SMTP 凭据 / Bot Token）
- **配置测试**：单通道连通性测试（`POST /notification-config/test/:channel`）
- **被多模块调用**：`alerts/`、`workflow/`、`auto/`、`mcp/` 完成后通过 `createNotification()` 或 `notificationService.sendXxx()` 派发

## 二、路由端点（受保护）

`notification/routes.ts` 行为：
```ts
router.use('/notifications', notificationRoutes);
router.use('/notification-config', notificationConfigRoutes);
```

| 路径 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/notifications/` | GET | 受保护 | 列表（page/limit/type/status/start_date/end_date 过滤） |
| `/notifications/:id/send` | PUT | 受保护 | 标记为已发送 |
| `/notifications/:id` | DELETE | 受保护 | 删除 |
| `/notifications/stats/summary` | GET | 受保护 | 统计（typeStats / pendingCount / todaySent） |
| `/notification-config/` | GET | admin | 当前渠道配置（凭据脱敏） |
| `/notification-config/test/:channel` | POST | admin | 单通道测试（不发真实消息） |
| `/notification-config/` | PUT | admin | 保存配置（多通道嵌套对象） |

## 三、内部结构（2026-07-22 实测）

```
notification/
├── routes.ts                          # 模块路由聚合（notifications + notification-config）
├── index.ts                           # 导出 routes + 工具函数 (sendFeishu / sendWeCom / sendDingTalk / sendTelegram / sendNotification)
├── routes/
│   ├── notificationRoutes.ts          # 通知记录 CRUD + createNotification
│   └── notificationConfigRoutes.ts    # 通知渠道配置 + 测试
├── services/                          # 7 个业务文件（5 服务 + 2 测试）
│   ├── notificationService.ts            ← 通知发送核心（多通道 + 历史管理 + init 注册）
│   ├── notificationService.test.ts       ← 1 个测试文件
│   ├── notificationCrudService.ts        ← 通知 CRUD routes 抽象（ADR-016）
│   ├── notificationConfigService.ts      ← 渠道配置 CRUD routes 抽象
│   ├── notificationChannelTestService.ts ← 渠道测试（不发真实消息，验证凭据）
│   ├── notificationChannels.ts           ← 通道适配器（飞书/企业微信/钉钉/Telegram/Webhook）
│   └── notificationChannels.test.ts      ← 1 个测试文件
└── README.md
```

## 四、依赖关系

- **仓储层**：`repositories/infraRepository`（`notificationsRepo` + `infraRepositoryTypes`）
- **认证**：`middleware/auth` 的 `requireRole('admin')` 控制配置写入
- **凭据**：`modules/auth/services/credentialService`（SMTP 密码加解密）
- **依赖方向**：被 `workflow/`、`alerts/`、`auto/`、`mcp/` 调用（`notificationService` 在 `serviceRegistry.ts` 注册）

## 五、被依赖

- `serviceRegistry.ts`：服务初始化
- `modules/workflow/`：工作流执行完成后发送通知
- `modules/alerts/`：告警触发 + 通知分发
- `modules/auto/`：自动修复执行完成后发送通知
- 前端 `frontend/src/modules/notification/`（Notifications + NotificationSettings）

## 六、关键说明

- **6 通道适配器**：`sendFeishu()` / `sendWeCom()` / `sendDingTalk()` / `sendTelegram()` + `sendNotification()` 多通道分发（Email/Webhook 走此入口）
- **凭据加密**：SMTP 密码走 `credentialService` 加解密
- **测试通道**：`notificationChannelTestService.testNotificationChannel(channel, body)` 提供"验证配置但不发送真实消息"的端点
- **`createNotification(data)`**：从 notificationService 导出的通用发送入口，其他模块按需调用
- **CHANNEL_NAMES**：通道名映射常量（飞书/企微/钉钉/Telegram/Email/Webhook）
- **测试覆盖**：2 个测试文件（`notificationService` + `notificationChannels`），是较完整的模块之一

## 七、通道矩阵

| 通道 | 适配函数 | 典型配置 |
|------|---------|---------|
| 飞书 | `sendFeishu(url, msg)` | webhook URL |
| 企业微信 | `sendWeCom(url, msg)` | webhook URL |
| 钉钉 | `sendDingTalk(url, msg, secret?)` | webhook URL + 可选 secret |
| Telegram | `sendTelegram(botToken, chatId, msg)` | Bot Token + Chat ID |
| Email / Webhook | `sendNotification(config, msg)` | SMTP 凭据 / 自定义 POST URL |
