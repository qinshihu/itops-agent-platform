# ITOPS Agent Platform - 部署操作手册

## 项目概述

ITOps Agent Platform 是一个基于 AI 的智能运维平台，采用前后端分离架构：

| 模块 | 技术栈 | 端口 | 说明 |
|------|--------|------|------|
| 后端 | Node.js 18+ + Express + TypeScript + SQLite | 3001 | REST API + WebSocket |
| 前端 | React 18 + TypeScript + Vite + TailwindCSS | 80 (Nginx) | SPA 单页应用 |
| 反向代理 | Nginx (Alpine) | 8080 → 80 | 前端静态文件 + /api 代理 |

---

## 1. 环境要求

| 工具 | 最低版本 | 说明 |
|------|---------|------|
| Docker | 20.10+ | 容器运行时 |
| Docker Compose | v2.0+ | 编排工具 (或 `docker compose` v2) |
| Git | 2.0+ | 源码管理（可选） |

> **注意**: Windows/macOS 用户安装 Docker Desktop 即可（已包含 Docker + Compose）。Linux 用户需单独安装 docker-compose-plugin。

### 硬件要求
- CPU: 2核以上
- 内存: 4GB以上
- 磁盘: 20GB以上可用空间

---

## 2. 快速部署（推荐 5 分钟搞定）

### 2.1 一键脚本部署

适用于大多数场景，脚本自动完成环境检查、配置生成、镜像拉取、服务启动：

**Linux/macOS**:
```bash
curl -sL https://gitee.com/IT_Oline/itops-agent-platform/raw/main/deploy.sh -o deploy.sh && chmod +x deploy.sh && ./deploy.sh
```

**Windows (PowerShell)**:
```powershell
Invoke-WebRequest -Uri "https://gitee.com/IT_Oline/itops-agent-platform/raw/main/deploy.ps1" -OutFile "deploy.ps1"
.\deploy.ps1
```

> 💡 脚本支持 `-y` 参数自动确认所有提示：`./deploy.sh -y`

### 2.2 访问应用

部署完成后访问：
- **前端界面**: `http://<服务器IP>:8080`
- **后端健康检查**: `http://<服务器IP>:3001/health`

**默认管理员账号**:
- 用户名: `admin`
- 密码: `admin`

> ⚠️ **首次登录后系统会强制要求修改密码，请务必及时修改！**

---

## 3. Docker Compose 手动部署

### 3.1 克隆项目

```bash
git clone <your-repo-url>
cd ai
```

### 3.2 配置环境变量

项目根目录的 `.env` 文件会被 Docker Compose 自动读取。**请务必修改 JWT_SECRET**：

```bash
# 复制示例文件
cp .env.example .env
```

编辑 `.env`，重点配置：

```env
# 【必须修改】生产环境使用强随机密钥
JWT_SECRET=your-production-secret-change-me

# AI 模型配置（部署后也可在网页设置）
DOUBAO_API_KEY=your-doubao-api-key
OPENAI_API_KEY=your-openai-api-key
```

> 💡 生成强随机密钥：`openssl rand -hex 32`

### 3.3 启动服务

```bash
# 使用预构建镜像启动（推荐，速度快）
docker compose up -d

# 或本地源码构建启动
docker compose up -d --build
```

### 3.4 验证部署

```bash
# 查看容器状态（两个都应显示 Up）
docker compose ps

# 检查后端健康
curl http://localhost:3001/health
# 预期输出: {"status":"healthy","timestamp":"..."}

# 检查前端
curl -I http://localhost:8080
# 预期输出: HTTP/1.1 200 OK
```

### 3.5 查看日志

```bash
# 查看所有服务实时日志
docker compose logs -f

# 只看后端日志
docker compose logs -f backend

# 只看前端日志
docker compose logs -f frontend

# 查看最近 100 行
docker compose logs --tail=100
```

### 3.6 停止服务

```bash
# 停止服务（保留数据）
docker compose down

# 停止并删除数据卷（⚠️ 会清空数据库，慎用！）
docker compose down -v
```

---

## 4. 本地开发部署

### 4.1 安装依赖

```bash
# 使用根目录脚本一键安装所有依赖
npm run install:all

# 或分别安装
cd backend && npm install
cd ../frontend && npm install
```

### 4.2 配置环境变量

```bash
cd backend
cp .env.example .env
# 编辑 .env 文件
```

### 4.3 启动开发服务

```bash
# 同时启动前后端（根目录执行）
npm run dev

# 或分别启动
# 后端（端口 3001）
cd backend && npm run dev

# 前端（端口 5173，新终端）
cd frontend && npm run dev
```

### 4.4 访问

- **前端开发环境**: `http://localhost:5173`
- **后端 API**: `http://localhost:3001`
- **健康检查**: `http://localhost:3001/health`

---

## 5. 环境变量配置说明

| 变量名 | 说明 | 默认值 | 必填 |
|--------|------|--------|------|
| `NODE_ENV` | 运行环境 | production | 否 |
| `PORT` | 后端端口 | 3001 | 否 |
| `DATABASE_PATH` | 数据库路径 | ./data/app.db | 否 |
| `JWT_SECRET` | JWT 签名密钥（生产环境必须修改） | 开发环境自动生成 | 是（生产） |
| `JWT_EXPIRES_IN` | Access Token 有效期 | 24h | 否 |
| `ADMIN_INITIAL_PASSWORD` | 管理员初始密码（首次部署时生效） | 空（默认 admin） | 否 |
| `DOUBAO_API_KEY` | 豆包 API 密钥 | - | 否 |
| `DOUBAO_API_BASE` | 豆包 API 地址 | https://ark.cn-beijing.volces.com/api/v3 | 否 |
| `DOUBAO_MODEL` | 豆包模型名称 | doubao-4o | 否 |
| `OPENAI_API_KEY` | OpenAI API 密钥 | - | 否 |
| `OPENAI_API_BASE` | OpenAI API 地址 | https://api.openai.com/v1 | 否 |
| `OPENAI_MODEL` | OpenAI 模型名称 | gpt-4o | 否 |
| `LOCAL_AI_API_BASE` | 本地 AI API 地址（Ollama 等） | - | 否 |
| `LOCAL_AI_MODEL` | 本地 AI 模型名称 | - | 否 |
| `ALLOWED_ORIGINS` | CORS 允许源列表（逗号分隔） | http://localhost,http://localhost:3000,http://localhost:8080 | 否 |
| `WEBHOOK_VERIFY_ENABLED` | 是否启用 Webhook 签名验证（生产环境建议开启） | false | 否 |
| `WEBHOOK_SECRET` | Webhook 签名密钥（启用签名验证时必须设置） | - | 否 |
| `WEBHOOK_IP_WHITELIST` | Webhook IP 白名单（逗号分隔，空为允许所有 IP） | - | 否 |
| `LOG_LEVEL` | 日志级别（debug/info/warn/error） | info | 否 |

> 💡 **AI 模型配置无需在 `.env` 中配置**：登录后可直接在 Web 页面 `设置 → AI 配置` 中配置，保存到数据库，重启不丢失。

### 5.1 安全配置最佳实践

#### 🔐 登录安全
- **强制密码修改**：首次登录系统会强制要求修改默认密码 `admin`
- **密码复杂度**：新密码必须满足至少 8 位，包含大小写字母、数字和特殊字符
- **登录锁定**：连续 5 次登录失败后，账户将被锁定 30 分钟（管理员可在用户管理中手动解锁）

#### 🌐 Webhook 安全配置（推荐）

生产环境建议同时启用以下两项安全措施：

**1. IP 白名单**
```env
# 只允许 Prometheus 服务器和 Zabbix 服务器发送告警
WEBHOOK_IP_WHITELIST=192.168.1.100,192.168.1.101
```

**2. 签名验证**
```env
WEBHOOK_VERIFY_ENABLED=true
WEBHOOK_SECRET=your-strong-random-secret-here
```

生成安全密钥：
```bash
openssl rand -hex 32
```

在告警源（Prometheus/Zabbix）中配置相同的 secret 和签名算法（HMAC-SHA256）。

---

## 6. 端口配置说明

| 端口 | 服务 | 说明 |
|------|------|------|
| 8080 | 前端 | Nginx 代理，对外暴露 |
| 3001 | 后端 API | Express 服务，开发/调试时对外暴露 |

> 🔒 **生产环境最佳实践**：
> - 8080 端口对外开放（或映射为 80/443）
> - 3001 端口仅内网访问，不直接对外暴露
> - 使用反向代理处理 HTTPS 和负载均衡

---

## 7. 数据持久化与备份

### 7.1 Docker 数据卷

系统使用 Docker volume 持久化数据：
- `app-data`: 存储 SQLite 数据库文件

### 7.2 备份数据库

```bash
# 1. 停止服务（可选，建议备份时停止）
docker compose down

# 2. 备份数据卷
docker run --rm -v itops-agent-platform_app-data:/data -v $(pwd):/backup alpine tar czf /backup/itops-data-backup-$(date +%Y%m%d).tar.gz -C /data .

# 3. 重启服务
docker compose up -d
```

### 7.3 恢复数据库

```bash
# 1. 停止服务
docker compose down

# 2. 恢复数据卷
docker run --rm -v itops-agent-platform_app-data:/data -v $(pwd):/backup alpine tar xzf /backup/itops-data-backup-20240101.tar.gz -C /data

# 3. 重启服务
docker compose up -d
```

### 7.4 自动备份建议

生产环境建议配置定时任务（crontab）自动备份：

```bash
# 每天凌晨 2 点备份
0 2 * * * /path/to/backup-script.sh
```

---

## 8. 安全配置

### 8.1 修改默认密码

首次登录后系统会强制修改默认密码：
- 用户名: `admin`
- 初始密码: `admin`

### 8.2 配置 HTTPS

生产环境必须使用 HTTPS，建议配置 Nginx 反向代理处理 SSL：

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;

    # 代理到前端 8080 端口
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 8.3 防火墙配置

```bash
# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --permanent --add-port=3001/tcp  # 仅调试需要
sudo firewall-cmd --reload

# Ubuntu (ufw)
sudo ufw allow 8080/tcp
sudo ufw allow 3001/tcp  # 仅调试需要
sudo ufw reload
```

### 8.4 Webhook 签名验证（生产环境必须）

> ⚠️ **严重安全警告**：如果不启用 Webhook 签名验证，任何知道 Webhook URL 的人都可以向系统发送伪造告警，可能导致恶意工作流触发、虚假告警恢复或拒绝服务攻击。

**启用步骤**:

1. 生成签名密钥：
```bash
openssl rand -hex 32
```

2. 在 `.env` 中配置：
```env
# Webhook 签名验证（生产环境必须启用）
WEBHOOK_VERIFY_ENABLED=true
WEBHOOK_SECRET=<上面生成的密钥>
```

3. 在告警源（Zabbix/Prometheus/Grafana 等）配置相同的 Secret，并在发送请求时计算 HMAC-SHA256 签名，添加到对应 Header：

| 告警源 | Header 名称 |
|--------|-------------|
| Zabbix | `X-Webhook-Signature-zabbix` |
| Prometheus | `X-Webhook-Signature-prometheus` |
| Grafana | `X-Webhook-Signature-grafana` |
| 阿里云 | `X-Webhook-Signature-aliyun` |
| 腾讯云 | `X-Webhook-Signature-tencent` |
| 通用 | `X-Webhook-Signature-generic` |

> 💡 详细配置指南请参考：[Zabbix Webhook 安全配置文档](./docs/ZABBIX_CONFIG.md)

---

## 9. 更新部署

### 9.1 拉取最新代码并更新

```bash
# 1. 拉取最新代码
git pull

# 2. 拉取最新镜像并重启
docker compose pull
docker compose up -d

# 或本地重新构建
docker compose up -d --build
```

### 9.2 数据库迁移

系统会自动处理数据库迁移，无需手动操作。

---

## 10. 故障排查

### 10.1 容器无法启动

```bash
# 查看启动日志
docker compose logs backend
docker compose logs frontend

# 检查端口占用
netstat -tulpn | grep -E ':(3001|8080)'

# 检查 Docker 服务状态
sudo systemctl status docker
```

### 10.2 数据库问题

```bash
# 检查数据卷
docker volume ls

# 删除旧数据卷（⚠️ 会丢失所有数据！）
docker volume rm itops-agent-platform_app-data
```

### 10.3 WebSocket 连接失败

- 检查防火墙设置
- 确认 `ALLOWED_ORIGINS` 配置包含实际访问域名
- 检查 Nginx 的 WebSocket 代理配置

### 10.4 SSH 连接失败

- 确认目标服务器 SSH 服务运行
- 检查网络连通性和防火墙
- 验证认证信息（用户名/密码或密钥）
- 查看后端日志

### 10.5 前端页面空白

1. 确认后端健康检查通过：`curl http://localhost:3001/health`
2. 检查浏览器控制台 Network 面板，看 `/api/` 请求是否 200
3. 如果 API 请求 502，说明前端连不上后端，检查网络配置

---

## 11. 生产环境最佳实践

### 11.1 高可用配置

- 多实例部署 + 负载均衡
- 数据库主从复制（SQLite 可考虑替换为 PostgreSQL）
- 异地备份策略

### 11.2 监控告警

- 集成 Prometheus + Grafana 监控服务状态
- 监控容器资源使用情况
- 设置告警通知渠道（邮件/企业微信/钉钉）

### 11.3 日志管理

- 使用 ELK Stack 或 Loki 聚合日志
- 配置日志轮转和保留策略
- 定期审计错误日志

### 11.4 资源限制

生产环境 docker-compose.yml 已配置资源限制：
- 后端: 2 CPU / 2GB 内存
- 前端: 1 CPU / 512MB 内存

可根据实际服务器配置调整。

---

## 12. 常用命令速查

| 命令 | 说明 |
|------|------|
| `docker compose up -d` | 启动服务 |
| `docker compose up -d --build` | 重新构建并启动 |
| `docker compose down` | 停止服务 |
| `docker compose down -v` | 停止并删除数据（⚠️ 危险） |
| `docker compose ps` | 查看服务状态 |
| `docker compose logs -f` | 查看实时日志 |
| `docker compose logs -f backend` | 查看后端日志 |
| `docker compose restart` | 重启所有服务 |
| `docker compose pull` | 拉取最新镜像 |
| `docker stats` | 查看容器资源使用 |

---

## 📚 相关文档

- [项目 README](./README.md) — 项目总览和功能介绍
- [快速部署指南](./QUICK_DEPLOY.md) — 更简化的部署步骤
- [开发指南](./docs/DEVELOPMENT.md) — 本地开发环境搭建
- [生产环境最佳实践](./docs/PRODUCTION.md) — 生产环境配置建议
- [API 文档](./docs/API.md) — 完整的 API 接口文档
- [架构设计](./docs/ARCHITECTURE.md) — 系统架构说明
- [Zabbix 集成配置](./docs/ZABBIX_CONFIG.md) — 告警集成详细说明
- [Web SSH 终端技术文档](./WEB_TERMINAL.md) — 远程终端功能说明

---

## 🆘 获取帮助

如遇问题：
1. 查看项目 Issue 列表
2. 参考故障排查章节
3. 查看容器日志诊断问题
4. 提交 Issue 时请附上：系统环境、Docker 版本、错误日志
