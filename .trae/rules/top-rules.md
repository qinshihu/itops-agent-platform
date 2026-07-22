# ITops Agent 项目顶层规则（top-rules）

> **适用范围**：本文件是 **Trae CN**（项目默认 AI 工具）的**必读首条规则**。
> 其他 AI 工具（Cursor/Copilot/Claude Code 等）的入口文件已统一移到根目录 [`ai-tool-configs/`](file:///c:/Users/123/Desktop/daima/AIops/ai-tool-configs/)，按需手动 `cp` 使用。
>
> **维护原则**：项目代码发生变化时，必须同步更新本文件及 `.trae/` 下相关文档，并同步各模块 `README.md`（包括 `backend/src/modules/*/README.md`、`frontend/src/modules/*/README.md`）。
> 所有文档只保留最新的有效内容，过时的历史信息、变更记录、迁移说明这类"考古"内容全部删掉 — 这些对当前使用没价值，只占 token。

---

## 📑 目录（Table of Contents）

| §    | 标题                   | 一句话说明                                                                              |
| ---- | ---------------------- | --------------------------------------------------------------------------------------- |
| 一   | 强制报告规则           | 任何不一致/建议/写测试前都需报告                                                        |
| 二   | AI 工具支持范围        | 只维护 Trae CN；其他工具入口按需 `cp`                                                   |
| 三   | 文档路径与编码         | 相对路径、UTF-8、PowerShell 编码安全                                                    |
| 四   | 代码位置与开发方式     | backend/frontend + 三种开发模式                                                         |
| 五   | 探索开发阶段约束       | 探索期、测试按需、Repository/Service 优先 + **临时脚本统一在 scripts/<task>/**（v2.32） |
| 六   | 文档同步规则           | 新增代码必同步更新 .trae/                                                               |
| 七   | ⚠️ PowerShell 编码禁令 | 跨文件批量改内容严禁 PS cmdlet（细节见 [powershell.md](./powershell.md)）               |
| 八   | 本地 Node 环境         | 见 [AGENTS.md §10.2](../../AGENTS.md#102-路径与目录约定) 路径约定                       |
| 九   | CODEOWNERS 单点 owner  | 24 模块 owner 全为 `@tance` 是有意设计——探索期豁免，暂不拆分                            |
| 十   | Dependabot 已启用      | npm/GitHub Actions/Docker 三生态每周一扫描；CodeQL 暂缓豁免                             |
| 十一 | PR 模板自检豁免        | 9 项 checklist 依赖人工——但核心 6 项已被 CI 强制，豁免为双重保险                        |
| 十二 | 测试覆盖率豁免         | 探索期 P1 测试覆盖率任务整项豁免——vitest 配置 25/60/30/25 阈值不强制                    |

---

## 一、强制报告规则

1. **如果发现项目实际代码跟 .trae 目录下的文件描述有不一致的，需要及时报告；**
2. 任何时候你有好的建议，都可以及时报告；
3. **不需要写测试文件**，真的要写先询问用户是否写测试文件；
4. 中英文切换功能可以以后再做。
5. **ai-tool-configs/ 不要动**：`ai-tool-configs/` 目录收纳的是其他 AI 工具（Cursor/Copilot/Claude Code 等）的入口文件，开发过程中**不需要更新或修改**，除非用户**明确要改**某个工具的配置。
6. **错误沉淀**：发生错误时按 [lessons-learned.md](./lessons-learned.md) 流程分级处理（L1 记忆 / L2 更新规则 / L3 新建规则文件）。
7. **测试覆盖率不达阈值**：目前是开发阶段，测试覆盖率不达阈值（如 < 80%）时，不需要关心，直接忽略。
8. 大文件拆分后要全面分析和考虑相关的文件和文档的及时更新，另外会不会牵连出其它的问题，比如docker构建或其它引用的问题,这些也要及时处理和报告。

---

## 二、AI 工具支持范围（2026-07-21 v2.1 新增）

**开发阶段默认只维护 Trae CN 相关的 AI 开发文件**（即根目录 [`AGENTS.md`](file:///c:/Users/123/Desktop/daima/AIops/AGENTS.md) + [`.trae/`](file:///c:/Users/123/Desktop/daima/AIops/.trae/) 目录下的内容）。

**不维护**以下 AI 工具的入口文件（不要主动生成、修改、迁移）：

- `.cursorrules`（Cursor）
- `.windsurfrules`（Windsurf）
- `.aider.conf.yml`（Aider）
- `.continue/config.json`（Continue.dev）
- `CLAUDE.md`（Claude Code）
- `.github/copilot-instructions.md`（GitHub Copilot）

**唯一例外**：当用户**明确要求**为某个工具生成/更新入口文件时（如用户说"加 .cursorrules"、"让 Claude Code 能用"），才允许生成对应文件。

**统一收纳位置**：如确需提供其他 AI 工具入口，已统一放到根目录 [`ai-tool-configs/`](file:///c:/Users/123/Desktop/daima/AIops/ai-tool-configs/)（2026-07-21 v2.1 创建），由用户按需手动 `cp` 到根目录使用。详见 [ai-tool-configs/README.md](../../ai-tool-configs/README.md)。

**设计原因**：

- **减少根目录维护负担**：之前 6 个 AI 工具文件分散在根目录，每次规则更新要同步 6+ 份派生文件
- **避免规则漂移**：多份派生文件容易出现内容不一致
- **集中精力**：维护 Trae CN + AGENTS.md 已能覆盖 AI 协作 80%+ 场景

---

## 三、文档路径与编码

> **2026-07-21 v2.1 合并**：原 blockquote 顶部规则 + PowerShell 编码禁令统一收口到本章。

### 3.1 路径约定

- **相对路径**：文档中的路径必须用相对路径（基于项目根目录），所有开发环境的开发目录参看 [AGENTS.md §10 项目记忆](../../AGENTS.md#10-项目记忆2026-07-21-v21-新增)
- **前后端同步**：所有功能的开发和实现，要前后端都做，不能只做前端不做后端，也不能只做后端不做前端

### 3.2 单文件大小

#### 核心规则（强制）

1. **新代码文件 ≤ 500 行（强制）**
   - `backend/.eslintrc.json` + `frontend/.eslintrc.json` 的 `max-lines` 规则已升级为 `error`（**2026-07-21 v2.5 落地**）
   - 新文件超 500 行将**真阻断 CI**
   - 适用范围：`.js` / `.ts` / `.tsx` / `.cjs`（`.md` 文档不在强制范围）

2. **既有超 500 行文件必须在 `overrides` 中逐文件豁免**
   - 拆分完成后从清单移除文件 + 在 overrides 块添加 v2.x 拆分注释
   - 详见 §3.2.A 当前豁免清单状态

3. **拆分前必跑 4 步风险防御**（[lessons-learned.md §3.5.1](./lessons-learned.md#351-拆分前必跑-4-步风险防御强制)）

   ```powershell
   git status --short <file>          # Step 1: 检查 uncommitted diff
   git diff HEAD --stat <file>        # Step 2: 显示 insertions / deletions
   node -e "..."  WORKSPACE vs HEAD   # Step 3: 对比 git 行数 vs workspace
   Grep -pattern "<file>" -path ...   # Step 4: find consumers (routes / mocks / Docker)
   ```

4. **拆分前后必跑 tsc 全文验证**（[lessons-learned.md §3.5.2](./lessons-learned.md#352-tsc-全文验证新增规则-14---baseline-bug-修复)）
   ```bash
   npx tsc --noEmit 2>&1 | grep <file_path>
   ```
   - 拆分前：发现 baseline error（**简单 typo 必修** + 记录）
   - 拆分后：确认 0 个新错误

#### §3.2.A 当前豁免清单状态

| 类型         | 实测文件    | 状态                                                                            | 位置                                                                              |
| ------------ | ----------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **frontend** | **0 个** 🎉 | 清单全清                                                                        | [frontend/.eslintrc.json](../../frontend/.eslintrc.json) `overrides[1].files: []` |
| **backend**  | **1 个**    | 仅 `src/migrations/v001_initial_schema.ts`（按 ADR-013 不拆，类型声明集中文件） | [backend/.eslintrc.json](../../backend/.eslintrc.json) `overrides[2].files`       |
| **总计**     | **1 个**    |                                                                                 |                                                                                   |

当前 frontend **0 个**超 500 行文件，最大单文件是 `frontend/src/modules/tool-links/pages/tool-links/useToolLinksData.ts`（215 行）。

#### §3.2.B 拆分方法论完整资产

遇到新文件需拆分时，按以下顺序查询：

1. **12 个拆分模式 + 15 个错误案例**：[`.trae/adr/031-v2-large-file-splitting-methodology.md`](../adr/031-v2-large-file-splitting-methodology.md)
2. **4 步风险防御 + 6 强制规则**：[`lessons-learned.md §3.5.1-3.5.6`](./lessons-learned.md)
3. **拆分示范**：参考 `frontend/src/modules/ai/pages/agents/tool/`（4 文件拆 1 文件的最小示例）+ `frontend/src/modules/notification/pages/notification-settings/`（9 子模块的完整示例，含 deep merge + 避免抽象教训）

#### §3.2.C 拆分后必做 5 件事（ad-hoc check list）

```
□ 1. npx tsc --noEmit 2>&1 | grep <file_path>  → 0 错
□ 2. node -e "..."  每个子文件 ≤ 500 行
□ 3. ESLint overrides 清单移除原文件 + 添加 v2.x 注释
□ 4. module/README.md 添加新子模块清单 + v2.x 标注
□ 5. barrel + default export 桶兼容验证（routes.ts / test mock 零改动）
```

#### §3.2.D 强制项

未来新代码文件超 500 行将被 ESLint `error` 规则**真阻断 CI**（不允许 overrides 新增）。

### 3.3 编码安全（PowerShell）

- Windows 环境下用 PowerShell 修改含中文文件时，必须遵守 [powershell.md](./powershell.md) 编码安全规则
- 跨文件内容修改严禁用 PowerShell cmdlet（详见 §七）

---

## 四、代码位置与开发方式

### 4.1 代码位置

项目代码在以下两个目录下：

```
backend/    # 后端（Node.js + Express + TypeScript + SQLite）
frontend/   # 前端（React + Vite + TypeScript + Ant Design）
```

完整结构见 [`documents/TECH_ARCHITECTURE.md`](../documents/TECH_ARCHITECTURE.md)。

#### 4.1.1 依赖安装位置（三独立目录 + npm）

> **设计决策（2026-07-22 实测）**：项目**不**使用 npm/pnpm workspaces，**不**是 monorepo 工具链架构。三个目录各自维护独立 `package.json` + `package-lock.json`，**保留简单直接的「三独立 npm 项目」模式**。

**目录分布**（实测 2026-07-22）：

```
AIops/
├── node_modules/         ← 228 个包（根：工程工具链）
├── backend/node_modules/  ← 410 个包（后端运行时）
└── frontend/node_modules/ ← 496 个包（前端运行时）
```

| 目录                         | 内容                                                      | 关键依赖                                                                                     |
| ---------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **根 `node_modules/`**       | 工程工具链（lint / arch 检查 / git hooks / 文档格式化）   | `dependency-cruiser` / `lint-staged` / `madge` / `prettier` / `husky` / `concurrently`       |
| **`backend/node_modules/`**  | 后端运行时（Express + TypeScript + SQLite + native 模块） | `express` / `better-sqlite3` / `socket.io` / `ssh2` / `dockerode` / `net-snmp` / `zod`       |
| **`frontend/node_modules/`** | 前端运行时（React + Vite + Antd）                         | `react` / `vite` / `antd` / `@tanstack/react-query` / `socket.io-client` / `axios` / `three` |

**首次安装 / 补全依赖**：

```bash
# 一次性安装全部依赖（首次约 3-5 分钟，包含 native 模块编译）
npm run install:all

# 等价于：
# npm install && cd backend && npm install && cd ../frontend && npm install
```

**为什么不切 pnpm workspaces**（探索期豁免）：

- ✅ 项目处于探索期（见 §五），代码变动频繁，避免 workspaces 拓扑复杂度
- ✅ 三独立目录满足 [architecture.md §三.1](file:///c:/Users/123/Desktop/daima/AIops/.trae/rules/architecture.md) "按模块组织" 原则，无需 workspaces 跨包引用
- ✅ 各自 lockfile 独立维护，CI 故障隔离
- 🟢 **有意保留设计**（不是缺陷）——切换 workspaces 应作为 P3 任务，等模块边界冻结 ≥ 6 个月后再评估

**触发切换条件**（任一满足时重新评估）：

- 项目进入稳定维护期（模块边界冻结 ≥ 6 个月）
- 日常 `npm install` 时长成为痛点（> 5 分钟）
- `node_modules` 总大小 > 2GB
- 新人 onboarding 反馈"装依赖太复杂"
- `@tance` 主动决定切换

**包管理器切换指引**（未来切换时）：

1. 评估 pnpm workspaces vs 保持三独立
2. 若切：删除 3 份 `package-lock.json` → 新增 `pnpm-workspace.yaml` → 改 `install:all` 脚本 → 同步 husky / lint-staged / depcruise / Dependabot 配置
3. 创建 `ADR-035 包管理器与 workspaces 决策` 记录决策背景
4. 更新本文档 §4.1.1 + `TECH_ARCHITECTURE.md` §6

### 4.2 本地开发方式（三种，按推荐优先级排序）

#### 方式一：宿主机直接运行（最快，推荐日常编码调试）

```bash
后端: cd backend; npm run dev    → http://localhost:3001
前端: cd frontend; npm run dev   → http://localhost:3000
```

- 改代码即热重载（tsx watch + Vite HMR），无需任何构建
- **推荐 Node 20**（版本固定见项目根目录 [`.nvmrc`](../../.nvmrc)，内容为 `20.19.5`）
- 推荐使用 fnm（Fast Node Manager）管理 Node 版本，自动读取 .nvmrc 切换（详见 [docs/Node_v20.19.5_安装方案.md](../../docs/Node_v20.19.5_安装方案.md)）
- 若 better-sqlite3 等 native 模块兼容性问题，可改用 Node 24（各开发者自行安装，路径不做硬性约束）

#### §4.2.1 长跑进程必须独立 Terminal（强制规则，2026-07-22 实测）

> **规则**：`npm run dev` / `npm run dev:backend` / `npm run dev:frontend` / `docker compose up` / `npm run build:watch` 等长跑进程**必须放在独立 terminal**，禁止与一次性命令（curl / git status / ls / cat 等）共用同一个 terminal。

**为什么**（2026-07-22 实测教训）：

- AI 协作工具（Trae CN）的 terminal 复用机制会因"在跑长跑进程的 terminal 里执行下一个命令"而**误杀**正在运行的 dev server（表现为 vite/node 进程被 SIGTERM）
- 用户看到的是"前端突然连不上了 / 报网络错误"，但根因是 dev server 已死
- 重启 dev server 后虽然能恢复，但会打断开发节奏 + 丢失 HMR 状态

**正确做法**：

```bash
# Terminal A（专用，后端）:  长跑，永不混用
cd backend && npm run dev

# Terminal B（专用，前端）:  长跑，永不混用
cd frontend && npm run dev

# Terminal C（一次性命令）:  curl / git / ls / 文件操作
curl http://localhost:3001/health
```

**判定自检（启动前）**：

```
□ 这个 terminal 已经在跑 npm run dev 了吗？
  ├─ 是 → ❌ 禁止再用，跑新命令到 Terminal C/D/E
  └─ 否 → ✅ 可以跑一次性命令
```

**恢复措施**（如果已经误杀）：

```bash
# 重启对应 dev server（不要在原 terminal 重启，换新 terminal）
cd c:\Users\123\Desktop\daima\AIops\frontend  # 或 backend
npm run dev
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

## 五、探索开发阶段约束

### 5.1 阶段定位

- **项目处于探索开发阶段**，测试代码按需编写、不强制要求

### 5.2 架构原则（必须遵守）

- 新功能开发时严格遵循"业务代码不直接操作 db，必须经过 Repository"的原则
- 新功能开发时严格遵循"路由层不直接操作 Repository，必须经过 Service 层"的原则（详见 [`architecture.md`](./architecture.md) §3.2）

### 5.3 大文件拆分（暂缓）

- **大文件拆分任务暂缓执行**（2026-07-20 决定）：
  - 行数本身不是架构问题，关键是文件性质是否违反架构规则
  - **2026-07-21 v2.31 升级**：拆分方法论完整沉淀于 [ADR-031](../../.trae/adr/031-v2-large-file-splitting-methodology.md) + [ADR-034](../../.trae/adr/034-v001-migration-splitting.md)；拆分期间产生的验证脚本按下文 §5.4 存放
  - 详细分级分析与文件清单见 [`docs/关于大文件的拆分.md`](../../docs/关于大文件的拆分.md)

### 5.4 临时测试/验证脚本统一存放

**强制规则**：

1. **脚本根目录**：`scripts/` 用于存放 **核心 + 长期工具脚本**，例如：
   - `scripts/check-architecture.js` — [package.json L14-16](../../package.json#L14) `check:arch` 引用
   - `scripts/lint-staged.cjs` — [package.json L48-53](../../package.json#L48) `lint-staged` 引用

2. **临时测试 / 验证 / 一次性脚本统一存放在 `scripts/<task-name>/` 子目录**：
   - 每个新任务（拆分 / 迁移 / 验证）创建独立子目录
   - 子目录名 = 任务 ID（如 `verify-v001-schema/` / `verify-bug-042/` / `migrate-v058/`）
   - 任务完成且 ADR 中记录了验证方法后：**子目录必须清理或归并** —— 临时脚本全删，永久验证脚本移到 `scripts/` 根

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

**示例（v2.32 scripts/ 终态）**：

```text
scripts/
├── check-architecture.js          # 核心（package.json check:arch）
├── lint-staged.cjs                # 核心（package.json lint-staged）
└── verify-v001-schema/            # 长期验证（ADR-034 §三 引用）
    └── sqlite-parse-test.js
```

**依据**：

- [ADR-031 §三 v2.x 大文件拆分完整方法论](../../.trae/adr/031-v2-large-file-splitting-methodology.md)（12 模式 + 15 错误）
- [ADR-034 §三 v001 migration 拆分 B 模式](../../.trae/adr/034-v001-migration-splitting.md)（引用 sqlite-parse-test.js）
- [lessons-learned.md §七 案例库](../../.trae/rules/lessons-learned.md)（AI 用 Glob 查 `scripts/**` 返回空 — 强制二次核实）

---

## 六、文档同步规则

1. **新增项目代码后，必须同步更新 `.trae` 目录下的文件描述**（规则、ADR、模块 README）
2. 所有新生成的报告文件，都保存到 `../docs/` 目录下（项目根目录下的 docs 子目录）
3. 详细架构规则见 [`architecture.md`](./architecture.md) 和 [`adr/README.md`](../adr/README.md)

### 6.1 全面阅读项目代码的同步执行清单（2026-07-22 实测）

> **触发**：用户要求"全面认证阅读项目代码，然后更新相关文档"。本节列出本次执行后的同步清单，**作为 §六 规则的执行范本**。

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
| 路由表扩充   | [backend/src/modules/database/README.md](../../backend/src/modules/database/README.md)                   | 已有完整路由表，无需修改                                                                                           |
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

## 七、⚠️ PowerShell 编码禁令（2026-07-21 强化）

> **2026-07-21 强化**: 跨多个文件做内容修改（批量替换 import 路径、批量重命名 + 改内容、批量复制 + 改造等）**严禁使用任何 PowerShell cmdlet**（包括 `Copy-Item + Set-Content` 这类组合）。**唯一允许的是 `node fs.readFileSync/writeFileSync`**（已 3 次编码事故，第 3 次见 [powershell.md §1.5](./powershell.md#15-第三次事件回顾2026-07-21--p1-15) + [§2.4](./powershell.md#24-强制规则批量文件操作只能用-nodejs2026-07-21-新增-15-事件)）。
>
> **执行前自检**："这个操作能用 Edit 工具逐文件完成吗？" 能 → Edit；不能 → node 脚本。**永远不**用 PS cmdlet。

完整细节、错误案例、最佳实践见 [powershell.md](./powershell.md)。

---

## 八、本地 Node 环境

本地 Node 版本固定 `20.19.5`（见 [AGENTS.md §10.2](../../AGENTS.md#102-路径与目录约定) + [.nvmrc](../../.nvmrc)），实际安装位置见 [docs/Node_v20.19.5_安装方案.md](../../docs/Node_v20.19.5_安装方案.md)。

---

## 九、CODEOWNERS 单点 owner 设计（豁免规则）

> **本节为有意保留的设计决策**，不是缺陷。

[.github/CODEOWNERS](../../.github/CODEOWNERS) 当前全局规则为 `* @tance`——24 个后端模块 + 3 个前端核心模块（frontend/ai、frontend/alerts、frontend/workflow）owner **全部仅 `@tance` 一人**。这不是疏漏，是**探索开发阶段的有意设计**。

**理由**：

1. **项目处于探索期**（见 §五），模块边界仍在演进，过早分配 fallback owner 会导致"半生不熟"的领域归属——半年后模块拆分/合并时还得重新洗牌
2. **作者是当前唯一活跃贡献者**，CI 全套防线（7 个 workflow job + depcruise + check-architecture + ESLint max-lines + PR 模板 checklist）足以保证代码质量，不必依赖多人 review
3. **外部贡献者 PR 主要被 AI 防线过滤**，Trae CN 友好度高（AGENTS.md v2.2 + 7 份规则），新人提交即可生成合规代码，无需领域 owner 介入
4. **CODEOWNERS 拆分应作为 P3 任务**（半年内规划）：待项目进入"稳定维护期"+ 出现 2-3 名长期贡献者后，再按模块领域分配 fallback owner——见 [docs/开源治理与架构健壮性最终报告_v2.md §8.2 任务 1](../../docs/开源治理与架构健壮性最终报告_v2.md)

**AI 处理规则**：

- ❌ AI **不得**主动建议拆分 CODEOWNERS / 添加 fallback owner / 引入 Dependabot 等"开源协作护栏"措施
- ❌ AI **不得**把"24 模块 owner 单点"作为风险或 P0 问题写入报告
- ✅ 仅当用户**明确要求**"拆分 owner"或"添加协作护栏"时，才按 v2.2 报告 §8.2 任务 1 实施
- ✅ 引用此豁免时，统一标注「**有意保留设计**」（不要用"风险/缺陷/单点失效"等措辞）

**触发解除条件**（任一满足时重新评估）：

- 项目进入稳定维护期（模块边界冻结 ≥ 6 个月）
- 出现 2 名以上长期活跃外部贡献者
- `@tance` 主动宣布长期无法继续维护

---

## 十、Dependabot 已启用 + CodeQL 暂缓豁免

> **本节为有意保留的设计决策**，不是缺陷。

### 10.1 Dependabot 已启用（2026-07-21）

[.github/dependabot.yml](../../.github/dependabot.yml) 已配置，覆盖 3 大生态：

| 生态               | 监控目录                            | PR 上限   | 调度                         |
| ------------------ | ----------------------------------- | --------- | ---------------------------- |
| **npm**            | `/`（根）+ `/backend` + `/frontend` | 3 / 5 / 5 | 每周一 09:00 (Asia/Shanghai) |
| **github-actions** | `/`（3 个 workflow 文件）           | 3         | 每周一 09:00                 |
| **docker**         | `/docker`（生产 Dockerfile）        | 2         | 每周一 09:00                 |

**关键设计**：

- **按生态分组**：避免 npm / GitHub Actions / Docker PR 互串，每个生态独立审查
- **native 模块独立组**（backend-native-modules）：better-sqlite3 / net-snmp / dockerode / ssh2 — 这些升级需要重新编译 native binding，可能引入 Node 20 兼容性回归，必须人工 review
- **major / minor-patch 分组**：major 升级单独 PR，minor+patch 合并
- **commit prefix**：`chore(deps)` / `chore(backend-deps)` / `chore(frontend-deps)` / `ci(actions)` / `chore(docker-base)` — 与 Conventional Commits 规范对齐
- **走完整 CI 防线**：Dependabot PR 会触发 [ci.yml](../../.github/workflows/ci.yml) 7 个 job + [check-architecture.js](../../scripts/check-architecture.js) + depcruise——不会出现"自动 PR 绕过护栏"

**AI 处理规则**：

- ❌ AI **不得**主动建议关闭 Dependabot / 改 PR 上限 / 改调度频率
- ❌ AI **不得**手动合并 Dependabot PR 而不审查 native 模块组（backend-native-modules 风险最高）
- ✅ Dependabot PR 仍按项目 [CONTRIBUTING.md](../../CONTRIBUTING.md) 流程走：作者 `@tance` review → CI 全绿 → squash merge
- ✅ 月度评估：每月最后一周 review Dependabot PR 量/频率，不合适时调整 open-pull-requests-limit

### 10.2 CodeQL 暂缓豁免（与 §九 模式一致）

**当前状态**：未启用 CodeQL，**有意保留**（不是缺陷）。

**理由**：

1. **项目处于探索期**（见 §五），代码变动频繁，CodeQL 每周扫一次会产生大量 false positive，分散维护精力
2. **TypeScript 后端已有 TS 编译 + ESLint + depcruise 三层防护**——SQL 注入 / 类型错误的常见漏洞已被堵
3. **Dependabot 已覆盖依赖层 CVE**——见 §10.1
4. **CodeQL 收益与探索期成本不匹配**

**触发启用条件**（任一满足时启用）：

- 项目进入稳定维护期（模块边界冻结 ≥ 6 个月）
- 收到第一个外部安全相关 PR（需自动审查代码改动）
- 出现 1+ 长期贡献者（可分担 false positive 审查工作量）
- `@tance` 主动决定启用

**AI 处理规则**：

- ❌ AI **不得**主动创建 `.github/workflows/codeql.yml` 或启用 CodeQL
- ❌ AI **不得**把"无 CodeQL"作为风险写入报告——这是有意保留设计
- ✅ 仅当用户**明确要求**"启用 CodeQL"时，按 GitHub 官方模板创建配置

### 10.3 整体设计原则

- **依赖层用 Dependabot，代码层暂不用 CodeQL**——分层防御，互不重叠
- **所有自动化都有豁免规则**——避免 AI 反复"建议开启"已豁免的工具
- **月度评估机制**——每月最后一周 review 自动化 PR 总量，必要时调整

详见 [docs/开源治理与架构健壮性最终报告_v2.md §4.3 + §8.2 任务 2](../../docs/开源治理与架构健壮性最终报告_v2.md)。

---

## 十一、PR 模板自检 checklist 豁免规则（2026-07-21 v2.8）

> **本节为有意保留的设计决策**，不是缺陷。

[.github/PULL_REQUEST_TEMPLATE.md](../../.github/PULL_REQUEST_TEMPLATE.md) 含 **9 项自检 checklist**（变更类型 + 变更描述 + 相关问题 + 测试方法 5 项 + 架构约束 4 项 + 单文件行数 + ADR 关联），依赖贡献者手动勾选——v2.2 报告 §4.6 标记为 ⚠️"PR 自检依赖人工"。

**判定**：🟢 **有意保留**（豁免规则），因为核心 6 项已被 CI 强制约束，PR 模板仅作为"双重保险"。

**CI 已强制 vs PR 模板 checklist 对照表**：

| PR 自检项                     | 行号   | CI 强制约束                                                                                                          | 真阻断位置                                                                                                 |
| ----------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `npm run check:arch` 架构检查 | L26    | ✅ [scripts/check-architecture.js L324](file:///c:/Users/123/Desktop/daima/AIops/scripts/check-architecture.js#L324) | `process.exit(hasCriticalViolations ? 1 : 0)`                                                              |
| `npm run lint` 代码风格       | L27    | ✅ ESLint max-lines 真阻断（v2.5 升级）                                                                              | [backend/.eslintrc.json L46-49](file:///c:/Users/123/Desktop/daima/AIops/backend/.eslintrc.json#L46-L49)   |
| `npm run format` 代码格式     | L28    | ✅ Prettier check                                                                                                    | lint-staged + CI workflow                                                                                  |
| 后端测试                      | L29    | ✅ [backend/vitest.config.ts](file:///c:/Users/123/Desktop/daima/AIops/backend/vitest.config.ts)                     | CI workflow backend-test job                                                                               |
| 架构约束（4 项）              | L36-39 | ✅ [.dependency-cruiser.json](file:///c:/Users/123/Desktop/daima/AIops/.dependency-cruiser.json) 7 条 forbidden      | `routes-禁止直访-Repository` 等 6 条 error                                                                 |
| 单文件 ≤500 行                | L46-47 | ✅ ESLint max-lines 真阻断（v2.5 升级）                                                                              | [frontend/.eslintrc.json L78-81](file:///c:/Users/123/Desktop/daima/AIops/frontend/.eslintrc.json#L78-L81) |
| **ADR 关联**                  | L49-55 | ⚠️ 无自动校验                                                                                                        | 仅依赖人工 review                                                                                          |

**理由**：

1. **核心 6 项已被 CI 强制**——外部贡献者即便漏勾选 PR 模板，CI 也会拦截
2. **PR 模板 checklist 是"双重保险"**——即使核心约束失效，reviewer 也能从 checklist 发现问题
3. **danger.js / pr-labeler 自动校验会引入新工具**——按 §10.3「所有自动化都有豁免规则」原则，应保持"够用即可"
4. **ADR 关联仅 1 项无自动校验**，但属于"提醒性"约束，误判成本低（人工 review 时易发现）

**AI 处理规则**：

- ❌ AI **不得**主动建议引入 `danger.js` / `pr-labeler` 等 PR 自动校验工具
- ❌ AI **不得**把"PR 自检依赖人工"作为风险或 P2 问题写入报告
- ✅ 仅当用户**明确要求**"PR 自动校验"或"加 danger.js"时，才按 v2.4 报告 §8.4 任务 6 实施
- ✅ 引用此豁免时，统一标注「**有意保留设计**」（不要用"风险/缺陷/漏洞"等措辞）

**触发解除条件**（任一满足时重新评估）：

- 出现 2+ 长期贡献者（人工 review 压力增大）
- 收到第一个外部安全相关 PR（需自动审查 checklist）
- 出现连续 3 次"PR 漏勾选 + CI 拦截"的真实案例
- `@tance` 主动决定升级到 PR 自动校验

---

## 十二、测试覆盖率豁免规则

> **本节为有意保留的设计决策**，不是缺陷。

探索期 P1 测试覆盖率任务（任务 4「补测试覆盖率至阈值 80h」+ 任务 5「settings/audit/database 3 模块 0 覆盖」），**整项豁免**。

**判定**：🟢 **有意保留**（豁免规则），与 §一 第 7 条「测试覆盖率不达阈值不关心」一致——本次豁免把范围从"忽略不达阈值"扩展到"**P1 测试覆盖率任务不做**"。

**理由**：

1. **项目处于探索开发阶段**（见 §五）——核心功能边界仍在演进，写测试会因代码频繁变动而失效
2. **CI 防线已足够保证架构正确性**——depcruise + check-architecture + ESLint max-lines + 7 个 workflow job 全部就位
3. **测试覆盖率是"质量改进项"而非"质量底线"**——架构约束已保证代码不会破坏系统，测试只是补充
4. **资源投入产出比低**——80 小时测试覆盖率工作对探索期价值不高，应聚焦新功能开发
5. **§一 第 7 条已声明探索期不强制**——本次豁免明确"测试覆盖率**任务本身**不做"，避免后续 AI 反复建议

**AI 处理规则**：

- ❌ AI **不得**主动建议补测试覆盖率 / 写 .test.ts 文件 / 提升 vitest 阈值
- ❌ AI **不得**把"测试覆盖率 17/57/22/17 低于阈值"作为风险或 P1 问题写入报告
- ❌ AI **不得**主动补 settings/audit/database 3 模块的 .test.ts 文件
- ✅ 仅当用户**明确要求**"补测试"或"提升覆盖率"时，才按 v2.5 报告 §8.3 任务 4 实施
- ✅ 引用此豁免时，统一标注「**有意保留设计**」（不要用"风险/缺口/不足"等措辞）
- ✅ 如需 mock 测试，参考 [testing.md](./testing.md) 的 mock 模板

**触发解除条件**（任一满足时重新评估）：

- 项目进入稳定维护期（模块边界冻结 ≥ 6 个月）
- 出现 1+ 长期贡献者（可分担测试编写工作量）
- 出现连续 3 次"重构引入 bug"的真实案例（测试能捕获）
- `@tance` 主动决定启动测试覆盖率工作

**与 §一 第 7 条的关系**：

- §一 第 7 条：**忽略**覆盖率不达阈值（被动豁免）
- §十二（本节）：**不做** P1 测试覆盖率任务（主动豁免）——范围更明确

详见 [docs/开源治理与架构健壮性最终报告_v2.md §7 #4 #5 + §8.3 任务 4 + §8.6](../../docs/开源治理与架构健壮性最终报告_v2.md)。

---

## 十三、迁移到 architecture.md 的业务原则（原 §七/§八/§九）

> **2026-07-21 v2.1 拆分**：以下业务领域原则已迁移到 [`architecture.md`](./architecture.md) 对应章节，本文件不再重复：

| 原章节                          | 新位置                                                   |
| ------------------------------- | -------------------------------------------------------- |
| SSH 功能设计原则（原 §七）      | [architecture.md §六 安全设计原则](./architecture.md)    |
| AI / LLM 模块设计原则（原 §八） | [architecture.md §七 AI/LLM 设计原则](./architecture.md) |
| UI / 配置管理原则（原 §九）     | [architecture.md §八 UI/配置设计原则](./architecture.md) |

如需查看业务原则细节，请查阅 `architecture.md`。

---

## 附录 A：ADR 索引（与本文件相关）

| ADR                                            | 标题                                                        | 与本文件关联                 |
| ---------------------------------------------- | ----------------------------------------------------------- | ---------------------------- |
| [ADR-019](../adr/019-trae-adr-git-tracking.md) | ADR git 跟踪策略                                            | `.trae/` 反向 gitignore 规则 |
| [ADR-022](../adr/022-node20-dep-pin.md)        | depcruise 锁 Node 20                                        | §四 方式一"推荐 Node 20"     |
| [ADR-025](../adr/025-p1-batch-fixes.md)        | P1 批量修复                                                 | §七 PowerShell 编码禁令      |
| [ADR-026](../adr/026-top-rules-refactor.md)    | **本文件重构决策**（2026-07-21 v2.1 新增）                  | 1.md → top-rules.md          |
| 拟新增 ADR-027                                 | **CODEOWNERS 单点 owner 豁免规则**（v2.1 待补，优先级 P3）  | §九 单点 owner 豁免          |
| 拟新增 ADR-028                                 | **Dependabot 已启用 + CodeQL 豁免**（v2.1 待补，优先级 P3） | §十 自动化安全扫描分层       |
| 拟新增 ADR-029                                 | **PR 模板自检 checklist 豁免规则**（v2.8 待补，优先级 P3）  | §十一 PR 模板双重保险        |
| 拟新增 ADR-030                                 | **测试覆盖率豁免规则**（v2.9 待补，优先级 P3）              | §十二 探索期 P1 测试不强制   |

> **2026-07-22 标注**：上述 4 个 ADR 编号虽已"拟新增"，但**实际未在 `.trae/adr/` 目录下创建文件**。这些豁免规则已经在 `top-rules.md` 各章节中详细记录（§九 ~ §十二），对当前使用无影响。仅当用户**明确要求**"补 ADR 文件"或"v2 报告 §8.x 任务实施"时才需要正式落地。**当前状态：可延后**（与 §三 §十二"探索期不强制"原则一致）。

---
