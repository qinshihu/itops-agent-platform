# ITOps Agent Platform

Enterprise IT Operations Multi-Agent Automation Platform powered by Large Language Models.

[![License](https://img.shields.io/badge/license-MPL--2.0-blue.svg)](../LICENSE)

## 🌐 Overview

ITOps Agent Platform is an enterprise-grade IT operations automation platform where multiple AI agents work together through visual workflows to handle alert processing, fault diagnosis, system inspection, compliance checks, and more.

**Features:**

- **Multi-Agent Collaboration** - 9 preset operation agents with custom agent support
- **Visual Workflow Orchestration** - Drag-and-drop editor with serial/parallel/conditional branches
- **Server Management** - SSH remote connection, command execution, 13 compliance checks
- **Alert Center** - Webhook integration for Prometheus/Zabbix, automatic noise reduction
- **Knowledge Base + RAG** - Smart retrieval injected into LLM context
- **AI Copilot** - Natural language conversational operations assistant
- **Multi-LLM Support** - Doubao and OpenAI API integration
- **Enterprise Security** - AES-256-GCM encryption, JWT auth, rate limiting, audit logs

## 📦 Available Images

### Backend API Server

```bash
# Latest tag (Always pull the newest version)
docker pull registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:IT_Onlin-ITOps-backend-latest
```

### Frontend Web UI

```bash
# Latest tag (Always pull the newest version)
docker pull registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:IT_Onlin-ITOps-frontend-latest
```

## 🚀 Quick Start

### Using Docker Compose (Recommended)

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  backend:
    image: registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:IT_Onlin-ITOps-backend-latest
    container_name: itops-backend
    ports:
      - '3001:3001'
    environment:
      - NODE_ENV=production
      - PORT=3001
      - HOST=0.0.0.0
      - DATABASE_PATH=/app/data/app.db
    volumes:
      - app-data:/app/data
    restart: unless-stopped

  frontend:
    image: registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:IT_Onlin-ITOps-frontend-latest
    container_name: itops-frontend
    ports:
      - '8080:80'
    depends_on:
      - backend
    restart: unless-stopped

volumes:
  app-data:
    driver: local
```

Then run:

```bash
docker-compose up -d
```

### Using Docker Run

**Backend:**

```bash
docker run -d \
  --name itops-backend \
  -p 3001:3001 \
  -e NODE_ENV=production \
  -v itops-data:/app/data \
  registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:IT_Onlin-ITOps-backend-latest
```

**Frontend:**

```bash
docker run -d \
  --name itops-frontend \
  -p 8080:80 \
  --link itops-backend \
  registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:IT_Onlin-ITOps-frontend-latest
```

## ⚙️ Configuration

### 配置方式

**本项目所有配置通过前端 UI 管理，不需要环境变量文件（.env）。**

部署完成后，在 Web 界面中进行配置：

| 配置项   | 位置                          | 说明                         |
| -------- | ----------------------------- | ---------------------------- |
| API Keys | `/settings` 页面              | 写入 `settings` 表           |
| AI 模型  | `/ai-models` 页面             | 写入 `ai_models` 表          |
| 通知渠道 | `/notification-settings` 页面 | 企业微信/飞书/钉钉等         |
| 告警源   | `/alert-providers` 页面       | Prometheus/Zabbix 等 Webhook |

### Environment Variables（仅基础配置）

仅以下基础配置可通过环境变量设置，业务配置全部通过 UI 管理：

| Variable          | Description                             | Default                 |
| ----------------- | --------------------------------------- | ----------------------- |
| `NODE_ENV`        | Runtime environment                     | `production`            |
| `PORT`            | Backend API port                        | `3001`                  |
| `DATABASE_PATH`   | SQLite database path                    | `/app/data/app.db`      |
| `JWT_SECRET`      | JWT signing key（可选，不设则自动生成） | 自动生成并持久化        |
| `JWT_EXPIRES_IN`  | Token expiration time                   | `24h`                   |
| `ALLOWED_ORIGINS` | CORS allowed origins                    | `http://localhost:8080` |

## 📚 Documentation

- **项目根目录文档：** [`docs/`](../docs/)
- **架构文档：** [TECH_ARCHITECTURE.md](../.trae/documents/TECH_ARCHITECTURE.md)
- **架构规则：** [architecture.md](../.trae/rules/architecture.md)
- **API 文档：** 启动后访问 `/api/v1/docs`
- **部署指南：** [`docs/`](../docs/)

## 🔧 Building from Source

```bash
# Clone repository
git clone https://github.com/qinshihu/itops-agent-platform.git
cd ITOpsAgent

# Build images
docker build -f docker/Dockerfile.backend -t itops-backend:latest .
docker build -f docker/Dockerfile.frontend -t itops-frontend:latest .

# Start with docker-compose
docker-compose up -d --build
```

## 🎯 Usage

1. Access the frontend at `http://localhost:8080`
2. Login with default admin credentials:
   - **Username:** `admin`
   - **Password:** `admin`
   - ⚠️ Password must be changed on first login
3. Configure your LLM API keys in Settings
4. Create agents, workflows, and start automating!

## 🏗️ Architecture

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
┌──────▼──────┐
│   Nginx     │ (Frontend Container - Port 8080)
│  Static UI  │
└──────┬──────┘
       │ Proxy API /api/*
┌──────▼──────┐
│   Express   │ (Backend Container - Port 3001)
│   API Server│
└──┬───┬───┬──┘
   │   │   │
┌──▼─┐┌▼──┐┌▼─────┐
│SQLite││LLM││SSH   │
│  DB  ││API││Servers│
└──────┘└───┘└──────┘
```

## 🔒 Security

- Server passwords and SSH keys encrypted with AES-256-GCM
- JWT authentication with token blacklist
- API rate limiting
- Complete audit logging
- Sensitive information masking
- Non-root container user execution

## 📝 License

[MPL-2.0](../LICENSE) © 谭策

## 👤 Author

**谭策** - Independent Developer | AIOps Explorer

- 🌐 Website: [ITOpsAgentinfo](https://www.zjzwfw.cloud/ITOpsAgentinfo)
- 📧 Email: [huawei_network@foxmail.com](mailto:huawei_network@foxmail.com)
- 💬 WeChat: IT Online

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## ⭐ Show Your Support

Give a ⭐ if this project helped you!
