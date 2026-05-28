# 附录A 环境变量参考手册


## 作者

**谭策** — 独立开发者 | AIOps 领域探索者

- 🌐 项目官网：[ITOpsAgentinfo](https://www.zjzwfw.cloud/ITOpsAgentinfo)
- 📝 博客：[zjzwfw.cloud](https://www.zjzwfw.cloud/)
- 📧 邮箱：<huawei_network@foxmail.com>
- 💬 微信公众号：**IT Online**

<p align="left">
  <img src="./frontend/public/wechaterweima.png" width="200" alt="IT Online 微信公众号">
</p>

## 许可证

[MPL-2.0](../../LICENSE) © 谭策



## A.1 概述

本手册列出 ITOps Agent Platform 项目中使用的所有环境变量，包括后端服务配置、AI 模型配置、Docker 部署配置以及可选扩展变量。所有环境变量通过 `.env` 文件（开发环境）或 `docker-compose.yml` 的 `environment` 块（生产环境）注入。

> **相关章节**: 第2章 环境准备与快速入门、第19章 Docker容器化与部署

## A.2 环境变量总览

### A.2.1 核心服务变量

| 变量名 | 类型 | 默认值 | 是否必需 | 说明 |
|--------|------|--------|----------|------|
| `NODE_ENV` | string | `development` | 否 | 运行环境，可选值：`development`、`production`、`test`。生产环境下会启用更严格的安全校验 |
| `PORT` | number | `3001` | 否 | 后端服务监听端口 |
| `HOST` | string | `0.0.0.0` | 否 | 后端服务监听地址，Docker 容器中必须设为 `0.0.0.0` |
| `DATABASE_PATH` | string | `./data/app.db` | 否 | SQLite 数据库文件路径，Docker 容器中通常设为 `/app/data/app.db` |
| `JWT_SECRET` | string | （自动生成） | **生产环境必需** | JWT 签名密钥。开发环境不设置时会自动生成随机密钥（重启后失效），**生产环境必须设置强密钥** |
| `JWT_EXPIRES_IN` | string | `24h` | 否 | Access Token 过期时间，支持 `ms`、`s`、`m`、`h`、`d` 单位 |
| `ALLOWED_ORIGINS` | string | `http://localhost:3000` | 否 | 允许的跨域来源，多个地址用逗号分隔 |
| `LOG_LEVEL` | string | `info` | 否 | 日志级别，可选值：`error`、`warn`、`info`、`debug` |
| `ADMIN_INITIAL_PASSWORD` | string | 空（默认 admin） | 否 | 管理员初始密码，仅在首次部署时使用，留空则使用 'admin' |

### A.2.2 AI 模型变量

| 变量名 | 类型 | 默认值 | 是否必需 | 说明 |
|--------|------|--------|----------|------|
| `DOUBAO_API_KEY` | string | 空 | 否 | 豆包（火山引擎）API 密钥。设置后启用豆包模型 |
| `DOUBAO_API_BASE` | string | `https://ark.cn-beijing.volces.com/api/v3` | 否 | 豆包 API 基础地址 |
| `DOUBAO_MODEL` | string | `doubao-4o` | 否 | 豆包模型名称 |
| `OPENAI_API_KEY` | string | 空 | 否 | OpenAI API 密钥。设置后启用 OpenAI 模型 |
| `OPENAI_API_BASE` | string | `https://api.openai.com/v1` | 否 | OpenAI API 基础地址，可替换为兼容 OpenAI 接口的第三方服务 |
| `OPENAI_MODEL` | string | `gpt-4o` | 否 | OpenAI 模型名称 |
| `LOCAL_AI_API_KEY` | string | 空 | 否 | 本地 AI 服务 API 密钥（如 Ollama） |
| `LOCAL_AI_API_BASE` | string | 空 | 否 | 本地 AI 服务地址，如 `http://host.docker.internal:11434/v1` |
| `LOCAL_AI_MODEL` | string | 空 | 否 | 本地 AI 模型名称，如 `qwen2.5:7b` |

### A.2.3 通知与告警变量

| 变量名 | 类型 | 默认值 | 是否必需 | 说明 |
|--------|------|--------|----------|------|
| `WEBHOOK_VERIFY_ENABLED` | boolean | `false` | 否 | 是否启用 Webhook 签名验证（HMAC-SHA256） |
| `WEBHOOK_SECRET` | string | 空 | 否 | Webhook 签名验证密钥，启用验证时必须设置 |
| `WEBHOOK_IP_WHITELIST` | string | 空 | 否 | Webhook IP 白名单，逗号分隔多个 IP，空表示允许所有 |
| `ALERT_WEBHOOK_URL` | string | 空 | 否 | 默认告警 Webhook 通知地址 |
| `ALERT_EMAIL_HOST` | string | 空 | 否 | SMTP 邮件服务器地址 |
| `ALERT_EMAIL_PORT` | number | `587` | 否 | SMTP 邮件服务器端口 |
| `ALERT_EMAIL_USER` | string | 空 | 否 | SMTP 邮件登录用户名 |
| `ALERT_EMAIL_PASS` | string | 空 | 否 | SMTP 邮件登录密码 |
| `ALERT_EMAIL_TO` | string | 空 | 否 | 告警邮件接收地址 |

## A.3 配置文件示例

### A.3.1 开发环境 `.env`

```env
# Server Configuration
NODE_ENV=development
PORT=3001
DATABASE_PATH=./data/app.db

# AI API Configuration
# Leave empty if not configured
DOUBAO_API_KEY=
DOUBAO_API_BASE=https://ark.cn-beijing.volces.com/api/v3
DOUBAO_MODEL=doubao-4o
OPENAI_API_KEY=
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:80,http://localhost:8080

# Logging
LOG_LEVEL=info

# Security
JWT_SECRET=your-development-secret-change-me-in-production

# Administrator Initial Password (only used on first deployment)
ADMIN_INITIAL_PASSWORD=
```

### A.3.2 生产环境 `.env.production`

```env
# Server Configuration
NODE_ENV=production
PORT=3001
DATABASE_PATH=/app/data/app.db

# Security - MUST set strong values in production
JWT_SECRET=<使用 openssl rand -hex 32 生成的强密钥>
ADMIN_INITIAL_PASSWORD=<部署脚本自动生成的随机密码>
WEBHOOK_VERIFY_ENABLED=true
WEBHOOK_SECRET=<your-webhook-hmac-secret>
WEBHOOK_IP_WHITELIST=192.168.1.100,10.0.0.50

# AI API Configuration
DOUBAO_API_KEY=<your-actual-doubao-api-key>
DOUBAO_API_BASE=https://ark.cn-beijing.volces.com/api/v3
DOUBAO_MODEL=doubao-4o

# CORS - 仅允许实际使用的前端地址
ALLOWED_ORIGINS=https://your-domain.com,https://itops.your-domain.com

# Logging
LOG_LEVEL=warn

# Notification (optional)
ALERT_WEBHOOK_URL=https://hooks.example.com/alerts
```

## A.4 Docker 部署环境变量

### A.4.1 docker-compose.yml 注入方式

在 `docker-compose.yml` 中，环境变量通过 `${VAR:-default}` 语法从宿主机 `.env` 文件读取并注入容器：

```yaml
environment:
  - NODE_ENV=production
  - PORT=3001
  - HOST=0.0.0.0
  - DATABASE_PATH=/app/data/app.db
  - JWT_SECRET=${JWT_SECRET:?JWT_SECRET must be set for production deployment}
  - DOUBAO_API_KEY=${DOUBAO_API_KEY:-}
  - DOUBAO_API_BASE=${DOUBAO_API_BASE:-https://ark.cn-beijing.volces.com/api/v3}
  - DOUBAO_MODEL=${DOUBAO_MODEL:-doubao-4o}
  - OPENAI_API_KEY=${OPENAI_API_KEY:-}
  - OPENAI_API_BASE=${OPENAI_API_BASE:-https://api.openai.com/v1}
  - OPENAI_MODEL=${OPENAI_MODEL:-gpt-4o}
  - ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-http://localhost:80,http://localhost:3000}
```

### A.4.2 变量语法说明

| 语法 | 说明 | 示例 |
|------|------|------|
| `${VAR:-default}` | 如果 VAR 未设置则使用默认值 | `${PORT:-3001}` |
| `${VAR:?error_msg}` | 如果 VAR 未设置则报错终止 | `${JWT_SECRET:?must be set}` |
| `${VAR}` | 直接使用变量值，未设置则为空 | `${DOUBAO_API_KEY}` |

## A.5 安全注意事项

### A.5.1 敏感变量清单

以下变量包含敏感信息，**绝不**应提交到版本控制系统：

- `JWT_SECRET` — JWT 签名密钥
- `DOUBAO_API_KEY` — 豆包 API 密钥
- `OPENAI_API_KEY` — OpenAI API 密钥
- `LOCAL_AI_API_KEY` — 本地 AI 密钥
- `WEBHOOK_SECRET` — Webhook 签名密钥
- `ALERT_EMAIL_PASS` — SMTP 密码
- `ADMIN_INITIAL_PASSWORD` — 管理员初始密码

### A.5.2 安全最佳实践

1. **生产环境 JWT_SECRET**：使用 `openssl rand -hex 32` 生成至少 64 字符的随机密钥
2. **环境变量文件**：确保 `.env` 已加入 `.gitignore`
3. **Docker Secret**：生产环境建议使用 Docker Secrets 或外部密钥管理服务
4. **密钥轮换**：定期更换 JWT_SECRET，更换后所有已签发 Token 将失效
5. **API 密钥最小权限**：AI 服务商的 API Key 应设置配额和使用限制

## A.6 环境变量优先级

环境变量按以下优先级加载（从高到低）：

1. **进程环境变量** — 通过命令行直接设置 `NODE_ENV=production node dist/app.js`
2. **Docker Compose environment** — `docker-compose.yml` 中定义的 `environment` 块
3. **.env 文件** — 项目根目录的 `.env` 文件（通过 `dotenv` 加载）
4. **代码默认值** — `env.ts` 中定义的 `defaultValue`

## A.7 故障排查

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| 启动报错 `Missing required environment variable: JWT_SECRET` | 生产环境未设置 JWT_SECRET | 在 `.env` 中设置强密钥 |
| 跨域请求被拒绝 | `ALLOWED_ORIGINS` 未包含前端地址 | 添加前端地址到逗号分隔列表 |
| AI 功能不可用 | 未配置任何 AI 服务的 API Key | 至少配置 `DOUBAO_API_KEY` 或 `OPENAI_API_KEY` |
| 数据库文件找不到 | `DATABASE_PATH` 路径不正确或无写入权限 | 检查路径并确保目录存在且有写权限 |
| 容器启动后立即退出 | `HOST` 未设为 `0.0.0.0` | 设置 `HOST=0.0.0.0` |
