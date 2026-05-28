# 附录D 开发工具配置指南

## D.1 概述

本指南提供 ITOps Agent Platform 开发环境的完整配置说明，涵盖代码编辑器、语言工具、Git 工作流、Docker 桌面、Node.js 版本管理、API 测试工具和数据库检查工具等。

> **相关章节**: 第2章 环境准备与快速入门、第4章 技术栈入门

## D.2 Node.js 版本管理

### D.2.1 使用 nvm-windows（Windows 推荐）

项目要求 **Node.js >= 18.0.0**，推荐使用 nvm-windows 管理多版本 Node.js：

```powershell
# 1. 下载并安装 nvm-windows
# 访问 https://github.com/coreybutler/nvm-windows/releases
# 下载 nvm-setup.exe 并安装

# 2. 安装 Node.js LTS 版本
nvm install 20.11.0
nvm use 20.11.0

# 3. 验证安装
node --version    # v20.11.0
npm --version     # 10.x.x
```

### D.2.2 版本要求

| 工具 | 最低版本 | 推荐版本 |
|------|----------|----------|
| Node.js | 18.0.0 | 20.x LTS |
| npm | 9.0.0 | 10.x |
| Git | 2.39.0 | 2.43+ |

## D.3 VS Code 配置

### D.3.1 推荐扩展

在项目根目录创建 `.vscode/extensions.json`：

```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-typescript-next",
    "christian-kohler.path-intellisense",
    "formulahendry.auto-close-tag",
    "formulahendry.auto-rename-tag",
    "streetsidesoftware.code-spell-checker",
    "ms-vscode.vscode-jsonl",
    "mtxr.sqltools",
    "alexcvzz.vscode-sqlite",
    "humao.rest-client",
    "GitHub.vscode-pull-request-github",
    "eamodio.gitlens"
  ]
}
```

| 扩展 | 用途 |
|------|------|
| ESLint | TypeScript/JavaScript 代码检查 |
| Prettier | 代码格式化 |
| Tailwind CSS IntelliSense | Tailwind CSS 类名补全和文档 |
| TypeScript and JavaScript Language | TypeScript 语言服务 |
| Path Intellisense | 文件路径自动补全 |
| Auto Close/Rename Tag | HTML/JSX 标签自动闭合/重命名 |
| Code Spell Checker | 拼写检查 |
| SQLite | SQLite 数据库浏览和查询 |
| REST Client | API 接口测试 |
| GitLens | Git 增强（代码行级历史记录） |

### D.3.2 VS Code 工作区设置

在项目根目录创建 `.vscode/settings.json`：

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "editor.tabSize": 2,
  "editor.insertSpaces": true,
  "files.trimTrailingWhitespace": true,
  "files.insertFinalNewline": true,
  "typescript.preferences.importModuleSpecifier": "relative",
  "typescript.suggest.autoImports": true,
  "typescript.updateImportsOnFileMove.enabled": "always",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/data/*.db": true,
    "**/data/*.db-wal": true,
    "**/data/*.db-shm": true
  },
  "files.exclude": {
    "**/node_modules": true
  },
  "workbench.editorAssociations": {
    "*.db": "sqlite-viewer"
  }
}
```

### D.3.3 启动配置（launch.json）

在项目根目录创建 `.vscode/launch.json`：

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Backend: Debug (tsx)",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "${workspaceFolder}/backend/node_modules/.bin/tsx",
      "runtimeArgs": ["--inspect-brk", "${workspaceFolder}/backend/src/app.ts"],
      "console": "integratedTerminal",
      "skipFiles": ["<node_internals>/**"],
      "outFiles": ["${workspaceFolder}/backend/dist/**/*.js"],
      "preLaunchTask": "npm: install (backend)",
      "env": {
        "NODE_ENV": "development",
        "PORT": "3001"
      },
      "cwd": "${workspaceFolder}/backend"
    },
    {
      "name": "Backend: Attach to Process",
      "type": "node",
      "request": "attach",
      "port": 9229,
      "restart": true,
      "skipFiles": ["<node_internals>/**"],
      "cwd": "${workspaceFolder}/backend"
    },
    {
      "name": "Frontend: Debug (Vite)",
      "type": "chrome",
      "request": "launch",
      "url": "http://localhost:5173",
      "webRoot": "${workspaceFolder}/frontend/src",
      "preLaunchTask": "npm: dev (frontend)",
      "sourceMaps": true
    },
    {
      "name": "Backend: Run Tests",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "${workspaceFolder}/backend/node_modules/.bin/vitest",
      "args": ["run", "--inspect-brk", "--no-threads"],
      "console": "integratedTerminal",
      "cwd": "${workspaceFolder}/backend"
    }
  ],
  "compounds": [
    {
      "name": "Full Stack Debug",
      "configurations": [
        "Backend: Debug (tsx)",
        "Frontend: Debug (Vite)"
      ],
      "presentation": {
        "hidden": false,
        "group": "fullstack",
        "order": 1
      }
    }
  ]
}
```

### D.3.4 任务配置（tasks.json）

在项目根目录创建 `.vscode/tasks.json`：

```json
{
  "version": "2.0.0",
  "tasks": [
    {
      "label": "npm: install (backend)",
      "type": "npm",
      "script": "install",
      "path": "backend",
      "problemMatcher": [],
      "presentation": {
        "reveal": "silent"
      }
    },
    {
      "label": "npm: install (frontend)",
      "type": "npm",
      "script": "install",
      "path": "frontend",
      "problemMatcher": [],
      "presentation": {
        "reveal": "silent"
      }
    },
    {
      "label": "npm: dev (backend)",
      "type": "npm",
      "script": "dev",
      "path": "backend",
      "isBackground": true,
      "problemMatcher": [{
        "pattern": [{
          "regexp": ".",
          "file": 1,
          "location": 2,
          "message": 3
        }],
        "background": {
          "activeOnStart": true,
          "beginsPattern": ".",
          "endsPattern": "Backend running"
        }
      }]
    },
    {
      "label": "npm: dev (frontend)",
      "type": "npm",
      "script": "dev",
      "path": "frontend",
      "isBackground": true,
      "problemMatcher": [{
        "pattern": [{
          "regexp": ".",
          "file": 1,
          "location": 2,
          "message": 3
        }],
        "background": {
          "activeOnStart": true,
          "beginsPattern": ".",
          "endsPattern": "ready in"
        }
      }]
    },
    {
      "label": "npm: build (backend)",
      "type": "npm",
      "script": "build",
      "path": "backend",
      "problemMatcher": ["$tsc"],
      "group": "build"
    },
    {
      "label": "npm: lint (backend)",
      "type": "npm",
      "script": "lint",
      "path": "backend",
      "problemMatcher": ["$eslint-stylish"],
      "group": "build"
    },
    {
      "label": "npm: lint (frontend)",
      "type": "npm",
      "script": "lint",
      "path": "frontend",
      "problemMatcher": ["$eslint-stylish"],
      "group": "build"
    },
    {
      "label": "npm: test (backend)",
      "type": "npm",
      "script": "test",
      "path": "backend",
      "problemMatcher": []
    },
    {
      "label": "docker: compose up",
      "type": "shell",
      "command": "docker-compose",
      "args": ["up", "-d", "--build"],
      "options": {
        "cwd": "${workspaceFolder}"
      },
      "group": "build"
    },
    {
      "label": "docker: compose down",
      "type": "shell",
      "command": "docker-compose",
      "args": ["down"],
      "options": {
        "cwd": "${workspaceFolder}"
      }
    }
  ]
}
```

## D.4 TypeScript 配置

### D.4.1 后端 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "moduleResolution": "node"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**关键配置说明**:

| 配置项 | 值 | 说明 |
|--------|------|------|
| `strict` | `true` | 启用所有严格类型检查选项 |
| `noImplicitAny` | `true` | 禁止隐式 any 类型 |
| `esModuleInterop` | `true` | 启用 ES 模块互操作性 |
| `declaration` | `true` | 生成 .d.ts 类型声明文件 |
| `sourceMap` | `true` | 生成 Source Map 用于调试 |

### D.4.2 前端 tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

## D.5 ESLint 配置

### D.5.1 后端 .eslintrc.json

```json
{
  "env": {
    "node": true,
    "es2021": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "plugins": ["@typescript-eslint"],
  "ignorePatterns": ["dist/", "node_modules/"],
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        "argsIgnorePattern": "^_",
        "destructuredArrayIgnorePattern": "^_",
        "varsIgnorePattern": "^_"
      }
    ]
  }
}
```

### D.5.2 前端 .eslintrc.json

```json
{
  "env": {
    "browser": true,
    "es2021": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module",
    "ecmaFeatures": {
      "jsx": true
    }
  },
  "plugins": ["react", "react-hooks", "@typescript-eslint"],
  "settings": {
    "react": {
      "version": "detect"
    }
  },
  "rules": {
    "react/react-in-jsx-scope": "off",
    "react/no-unescaped-entities": "warn",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { "argsIgnorePattern": "^_" }
    ]
  }
}
```

### D.5.3 常用 ESLint 命令

```bash
# 后端检查
cd backend && npm run lint

# 前端检查
cd frontend && npm run lint

# 自动修复
cd backend && npx eslint src --ext .ts --fix
cd frontend && npx eslint src --ext .tsx --fix
```

## D.6 Git 配置

### D.6.1 全局 Git 配置

```bash
# 设置用户信息
git config --global user.name "你的名字"
git config --global user.email "your-email@example.com"

# 设置默认分支名
git config --global init.defaultBranch main

# 设置默认合并策略
git config --global merge.ff only

# 设置换行符（Windows 用户）
git config --global core.autocrlf true

# 启用 Git 凭据缓存（1小时）
git config --global credential.helper 'cache --timeout=3600'
```

### D.6.2 项目 .gitignore

项目已包含 `.gitignore` 文件，关键忽略规则：

```gitignore
# 依赖
node_modules/
.pnp/
.pnp.js

# 构建输出
backend/dist/
frontend/dist/

# 环境变量
.env
.env.local
.env.production
.env.*.local

# 数据库文件
data/*.db
data/*.db-wal
data/*.db-shm

# IDE
.vscode/*.code-workspace
.idea/
*.swp
*.swo

# 操作系统
.DS_Store
Thumbs.db

# 日志
*.log
npm-debug.log*

# 临时文件
*.tmp
*.temp
```

### D.6.3 推荐 Git Hook

可以使用 Husky 配合 lint-staged 实现提交前自动检查：

```bash
# 安装
cd backend && npm install --save-dev husky lint-staged
npx husky install

# 创建 pre-commit hook
npx husky add .husky/pre-commit "npx lint-staged"
```

lint-staged 配置（添加到 package.json）：

```json
{
  "lint-staged": {
    "src/**/*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ]
  }
}
```

## D.7 Docker Desktop 配置

### D.7.1 安装要求

- **Windows**: Docker Desktop for Windows（需要启用 WSL 2）
- **内存**: 至少 4 GB 可用内存
- **磁盘**: 至少 10 GB 可用空间

### D.7.2 Windows WSL 2 配置

```powershell
# 1. 启用 WSL
wsl --install

# 2. 安装完成后重启计算机

# 3. 设置 WSL 2 为默认版本
wsl --set-default-version 2

# 4. 验证
wsl --status
```

### D.7.3 Docker Desktop 推荐设置

| 设置项 | 推荐值 | 说明 |
|--------|--------|------|
| Memory | 4 GB | 容器可用内存 |
| CPUs | 2 | 容器可用 CPU 核心 |
| Disk image size | 50 GB | 镜像存储空间 |
| Start Docker Desktop on login | 否 | 减少开机负担 |

### D.7.4 常用 Docker 命令

```bash
# 构建并启动
docker-compose up -d --build

# 查看日志
docker-compose logs -f backend
docker-compose logs -f frontend

# 进入容器
docker exec -it itops-backend sh

# 停止服务
docker-compose down

# 停止并清除数据卷
docker-compose down -v

# 查看容器状态
docker ps -a

# 清理无用镜像
docker image prune -f

# 清理所有未使用资源
docker system prune -f
```

## D.8 API 测试工具配置

### D.8.1 Postman

1. **安装**: 从 https://www.postman.com/downloads/ 下载
2. **导入环境**: 创建环境变量
   - `base_url`: `http://localhost:3001/api`
   - `token`: 登录后填入 access token
3. **设置认证**: 在 Collection 级别设置 `Authorization` → `Bearer Token`，值为 `{{token}}`

**推荐 Collection 结构**:
```
ITOps Agent Platform
├── Auth
│   ├── POST Login
│   ├── POST Refresh Token
│   └── GET Me
├── Servers
│   ├── GET List
│   ├── POST Create
│   └── DELETE :id
├── Agents
├── Workflows
├── Tasks
├── Alerts
└── ...
```

### D.8.2 Insomnia

1. **安装**: 从 https://insomnia.rest/download 下载
2. **创建 Environment**:
   ```yaml
   base_url: http://localhost:3001/api
   token: ""
   ```
3. **设置 Header 模板**:
   ```
   Authorization: Bearer {{ token }}
   ```

### D.8.3 VS Code REST Client

使用 `humao.rest-client` 扩展直接在 VS Code 中测试 API。

创建 `api.http` 文件：

```http
### 登录
POST http://localhost:3001/api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin"
}

### 获取服务器列表（使用登录返回的 token）
GET http://localhost:3001/api/servers
Authorization: Bearer {{token}}

### 创建 Agent
POST http://localhost:3001/api/agents
Authorization: Bearer {{token}}
Content-Type: application/json

{
  "name": "Test Agent",
  "role": "diagnosis",
  "system_prompt": "You are a test agent.",
  "model": "doubao-4o"
}
```

## D.9 SQLite 数据库检查

### D.9.1 VS Code SQLite 扩展

安装 `alexcvzz.vscode-sqlite` 扩展后：

1. `Ctrl+Shift+P` → `SQLite: Open Database`
2. 选择 `data/app.db`
3. 在编辑器中执行 SQL 查询

### D.9.2 DB Browser for SQLite

1. **安装**: 从 https://sqlitebrowser.org/dl/ 下载
2. **打开数据库**: File → Open Database → 选择 `data/app.db`
3. **常用操作**:
   - Browse Data 浏览表数据
   - Execute SQL 执行自定义查询
   - Database Structure 查看表结构

### D.9.3 命令行工具

```bash
# 安装 sqlite3 CLI（Windows 可使用 Chocolatey）
choco install sqlite

# 连接数据库
sqlite3 data/app.db

# 常用命令
sqlite> .tables                    # 列出所有表
sqlite> .schema users              # 查看表结构
sqlite> SELECT COUNT(*) FROM users; # 执行查询
sqlite> .exit                      # 退出
```

## D.10 调试配置

### D.10.1 后端调试

**方式一：VS Code 直接调试（推荐）**

使用 D.3.3 节配置的 `Backend: Debug (tsx)` 启动配置，按 `F5` 启动调试，支持断点、单步执行、变量监视。

**方式二：手动附加进程**

```bash
# 1. 启动后端（带调试端口）
cd backend
node --inspect-brk=9229 -r ts-node/register src/app.ts

# 2. 在 VS Code 中使用 "Backend: Attach to Process" 附加
```

**方式三：Console 日志调试**

```typescript
import { logger } from './utils/logger';

logger.debug('调试信息', { data: someData });
logger.info('一般信息');
logger.warn('警告信息');
logger.error('错误信息', error as Error);
```

通过设置环境变量 `LOG_LEVEL=debug` 启用详细日志：

```bash
# PowerShell
$env:LOG_LEVEL="debug"
npm run dev

# CMD
set LOG_LEVEL=debug
npm run dev
```

### D.10.2 前端调试

**方式一：Chrome DevTools**

1. 启动前端开发服务器：`cd frontend && npm run dev`
2. 浏览器打开 `http://localhost:5173`
3. `F12` 打开 DevTools
4. 在 Sources 面板找到对应 TSX 文件设置断点（Vite 支持 Source Map）

**方式二：VS Code + Chrome**

使用 D.3.3 节配置的 `Frontend: Debug (Vite)` 启动配置，在 VS Code 中直接调试前端代码。

**React DevTools**

安装 React Developer Tools Chrome 扩展，可以：
- 查看组件树和 Props/State
- 追踪组件渲染性能
- 使用 Profiler 分析渲染耗时

### D.10.3 WebSocket 调试

使用浏览器控制台监视 WebSocket 消息：

```javascript
// 在浏览器控制台执行
const ws = new WebSocket('ws://localhost:3001');
ws.onopen = () => console.log('WebSocket 连接成功');
ws.onmessage = (e) => console.log('收到消息:', e.data);
ws.onerror = (e) => console.error('WebSocket 错误:', e);
```

## D.11 快速上手清单

```
[ ] 1. 安装 Node.js 20.x LTS（使用 nvm-windows）
[ ] 2. 安装 VS Code 及推荐扩展
[ ] 3. 克隆项目仓库
[ ] 4. 后端安装依赖：cd backend && npm install
[ ] 5. 前端安装依赖：cd frontend && npm install
[ ] 6. 复制 .env.example 到 .env
[ ] 7. 启动后端：cd backend && npm run dev
[ ] 8. 启动前端：cd frontend && npm run dev
[ ] 9. 访问 http://localhost:5173
[ ] 10. 使用 VS Code launch.json 配置启动调试
```

## D.12 常见问题排查

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| `npm install` 报 `better-sqlite3` 编译错误 | 缺少编译工具 | 运行 `npm install --global windows-build-tools` |
| 后端启动报 `Cannot find module` | TypeScript 未编译或未使用 tsx | 使用 `npm run dev`（tsx watch 模式） |
| 前端白屏 | 后端未启动或 CORS 配置不对 | 检查后端是否在 3001 端口运行，检查 `ALLOWED_ORIGINS` |
| SQLite 数据库文件被锁定 | 多个进程同时访问 | 关闭其他占用数据库的进程 |
| Docker 容器启动失败 | 端口被占用 | 修改 docker-compose.yml 中的端口映射 |
| ESLint 报大量错误 | 未安装依赖或配置不匹配 | 运行 `npm install` 重新安装 |
| VS Code 断点不命中 | Source Map 未生成 | 确保 `sourceMap: true` 在 tsconfig.json 中 |


## 作者

**谭策** — 独立开发者 | AIOps 领域探索者

- 🌐 项目官网：[ITOpsAgentinfo](https://www.zjzwfw.cloud/ITOpsAgentinfo)
- 📝 博客：[zjzwfw.cloud](https://www.zjzwfw.cloud/)
- 📧 邮箱：<huawei_network@foxmail.com>
- 💬 微信公众号：**IT Online**

<p align="left">
  <img src="../../frontend/public/wechaterweima.png" width="200" alt="IT Online 微信公众号">
</p>

## 许可证

[MPL-2.0](../../LICENSE) © 谭策