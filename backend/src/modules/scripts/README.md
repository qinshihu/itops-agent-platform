# 脚本与终端模块 (`scripts/`)

> **DDD 限界上下文**：脚本 / 终端 / AI 命令（P1-6 从 infra 抽离）
> **聚合根**：`Script`、`TerminalSession`
> **最后刷新**：2026-07-23（nav.autoExecution 第 5 轮：scriptRoutes 5 空 catch 加 logger + 前端 Scripts.tsx 补 P0 ReferenceError import）

## 职责
运维脚本（scripts）CRUD + Web 终端会话（terminalService）+ 终端 AI 分析（terminalAiService）+ 多平台命令模板（commandDispatcher）。

## 路由端点（受保护）

> `scripts/routes.ts` 自身仅挂载 `router.use('/', scriptRoutes)`，所有路径来自 `scriptRoutes.ts`。

| 前缀 | 来源 | 说明 |
|------|------|------|
| `/scripts/*` | `scriptRoutes.ts` | 脚本 CRUD + 分类列表 |

> Web Terminal 与 AI 分析通过 `shared/websocket/handler.ts` 暴露 WebSocket，**不走 REST**。

## 内部结构
```
scripts/
├── routes/                        # 1 路由文件
│   └── scriptRoutes.ts            # scripts CRUD REST API
├── services/                      # 4 业务服务
│   ├── scriptCrudService.ts        ← scripts CRUD（v3 P1-5 第三批迁移）
│   ├── terminalService.ts          ← Web Terminal SSH 会话管理
│   ├── terminalAiService.ts        ← LLM 分析终端输出（依赖 ai/ 模块）
│   └── commandDispatcher.ts        ← 多平台命令模板（Linux/Windows/FreeBSD/macOS/Solaris/AIX）
├── routes.ts                       # 模块路由聚合
├── index.ts                        # 模块导出
└── README.md
```

## 路由端点（受保护）

| 路径 | 方法 | 权限 | 说明 |
|------|------|------|------|
| `/scripts` | GET | 受保护 | 列出脚本（支持 category, search 过滤） |
| `/scripts` | POST | admin / operator | 创建脚本 |
| `/scripts/:id` | GET | 受保护 | 获取脚本详情 |
| `/scripts/:id` | PUT | admin / operator | 更新脚本 |
| `/scripts/:id` | DELETE | admin / operator | 删除脚本 |
| `/scripts/categories` | GET | 受保护 | 获取脚本分类 |

## 依赖
- `repositories/scriptsRepo` — scripts 表的读写
- `repositories/serversRepo` — Web Terminal 调用的服务器信息
- `auth/services/encryptionService` — SSH 凭据解密（terminalService）
- `ai/services/models/aiModelService` — 默认模型获取（terminalAiService）
- `ai/services/llm/llmService/providerAdapters` — LLM 调用（terminalAiService）
- `utils/logger` — 日志

## 被依赖（外部对 scripts 子域的引用）

| 文件 | 引用内容 |
|------|----------|
| `shared/websocket/handler.ts` | `terminalService`, `terminalAiService` |
| `modules/servers/services/serverInfoCollector.ts` | `OSType`, `getCommandTemplates`, `detectOSType` |
| `modules/servers/services/sshService/sshTypes.ts` | `OSType` (type-only) |
| `modules/servers/services/sshService/sshComplianceService.ts` | `OSType`, `getCommandTemplates` |

## 关键说明
- `commandDispatcher.ts` 是**纯常量模板**,无外部依赖,被 servers 模块用作 OS 类型检测与命令生成
- `terminalService` 启动时即注册**清理定时器**(5min 一次,SESSION_MAX_COUNT=100,SESSION_TTL=30min),无须手动实例化
- `terminalAiService` 通过 `ai/services/models/aiModelService.getDefaultModel()` 获取默认 LLM,**AI 不可用时返回兜底建议**,从不抛错
- Web Terminal 会话通过 `shared/websocket/handler.ts` 的 WebSocket 层向前端暴露,不走 REST API
