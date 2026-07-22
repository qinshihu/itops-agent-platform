# ITops Agent 顶层规则（Trae CN 专属）

> **适用范围**：本文件是 **Trae CN**（项目默认 AI 工具）的**必读首条规则**。
> 其他 AI 工具（Cursor/Copilot/Claude Code 等）的入口文件已统一移到根目录 [`ai-tool-configs/`](file:///c:/Users/123/Desktop/daima/AIops/ai-tool-configs/)，按需手动 `cp` 使用。
>
> **维护原则**：
>
> - 本文件只描述 Trae CN 专属规则；**项目级豁免/强规则见 [AGENTS.md §8](../../AGENTS.md#8-项目记忆2026-07-21-v21-新增)**（详见 [ADR-035](../adr/035-agents-md-top-rules-merge.md)）
> - 项目代码发生变化时，必须同步更新本文件 + `AGENTS.md` + `.trae/` 相关文档，并同步各模块 `README.md`（包括 `backend/src/modules/*/README.md`、`frontend/src/modules/*/README.md`）
> - 所有文档只保留最新的有效内容，过时的历史信息、变更记录、迁移说明这类「考古」内容全部删掉
> - 每次最终推送仓库前：检查 `backend/` 和 `frontend/` 内部所有 README.md（包括子模块、子目录），看有没有需要更新的
> - 改根 `README.md` 中文版后，必须提醒用户同步更新 6 份多语言 README（en/ja/ko/fr/de/TW），与中文版保持结构与内容一致（详见 [AGENTS.md §8.4 L1 教训](../../AGENTS.md#L152)）

---

## 📑 目录（Table of Contents）

| §   | 标题               | 一句话说明                                                         |
| --- | ------------------ | ------------------------------------------------------------------ |
| 一  | AI 工具支持范围    | 只维护 Trae CN；其他工具入口按需 `cp`                              |
| 二  | 代码位置与开发方式 | backend/frontend + 三种开发模式 + 长跑进程独立 Terminal            |
| 三  | 探索开发阶段约束   | 探索期、Repository/Service 优先 + 临时脚本统一在 `scripts/<task>/` |
| 四  | 文档同步规则       | 新增代码必同步更新 `.trae/` + `AGENTS.md`                          |
| 五  | 本地 Node 环境     | 见 [AGENTS.md §8.2](../../AGENTS.md#82-路径与目录约定) 路径约定    |

> **项目特定豁免/强规则**（CODEOWNERS 单点 owner / Dependabot+CodeQL / PR 模板双重保险 / 测试覆盖率豁免）→ [AGENTS.md §8.8 ~ §8.11](../../AGENTS.md#8-项目记忆2026-07-21-v21-新增)
> **强制报告规则**（8 条）→ [AGENTS.md §8.6](../../AGENTS.md#86-强制报告规则迁移自-top-rulesmd-一2026-07-23)
> **强制编码约束**（max-lines + PowerShell 禁令）→ [AGENTS.md §8.7](../../AGENTS.md#87-强制编码约束迁移自-top-rulesmd-三2--七2026-07-23)
> **详细业务规则**（架构/前端/PowerShell/测试）→ [.trae/rules/](./) 其他文件

---

## 一、AI 工具支持范围

**开发阶段默认只维护 Trae CN 相关的 AI 开发文件**（即根目录 [`AGENTS.md`](file:///c:/Users/123/Desktop/daima/AIops/AGENTS.md) + [`.trae/`](file:///c:/Users/123/Desktop/daima/AIops/.trae/) 目录下的内容）。

**不维护**以下 AI 工具的入口文件（不要主动生成、修改、迁移）：

- `.cursorrules`（Cursor）
- `.windsurfrules`（Windsurf）
- `.aider.conf.yml`（Aider）
- `.continue/config.json`（Continue.dev）
- `CLAUDE.md`（Claude Code）
- `.github/copilot-instructions.md`（GitHub Copilot）

**唯一例外**：当用户**明确要求**为某个工具生成/更新入口文件时，才允许生成对应文件。

**统一收纳位置**：如确需提供其他 AI 工具入口，已统一放到根目录 [`ai-tool-configs/`](file:///c:/Users/123/Desktop/daima/AIops/ai-tool-configs/)，由用户按需手动 `cp` 到根目录使用。详见 [ai-tool-configs/README.md](../../ai-tool-configs/README.md)。

**设计原因**：

- **减少根目录维护负担**：之前 6 个 AI 工具文件分散在根目录，每次规则更新要同步 6+ 份派生文件
- **避免规则漂移**：多份派生文件容易出现内容不一致
- **集中精力**：维护 Trae CN + AGENTS.md 已能覆盖 AI 协作 80%+ 场景

---

## 二、代码位置与开发方式

### 2.1 代码位置

项目代码在以下两个目录下：

```
backend/    # 后端（Node.js + Express + TypeScript + SQLite）
frontend/   # 前端（React + Vite + TypeScript + Ant Design）
```

完整结构见 [`documents/TECH_ARCHITECTURE.md`](../documents/TECH_ARCHITECTURE.md)。

#### 2.1.1 依赖安装位置（三独立目录 + npm）

> **设计决策**：项目**不**使用 npm/pnpm workspaces，**不**是 monorepo 工具链架构。三个目录各自维护独立 `package.json` + `package-lock.json`。

| 目录                         | 内容                                                      |
| ---------------------------- | --------------------------------------------------------- |
| **根 `node_modules/`**       | 工程工具链（lint / arch 检查 / git hooks / 文档格式化）   |
| **`backend/node_modules/`**  | 后端运行时（Express + TypeScript + SQLite + native 模块） |
| **`frontend/node_modules/`** | 前端运行时（React + Vite + Antd）                         |

**首次安装 / 补全依赖**：

```bash
npm run install:all
# 等价于：npm install && cd backend && npm install && cd ../frontend && npm install
```

### 2.2 本地开发方式（三种，按推荐优先级排序）

#### 方式一：宿主机直接运行（最快，推荐日常编码调试）

```bash
后端: cd backend; npm run dev    → http://localhost:3001
前端: cd frontend; npm run dev   → http://localhost:3000
```

- 改代码即热重载（tsx watch + Vite HMR），无需任何构建
- **推荐 Node 20**（版本固定见项目根目录 [`.nvmrc`](../../.nvmrc)，内容为 `20.19.5`）
- 推荐使用 fnm（Fast Node Manager）管理 Node 版本，自动读取 .nvmrc 切换（详见 [docs/Node_v20.19.5_安装方案.md](../../docs/Node_v20.19.5_安装方案.md)）
- 若 better-sqlite3 等 native 模块兼容性问题，可改用 Node 24

#### 2.2.1 长跑进程必须独立 Terminal（强制规则）

> **规则**：`npm run dev` / `npm run dev:backend` / `npm run dev:frontend` / `docker compose up` / `npm run build:watch` 等长跑进程**必须放在独立 terminal**，禁止与一次性命令（curl / git status / ls / cat 等）共用同一个 terminal。

**为什么**：

- AI 协作工具（Trae CN）的 terminal 复用机制会因「在跑长跑进程的 terminal 里执行下一个命令」而**误杀**正在运行的 dev server（表现为 vite/node 进程被 SIGTERM）
- 用户看到的是「前端突然连不上了 / 报网络错误」，但根因是 dev server 已死

**正确做法**：

```bash
# Terminal A（专用，后端）:  长跑，永不混用
cd backend && npm run dev

# Terminal B（专用，前端）:  长跑，永不混用
cd frontend && npm run dev

# Terminal C（一次性命令）:  curl / git / ls / 文件操作
curl http://localhost:3001/health
```

#### 方式二：local-dev Docker 开发环境（环境与生产一致，推荐调试/演示）

目录：`../local-dev`（项目根目录下的 local-dev 子目录）

```bash
首次或 package.json 变更时:  cd local-dev; docker compose build
日常启动:                    cd local-dev; docker compose up -d
停止:                        cd local-dev; docker compose down
```

- 访问：前端 http://localhost:5173、后端 http://localhost:3001、Node 调试器 9229
- 原理：镜像只装依赖，源码通过 volume 挂载进容器，tsx watch + Vite HMR 热重载
- **关键规则：改业务代码不需要 rebuild！只有 package.json 变更时才需要 docker compose build**

#### 方式三：生产镜像（仅用于验证部署/交付，严禁用于日常开发）

目录：项目根目录下的 `docker/Dockerfile.*`

```bash
docker build -f docker/Dockerfile.backend -t itops-backend .
docker build -f docker/Dockerfile.frontend -t itops-frontend .
```

每次改代码都要 rebuild 整个镜像，不适合开发迭代。

---

## 三、探索开发阶段约束

### 3.1 阶段定位

- **项目处于探索开发阶段**，测试代码按需编写、不强制要求（详见 [AGENTS.md §8.11](../../AGENTS.md#811-豁免规则探索期测试不强制迁移自-top-rulesmd-十二2026-07-23)）

### 3.2 架构原则（必须遵守）

- 新功能开发时严格遵循「业务代码不直接操作 db，必须经过 Repository」的原则
- 新功能开发时严格遵循「路由层不直接操作 Repository，必须经过 Service 层」的原则（详见 [`architecture.md`](./architecture.md) §3.2）

### 3.3 大文件拆分（暂缓）

- **大文件拆分任务暂缓执行**：行数本身不是架构问题，关键是文件性质是否违反架构规则
- 拆分方法论完整沉淀于 [ADR-031](../../.trae/adr/031-v2-large-file-splitting-methodology.md) + [ADR-034](../../.trae/adr/034-v001-migration-splitting.md)
- 单文件 ≤ 500 行是 ESLint 强制约束（详见 [AGENTS.md §8.7.1](../../AGENTS.md#871-单文件--500-行eslint-强制)）
- 详细分级分析与文件清单见 [`docs/关于大文件的拆分.md`](../../docs/关于大文件的拆分.md)

### 3.4 临时测试/验证脚本统一存放

**强制规则**：

1. **脚本根目录**：`scripts/` 用于存放**核心 + 长期工具脚本**，例如：
   - `scripts/check-architecture.js` — [package.json L14-16](../../package.json#L14) `check:arch` 引用
   - `scripts/lint-staged.cjs` — [package.json L48-53](../../package.json#L48) `lint-staged` 引用

2. **临时测试 / 验证 / 一次性脚本统一存放在 `scripts/<task-name>/` 子目录**：
   - 每个新任务（拆分 / 迁移 / 验证）创建独立子目录
   - 子目录名 = 任务 ID（如 `verify-v001-schema/` / `verify-bug-042/` / `migrate-v058/`）
   - 任务完成且 ADR 中记录了验证方法后：**子目录必须清理或归并**——临时脚本全删，永久验证脚本移到 `scripts/` 根

3. **引用完整性原则**：
   - **被 package.json / .husky / CI workflow 引用的脚本** = 永久脚本，放在 `scripts/` 根
   - **被 ADR / lessons-learned 引用的脚本** = 永久脚本，**保留**（即使无 npm 引用）
   - **未在 ADR / lessons-learned / package.json 引用的脚本** = 临时脚本，**清理掉**

4. **生成时机**：
   - ✅ 生成临时脚本**前**，判断该任务是**一次性**还是**长期**：
     - **一次性**（如本次 v001 字节级 byte-diff 验证）→ 任务完成后**必须删除**
     - **长期**（如 SQLite schema 等价验证后续可能复用）→ 迁移到 `scripts/verify-v001-schema/` 或 `scripts/` 根，并在 ADR 中交叉引用
   - ✅ 引用 ADR 后**禁止删除**：删除前**强制**验证无 ADR / lessons-learned / package.json 引用

5. **CI 阻断保护**：
   - 临时脚本不提交到 git（如确需提交，必须放在 `scripts/<task-name>/` 子目录而非 `scripts/` 根）
   - **禁止**在 `scripts/` 根留有**未引用**的临时文件

**依据**：

- [ADR-031 §三 v2.x 大文件拆分完整方法论](../../.trae/adr/031-v2-large-file-splitting-methodology.md)（12 模式 + 15 错误）
- [ADR-034 §三 v001 migration 拆分 B 模式](../../.trae/adr/034-v001-migration-splitting.md)（引用 sqlite-parse-test.js）
- [lessons-learned.md §七 案例库](../../.trae/rules/lessons-learned.md)（AI 用 Glob 查 `scripts/**` 返回空 — 强制二次核实）

---

## 四、文档同步规则

1. **新增项目代码后，必须同步更新 `.trae` 目录下的文件描述**（规则、ADR、模块 README）
2. 所有新生成的报告文件，都保存到 `../docs/` 目录下（项目根目录下的 docs 子目录）
3. 详细架构规则见 [`architecture.md`](./architecture.md) 和 [`adr/README.md`](../adr/README.md)

### 4.1 全面阅读项目代码的同步执行清单

> **触发**：用户要求「全面认证阅读项目代码，然后更新相关文档」。本节列出本次执行后的同步清单，**作为 §四 规则的执行范本**。

| 改动类型     | 文件                                                                                                     | 改动内容                                                                                                           |
| ------------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 新增 ⚠️ 提醒 | [backend/src/modules/monitor/README.md](../../backend/src/modules/monitor/README.md)                     | 添加 READ-ME-001 段：发现 `routes/prometheusRoutes.ts` 与 `routes/zabbixRoutes.ts` **未挂载**（P0 bug，✅ 已修复） |
| 新增 ⚠️ 提醒 | [frontend/src/modules/backup/README.md](../../frontend/src/modules/backup/README.md)                     | 添加 READ-ME-002 段：发现 `backupRoutes` **未注册到 `_routes.tsx`**（P0 bug，前端页面不可达，✅ 已修复）           |
| 前端联检     | [frontend/src/modules/monitor/README.md](../../frontend/src/modules/monitor/README.md)                   | 添加「⚠️ READ-ME-001 关联」段：前端 `monitor/routes.ts` 已注册 prometheus/zabbix 但后端 API 404（✅ 已修复）       |
| 路径修正     | [backend/src/modules/mcp/README.md](../../backend/src/modules/mcp/README.md)                             | `/api/mcp/*` → `/api/v1/mcp/*` + 添加双前缀说明                                                                    |
| 路径修正     | [backend/src/modules/ai/README.md](../../backend/src/modules/ai/README.md)                               | 补充 `/mcp` 代理挂载 + 9 个 mount 路由表                                                                           |
| 路径细化     | [backend/src/modules/alerts/README.md](../../backend/src/modules/alerts/README.md)                       | 添加 7 个子路由 + 3 个 named export 的实际挂载表                                                                   |
| 服务清单     | [backend/src/modules/auto/README.md](../../backend/src/modules/auto/README.md)                           | 添加 11 个服务文件（含 1 测试）+ 4 子路由表                                                                        |
| 路径表扩充   | [backend/src/modules/network/README.md](../../backend/src/modules/network/README.md)                     | 添加 6 路由表 + 17 厂商适配器清单 + VNC 代理说明                                                                   |
| 路径表扩充   | [backend/src/modules/workflow/README.md](../../backend/src/modules/workflow/README.md)                   | 添加 3 路由表 + 20 服务清单 + 状态机保护说明                                                                       |
| 路径表扩充   | [backend/src/modules/auth/README.md](../../backend/src/modules/auth/README.md)                           | 添加 3 router 导出表 + 5 服务清单 + RBAC + 节流说明                                                                |
| 路径修正     | [backend/src/modules/audit/README.md](../../backend/src/modules/audit/README.md)                         | 路径前缀从 `/audit-logs` 修正为 `/audit`（与 `_registry.ts` 挂载一致）                                             |
| 路径表扩充   | [backend/src/modules/change-management/README.md](../../backend/src/modules/change-management/README.md) | 添加 2 路由表 + 4 服务清单 + 工作流联动说明                                                                        |
| 路由表扩充   | [backend/src/modules/servers/README.md](../../backend/src/modules/servers/README.md)                     | 添加 5 路由端点表（SSH/RemoteDesktop/AI Assistant/Import 等）                                                      |
| 路由表扩充   | [backend/src/modules/containers/README.md](../../backend/src/modules/containers/README.md)               | 12 个 mount path 表（`/docker/*` 标注 Deprecation: true）                                                          |
| 路由表扩充   | [backend/src/modules/config-management/README.md](../../backend/src/modules/config-management/README.md) | 添加 3 路由表                                                                                                      |
| 路由表扩充   | [backend/src/modules/backup/README.md](../../backend/src/modules/backup/README.md)                       | 添加 `/backups/*` 路由表                                                                                           |
| 路由表扩充   | [backend/src/modules/database/README.md](../../backend/src/modules/database/README.md)                   | 添加 `/database-connections/*` 路由表                                                                              |
| 路由表扩充   | [backend/src/modules/dc/README.md](../../backend/src/modules/dc/README.md)                               | 添加 `/dc` + `/dc-infrastructure` 双别名说明 + 13 子路由迁移记录                                                   |
| 路由表扩充   | [backend/src/modules/kubernetes/README.md](../../backend/src/modules/kubernetes/README.md)               | 添加 `/kubernetes/*` 路由表                                                                                        |
| 路由表扩充   | [backend/src/modules/notification/README.md](../../backend/src/modules/notification/README.md)           | 添加 `/notifications` + `/notification-config` 双路由表                                                            |
| 路由表扩充   | [backend/src/modules/scripts/README.md](../../backend/src/modules/scripts/README.md)                     | 添加 `/scripts/*` 路由表 + WebSocket 不走 REST 声明                                                                |
| 路由表扩充   | [backend/src/modules/settings/README.md](../../backend/src/modules/settings/README.md)                   | 添加 `/settings/*` 路由表                                                                                          |
| 路由表扩充   | [backend/src/modules/tool-links/README.md](../../backend/src/modules/tool-links/README.md)               | 添加 `/tool-links/*` 路由表                                                                                        |
| 路由表扩充   | [backend/src/modules/import-export/README.md](../../backend/src/modules/import-export/README.md)         | 添加 `/import-export/*` 路由表                                                                                     |
| 路由表扩充   | [backend/src/modules/linkage/README.md](../../backend/src/modules/linkage/README.md)                     | 添加 `/linkage/*` 路由表 + 前端 23 模块无 linkage 对应实现声明                                                     |
| 架构层细化   | [.trae/rules/architecture.md §1.3/§1.4/§1.5/§3.5](./architecture.md)                                     | 数据库/技术架构层 + 启动序列 + 测试规则与代码现状对齐                                                              |
| 前端共享层   | [.trae/rules/frontend.md §1.0/§八/§九](./frontend.md)                                                    | 添加 `frontend/src` 顶层结构 + App.tsx 包裹顺序 + axios 401 自动刷新规则                                           |
| 部署架构     | [.trae/documents/TECH_ARCHITECTURE.md §6/§8](../documents/TECH_ARCHITECTURE.md)                          | 三种开发模式 + 健康检查端点 + 26 个服务注册清单 + 不一致报告                                                       |

---

## 五、本地 Node 环境

本地 Node 版本固定 `20.19.5`（见 [AGENTS.md §8.2](../../AGENTS.md#82-路径与目录约定) + [.nvmrc](../../.nvmrc)），实际安装位置见 [docs/Node_v20.19.5_安装方案.md](../../docs/Node_v20.19.5_安装方案.md)。

---

## 附录 A：ADR 索引（与本文件相关）

| ADR                                                | 标题                                   | 与本文件关联                                            |
| -------------------------------------------------- | -------------------------------------- | ------------------------------------------------------- |
| [ADR-019](../adr/019-trae-adr-git-tracking.md)     | ADR git 跟踪策略                       | `.trae/` 反向 gitignore 规则                            |
| [ADR-022](../adr/022-node20-dep-pin.md)            | depcruise 锁 Node 20                   | §二 方式一「推荐 Node 20」                              |
| [ADR-025](../adr/025-p1-batch-fixes.md)            | P1 批量修复                            | [AGENTS.md §8.7.2](../../AGENTS.md) PowerShell 编码禁令 |
| [ADR-026](../adr/026-top-rules-refactor.md)        | **本文件重构决策**                     | 1.md → top-rules.md                                     |
| [ADR-035](../adr/035-agents-md-top-rules-merge.md) | **AGENTS.md 与 top-rules.md 合并决策** | §目录 → [AGENTS.md §8](../../AGENTS.md) 迁移说明        |

---

**最后更新**：2026-07-23（v2.3：从本文件迁出项目特定规则到 AGENTS.md §8，本文件精简，详见 [ADR-035](../adr/035-agents-md-top-rules-merge.md)）
