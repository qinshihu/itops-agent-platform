# ITOPS Agent Platform - 快速部署指南

## 项目简介

ITOps Agent Platform 是一个基于 AI 的智能运维平台，支持：

- 告警噪声消除与根因分析
- 多 Agent 协作自动化运维
- 可视化工作流编排
- Web SSH 终端远程管理
- 主机资产管理与批量导入
- Zabbix 告警集成

---

## 方式一：一键部署（推荐）

适用于：Linux 服务器，已安装 Docker

```bash
curl -fsSL https://your-repo/deploy.sh | bash
```

脚本会自动完成：环境检查 → 生成配置 → 拉取镜像 → 启动服务 → 健康检查

---

## 方式二：手动部署

### 1. 安装 Docker

```bash
# CentOS/RHEL 7+
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://mirrors.aliyun.com/docker-ce/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io
sudo systemctl enable --now docker

# Ubuntu 20.04+
curl -fsSL https://get.docker.com | bash -s docker --mirror Aliyun
sudo systemctl enable --now docker
```

验证安装：

```bash
docker --version
docker compose version
```

### 2. 创建配置文件

```bash
mkdir -p /opt/itops && cd /opt/itops
```

创建 `.env` 文件：

```bash
# 先生成随机 JWT_SECRET
JWT_SECRET=$(openssl rand -base64 32)

# 写入 .env 文件
cat > .env << EOF
# JWT 签名密钥（必须修改，生成随机密钥）
JWT_SECRET=${JWT_SECRET}

# 后端端口
PORT=3001

# 运行环境
NODE_ENV=production

# CORS 白名单（添加你的服务器 IP 或域名）
ALLOWED_ORIGINS=http://localhost,http://你的服务器IP
EOF
```

创建 `docker-compose.yml` 文件：

```bash
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  backend:
    image: registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:IT_Onlin-ITOps-backend-latest
    container_name: itops-backend
    restart: unless-stopped
    ports:
      - "3001:3001"
    env_file: .env
    volumes:
      - app-data:/app/data
    networks:
      - itops-network
    healthcheck:
      test: ["CMD-SHELL", "node -e \"require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})\""]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  frontend:
    image: registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:IT_Onlin-ITOps-frontend-latest
    container_name: itops-frontend
    restart: unless-stopped
    ports:
      - "8080:80"
    depends_on:
      backend:
        condition: service_healthy
    networks:
      - itops-network
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:80/"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

networks:
  itops-network:
    driver: bridge

volumes:
  app-data:
    driver: local
EOF
```

> **注意**：将 `.env` 中的 `你的服务器IP` 替换为实际的服务器 IP 或域名。

### 3. 启动服务

```bash
cd /opt/itops
docker compose up -d
```

### 4. 验证部署

```bash
# 查看容器状态（两个都应显示 Up）
docker compose ps

# 检查后端健康状态
curl http://localhost:3001/health
# 预期输出: {"status":"ok","timestamp":"..."}

# 检查前端
curl -I http://localhost:8080
# 预期输出: HTTP/1.1 200 OK
```

### 5. 登录系统

- **前端地址**: http://服务器IP:8080
- **后端 API**: http://服务器IP:3001
- **默认账号**: admin
- **默认密码**: admin

> ⚠️ **首次登录后系统会强制要求修改密码**

---

## 方式三：从源码构建部署

适用于：需要自定义修改源码的场景

```bash
# 克隆项目
git clone <your-repo-url>
cd ai

# 配置环境变量
cp .env.example .env
# 编辑 .env，修改 JWT_SECRET 等配置

# 构建并启动
docker compose up -d --build
```

---

## 常用运维命令

### 查看日志

```bash
# 实时查看所有服务日志
docker compose logs -f

# 只看后端日志
docker compose logs -f backend

# 查看最近 100 行日志
docker compose logs --tail=100 backend
```

### 重启服务

```bash
# 重启所有服务
docker compose restart

# 只重启后端
docker compose restart backend
```

### 停止服务

```bash
# 停止服务（保留数据）
docker compose down

# 停止服务并删除数据卷（⚠️ 会清空数据库）
docker compose down -v
```

### 更新版本

```bash
# 拉取最新镜像
docker compose pull

# 重新创建容器
docker compose up -d
```

---

## 数据备份

```bash
# 备份 SQLite 数据库
docker cp itops-backend:/app/data/app.db ./backup-$(date +%Y%m%d).db

# 恢复数据库
docker cp ./backup-20260525.db itops-backend:/app/data/app.db
docker compose restart backend
```

---

## 配置 AI 模型

部署后可以在网页 → 设置页面配置 AI 模型，也可以通过环境变量配置：

```env
# 豆包（火山引擎）
DOUBAO_API_KEY=your-doubao-key
DOUBAO_API_BASE=https://ark.cn-beijing.volces.com/api/v3
DOUBAO_MODEL=doubao-4o

# OpenAI
OPENAI_API_KEY=your-openai-key
OPENAI_API_BASE=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o

# 本地 AI（Ollama / LM Studio / vLLM 等）
LOCAL_AI_API_BASE=http://localhost:11434/v1
LOCAL_AI_MODEL=qwen2.5
```

> AI 模型都是可选的，至少配置一个才能使用 AI 功能。

---

## 安全配置（生产环境建议）

### 🔐 登录安全

系统默认已启用以下安全机制：
- **强制初始密码修改**：首次登录必须修改 `admin/admin` 默认密码
- **密码复杂度校验**：至少 8 位，必须包含大小写字母、数字和特殊字符
- **登录失败锁定**：连续 5 次失败锁定 30 分钟，防止暴力破解

### 🌐 Webhook 安全（告警接收）

生产环境建议启用：

```env
# 1. IP 白名单（只允许指定 IP 发送告警）
WEBHOOK_IP_WHITELIST=192.168.1.100,10.0.0.50

# 2. 签名验证（HMAC-SHA256）
WEBHOOK_VERIFY_ENABLED=true
WEBHOOK_SECRET=$(openssl rand -hex 32)
```

### 🛡️ 其他安全建议

```env
# 必须设置强 JWT 密钥
JWT_SECRET=$(openssl rand -hex 32)

# 限制 CORS 来源（逗号分隔）
ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com

# 设置运行环境
NODE_ENV=production
```

---

## 常见问题

### 1. 容器无法启动

```bash
# 查看启动日志
docker compose logs backend

# 常见原因：
# 1. 端口被占用 → 修改 docker-compose.yml 中的端口映射
# 2. JWT_SECRET 未设置 → 检查 .env 文件
# 3. 镜像拉取失败 → 检查网络连接
```

### 2. 前端页面空白

1. 确认后端健康检查通过：`curl http://localhost:3001/health`
2. 检查浏览器控制台 Network 面板，看 `/api/` 请求是否 200
3. 如果 API 请求 502，说明前端连不上后端，检查网络配置

### 3. 登录失败

- 确认使用了正确的默认账号：`admin` / `admin`
- 如果提示"用户不存在"，可能数据库被清空，执行：
  ```bash
  docker compose down -v
  docker compose up -d
  ```
  > ⚠️ 这会清除所有数据！
- 如果密码错误但账号存在，可能是之前已经修改过密码，尝试你设置的密码

### 4. 防火墙配置

需要开放以下端口：

```bash
# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=8080/tcp
sudo firewall-cmd --permanent --add-port=3001/tcp
sudo firewall-cmd --reload

# Ubuntu (ufw)
sudo ufw allow 8080/tcp
sudo ufw allow 3001/tcp
sudo ufw reload
```

---

## 安全建议

| 项目 | 建议 |
|------|------|
| JWT_SECRET | 必须使用强随机字符串，不要用默认值 |
| 默认密码 | 首次登录后立即修改 admin 密码 |
| CORS | 将 `ALLOWED_ORIGINS` 限制为实际使用的域名 |
| HTTPS | 生产环境建议使用 Nginx 反向代理配置 SSL |
| 防火墙 | 仅暴露 8080 和 3001 端口，其他端口禁止对外 |

---

## 系统架构

```
用户浏览器
    │
    ▼
┌─────────────────────────┐
│  Nginx (:80)            │  前端容器
│  ├── / → 静态文件       │
│  ├── /api → 代理到后端  │
│  └── /socket.io → WS代理│
└──────────┬──────────────┘
           │ Docker 网络
           ▼
┌─────────────────────────┐
│  Express (:3001)        │  后端容器
│  ├── REST API           │
│  ├── WebSocket          │
│  └── SQLite DB          │
└─────────────────────────┘
```

---

## 版本信息

| 组件 | 版本 |
|------|------|
| 项目版本 | v3.0.5 |
| Docker | 20.10+ |
| Docker Compose | v2.0+ |
| Node.js (容器) | 18+ |
| Nginx (容器) | Alpine |

---

## 获取帮助

- 项目文档：[DEPLOYMENT.md](./DEPLOYMENT.md) — 详细部署操作说明
- 开发指南：[docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) — 本地开发环境搭建
- API 文档：[docs/API.md](./docs/API.md) — 完整 API 接口文档
- 架构设计：[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — 系统架构说明
- Web 终端：[WEB_TERMINAL.md](./WEB_TERMINAL.md) — Web SSH 终端技术文档

---

> 📅 最后更新：2026-05-28  
> 📝 本文档基于 v3.0.5 版本编写
