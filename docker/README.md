# ITOps Agent Platform

Enterprise IT Operations Multi-Agent Automation Platform powered by Large Language Models.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

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
# Versioned tag (Recommended)
docker pull registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:itops-backend-v3.0.1
```

### Frontend Web UI
```bash
# Versioned tag (Recommended)
docker pull registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:itops-frontend-v3.0.1
```

### Simplified Version (Lightweight)
```bash
# Backend simplified version
docker pull registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:backend-simple-v3.0.1

# Frontend (same as standard)
docker pull registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:itops-frontend-v3.0.1
```

## 🚀 Quick Start

### Using Docker Compose (Recommended)

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  backend:
    image: registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:itops-backend-v3.0.1
    container_name: itops-backend
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - PORT=3001
      - HOST=0.0.0.0
      - DATABASE_PATH=/app/data/app.db
      - JWT_SECRET=your-secret-key-change-in-production
      - DOUBAO_API_KEY=your-doubao-api-key
      - OPENAI_API_KEY=your-openai-api-key
    volumes:
      - app-data:/app/data
    restart: unless-stopped

  frontend:
    image: registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:itops-frontend-v3.0.1
    container_name: itops-frontend
    ports:
      - "8080:80"
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
  -e JWT_SECRET=your-secret-key \
  -e DOUBAO_API_KEY=your-api-key \
  -v itops-data:/app/data \
  registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:itops-backend-v3.0.1
```

**Frontend:**
```bash
docker run -d \
  --name itops-frontend \
  -p 8080:80 \
  --link itops-backend \
  -e BACKEND_URL=http://itops-backend:3001 \
  registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:itops-frontend-v3.0.1
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Runtime environment | `production` |
| `PORT` | Backend API port | `3001` |
| `DATABASE_PATH` | SQLite database path | `/app/data/app.db` |
| `JWT_SECRET` | JWT signing key (required) | - |
| `JWT_EXPIRES_IN` | Token expiration time | `24h` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `http://localhost:8080` |
| `DOUBAO_API_KEY` | Doubao LLM API key | - |
| `DOUBAO_API_BASE` | Doubao API endpoint | `https://ark.cn-beijing.volces.com/api/v3` |
| `DOUBAO_MODEL` | Doubao model name | `doubao-4o` |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `OPENAI_API_BASE` | OpenAI API endpoint | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | OpenAI model name | `gpt-4o` |

## 📚 Documentation

- **Full Documentation:** [GitHub Repository](https://github.com/qinshihu/itops-agent-platform)
- **API Reference:** [API Docs](https://github.com/qinshihu/itops-agent-platform/blob/main/docs/API.md)
- **Deployment Guide:** [Deployment Guide](https://github.com/qinshihu/itops-agent-platform/blob/main/DEPLOYMENT.md)
- **Quick Deployment:** [Quick Deployment](https://github.com/qinshihu/itops-agent-platform/blob/main/QUICK_DEPLOY.md)
- **Architecture:** [Architecture Docs](https://github.com/qinshihu/itops-agent-platform/blob/main/docs/ARCHITECTURE.md)
- **Development Guide:** [Development Guide](https://github.com/qinshihu/itops-agent-platform/blob/main/docs/DEVELOPMENT.md)

## 🔧 Building from Source

```bash
# Clone repository
git clone https://github.com/qinshihu/itops-agent-platform.git
cd ITOpsAgent

# Build images (standard version)
docker build -f docker/Dockerfile.backend -t itops-backend:latest .
docker build -f docker/Dockerfile.frontend -t itops-frontend:latest .

# Build images (simplified backend version)
docker build -f docker/Dockerfile.backend.simple -t itops-backend-simple:latest .

# Start with docker-compose (standard)
docker-compose up -d --build

# Start with docker-compose (simplified)
docker-compose -f docker-compose.simple.yml up -d --build
```

## 🎯 Usage

1. Access the frontend at `http://localhost:8080`
2. Login with default admin credentials:
   - **Username:** `admin`
   - **Password:** `admin123`
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

[MIT](LICENSE) © 谭策

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
