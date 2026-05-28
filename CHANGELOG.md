# 变更日志

所有重要的项目变更都将记录在此文件中。

---

## [3.0.5] — 2026-05-28

### 🔒 安全特性增强（核心更新）

#### 登录安全强化
- **登录失败自动锁定**：连续 5 次登录失败后，账户自动锁定 30 分钟
- **锁定状态实时校验**：每次登录请求先检查账户是否处于锁定状态
- **失败计数自动重置**：登录成功后自动重置失败计数
- **管理员手动解锁**：用户管理页面支持解锁被锁定账户
- **锁定日志审计**：所有锁定/解锁操作均有详细审计记录

#### 密码策略强化
- **实时密码复杂度校验**：前端实时显示密码强度（弱/中/强）和进度条
- **五项要求组合**：至少 8 位 + 大写字母 + 小写字母 + 数字 + 特殊字符
- **逐项状态展示**：直观显示每一项要求是否满足
- **后端统一校验**：修改密码、创建用户、管理员重置密码均使用同一校验规则
- **错误提示明确**：清晰告知用户缺少哪些字符类型

#### 认证与安全中间件优化
- **强制修改密码拦截**：未修改初始密码的用户访问业务接口被拒绝，只能调用密码修改和获取用户信息接口
- **用户缓存优化**：缓存 TTL 从 60 秒缩短至 10 秒，用户状态变更更快生效
- **缓存失效机制完善**：修改密码、锁定/解锁账户时自动清除用户缓存
- **Token 自动刷新完善**：使用独立 axios 实例处理 refresh 请求，避免循环调用

#### Webhook 安全增强
- **IP 白名单控制**：支持配置 `WEBHOOK_IP_WHITELIST` 环境变量，逗号分隔多个 IP
- **白名单 IP 跳过限流**：可信告警源 IP 不受速率限制
- **IPv4/IPv6 兼容**：自动处理 IPv4-mapped IPv6 地址（::ffff:前缀）
- **详细安全日志**：拒绝未授权 IP 时记录详细日志，便于审计

### 🔧 技术改进

- **新增密码策略工具模块**：`passwordPolicy.ts` 统一处理密码校验逻辑
- **登录限流服务**：`loginThrottler.ts` 封装登录失败计数和锁定逻辑
- **类型安全**：所有新增功能均有完整 TypeScript 类型定义
- **前后端一致**：密码复杂度校验前后端使用相同规则，避免前端绕过

### 📚 文档全面更新

- **README.md**：更新安全特性表格，补充登录锁定、密码复杂度、Webhook IP 白名单等说明
- **环境变量参考**：新增 `WEBHOOK_IP_WHITELIST`、`ADMIN_INITIAL_PASSWORD` 等配置项说明
- **安全特性详解**：新增认证与访问控制、数据加密、API 与网络安全等五大章节详细说明

### ✅ 质量保证

- **TypeScript 编译零错误**：前后端均通过完整类型检查
- **向后兼容**：旧版本数据库自动迁移，无需手动操作
- **配置兼容**：新增环境变量均为可选，不影响现有部署

---

## [3.0.4] — 2026-05-28

### 文档更新
- 全面更新项目文档，同步最新功能和架构信息
- README.md 更新核心特性列表、项目结构说明
- SPEC.md 更新版本号至 v3.0.4，补充数据导入导出、备份恢复模块说明
- 更新合规检查数量从 13 项到 14 项
- 补充 Web SSH 终端、自动修复、根因分析、告警降噪等功能描述
- 添加 CI/CD 自动化特性说明

---

## [3.0.3] — 2026-05-25

### CI/CD 流水线
- 新增完整的 GitHub Actions CI/CD 流水线
- `release.yml`：推送 tag 自动构建 Docker 多架构镜像（amd64 + arm64）并推送阿里云
- 每个版本同时推送 3 个标签：版本号 / latest / Git SHA
- `mirror.yml`：Push 到 main 自动同步代码到 Gitee/Gitcode
- `ci.yml`：Push/PR 自动触发 Lint + TypeScript 检查 + 测试 + Docker 构建验证
- Quality Gates 使用 `continue-on-error`，测试失败不阻塞镜像构建
- Build 任务使用 `if: always()` 确保不受 Quality Gates 影响
- npm 缓存使用 `cache-dependency-path` 指向正确的 lock 文件位置

### 镜像命名规则
- 后端：`IT_Onlin-ITOps-backend-{version}` / `backend-latest` / `backend-{git SHA}`
- 前端：`IT_Onlin-ITOps-frontend-{version}` / `frontend-latest` / `frontend-{git SHA}`
- 仓库地址：`registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub`

### 文档更新
- `docker-compose.yml` 默认镜像地址更新到最新版本
- README.md、QUICK_DEPLOY.md、docker/README.md 同步更新
- CHANGELOG.md 记录 CI/CD 配置变更
- 新增 `docs/CICD_SETUP.md` 完整配置指南

## [3.0.2] — 2026-05-25

### 安全加固
- JWT 双 token 机制：引入 refresh_token（7 天有效期），access_token 自动刷新
- Token 黑名单安全降级修复：数据库错误时拒绝 token（原为接受）
- 加密服务 decrypt 格式错误时抛出异常（原为返回原文）
- bcrypt 密码哈希（成本因子 12）
- 默认密码 admin/admin，首次登录强制修改密码
- 邮件模板 HTML 转义，防止 XSS 注入
- 旧 refresh token 在刷新后自动加入黑名单
- Nginx 安全头完善：HSTS/CSP/X-Frame-Options/XSS-Protection/Referrer-Policy/Permissions-Policy

### 服务稳定性
- 优雅关闭机制：SIGTERM/SIGINT 信号处理，await HTTP/WS 关闭 → 停止定时任务 → 停止备份 → 关闭 DB → 刷日志，30s 超时强制退出
- uncaughtException/unhandledRejection 全局异常处理
- 所有 setInterval 添加 .unref() 防止阻止 Node.js 正常退出（3 处）
- 健康检查 10 秒缓存，避免高频调用影响性能
- SQLite mmap_size 从 30GB 调整为 1GB

### 新功能实现
- 备份恢复功能完整实现：查找备份 → 解压 → 完整性验证 → 恢复 → 清理临时文件
- 真实邮件发送（nodemailer SMTP），支持 SSL/TLS
- 前端 401 自动 token 刷新机制，不会因 token 过期误登出
- Web Terminal WebSocket 自动重连（指数退避，最多 3 次）
- 全局 Error Boundary 错误降级页面

### 跨平台兼容
- Windows 备份兼容性：spawn('gzip') → Node.js 内置 zlib.createGzip/createGunzip + pipeline
- 备份/恢复全平台可用

### Bug 修复
- Agent 巡检报告合规检查计数从硬编码 13 改为动态计算（实际 14 项）
- decryptWithKey 添加 try-catch 错误处理
- 密码修改后通过 AuthContext.updateUser() 统一更新状态（原为直接操作 localStorage）
- BigScreenDashboard JSON.parse 添加 try-catch 容错
- 数据库 mmap_size 注释统一

### 部署与发布
- Dockerfile 权限修复：chmod 777 → chown appuser:appgroup + chmod 750
- docker-compose.simple.yml 添加 CPU/内存限制、自定义网络隔离、日志驱动配置
- docker-compose.yml 添加日志大小限制（backend 50MB, frontend 15MB）
- docker-compose.yml 默认使用阿里云远程镜像（无需本地构建）
- .env.example 新增 ADMIN_INITIAL_PASSWORD 字段说明
- GitHub Actions CI/CD 完整流水线：
  - `ci.yml`：Push/PR 自动触发 Lint + TypeScript 检查 + 测试 + Docker 构建验证
  - `release.yml`：推送 tag 自动构建 Docker 镜像并推送至阿里云，自动生成 GitHub Release
  - `mirror.yml`：Push 到 main 自动同步代码到 Gitee/Gitcode
  - 详见 [docs/CICD_SETUP.md](docs/CICD_SETUP.md)

### 代码质量
- 前后端 TypeScript 编译零错误通过
- 所有修改均有明确的类型定义

---

## [Unreleased]

### 新增功能
- **Web SSH 终端** — 基于 xterm.js 的交互式远程终端
  - 实时双向 WebSocket 通信
  - 窗口大小自适应同步
  - VS Code 暗色主题配色
  - 连接状态可视化（连接中/已连接/错误/断开）
  - 服务器搜索筛选（按名称/IP/用户名/标签）
- **主机管理增强** — 企业级服务器分组与批量运维
  - 多级分组树形结构，支持父子关系
  - 按分组筛选服务器列表
  - JSON 批量导入，自动验证 SSH 连通性
  - 一键采集主机信息（OS/CPU/内存/磁盘/IP）
  - 服务器卡片展示分组标签和硬件信息

### Bug 修复
- 修复 Token 黑名单内存泄漏（Set 改为 Map + TTL 清理）
- 修复 Copilot 对话内存泄漏（添加 7 天 TTL + 1000 条上限）
- 修复加密服务空指针异常（activeKey 可能为 undefined）
- 修复 SSH 连接泄漏（错误路径未调用 conn.end()）
- 修复 WebSocket 监听器泄漏（terminal:data 重复注册）
- 修复 WebTerminal 路由切换黑屏问题（useEffect 依赖 + xterm.js 竞争）
- 修复 Servers 页面 .flatMap() 崩溃（防御性检查 undefined）
- 提取重复的 API 辅助函数到共享模块（getApiKey/getModelId/getApiBase/buildApiEndpoint）
- 修复 JWT 类型断言不规范问题
- 修复 import 语法不统一问题

### 改进
- 终端会话 30 分钟 TTL 自动清理，最大 100 个活跃会话
- 所有内存管理组件均添加上限和定时清理机制
- 前端路由切换时自动清理资源，防止 DOM 竞争
- 批量导入失败时自动清理孤儿数据（servers + group_mapping）

### 文档
- 新建 `WEB_TERMINAL.md` — Web 终端完整技术文档
- 新建 `SERVER_MANAGEMENT.md` — 主机管理增强功能文档
- 新建 `CHANGELOG.md` — 变更日志
- 新建 `TEST_GUIDE.md` — 功能测试说明
- 更新 `README.md` — 新增 Web 终端和主机管理功能说明
- 更新 `docs/README.md` — 新增文档导航条目
- 更新 `docs/ZABBIX_CONFIG.md` — 修复无效文档引用
- 更新 `.env.example` — 补充 JWT_SECRET 配置项
- 删除 `QUICKSTART.md` — 内容已合并到 README
- 删除 `DEPLOY.md` — 与 `DEPLOYMENT.md` 重复

### 代码质量
- 清理后端 database.ts 中的 5 处 DB_INIT DEBUG 调试日志
- 清理后端 settingsRoutes.ts 中的 5 处 DEBUG 调试日志
- 清理前端 Tasks.tsx 中的 10 处 WebSocket 调试日志
- 清理前端 ChatWidget.tsx 中的 4 处对话调试日志
- 清理后端 rootCauseAnalysisService.ts 和 reportService.ts 中的调试日志
- 修复 81 个 ESLint 警告（主要为 `any` 类型和未使用变量）
- 修复 `Math.random()` 在 `useMemo` 中的不稳定使用
- 修复 WorkflowEditor 中 useEffect 内 setState 的问题
- 前后端 TypeScript 编译零错误通过
- 清理 `.FullName` 垃圾文件和根目录重复的 `wechaterweima.png`

### 部署与发布
- 新增 `QUICK_DEPLOY.md` — 面向国内用户的快速部署指南
- 新增 `deploy.sh` — Linux 一键部署脚本（自动检查环境、生成配置、拉取镜像、启动服务、健康检查）
- 推送 Docker 镜像到阿里云杭州镜像仓库
  - 后端: `registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:IT_Onlin-ITOps-backend-latest`
  - 前端: `registry.cn-hangzhou.aliyuncs.com/huluwa666/tsq-images-hub:IT_Onlin-ITOps-frontend-latest`
- 修复 `QUICK_DEPLOY.md` 中 JWT_SECRET 生成逻辑（heredoc 变量展开问题）

### 安全
- 所有 WebSocket 连接均需 JWT 认证
- SSH 密码和密钥 AES-256-GCM 加密存储
- 组件卸载时主动断开 SSH 连接和清理监听器
- 批量导入自动去重，防止重复添加服务器

---

## [3.0.1] — 2026-05-25

### 版本升级
- 版本号从 `v1.0.0` 升级至 `v3.0.1`
- 更新所有 `package.json` 版本号（根目录、frontend、backend）
- 更新 `SPEC.md` 版本号

## [1.0.0] — 2026-05-18

### 初始发布
- 多 Agent 协作平台
- 可视化工作流编排
- 服务器管理（SSH 命令执行/合规检查）
- 告警中心（Prometheus/Zabbix/通用）
- 知识库 + RAG 检索
- AI Copilot 对话式运维
- 定时任务
- 报告系统
- Docker 一键部署
