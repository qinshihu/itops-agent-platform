# Security Policy

## Supported Versions

The following versions of ITOps Agent Platform are currently supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| 3.0.x   | :white_check_mark: |
| < 3.0   | :x:                |

## Reporting a Vulnerability

We take the security of ITOps Agent Platform seriously. If you discover a security vulnerability, please follow these steps:

### 1. **DO NOT** create a public GitHub issue

Public disclosure of security vulnerabilities could put users at risk before a fix is available.

### 2. Send a detailed report

Email us at <huawei_network@foxmail.com> with:

- A description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Any suggested fixes (if you have them)

### 3. What to expect

- **Acknowledgment**: We will acknowledge receipt of your report within 48 hours
- **Assessment**: We will assess the vulnerability and determine its impact
- **Fix Timeline**: We aim to release a fix within 30 days for critical vulnerabilities
- **Credit**: We will credit you in the release notes (unless you prefer to remain anonymous)

## Security Best Practices for Users

### Production Deployment

When deploying ITOps Agent Platform in production, please ensure:

1. **JWT Secret**: The platform uses a 3-tier JWT secret resolution strategy:
   - **Priority 1**: `JWT_SECRET` environment variable (highest priority, set this for production)
   - **Priority 2**: Persisted file `data/.jwt-secret` (auto-generated on first run, survives restarts)
   - **Priority 3**: Auto-generated random secret (first boot, saved to file for subsequent boots)
   - For production, always set a strong `JWT_SECRET` environment variable (64+ chars recommended)

2. **Inbound Webhook Security**: For alert webhook endpoints (receiving alerts from external systems):
   - Set `WEBHOOK_VERIFY_ENABLED=true` to enforce signature verification
   - Set `WEBHOOK_SECRET` to a strong secret key shared with your alerting system
   - Three modes available: `true` (enforce), `warn` (log but allow), `false` (disable)

3. **Outbound Notification Channels**: Configure via Web UI (Settings → Notifications):
   - Webhook, Email, WeChat Work, DingTalk, Telegram channels
   - All notification credentials are stored in the database with encryption

4. **Password Policy**: Change the default admin password immediately after first login

5. **HTTPS**: Use HTTPS in production with proper TLS certificates (e.g., behind a reverse proxy like Nginx)

6. **Network Isolation**: Run the application in a private network when possible

7. **Regular Updates**: Keep the application updated to the latest version

### Known Security Features

The platform includes the following security measures:

- **AES-256-GCM Encryption**: Server passwords, SSH keys, and notification credentials are encrypted at rest
- **JWT Authentication**: Access token + refresh token dual mechanism with automatic token refresh and blacklist
- **Login Throttling**: Account lockout after 5 failed login attempts (30 minute lockout)
- **Rate Limiting**: API endpoints are rate-limited to prevent abuse
- **Audit Logging**: All operations are logged for traceability
- **Input Validation**: Request validation using Zod schemas on all API endpoints
- **XSS Protection**: Frontend sanitizes user input and HTML output (DOMPurify)
- **CORS Control**: Configurable allowed origins via `ALLOWED_ORIGINS` environment variable
- **Webhook Signature Verification**: HMAC-based signature verification for inbound alert webhooks
- **Placeholder Secret Detection**: Rejects known placeholder secrets for JWT and webhook configs

## Security Advisories

Security advisories will be published on the [GitHub Security Advisories](https://github.com/qinshihu/itops-agent-platform/security/advisories) page.

---

# 安全政策

## 支持的版本

以下版本的 ITOps Agent Platform 目前支持安全更新：

| 版本  | 支持状态  |
| ----- | --------- |
| 3.0.x | ✅ 支持   |
| < 3.0 | ❌ 不支持 |

## 报告漏洞

我们非常重视 ITOps Agent Platform 的安全性。如果您发现了安全漏洞，请按照以下步骤操作：

### 1. **不要**创建公开的 GitHub Issue

公开披露安全漏洞可能会在修复方案可用之前将用户置于风险之中。

### 2. 发送详细报告

发送邮件至 <huawei_network@foxmail.com>，请包含：

- 漏洞描述
- 复现步骤
- 潜在影响评估
- 任何建议的修复方案（如果有的话）

### 3. 您可以期待

- **确认回复**：我们将在 48 小时内确认收到您的报告
- **漏洞评估**：我们将评估漏洞并确定其影响
- **修复时间**：对于严重漏洞，我们力争在 30 天内发布修复
- **致谢**：我们将在发行说明中致谢（除非您希望保持匿名）

## 用户安全最佳实践

### 生产环境部署

在生产环境中部署 ITOps Agent Platform 时，请确保：

1. **JWT 密钥**：平台采用三级 JWT 密钥解析策略：
   - **优先级 1**：`JWT_SECRET` 环境变量（最高优先级，生产环境必须设置）
   - **优先级 2**：持久化文件 `data/.jwt-secret`（首次运行自动生成，重启后依然有效）
   - **优先级 3**：自动生成随机密钥（首次启动时生成并保存到文件，供后续启动使用）
   - 生产环境请务必设置强 `JWT_SECRET` 环境变量（建议 64 字符以上）

2. **入站 Webhook 安全**：针对告警 Webhook 端点（接收外部系统推送的告警）：
   - 设置 `WEBHOOK_VERIFY_ENABLED=true` 强制执行签名验证
   - 设置 `WEBHOOK_SECRET` 为与告警系统共享的强密钥
   - 三种模式：`true`（强制验证）、`warn`（记录日志但放行）、`false`（禁用）

3. **出站通知渠道**：通过 Web UI 配置（设置 → 通知）：
   - 支持 Webhook、邮件、企业微信、钉钉、Telegram 等渠道
   - 所有通知凭证加密存储在数据库中

4. **密码策略**：首次登录后立即修改默认管理员密码

5. **HTTPS**：生产环境使用 HTTPS 和正确的 TLS 证书（例如通过 Nginx 反向代理）

6. **网络隔离**：尽可能在私有网络中运行应用

7. **定期更新**：保持应用更新到最新版本

### 已知安全特性

平台包含以下安全措施：

- **AES-256-GCM 加密**：服务器密码、SSH 密钥和通知凭证均加密存储
- **JWT 认证**：Access Token + Refresh Token 双令牌机制，支持自动刷新和黑名单
- **登录节流**：连续 5 次登录失败后锁定账户（锁定 30 分钟）
- **速率限制**：API 端点有限速保护，防止滥用
- **审计日志**：所有操作均有日志记录，可追溯
- **输入校验**：所有 API 端点使用 Zod Schema 进行请求校验
- **XSS 防护**：前端使用 DOMPurify 对用户输入和 HTML 输出进行消毒
- **CORS 控制**：可通过 `ALLOWED_ORIGINS` 环境变量配置允许的来源
- **Webhook 签名验证**：入站告警 Webhook 使用基于 HMAC 的签名验证
- **占位密钥检测**：拒绝已知的占位符密钥（JWT 和 Webhook 配置）

## 安全公告

安全公告将发布在 [GitHub Security Advisories](https://github.com/qinshihu/itops-agent-platform/security/advisories) 页面。

---

Thank you for helping keep ITOps Agent Platform and its users safe!
感谢您帮助保护 ITOps Agent Platform 及其用户的安全！
