# ITOps Agent Platform - Local Development Environment

> 本目录提供**一键启动的 Docker 开发环境**——后端（Express + tsx watch）+ 前端（Vite HMR）+ 命名 volume 数据持久化。
> 适用于本地开发、功能验证、调试。
>
> ⚠️ **本环境仅供开发用**。生产部署请参考 [`docker/`](../docker/) 目录下的生产镜像 Dockerfile。

---

## 🔒 安全警告（重要）

1. **不要在公网服务器上运行本环境**：所有端口（3001、5173、9229）默认绑定 `127.0.0.1`，但若部署在有公网 IP 的环境请检查防火墙
2. **容器可通过 `/var/run/docker.sock` 完全控制宿主 Docker** — 容器内为 root 权限，攻击者一旦入侵容器即等于入侵宿主机。仅在受信任的开发机上运行
3. **9229 Node.js 调试端口**已绑定 loopback，Chrome `chrome://inspect` 仅在本机可用。若需远程调试请用 SSH 端口转发

---

## 🚀 快速开始

### 1. 环境要求

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)（已安装并运行）
- 4GB+ 可用内存（后端 4G + 前端 2G）
- Windows 10/11 / macOS / Linux

### 2. 启动开发环境

**方法一：双击批处理文件（Windows，推荐）**

```bash
.\start-dev.bat
```

**方法二：使用 shell 脚本（Linux/Mac）**

```bash
./start-dev.sh
```

**方法三：直接用 docker compose**

```bash
cd local-dev
docker compose up --build
```

### 3. 访问服务

| 服务                     | 地址                                 | 说明                    |
| ------------------------ | ------------------------------------ | ----------------------- |
| **前端 (Vite HMR)**      | <http://localhost:5173>              | 热重载开发服务器        |
| **后端 API**             | <http://localhost:3001>              | Express 后端服务        |
| **健康检查 (liveness)**  | <http://localhost:3001/health/live>  | 探活                    |
| **健康检查 (readiness)** | <http://localhost:3001/health/ready> | 就绪探针                |
| **Swagger API 文档**     | <http://localhost:3001/api-docs>     | 交互式 API 文档         |
| **Node.js 调试器**       | <localhost:9229>                     | Chrome DevTools inspect |

> **默认账号**：`admin` / `admin`（首次登录会强制改密码）
> **容器名**：`itops-dev-backend`、`itops-dev-frontend`

---

## 🛠️ 常用命令

### 启动参数

```bash
# 启动（已有镜像则跳过构建）
.\start-dev.bat
./start-dev.sh

# 强制重新构建镜像（修改了 package.json 后用）
.\start-dev.bat --build
./start-dev.sh --build

# 强制重建且不用缓存（依赖出问题或镜像损坏时用）
.\start-dev.bat --no-cache
./start-dev.sh --no-cache

# 启动后自动跟踪日志
.\start-dev.bat --logs
./start-dev.sh --logs
```

### 停止 / 清理

```bash
# 停止（保留数据卷：数据库/备份/上传文件）
.\stop-dev.bat
./stop-dev.sh

# 停止并清理数据卷（删除所有开发数据）
.\stop-dev.bat --clean
./stop-dev.sh --clean

# 停止并删除本地镜像（强制下次启动重构建）
.\stop-dev.bat --images
./stop-dev.sh --images
```

### Docker Compose 常用

```bash
# 查看服务状态
docker compose ps

# 查看实时日志
docker compose logs -f
docker compose logs -f backend
docker compose logs -f frontend

# 重启服务
docker compose restart
docker compose restart backend     # 单独重启后端

# 进入容器调试
docker compose exec backend sh
docker compose exec frontend sh

# 查看容器环境变量
docker compose exec backend env

# 容器内运行测试
docker compose exec backend npm test
docker compose exec frontend npm test
```

---

## 📁 目录结构

```
local-dev/
├── docker-compose.yml          # Docker Compose 配置（开发环境）
├── Dockerfile.backend.dev      # 后端开发镜像（含 libsnmp-dev + inspect）
├── Dockerfile.frontend.dev     # 前端开发镜像（Vite HMR）
├── start-dev.bat               # 启动脚本（Windows）
├── start-dev.sh                # 启动脚本（Linux/Mac）
├── stop-dev.bat                # 停止脚本（Windows）
├── stop-dev.sh                 # 停止脚本（Linux/Mac）
└── README.md                   # 本文件
```

### Docker 数据持久化

| Volume        | 容器内路径     | 用途                                              |
| ------------- | -------------- | ------------------------------------------------- |
| `dev-data`    | `/app/data`    | SQLite 数据库（`app.db`）+ 上传文件（`uploads/`） |
| `dev-backups` | `/app/backups` | 系统/配置备份                                     |

> 停止容器不会丢失数据；`stop-dev.bat --clean` 才会清空。

---

## 🔧 开发说明

### 热重载

- **前端**：修改 `../frontend/src/` 下文件 → Vite 自动刷新浏览器（毫秒级）
- **后端**：修改 `../backend/src/` 下文件 → `tsx watch` 自动重启 Node 进程（秒级）

> 💡 后端**不需要**手动 `docker compose restart`——`tsx watch` 监听文件变更自动重启。
> 如果改了 `package.json` / `tsconfig.json` / 依赖，需要重新构建：`./start-dev.sh --build`

### 调试后端

1. 启动开发环境（默认已开启 inspect）
2. Chrome 打开 `chrome://inspect`
3. 点 **Configure** 添加 `localhost:9229`
4. 在 **Remote Target** 中打开 `inspect` 连接，开始断点调试

> 调试器默认绑定 `0.0.0.0:9229`，可在 `docker-compose.yml` 的 `NODE_OPTIONS` 调整。

### 网络架构

```
浏览器 → :5173 (Vite) → /api/* & /socket.io/* → backend:3001 (容器)
                                                          ↓
                                                   /app/data/app.db
                                                   /app/backups
```

- 浏览器访问 `http://localhost:5173` → Vite dev server
- `/api/v1/*` → Vite proxy → `http://backend:3001/api/v1/*`
- `/socket.io/*` → Vite proxy（WebSocket） → `http://backend:3001/socket.io/*`
- WebSocket 路径：`/socket.io/`（与 `app.ts:52` 一致）

### 数据库 / Migration

- 引擎：**SQLite**（`better-sqlite3`，WAL 模式，mmap 2GB）
- 文件：`/app/data/app.db`（容器）→ volume `dev-data`（宿主）
- Migration：**启动时自动执行**（`models/database/core.ts:112`）
- 健康检查：见 <http://localhost:3001/health/ready>

### AI 模型配置

本项目按 1.md 规则**仅支持国内大模型**。如需在本地环境测试 AI 功能：

1. **推荐方式**：在前端 **设置 → AI 配置** 中填写 API Key 并验证连通性
   - 豆包：`DOUBAO_API_KEY`、API Base、Model
   - OpenAI 兼容协议（国产模型也可以）
   - ⚠️ 配置写入数据库，重启后保留，适合长期使用
2. 或者通过 Docker 环境变量注入（Docker 模式下修改 `docker-compose.yml` 的 `environment:` 段，然后 `docker compose restart backend`）
   - 适合临时测试，不写入数据库
3. 或者宿主机开发模式下，通过环境变量注入：
   ```bash
   DOUBAO_API_KEY=your-key npm run dev
   ```

> AI 配置优先级：环境变量 > 数据库（Web UI 配置）。日常开发推荐用 Web UI 配置。

---

## ❓ 常见问题

### Q: 启动失败 / 容器立即退出

```bash
# 查看具体错误
docker compose logs backend
docker compose logs frontend

# 90% 是 libsnmp-dev 编译失败 → 检查 Dockerfile.backend.dev 是否包含 libsnmp-dev
```

### Q: `net-snmp` 编译失败

A: 确认 `Dockerfile.backend.dev` 包含 `libsnmp-dev`（v2 起已修复）。如还是失败：

```bash
./start-dev.sh --no-cache
```

### Q: Node.js 调试端口 9229 连不上

A: `docker-compose.yml` 已配置 `NODE_OPTIONS=--inspect=0.0.0.0:9229`。
确认 Chrome 的 `chrome://inspect` 里 `Network target` 列表有 `localhost:9229`。

### Q: 端口被占用

A: 编辑 `docker-compose.yml` 修改端口映射，例如：

```yaml
ports:
  - '3002:3001' # 宿主 3002 → 容器 3001
  - '5174:3000' # 宿主 5174 → 容器 3000
```

同时调整前端 Vite proxy 配置。

### Q: 前端无法连接后端（CORS / 502）

A: 检查：

1. 后端是否健康：`curl http://localhost:3001/health/live`
2. `ALLOWED_ORIGINS` 是否包含 `http://localhost:5173`（默认已配）
3. Vite proxy 是否生效：浏览器 Network 看 `/api/v1/...` 请求的 `Remote Address`

### Q: 数据库初始化失败 / 想完全重置

```bash
.\stop-dev.bat --clean
.\start-dev.bat --build
```

### Q: 改了 package.json 怎么生效

```bash
# 必须重新构建镜像（npm install 在构建时执行）
./start-dev.sh --build
```

### Q: 镜像越来越大 / 想清理

```bash
.\stop-dev.bat --images        # 删本地镜像
docker system prune -a         # 删所有未用镜像（谨慎）
```

### Q: 镜像拉取慢

A: 镜像已配阿里云 apt 源；Docker Hub 镜像建议在 `~/.docker/daemon.json` 配国内镜像：

```json
{
  "registry-mirrors": ["https://docker.mirrors.ustc.edu.cn", "https://hub-mirror.c.163.com"]
}
```

---

## 🔄 与生产部署的区别

| 维度     | 本地开发（local-dev）       | 生产部署（项目根 docker-compose.yml） |
| -------- | --------------------------- | ------------------------------------- |
| 构建     | `tsx watch` / Vite dev      | `node dist/app.js` / Nginx + 静态文件 |
| 热重载   | ✅ 挂载源码                 | ❌ 镜像内置产物                       |
| 调试器   | ✅ Node.js inspect 9229     | ❌ 关闭                               |
| 日志     | json-file 50m × 10          | json-file 10m × 5                     |
| AI 配置  | Web UI 或环境变量           | 环境变量                              |
| 默认账号 | `admin / admin`（强制改密） | `admin / ITOps@2024!Secure`           |
| CORS     | localhost 多端口            | 实际域名                              |

测试没问题后，部署到生产请：

```bash
# 1. 停止本地开发环境
cd local-dev && ./stop-dev.sh

# 2. 在项目根目录用生产 compose
cd ..
docker compose up -d --build
```

---

## 📝 默认账号

- 用户名：`admin`
- 初始密码：`admin`（首次登录后系统强制要求修改）
- 如需自定义初始密码：在 `docker-compose.yml` 的 `environment:` 段设置 `ADMIN_INITIAL_PASSWORD=your-password`

---

## 🔗 相关链接

- [项目主文档](../README.md)
- [项目文档](../docs/) — 项目根目录 docs/ 下的所有报告与说明
- [Docker Compose 官方文档](https://docs.docker.com/compose/)
- [Vite 开发服务器](https://cn.vitejs.dev/config/server-options.html)
- [tsx watch](https://github.com/privatenumber/tsx)

---

## 🐛 反馈问题

启动报错时，请附带：

```bash
docker compose ps
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
```
