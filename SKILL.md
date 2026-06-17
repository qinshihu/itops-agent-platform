---
name: "itops-agent-platform"
description: "ITOps Agent Platform 企业级 IT 运维多 Agent 自动化平台开发助手。当用户需要开发、调试、测试、部署此项目，或询问项目架构、代码结构、功能模块时使用。覆盖前后端开发、Docker 部署、CI/CD、数据库迁移等全流程。"
---

# ITOps Agent Platform 开发助手

## 项目概述

企业级 IT 运维多 Agent 自动化平台。通过可视化工作流编排多个 AI Agent 协同工作，实现服务器巡检、告警处理、故障诊断、合规检查等运维任务自动化。

- 许可证: MPL-2.0（永久开源，禁止闭源商用）
- 仓库: https://github.com/qinshihu/itops-agent-platform

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite 5 + Tailwind CSS 3 + Zustand + @tanstack/react-query + @xyflow/react + socket.io-client + xterm.js |
| 后端 | Node.js 18+ + Express 4 + TypeScript + better-sqlite3 (WAL) + Socket.io 4 + ssh2 + Zod |
| 部署 | Docker 多阶段构建 + Docker Compose + Nginx (安全头 + SPA 路由 + API/WS 反代) |
| 测试 | Vitest + @testing-library/react + @vitest/coverage-v8 |
| CI/CD | GitHub Actions (ci.yml: lint+test+build; release.yml: 质量门禁+镜像推送) |

## 目录结构

```
itops-agent-platform/
├── backend/
│   ├── src/
│   │   ├── app.ts                    # 入口: Express + Socket.io 初始化, 中间件链, 路由注册, 优雅关闭
│   │   ├── constants/agentNames.ts   # Agent 名称常量 (SERVER_COMMAND, SYSTEM_INSPECTION 等 10 种)
│   │   ├── data/playbooks.ts         # 运维 Playbook 预设数据
│   │   ├── middleware/
│   │   │   ├── auth.ts               # JWT 认证 (authenticateToken) + 角色检查 (requireRole) + 强制改密 (requirePasswordChange), 含用户缓存 (10s TTL)
│   │   │   ├── rateLimiter.ts        # 内存速率限制 (按路由配置不同窗口/上限) + Webhook IP 白名单 (支持 CIDR)
│   │   │   ├── errorHandler.ts       # 统一错误处理: 区分 operational/unexpected 错误, 返回 {success,code,message,traceId}
│   │   │   ├── validation.ts         # Zod schema 请求体验证
│   │   │   ├── trace.ts              # 请求追踪 (traceId 注入)
│   │   │   └── commandFilter.ts      # SSH 命令安全检查: 7 类危险命令策略 (rm -rf, mkfs, iptables -F, kill -9 0 等), 按角色 block/warn
│   │   ├── models/
│   │   │   ├── database.ts           # SQLite 单例 (Proxy 模式), WAL 模式 + 16 项 pragma 优化, 定期维护 (每日 checkpoint/每周 analyze/每月 vacuum)
│   │   │   ├── migrations.ts         # 迁移入口: runMigrations(db)
│   │   │   ├── migrations/
│   │   │   │   ├── index.ts          # 注册所有迁移 (v001~v017, 跳过 v008/v011)
│   │   │   │   ├── migrationFramework.ts  # MigrationManager 类: schema_migrations 表, 版本控制, 顺序执行
│   │   │   │   └── v001~v017_*.ts    # 各版本迁移文件
│   │   │   └── presets/              # 预设数据初始化 (Agent/工作流/知识/脚本/告警映射/定时任务/修复策略)
│   │   ├── prompts/rcaPrompt.ts      # 根因分析 LLM 提示词模板
│   │   ├── routes/                   # 47 个路由模块, 每个对应一个服务
│   │   ├── schemas/apiValidation.ts  # Zod 验证 Schema
│   │   ├── services/                 # 50+ 业务服务 (详见"后端服务详解")
│   │   ├── types/
│   │   │   ├── index.ts              # 核心类型: WorkflowNode/Edge, NodeResult, ExecutionContext, ApprovalRequest, RemediationPolicy/Execution 等
│   │   │   └── errors.ts            # ErrorCode 枚举 (15 种) + AppError 接口 + createAppError 工厂
│   │   ├── utils/
│   │   │   ├── env.ts                # 环境变量验证 (EnvConfig 接口), 开发环境自动生成随机 JWT
│   │   │   ├── apiConfig.ts          # API Key 获取链: credentialService → 环境变量 → settings 表
│   │   │   ├── logger.ts             # 结构化日志 (debug/info/warn/error), 支持文件输出, 含 startTimer
│   │   │   ├── retry.ts              # 重试工具
│   │   │   ├── sensitiveMask.ts      # 敏感信息脱敏
│   │   │   └── passwordPolicy.ts     # 密码复杂度策略
│   │   └── websocket/handler.ts      # Socket.io: JWT 认证, task:subscribe/unsubscribe, alert:subscribe, terminal:open/data/resize/close
│   ├── vitest.config.ts              # Vitest: node 环境, src/**/*.test.ts
│   └── .eslintrc.json
├── frontend/
│   ├── src/
│   │   ├── App.tsx                   # 路由入口: lazy + Suspense 代码分割, 45+ 路由, AuthProvider > ToastProvider > ThemeProvider 嵌套
│   │   ├── main.tsx                  # React 挂载点
│   │   ├── components/
│   │   │   ├── layout/Layout.tsx     # 主布局: 侧边栏导航 (分组: 概览/主机/Agent/告警/修复/网络/系统), ChatWidget, 主题切换
│   │   │   ├── ProtectedRoute.tsx    # 路由守卫: 未登录重定向 /login, 检测 password_must_change
│   │   │   ├── WebTerminal.tsx       # xterm.js 终端组件: Socket.io 双向通信, 自动重连
│   │   │   ├── TopologyGraph.tsx     # Cytoscape 拓扑图
│   │   │   └── ...                   # 其他通用组件 (ErrorBoundary, ImpactChain, MarkdownOutput 等)
│   │   ├── contexts/
│   │   │   ├── AuthContext.tsx        # 认证状态: token/user 存 localStorage, login/logout/updateUser
│   │   │   ├── ThemeContext.tsx       # 深色/浅色主题切换, CSS 变量 + Tailwind
│   │   │   └── ToastContext.tsx       # Toast 通知: success/error/warn/info, 自动清除
│   │   ├── hooks/                    # useEscapeKey, useTheme
│   │   ├── lib/
│   │   │   ├── api.ts                # Axios 封装: 自动附加 Bearer Token, 401 自动 refresh (队列化), 失败跳转 /login
│   │   │   ├── date.ts               # 日期工具
│   │   │   └── xss.ts                # XSS 防护 (DOMPurify)
│   │   ├── pages/                    # 45+ 页面组件 (详见"前端页面索引")
│   │   └── test/                     # 前端测试 (components/contexts/lib/pages/utils)
│   ├── vite.config.ts                # 别名 @→src, 代理 /api→:3001 + /socket.io→:3001 (ws:true), 端口 3000
│   ├── tailwind.config.js            # CSS 变量颜色映射, 自定义动画
│   └── vitest.config.ts
├── docker/
│   ├── Dockerfile.backend            # 多阶段: node:20-slim 构建 → node:20-slim 运行 (非 root, appuser)
│   ├── Dockerfile.frontend           # 多阶段: node:20-alpine 构建 → nginx:alpine 运行 (安全头)
│   ├── nginx.conf                    # 安全头 (CSP/X-Frame/X-Content-Type) + SPA try_files + /api 反代 + /socket.io WS 升级 + 静态资源 1y 缓存
│   └── docker-entrypoint-backend.sh  # 确保 /app/data 目录权限, su-exec 切换到 appuser
├── local-dev/                        # 本地开发 Docker (热重载)
│   ├── docker-compose.yml            # 前端 vite dev (:5173) + 后端 tsx watch (:3001) + 数据卷持久化
│   ├── Dockerfile.backend.dev        # tsx watch 模式
│   ├── Dockerfile.frontend.dev       # vite dev 模式
│   └── start-dev.bat / stop-dev.bat
├── .github/workflows/
│   ├── ci.yml                        # push/PR: backend lint → frontend lint → backend test → frontend build → docker build
│   ├── release.yml                   # tag push: 质量门禁 → 构建推送 backend/frontend 镜像 (阿里云 ACR)
│   └── mirror.yml                    # 镜像同步
├── docker-compose.yml                # 生产: backend (:3001, 2CPU/2G) + frontend (:8080→80, 1CPU/512M), 健康检查, 日志限制
├── docker-compose.simple.yml         # 简化版
├── deploy.sh / deploy.ps1            # 一键部署: 从阿里云拉镜像 → 生成 docker-compose.yml + .env → 启动
├── .env.example                      # 环境变量模板
└── package.json                      # 根脚本: dev/build/install:all/docker:* (concurrently)
```

## 后端核心架构

### 请求处理链 (app.ts)

```
请求 → helmet → traceMiddleware → morgan → cors → bodyParser(50mb)
  → 公开路由 (无需认证):
    /api/auth      → rateLimiter + authRoutes
    /api/webhooks  → webhookIpFilter + rateLimiter + webhookRoutes
    /health        → healthService.checkHealth()
  → authenticateToken (JWT 验证 + 用户缓存 10s)
  → requirePasswordChange (首次登录强制改密)
  → 受保护路由 (每个都挂 rateLimiter):
    /api/agents, /api/workflows, /api/tasks, /api/alerts, ...
  → notFoundHandler → errorHandler
```

### 中间件详解

| 中间件 | 文件 | 核心逻辑 |
|--------|------|---------|
| authenticateToken | middleware/auth.ts | Bearer Token → jwt.verify → 查 DB (带 10s 缓存) → req.user |
| requireRole | middleware/auth.ts | 检查 req.user.role 是否在允许列表中 |
| requirePasswordChange | middleware/auth.ts | password_must_change=1 时返回 403 + code:PASSWORD_MUST_CHANGE |
| rateLimiter | middleware/rateLimiter.ts | 内存 Map 存储, 按路由配置: login(5/15min), copilot(30/min), webhooks(10/s) |
| webhookIpFilter | middleware/rateLimiter.ts | IP 白名单过滤, 支持 CIDR |
| traceMiddleware | middleware/trace.ts | 生成 traceId 注入 req |
| errorHandler | middleware/errorHandler.ts | AppError → {success,code,message,traceId}, 非 operational 错误隐藏详情 |
| commandFilter | middleware/commandFilter.ts | 7 类危险命令正则匹配, 按角色 block/warn/allow |

### 数据库层 (models/database.ts)

- **引擎**: better-sqlite3 同步 API, WAL 模式
- **单例**: Proxy 模式, `import db from '../models/database'` 即可使用
- **关键 pragma**: WAL 模式, busy_timeout=10s, cache_size=128MB, mmap_size=2GB, synchronous=FULL
- **初始化流程**: createDatabaseInstance → runMigrations → migrateOldConfigToAIModels → initializeDefaultData (用户/Agent/工作流/知识/脚本/告警映射/定时任务/修复策略)
- **定期维护**: 每小时检查, 凌晨 3 点执行: 每日 WAL checkpoint, 每周 ANALYZE, 每月 VACUUM

### 数据库迁移框架

```typescript
// 1. 新建迁移文件 backend/src/models/migrations/vXXX_描述.ts
export default {
  id: '20240101000XXX',
  version: XXX,
  name: '描述',
  description: '详细说明',
  up: async (db) => { db.exec('CREATE TABLE ...'); },
  down: async (db) => { db.exec('DROP TABLE ...'); }
}

// 2. 在 migrations/index.ts 中 import 并加入 ALL_MIGRATIONS 数组
// 3. 启动时 runMigrations(db) 自动执行待处理的迁移
```

迁移记录存储在 `schema_migrations` 表中, 按 version 排序顺序执行。

### 错误处理体系

```typescript
// types/errors.ts: 15 种 ErrorCode 枚举
import { createAppError, ErrorCode } from '../types/errors';

// 在路由/服务中抛出 operational 错误:
throw createAppError(ErrorCode.VALIDATION_ERROR, '参数无效', 400, { field: 'name' });

// errorHandler 中间件自动处理:
// - operational 错误: 返回 message + details
// - 非 operational 错误: 返回通用消息, 开发环境附带 stack
```

### 加密体系 (encryptionService.ts)

- AES-256-GCM, 密钥存储在 `encryption_keys` 表
- 格式: `iv:authTag:encryptedData` (Base64)
- 用于: 服务器密码、SSH 私钥、API 密钥等敏感字段

### API Key 获取链 (apiConfig.ts)

```
getApiKey(db, keyName, envName):
  1. credentialService (加密存储) → 2. 环境变量 → 3. settings 表 (明文兼容) → 4. 备用 env
```

### LLM 调用 (llmService.ts)

- **熔断器模式**: CircuitBreaker 类, maxFailures=5, resetTimeout=60s, 半开探测 3 次
- **模型池**: aiModelService 统一管理, 按优先级排序, 主备降级
- **支持**: 豆包 (火山引擎), OpenAI 兼容接口, 本地模型 (Ollama/LM Studio/vLLM)

### 工作流执行引擎 (workflowExecutor.ts)

```
executeWorkflow(taskId, workflow, initialInput?, context?):
  1. 解析 nodes/edges → 拓扑排序得到 executionOrder
  2. 依次执行每个节点:
     - Agent 节点 → executeAgentNode() → 按 agentName 分发
     - 审批节点 → 创建 ApprovalRequest, 暂停执行, 持久化上下文到 tasks.context
  3. WebSocket 推送进度 (task:node:output)
  4. 审批通过后 resumeWorkflow() 从持久化状态恢复执行
  5. 最大执行深度 50, 防止死循环
```

### Agent 执行 (agentExecutor.ts)

按 Agent 名称匹配分发:
- `服务器命令执行` → executeServerCommandAgent (SSH 连接所有服务器执行)
- `系统巡检`/`自动巡检` → executeAutoInspectionAgent (采集 CPU/内存/磁盘)
- `数据库运维` → executeDatabaseAdminAgent (dbskiter 执行数据库诊断)
- 其他 → executeAgentWithLLM (通用 LLM 调用, 5 分钟超时)

### WebSocket 事件 (websocket/handler.ts)

| 事件 | 方向 | 说明 |
|------|------|------|
| task:subscribe | C→S | 订阅任务进度 (加入 room) |
| task:unsubscribe | C→S | 取消订阅 |
| alert:subscribe | C→S | 订阅告警推送 |
| terminal:open | C→S | 创建 SSH 终端会话 (callback 返回 sessionId) |
| terminal:data | 双向 | 终端 I/O 数据 |
| terminal:resize | C→S | 调整终端窗口大小 |
| terminal:close | C→S | 关闭终端会话 |

工具函数: `emitToTask(io, taskId, event, data)`, `emitToAlerts(io, event, data)`, `broadcast(io, event, data)`

### 后端服务速查表

| 服务 | 文件 | 职责 |
|------|------|------|
| workflowExecutor | services/workflowExecutor.ts | 工作流执行: 拓扑排序, 节点执行, 审批暂停/恢复 |
| agentExecutor | services/agentExecutor.ts | Agent 节点执行: 按名称分发到 SSH/巡检/DB/LLM |
| llmService | services/llmService.ts | LLM 调用: 熔断器 + 重试 + 模型池降级 |
| aiModelService | services/aiModelService.ts | AI 模型池管理: CRUD, 连通性测试, 优先级排序, 旧配置迁移 |
| sshService | services/sshService.ts | SSH 连接池: 并发复用, 健康检查, 命令执行 |
| terminalService | services/terminalService.ts | Web 终端: 会话管理 (30min TTL, 100 上限) |
| alertService | services/alertService.ts | 告警 CRUD + 状态机 (new→acknowledged→resolved) + 通知触发 |
| alertNoiseReductionService | services/alertNoiseReductionService.ts | 告警降噪: 去重 + 抑制 |
| alertCorrelationService | services/alertCorrelationService.ts | 告警关联: 时间窗口内聚合 |
| alertAutoAnalyzer | services/alertAutoAnalyzer.ts | AI 告警诊断: 定时轮询待处理告警 |
| rootCauseAnalysisService | services/rootCauseAnalysisService.ts | AI 根因分析 |
| remediationService | services/remediationService.ts | 自动修复: 告警→策略匹配→工作流执行→验证→回滚 |
| aiRemediationService | services/aiRemediationService.ts | AI 生成修复命令 |
| notificationService | services/notificationService.ts | 多渠道通知: WebSocket + 企业微信 + 钉钉 + 邮件 |
| copilotService | services/copilotService.ts | AI Copilot: 规则快速响应 + LLM 深度分析, 注入系统状态 |
| enhancedRAGService | services/enhancedRAGService.ts | RAG: 关键词匹配 + 语义评分 + 频率权重 + 时间衰减 |
| schedulerService | services/schedulerService.ts | 定时任务: node-schedule, 4 个预设 (健康检查/合规/日志/备份) |
| backupService | services/backupService.ts | 备份恢复: gzip 压缩, 完整性校验, 恢复后优雅重启 |
| encryptionService | services/encryptionService.ts | AES-256-GCM 加密/解密, 密钥轮换 |
| credentialService | services/credentialService.ts | 加密凭证存储, 旧明文迁移 |
| queueService | services/queueService.ts | 异步队列: 内存模式, 优先级 + 重试 + 超时 |
| networkDeviceService | services/networkDeviceService.ts | 网络设备 CRUD |
| networkInspectionService | services/networkInspectionService.ts | 网络设备巡检 |
| networkCommandGenerator | services/networkCommandGenerator.ts | 多厂商命令生成 (华为/华三/思科/锐捷) |
| vendorAdapter | services/vendorAdapter.ts | 厂商适配器 |
| snmpService | services/snmpService.ts | SNMP 基础操作 |
| snmpPollingService | services/snmpPollingService.ts | SNMP 定期轮询 |
| snmpTrapService | services/snmpTrapService.ts | SNMP Trap 接收 |
| networkDiscoveryService | services/networkDiscoveryService.ts | 网络发现 |
| lldpDiscoveryService | services/lldpDiscoveryService.ts | LLDP 邻居发现 |
| topologyService | services/topologyService.ts | 拓扑图数据 |
| vncProxyService | services/vncProxyService.ts | VNC WebSocket 代理 |
| healthService | services/healthService.ts | 健康检查 |
| selfMonitorService | services/selfMonitorService.ts | 自监控: 定期自检 + 告警历史 |
| auditService | services/auditService.ts | 审计日志 |
| importExportService | services/importExportService.ts | CSV/JSON 导入导出 |
| changeService | services/changeService.ts | 变更管理 |
| reportService | services/reportService.ts | 报告生成 (PDFKit) |
| tokenBlacklist | services/tokenBlacklist.ts | Token 黑名单 (登出失效) |
| loginThrottler | services/loginThrottler.ts | 登录限流 (5 次失败锁定 30min) |
| restartService | services/restartService.ts | 优雅重启 |

## 前端核心架构

### 应用结构 (App.tsx)

```
ErrorBoundary
  └─ ThemeProvider (深色/浅色)
      └─ AuthProvider (JWT 认证)
          └─ ToastProvider (通知)
              └─ QueryClientProvider (React Query, refetchOnWindowFocus:false, retry:1)
                  └─ BrowserRouter
                      └─ Routes:
                          /login → Login
                          /force-password-change → ProtectedRoute > ForcePasswordChange
                          / → ProtectedRoute > Layout > (所有业务页面)
                          /* → NotFound
```

所有页面使用 `lazy(() => import(...))` + `Suspense` 代码分割, 加载时显示 PageLoader (旋转动画)。

### API 调用模式 (lib/api.ts)

```typescript
// 统一 Axios 实例, baseURL 为空 (同源), timeout 120s
// 请求拦截: 自动附加 Authorization: Bearer <token>
// 响应拦截: 401 时自动 refresh
//   - 使用 refreshApi (独立实例, timeout 30s) 调用 /api/auth/refresh
//   - 并发请求队列化 (failedQueue), 刷新成功后重放
//   - 刷新失败 → 清除 localStorage → 跳转 /login
```

### 状态管理

| 方式 | 用途 | 示例 |
|------|------|------|
| React Query | 服务端状态缓存 | 页面数据获取, 自动重试, 后台刷新 |
| Context API | 全局 UI 状态 | AuthContext (token/user), ThemeContext, ToastContext |
| localStorage | 持久化 | token, refreshToken, user, 主题偏好 |
| Zustand | 组件状态 | 部分页面使用 |

### 前端页面索引

| 路由 | 组件 | 功能 |
|------|------|------|
| /dashboard | Dashboard | 概览: 服务器统计, Agent 列表, 告警, 任务 |
| /big-screen | BigScreenDashboard | 大屏仪表盘 |
| /servers | Servers | 服务器管理: CRUD, 分组, 批量导入, SSH 连接, 信息采集, 合规检查 |
| /ssh-keys | SSHKeys | SSH 密钥管理 |
| /db-connections | DbConnections | 数据库连接管理 |
| /network-devices | NetworkDevices | 网络设备管理 |
| /agents | Agents | Agent 管理: 9 预设 + 自定义 |
| /workflows | Workflows | 工作流列表 |
| /workflows/:id | WorkflowEditor | 工作流编辑器: @xyflow/react 拖拽, Agent 节点 + 审批节点 |
| /tasks | Tasks | 任务列表与进度 |
| /alerts | Alerts | 告警中心 |
| /alert-mappings | AlertMappings | 告警映射规则 |
| /alert-noise | AlertNoiseManagement | 告警降噪 |
| /alert-auto-analysis | AlertAutoAnalysis | AI 告警自动分析 |
| /alert-correlation-groups | AlertCorrelationGroups | 告警关联组 |
| /root-cause-analysis | RootCauseAnalysis | 根因分析列表 |
| /ai-root-cause | AIRootCause | AI 根因分析 |
| /ai-root-cause/:id | RCADetail | 根因分析详情 |
| /knowledge | Knowledge | 知识库管理 |
| /scripts | Scripts | 脚本管理 |
| /scheduled-tasks | ScheduledTasks | 定时任务 |
| /terminal | TerminalPage | Web SSH 终端 |
| /remote-desktop | RemoteDesktop | VNC 远程桌面 |
| /remediation-policies | RemediationPolicies | 修复策略列表 |
| /remediation-policies/:id | RemediationPolicyEditor | 修复策略编辑 |
| /remediation-executions | RemediationExecutions | 修复执行记录 |
| /remediation-dashboard | RemediationDashboard | 修复仪表盘 |
| /remediation-workbench | RemediationWorkbench | 修复工作台 |
| /ai-remediations | AiRemediations | AI 修复管理 |
| /ai-insights | AIInsights | AI 洞察 |
| /topology | Topology | 网络拓扑图 |
| /snmp | SNMP | SNMP 管理 |
| /network-discovery | NetworkDiscovery | 网络发现 |
| /approvals | Approvals | 审批中心 |
| /reports | Reports | 报告管理 |
| /audit | AuditLogs | 审计日志 |
| /notifications | Notifications | 通知管理 |
| /users | Users | 用户管理 |
| /settings | Settings | 系统设置: AI 模型, 知识库, 通知, 数据库, 安全 |

### 侧边栏导航分组 (Layout.tsx)

导航按功能分组: 概览 (仪表盘/大屏), 主机管理 (服务器/SSH密钥/DB连接), Agent (Agent/工作流/任务), 告警中心 (告警/映射/降噪/自动分析/关联组), 智能修复 (策略/执行/仪表盘/工作台/AI修复), 网络 (设备/拓扑/发现/SNMP), 智能分析 (根因/AI根因/AI洞察), 系统 (知识库/脚本/定时任务/终端/远程桌面/审批/报告/审计/通知/用户/设置)。

## 开发命令

```bash
# === 安装 ===
npm run install:all                    # 安装根+后端+前端依赖

# === 开发 ===
npm run dev                            # 同时启动前后端 (concurrently)
cd backend && npm run dev              # 后端: tsx watch src/app.ts → :3001
cd frontend && npm run dev             # 前端: vite → :3000 (代理 /api→:3001, /socket.io→:3001)

# === Docker 本地开发 (热重载, 推荐) ===
cd local-dev && ./start-dev.bat        # Windows: 前端 :5173 + 后端 :3001
cd local-dev && ./start-dev.sh         # Linux/Mac

# === 构建 ===
npm run build                          # 构建全部
npm run build:backend                  # 后端: tsc
npm run build:frontend                 # 前端: tsc && vite build

# === 代码检查 ===
cd backend && npm run lint             # ESLint
cd frontend && npm run lint            # ESLint
cd backend && npx tsc --noEmit         # 类型检查
cd frontend && npx tsc --noEmit        # 类型检查

# === 测试 ===
cd backend && npm test                 # Vitest run
cd backend && npm run test:coverage    # Vitest + v8 coverage
cd frontend && npm test                # Vitest run

# === Docker 部署 ===
docker compose up -d                   # 生产部署
docker compose down                    # 停止
docker compose logs -f backend         # 查看后端日志
```

## 环境变量 (.env.example)

| 变量 | 默认值 | 说明 |
|------|--------|------|
| NODE_ENV | development | 运行环境 |
| PORT | 3001 | 后端端口 |
| DATABASE_PATH | ./data/app.db | SQLite 文件路径 |
| JWT_SECRET | (开发自动生成) | **生产必须设置**, `openssl rand -hex 32` |
| JWT_EXPIRES_IN | 24h | Token 有效期 |
| ADMIN_INITIAL_PASSWORD | admin | 首次部署管理员密码 |
| DOUBAO_API_KEY | - | 豆包 API 密钥 |
| OPENAI_API_KEY | - | OpenAI API 密钥 |
| LOCAL_AI_API_BASE | - | 本地模型地址 (Ollama: http://localhost:11434/v1) |
| WEBHOOK_VERIFY_ENABLED | false | Webhook 签名验证 |
| ALLOWED_ORIGINS | http://localhost:3000 | CORS 允许源 (逗号分隔) |

AI 模型配置也可在 Web 页面 "设置 → AI 配置" 中设置, 保存到数据库加密存储。

## 部署架构

```
浏览器 → Nginx (:8080)
           ├── / → 前端静态文件 (SPA try_files, 1y 缓存)
           ├── /api → proxy_pass backend:3001 (60s 连接, 300s 读取)
           └── /socket.io → proxy_pass backend:3001 (WS 升级, 3600s 超时)

backend (:3001) → SQLite (WAL) + LLM API + SSH + Webhook
```

Docker Compose 生产配置:
- backend: 2 CPU / 2G 内存, 健康检查 (/health, 30s), 日志 10m×5
- frontend: 1 CPU / 512M, 健康检查 (wget :80, 30s), 日志 5m×3
- 数据卷: app-data (SQLite), app-backups

## 开发新功能指南

### 添加后端 API

1. 创建服务: `backend/src/services/myService.ts`
2. 创建路由: `backend/src/routes/myRoutes.ts`
3. 注册路由: 在 `app.ts` 中 `import myRoutes` + `app.use('/api/my-endpoint', rateLimiter, myRoutes)`
4. 如需新表: 在 `migrations/` 新建 `vXXX_*.ts`, 在 `migrations/index.ts` 注册
5. 如需请求体验: 在 `schemas/apiValidation.ts` 添加 Zod schema
6. 编写测试: `backend/src/services/myService.test.ts`

### 添加前端页面

1. 创建页面: `frontend/src/pages/MyPage.tsx`
2. 添加路由: 在 `App.tsx` 中 `const MyPage = lazy(() => import('./pages/MyPage'))` + `<Route path="my-page" ...>`
3. 添加导航: 在 `components/layout/Layout.tsx` 侧边栏对应分组中添加菜单项
4. API 调用: 在页面中使用 `import api from '../lib/api'` 调用后端

### 添加数据库迁移

1. 新建 `backend/src/models/migrations/vXXX_描述.ts`:

```typescript
import { Migration } from './migrationFramework';

const migration: Migration = {
  id: '20240101000XXX',
  version: XXX,
  name: '描述',
  description: '详细说明',
  up: async (db) => {
    db.exec(`CREATE TABLE IF NOT EXISTS my_table (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    )`);
  },
  down: async (db) => {
    db.exec('DROP TABLE IF EXISTS my_table');
  }
};

export default migration;
```

2. 在 `migrations/index.ts` 中 import 并加入 `ALL_MIGRATIONS` 数组

### 代码规范

- TypeScript 严格模式
- 变量/函数: camelCase, 类/接口: PascalCase, 常量: UPPER_CASE
- 后端路由 → routes/, 业务逻辑 → services/, 中间件 → middleware/, 工具 → utils/
- 前端页面 → pages/, 通用组件 → components/, Hooks → hooks/, API → lib/api.ts

## Git 提交规范

```
<type>(<scope>): <subject>
```

- type: feat, fix, docs, style, refactor, test, chore
- scope: frontend, backend, docker, deploy, ci, docs
- subject: 50 字符以内

示例:
```
feat(backend): 添加服务器分组管理功能
fix(frontend): 修复工作流编辑器节点拖拽偏移问题
chore(deploy): 优化 Dockerfile 减小镜像体积
```

## 安全设计要点

- JWT 认证 + Token 黑名单 (登出失效) + 用户缓存 (10s TTL)
- 首次登录强制改密, 密码复杂度 (8位+大小写+数字+特殊字符)
- 登录限流: 5 次失败锁定 30 分钟 (loginThrottler.ts)
- AES-256-GCM 加密敏感数据, 密钥存储在 encryption_keys 表
- API Key 三级获取: 加密凭证 → 环境变量 → settings 表
- SSH 命令安全检查: 7 类危险命令策略, 按角色拦截/警告
- Webhook IP 白名单 + HMAC-SHA256 签名验证
- CORS 白名单 + 请求速率限制 (按路由差异化配置)
- Nginx 安全头: CSP, X-Frame-Options, X-Content-Type-Options
- Docker 非 root 运行 (appuser)
- 审计日志记录所有关键操作

## 重要文档索引

| 文档 | 路径 |
|------|------|
| 架构设计 | docs/ARCHITECTURE.md |
| 架构图 | docs/ARCHITECTURE_DIAGRAM.md |
| API 文档 | docs/API.md |
| 开发指南 | docs/DEVELOPMENT.md |
| 部署手册 | docs/DEPLOYMENT.md |
| 测试指南 | docs/TEST_GUIDE.md |
| 工作流指南 | docs/WORKFLOW_GUIDE.md |
| Web 终端 | docs/WEB_TERMINAL.md |
| 自动修复设计 | docs/AUTO_REMEDIATION_DESIGN.md |
| HITL 审批设计 | docs/HITL_APPROVAL_DESIGN.md |
| AI 模型管理 | docs/AI_MODEL_POOL_DEVELOPMENT.md |
| 网络设备巡检 | docs/NETWORK_DEVICE_INSPECTION.md |
| 技术规范 | docs/SPEC.md |
| 贡献指南 | CONTRIBUTING.md |
