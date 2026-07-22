# AGENTS.md —— AI 编程工具统一入口（精简版）

> **本文件是所有 AI 编程工具（Trae / Cursor / Copilot / Claude Code 等）阅读本项目的第一份入口文档。**
>
> **v2.2 精简（2026-07-21）**：去除与 .trae/rules/ 的内容重复，改为指向 .trae/rules/ 的指针，避免双份维护漂移。
> **维护原则**：当 .trae/rules/ 下规则发生变化时，本文件**不直接修改**——只更新 §4「规则索引」表即可。

---

## 1. 项目一句话定义

**ITops Agent** —— 一站式智能运维平台。24 个后端模块（Node.js + Express + TypeScript + SQLite）+ 23 个前端模块（React + Vite + Ant Design + Tailwind）。

**核心定位**：用 AI 编排能力处理运维场景（告警、根因分析、自动化修复、知识沉淀、Agent 工具调用等）。

---

## 2. AI 工作流（接到任务时按顺序做）

1. **读本文件 §4 规则索引**（你正在读）—— 决定读哪些 .trae/rules/
2. **读相关模块 README.md**（backend/src/modules/<module>/README.md 或 frontend/src/modules/<module>/README.md）
3. **看同模块已有代码作为模板**
4. **只读相关代码**，不要盲目读全量
5. **新建文件遵守 §3 铁律**
6. **改完代码后跑** `npm run lint` + `npm run tsc --noEmit`

### 完成后必须汇报

- 改了哪些文件
- 是否需要更新文档（如果影响架构 → 改 .trae/rules/）
- 是否需要新增 ADR（→ 加 .trae/adr/NNN-slug.md）

---

## 3. 5 条铁律（完整版见 [architecture.md §四](.trae/rules/architecture.md)）

| # | 铁律 | 详细 |
|---|------|------|
| 1 | **分层单向依赖** | core/ → modules/ → routes/，禁止反向 |
| 2 | **routes 只做 3 件事** | 参数校验（Zod）→ 鉴权 → 调 service → 返回 |
| 3 | **新文件 ≤ 500 行** | 超过必须拆分（参考 tool/ 4 文件范例） |
| 4 | **不写测试文件** | 除非用户明确要求 |
| 5 | **报告/ADR 路径** | 报告→docs/，ADR→.trae/adr/ |

### AI 禁止的操作（速记，完整版见 architecture.md §四.2）

- ❌ routes 写业务逻辑（if/else）
- ❌ routes 直 import repository（必须经 service 层）
- ❌ 改 migrations/v001_*.ts（新建 v0XX_*.ts）
- ❌ 改 .trae/rules/ 不报告给用户（参见 [top-rules.md §一](.trae/rules/top-rules.md)）
- ❌ 用 process.env.SOMETHING（写到 settings 表）

---

## 4. 规则索引（去 .trae/rules/ 读全文）

| 想做什么？ | 读哪个规则？ | 关键章节 |
|------|----------|----------|
| 改后端/前端代码 | [.trae/rules/architecture.md](.trae/rules/architecture.md) | §1 4A 架构 / §3 编码约束 / §4 AI 禁止的操作 |
| 改前端代码 | [.trae/rules/frontend.md](.trae/rules/frontend.md) | §一 模块目录结构 / §三 编码约束 |
| 写测试代码 | [.trae/rules/testing.md](.trae/rules/testing.md) | §二 后端 / §三 前端 |
| PowerShell/编码/批量改文件 | [.trae/rules/powershell.md](.trae/rules/powershell.md) + [top-rules.md §七](.trae/rules/top-rules.md) | 全局禁令 |
| 报错/违反规则/沉淀教训 | [.trae/rules/lessons-learned.md](.trae/rules/lessons-learned.md) | §二 三级分类 / §三/§四/§五 L1/L2/L3 流程 |
| 看开发方式（三种）+ 项目位置 | [.trae/rules/top-rules.md](.trae/rules/top-rules.md) | §四 代码位置 / §七 PS 禁令 |
| 看本地开发环境（Node/npm/fnm 等） | [AGENTS.md §10 项目记忆](#10-项目记忆2026-07-21-v21-新增) | §10.1 / §10.2 |

---

## 5. 文档索引（按场景分类）

| 场景 | 文档 | 内容 |
|------|------|------|
| 看模块清单 + 架构全景 | [.trae/rules/architecture.md §1.2](.trae/rules/architecture.md) | 24 模块 + 聚合根 |
| 看设计决策（为什么这样做） | [.trae/adr/](.trae/adr/) | **26 份 ADR**（ADR-001 ~ ADR-026） |
| 看项目全面分析（深度） | [docs/项目全面分析报告_v8.md](docs/项目全面分析报告_v8.md) | 全模块深度分析（2026-07-22 v8） |
| 看开源治理方案 | [docs/开源治理与架构健壮性最终报告_v2.md](docs/开源治理与架构健壮性最终报告_v2.md) | P0/P1/P2 待治理项 |

---

## 6. 关键路径速查

```
backend/    # 后端（Node.js + Express + TypeScript + SQLite）
frontend/   # 前端（React + Vite + TypeScript + Ant Design）
docs/       # 项目报告
.trae/      # AI 规则 + ADR（项目级）
```

---

## 7. 一句话总结

> **本项目核心是「分层 + 模块化」：业务逻辑在 services，数据访问走 repositories，路由层只做参数校验和转发。**
> **完整规则去 [.trae/rules/architecture.md](.trae/rules/architecture.md) §四看。**

---

## 8. 项目记忆（2026-07-21 v2.1 新增）

> **v2.1 整合**：本章节取代了之前两份分散的记忆文件（~/.trae-cn/memory/user_profile.md + project_memory.md）。只维护本章节一份内容。
> **职责分工**：
> - **本节 §10.4 经验教训**：项目特定 L1 错误（项目级）
> - **本节 §10.5 全局规则文件索引**：指向 ~/.trae-cn/user_rules/ 的指针（跨项目）
> - **详细 L1/L2/L3 流程**：.trae/rules/lessons-learned.md（不重复维护）

### 8.1 用户偏好与开发环境

- **沟通语言**：中文
- **包管理器**：仅用 npm，不用 pnpm
- **Node 版本管理**：fnm（推荐）；pyenv-win 按需
- **Python 虚拟环境**：每个项目独立 .venv

#### 硬约束（不可违反）

- ⚠️ **所有开发软件与运行时环境必须装在 D:\kaifahuanjing\**，绝不默认 C 盘
- ⚠️ **Node.js/前端项目依赖必须本地安装**，绝不全局安装
- ⚠️ **Python 项目必须用 .venv 隔离**
- ⚠️ **Docker Desktop 装到 D:\kaifahuanjing\Docker\**

### 8.2 路径与目录约定

- **项目代码位置**：backend/ + frontend/
- **本地 Node 版本**：固定 20.19.5（见 .nvmrc）
- **SQLite 数据库位置**：backend/data/app.db（gitignore）

### 8.3 工程约定（本项目特有）

- **SQLite 维护**：使用 WAL 模式，由 backend/src/models/database/maintenance.ts 在每天 4:00 自动执行 wal_checkpoint(TRUNCATE)
- **服务初始化禁忌**：⚠️ **禁止在构造函数中调用任何访问 db 的方法**，必须通过公共 init() 方法由 serviceRegistry 在 db ready 后触发

### 8.4 经验教训（L1 错误追加处）

> **追加格式**：每条 L1 错误用以下模板追加：
>
> ```
> ## YYYY-MM-DD 错误复盘：<错误标题>
>
> **场景**：<简述>
> **错误**：<做错了什么>
> **正确做法**：<应该怎么做>
> **教训**：<一句话总结>
> ```

- **Trae CN 自动重置**：user_profile.md 如果太长，Trae 服务端可能自动重置。关键配置必须存到全局规则文件或本项目 AGENTS.md
- **第三方库 API 漂移**：自定义 .d.ts 类型声明可能与 npm 包实际 API 不一致，必须对照 node_modules/<pkg>/README.md 检查最新签名
- **PowerShell 编码陷阱**：跨文件内容修改严禁用 PowerShell cmdlet（详见 .trae/rules/powershell.md + top-rules.md §七）
- **1.md → top-rules.md 重构**：2026-07-21 已把无语义文件名 1.md 重命名为 top-rules.md（详见 ADR-026）
- **改 ADR 标题必须先 Read 原文**：2026-07-21 第五轮优化时给 ADR-025 加"批量修复类"标签，意外把标题从 `#15 完整` 改成 `#15 legacy 迁移`（无依据瞎改），发现后立即还原。教训：改文件标题或关键文本时**必须先 Read 原文件确认精确字符串**，不能凭记忆写 `old_str`
- **列"未做项"必须先 grep 验证（L2）**：2026-07-21 第八轮讨论时把"项目级 ESLint 引入（项目还没启用）"列为遗留项——**完全错误**。实测：backend/.eslintrc.json（92 行）+ frontend/.eslintrc.json（57 行）早已存在；backend/eslint-plugin-local-rules/ 是自定义插件；.github/workflows/ci.yml 跑 `backend-lint` + `frontend-lint` 两个 job。教训：**列任何"未做项"前必须 grep/Read 实际状态确认**，凭印象列项是 L2 级别的事实性错误，会误导后续决策方向（[lessons-learned.md §二.2](./.trae/rules/lessons-learned.md) 分级判断流程）

### 8.5 全局规则文件（不重复维护）

> 全局规则根目录：c:\Users\123\.trae-cn\user_rules\
> 冲突优先级：**项目 .trae/rules/ > 全局 user_rules/**（项目规则优先生效）

| 全局规则 | 作用 |
|----------|------|
| rule-env-python-node-git.md | 本机环境配置 + Python/Node 项目强制流程 |
| rule-powershell.md | PowerShell 文件操作编码安全 |
| rule-docker.md | Docker 容器开发强制约束 |
| rule-ddd-4a-architecture.md | 4A + DDD 分层强制依赖规则 |
| rule-lessons-learned.md | 错误复盘与规则沉淀流程 |

---

**最后更新**：2026-07-21（v2.2：精简去重，改为指向 .trae/rules/ 的指针）

**维护者**：项目作者 + AI 协作（Trae）
