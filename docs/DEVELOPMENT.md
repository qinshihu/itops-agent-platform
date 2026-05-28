# 开发指南

本文档介绍如何搭建本地开发环境、进行代码开发和调试。

## 🛠️ 环境要求

### 必需软件
- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0 或 **yarn** / **pnpm**
- **Git**: 最新版本

### 可选软件
- **Docker**: >= 20.10.0 (用于容器化开发/测试)
- **Docker Compose**: >= 2.0.0

## 🚀 快速开始

### 1. 克隆项目
```bash
git clone <repository-url>
cd itops-agent-platform
```

### 2. 安装依赖

#### 方式一：使用根目录脚本（推荐）
```bash
npm install
npm run install:all
```

#### 方式二：分别安装
```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

### 3. 配置环境变量
```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，配置您的设置
```

关键环境变量说明：
- `NODE_ENV`: 运行环境 (development/production)
- `PORT`: 后端服务端口
- `JWT_SECRET`: JWT 签名密钥（生产模式必填）
- `DOUBAO_API_KEY`: 豆包API密钥（用于 AI Agent）
- `OPENAI_API_KEY`: OpenAI API密钥（可选）

### 4. 启动开发服务

#### 方式一：Docker 本地开发环境（推荐，热重载）

项目提供了专门的本地开发环境配置（`local-dev/` 目录），使用 Docker 容器运行但支持代码热重载：

```bash
# Windows
cd local-dev
start-dev.bat

# Linux/Mac
cd local-dev
./start-dev.sh
```

**特点：**
- 前端：Vite 开发服务器，修改代码即时刷新（http://localhost:5173）
- 后端：tsx watch 热重载，修改代码自动重启（http://localhost:3001）
- 数据库：Docker volume 持久化，停止容器不丢失数据
- 调试支持：Node.js 调试端口（localhost:9229）

**常用命令：**
```bash
# 强制重新构建
start-dev.bat --build

# 停止环境
stop-dev.bat

# 停止并清理数据
stop-dev.bat --clean

# 查看日志
docker-compose logs -f
```

#### 方式二：同时启动前后端（推荐）

在项目根目录：
```bash
npm run dev
```

#### 方式三：分别启动

**启动后端：**
```bash
cd backend
npm run dev
```
后端将在 `http://localhost:3001` 启动

**启动前端：**
```bash
cd frontend
npm run dev
```
前端将在 `http://localhost:8080` 启动

### 5. 访问应用
- 前端页面：http://localhost:8080
- 后端API：http://localhost:3001
- 健康检查：http://localhost:3001/health

## 📁 项目结构说明

```
itops-agent-platform/
├── backend/                 # 后端项目
│   ├── src/
│   │   ├── models/         # 数据模型和数据库初始化
│   │   ├── routes/         # API路由
│   │   ├── services/       # 业务逻辑服务
│   │   ├── middleware/     # 中间件
│   │   ├── websocket/      # WebSocket处理
│   │   └── app.ts          # 应用入口
│   ├── package.json
│   └── tsconfig.json
├── frontend/               # 前端项目
│   ├── src/
│   │   ├── components/     # React组件
│   │   ├── pages/          # 页面组件
│   │   ├── contexts/       # React Context
│   │   ├── hooks/          # 自定义Hooks
│   │   └── App.tsx         # 应用入口
│   ├── package.json
│   └── vite.config.ts
├── docker/                 # Docker配置
├── docs/                   # 文档
└── examples/               # 示例文件
```

## 🔧 开发工具

### 代码检查
```bash
# 检查后端代码
cd backend
npm run lint

# 检查前端代码
cd frontend
npm run lint
```

### 类型检查
```bash
# 后端类型检查
cd backend
npx tsc --noEmit

# 前端类型检查
cd frontend
npx tsc --noEmit
```

### 构建
```bash
# 构建整个项目
npm run build

# 分别构建
npm run build:backend
npm run build:frontend
```

## 🐛 调试技巧

### 后端调试
1. 使用 `console.log` 或调试器
2. 查看日志输出
3. 访问健康检查端点验证服务状态

### 前端调试
1. 使用浏览器开发者工具
2. React DevTools 进行组件调试
3. Redux DevTools (如果使用状态管理)

### 数据库调试
SQLite数据库文件位置：`backend/data/app.db`
可以使用DB Browser for SQLite等工具查看数据库内容。

## 🔌 API开发

### 添加新的API端点
1. 在 `backend/src/routes/` 创建新的路由文件
2. 在 `backend/src/app.ts` 中注册路由
3. 编写对应的服务逻辑
4. 添加前端API调用代码

### WebSocket事件
- 后端：在 `backend/src/websocket/handler.ts` 中处理
- 前端：在对应组件中使用 Socket.io 客户端

## 🧪 测试指南

（目前项目未包含自动化测试，建议添加）

### 手动测试流程
1. 测试登录功能（admin/admin）
2. 测试服务器添加和连接
3. 测试命令执行
4. 测试工作流创建和执行
5. 测试告警接收和处理

## 📝 代码规范

### Git提交规范
建议使用以下格式：
```
<type>(<scope>): <subject>

类型：
- feat: 新功能
- fix: 修复
- docs: 文档
- style: 格式
- refactor: 重构
- test: 测试
- chore: 构建/工具
```

### 代码风格
- TypeScript：严格模式
- 遵循ESLint规则
- 使用Prettier格式化（建议）

## 🤝 贡献流程

1. Fork项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启Pull Request

## 🆘 常见开发问题

### 端口被占用
```bash
# Windows查找占用进程
netstat -ano | findstr :3001
netstat -ano | findstr :8080

# 结束进程
taskkill /PID <进程ID> /F
```

### 依赖安装失败
```bash
# 清除缓存重新安装
rm -rf node_modules package-lock.json
npm install
```

### 数据库问题
删除 `backend/data/` 目录，重启服务会自动重新初始化。

## 📚 参考资源

- [Express.js 文档](https://expressjs.com/)
- [React 文档](https://react.dev/)
- [TypeScript 文档](https://www.typescriptlang.org/docs/)
- [Socket.io 文档](https://socket.io/docs/)
