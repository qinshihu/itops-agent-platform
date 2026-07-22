# AGENTS.md —— AI 编程工具统一入口

> **本文件是所有 AI 编程工具（Trae / Cursor / Copilot / Claude Code 等）阅读本项目的第一份入口文档。**
>
> **本文件 §8 是「项目特定规则单一权威源」**——任何项目特定豁免/强规则都必须放这里，不重复到 top-rules.md（详见 [ADR-035](.trae/adr/035-agents-md-top-rules-merge.md)）。
>
> **核心维护原则（适用于所有 .trae/ + docs/ + 根 README/AGENTS.md 文档）**：
>
> - **只保留最新的有效内容**：过时的历史信息、变更记录、迁移说明这类「考古」内容全部删掉——这些对当前使用没价值，只占 token
> - **当 .trae/rules/ 下规则发生变化时**：本文件 §3/§4 规则索引表直接同步；§8 项目特定规则变更必须更新本文件并考虑新建/更新 ADR

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

## 3. 6 条铁律（完整版见 [architecture.md §四](.trae/rules/architecture.md) + [top-rules.md §三.2](.trae/rules/top-rules.md)）

| #   | 铁律                   | 详细                                                                                      |
| --- | ---------------------- | ----------------------------------------------------------------------------------------- |
| 1   | **分层单向依赖**       | core/ → modules/ → routes/，禁止反向                                                      |
| 2   | **routes 只做 3 件事** | 参数校验（Zod）→ 鉴权 → 调 service → 返回                                                 |
| 3   | **新文件 ≤ 500 行**    | ESLint `max-lines: error` 真阻断 CI（v2.5 升级），超 500 必须拆分                         |
| 4   | **不写测试文件**       | 探索期豁免（§8.11），除非用户明确要求                                                     |
| 5   | **报告/ADR 路径**      | 报告→docs/，ADR→.trae/adr/                                                                |
| 6   | **强制编码约束**       | PowerShell 严禁做跨文件内容修改（详见 §8.7 + [powershell.md](.trae/rules/powershell.md)） |

### AI 禁止的操作（速记，完整版见 architecture.md §四.2）

- ❌ routes 写业务逻辑（if/else）
- ❌ routes 直 import repository（必须经 service 层）
- ❌ 改 migrations/v001__.ts（新建 v0XX__.ts）
- ❌ 改 .trae/rules/ 不报告给用户（参见 [§8.6 强制报告规则](#86-强制报告规则)）
- ❌ 用 process.env.SOMETHING（写到 settings 表）
- ❌ 把「有意保留」豁免（§8.8 ~ §8.11）误报为风险或 P0/P1 问题

---

## 4. 规则索引（去 .trae/rules/ 读全文）

| 想做什么？                        | 读哪个规则？                                                                                              | 关键章节                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 改后端/前端代码                   | [.trae/rules/architecture.md](.trae/rules/architecture.md)                                                | §1 4A 架构 / §3 编码约束 / §4 AI 禁止的操作 |
| 改前端代码                        | [.trae/rules/frontend.md](.trae/rules/frontend.md)                                                        | §一 模块目录结构 / §三 编码约束             |
| 写测试代码                        | [.trae/rules/testing.md](.trae/rules/testing.md)                                                          | §二 后端 / §三 前端                         |
| PowerShell/编码/批量改文件        | [.trae/rules/powershell.md](.trae/rules/powershell.md) + [AGENTS.md §8.7.2](#872-powershell-编码禁令强制) | 全局禁令                                    |
| 报错/违反规则/沉淀教训            | [.trae/rules/lessons-learned.md](.trae/rules/lessons-learned.md)                                          | §二 三级分类 / §三/§四/§五 L1/L2/L3 流程    |
| 看开发方式（三种）+ 项目位置      | [.trae/rules/top-rules.md](.trae/rules/top-rules.md)                                                      | §二 代码位置与开发方式                      |
| 看本地开发环境（Node/npm/fnm 等） | [AGENTS.md §8 项目记忆](#8-项目记忆)                                                                      | §8.1 / §8.2                                 |

---

## 5. 文档索引（按场景分类）

| 场景                       | 文档                                                                               | 内容                                                                     |
| -------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 看模块清单 + 架构全景      | [.trae/rules/architecture.md §1.2](.trae/rules/architecture.md)                    | 24 模块 + 聚合根                                                         |
| 看设计决策（为什么这样做） | [.trae/adr/](.trae/adr/)                                                           | **28 份 ADR**（ADR-001 ~ ADR-036，跳号 ADR-027~030 已合并到 §8.8-§8.11） |
| 看项目全面分析（深度）     | [docs/项目全面分析报告_v8.md](docs/项目全面分析报告_v8.md)                         | 全模块深度分析（2026-07-22 v8）                                          |
| 看开源治理方案             | [docs/开源治理与架构健壮性最终报告_v2.md](docs/开源治理与架构健壮性最终报告_v2.md) | P0/P1/P2 待治理项                                                        |

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

## 8. 项目记忆

> 本章节整合了两份历史分散的记忆文件（~/.trae-cn/memory/user_profile.md + project_memory.md），只维护本章节一份内容。
> **职责分工**：
>
> - **本节 §8.4 经验教训**：项目特定 L1 错误（项目级）
> - **本节 §8.5 全局规则文件索引**：指向 ~/.trae-cn/user_rules/ 的指针（跨项目）
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
- ⚠️ *_Docker Desktop 装到 D:\kaifahuanjing\Docker\*_

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
- **PowerShell 编码陷阱**：跨文件内容修改严禁用 PowerShell cmdlet（详见 [§8.7.2](#872-powershell-编码禁令强制) + .trae/rules/powershell.md）
- **改 ADR 标题必须先 Read 原文**：改文件标题或关键文本时**必须先 Read 原文件确认精确字符串**，不能凭记忆写 `old_str`
- **列"未做项"必须先 grep 验证（L2）**：列任何"未做项"前必须 grep/Read 实际状态确认，凭印象列项是 L2 级别的事实性错误（[lessons-learned.md §二.2](./.trae/rules/lessons-learned.md) 分级判断流程）
- **改根 README 顶部导航条必同步 6 份多语言 README（L1）**：根 README 顶部导航条的任何改动都是 7 份文档同步问题，不能只改根 README 了事；改前必须 grep `SKILL\.md|AI编程Skill|AI Coding Skill|AIプログラミングスキル|AI 프로그래밍 스킬|AI程式設計|Skill de programmation IA|KI-Programmier-Skill` 一次性确认范围，改时 `SearchReplace` 6 份文件并行执行一次性到位
- **追加 §8.4 条目时 `old_str` 必须含首字符 `- `（L1 自纠错）**：在有序列表追加条目，`new_str` 中新增条目的首字符 `- ` 必须显式写出，不能省略；改完必须立刻 Read 复核，不能只看工具返回的 diff（diff 只显示「有变化」，不显示「符号对不对」）
- **大文件精简后必 grep 全文检查失效交叉引用（L1）**：精简大文件（删章节/重命名）后，必须对所有引用方文件 grep `已删章节号|已删文件名` 全文扫描，不能用「我以为改对了」蒙混过关。**精简 = 重新编号，必须把「引用方文件」作为精简验收清单的一部分**
- **「拟新增 ADR」超过 3 天未落地应立即合并或删除（L2）**：「拟新增」是 placeholder，不是永久状态——3 天内必须落地（合并到现有 ADR 或新建），否则按 [lessons-learned.md §三.4](./.trae/rules/lessons-learned.md)「占位规则清理」流程删除或合并到 AGENTS.md §8
- **改 package.json 必须同步 lockfile（L1）**：任何修改 `package.json`（包括 `npm install <pkg>` / `npm install <pkg>@<ver>` / 手动增删依赖）的提交，**必须**同时运行 `npm install --package-lock-only` 同步 `package-lock.json` 后一并提交；否则 CI `npm ci` 会因 lockfile 与 package.json 不一致报 EUSAGE 错误中断（2026-07-23 真实案例：commit `804a2bf` 添加 `@vitest/coverage-v8` 时漏同步 lockfile，导致 GitHub Actions 全军覆没）。**检查清单**：`git status` 必须看到 `package.json` 和 `package-lock.json` 同时出现在变更列表，缺一不可

### 8.5 全局规则文件（不重复维护）

> 全局规则根目录：c:\Users\123\.trae-cn\user_rules\
> 冲突优先级：**项目 .trae/rules/ > 全局 user_rules/**（项目规则优先生效）

| 全局规则                    | 作用                                    |
| --------------------------- | --------------------------------------- |
| rule-env-python-node-git.md | 本机环境配置 + Python/Node 项目强制流程 |
| rule-powershell.md          | PowerShell 文件操作编码安全             |
| rule-docker.md              | Docker 容器开发强制约束                 |
| rule-ddd-4a-architecture.md | 4A + DDD 分层强制依赖规则               |
| rule-lessons-learned.md     | 错误复盘与规则沉淀流程                  |

---

### 8.6 强制报告规则

AI 在执行过程中必须遵守以下 8 条强制报告规则：

1. **代码与 .trae 描述不一致**——发现项目实际代码跟 `.trae/` 目录下文件描述不一致时，**必须立即报告**
2. **好的建议**——任何时候有好的建议都可以及时报告（不要藏着）
3. **测试文件**——默认**不写测试文件**；如需写，先询问用户
4. **中英文切换**——可以以后再做，不作为当前任务
5. **`ai-tool-configs/` 不要动**——除非用户明确要改某个工具的配置
6. **错误沉淀**——发生错误时按 [lessons-learned.md](.trae/rules/lessons-learned.md) 流程分级处理（L1 记忆 / L2 更新规则 / L3 新建规则文件）
7. **测试覆盖率**——探索期不达阈值（< 80%）时**直接忽略**（详见 §8.11）
8. **大文件拆分后全面分析**——拆分后必须考虑关联文件、文档、Docker 构建、其它引用是否同步更新并报告

### 8.7 强制编码约束

#### 8.7.1 单文件 ≤ 500 行（ESLint 强制）

- `backend/.eslintrc.json` + `frontend/.eslintrc.json` 的 `max-lines` 规则已升级为 `error`（v2.5 落地）
- 新文件超 500 行将**真阻断 CI**
- 适用范围：`.js` / `.ts` / `.tsx` / `.cjs`（`.md` 文档不在强制范围）
- 拆分前必跑 4 步风险防御 + 拆分后必跑 tsc 全文验证（详见 [top-rules.md §三.2](.trae/rules/top-rules.md)）

#### 8.7.2 PowerShell 编码禁令（强制）

> 跨多个文件做内容修改（批量替换 import 路径、批量重命名 + 改内容、批量复制 + 改造等）**严禁使用任何 PowerShell cmdlet**（包括 `Copy-Item + Set-Content` 这类组合）。**唯一允许的是 `node fs.readFileSync/writeFileSync`**（已 3 次编码事故）。
>
> **执行前自检**：「这个操作能用 Edit 工具逐文件完成吗？」能 → Edit；不能 → node 脚本。**永远不**用 PS cmdlet。

完整细节、错误案例、最佳实践见 [powershell.md](.trae/rules/powershell.md)。

### 8.8 豁免规则：CODEOWNERS 单点 owner

> ⚠️ **本节为有意保留的设计决策**，不是缺陷。

[.github/CODEOWNERS](.github/CODEOWNERS) 当前全局规则为 `* @tance`——24 个后端模块 + 3 个前端核心模块 owner **全部仅 `@tance` 一人**。

**理由**：

1. 项目处于探索期（见 §8.11），模块边界仍在演进，过早分配 fallback owner 会导致「半生不熟」的领域归属
2. 作者是当前唯一活跃贡献者，CI 全套防线（7 个 workflow job + depcruise + check-architecture + ESLint max-lines + PR 模板 checklist）足以保证代码质量
3. 外部贡献者 PR 主要被 AI 防线过滤，Trae CN 友好度高（AGENTS.md v2.3 + 7 份规则），新人提交即可生成合规代码
4. CODEOWNERS 拆分应作为 P3 任务，待项目进入「稳定维护期」+ 出现 2-3 名长期贡献者后再分配

**AI 处理规则**：

- ❌ AI **不得**主动建议拆分 CODEOWNERS / 添加 fallback owner / 引入 Dependabot 等「开源协作护栏」措施
- ❌ AI **不得**把「24 模块 owner 单点」作为风险或 P0 问题写入报告
- ✅ 仅当用户**明确要求**「拆分 owner」时，才按 v2.2 报告 §8.2 任务 1 实施
- ✅ 引用此豁免时，统一标注「**有意保留设计**」（不要用「风险/缺陷/单点失效」等措辞）

### 8.9 豁免规则：自动化扫描分层

> ⚠️ **本节为有意保留的设计决策**，不是缺陷。

#### Dependabot 已启用（覆盖 3 大生态）

| 生态               | 监控目录                       | PR 上限   | 调度                         |
| ------------------ | ------------------------------ | --------- | ---------------------------- |
| **npm**            | `/` + `/backend` + `/frontend` | 3 / 5 / 5 | 每周一 09:00 (Asia/Shanghai) |
| **github-actions** | `/`（3 个 workflow 文件）      | 3         | 每周一 09:00                 |
| **docker**         | `/docker`（生产 Dockerfile）   | 2         | 每周一 09:00                 |

**关键设计**：

- 按生态分组，避免 npm / GitHub Actions / Docker PR 互串
- native 模块独立组（backend-native-modules）：better-sqlite3 / net-snmp / dockerode / ssh2 — 这些升级需要重新编译 native binding
- major / minor-patch 分组：major 升级单独 PR，minor+patch 合并

#### CodeQL 暂缓豁免

**当前状态**：未启用 CodeQL，**有意保留**（不是缺陷）。

**理由**：

1. 项目处于探索期，代码变动频繁，CodeQL 每周扫一次会产生大量 false positive
2. TypeScript 后端已有 TS 编译 + ESLint + depcruise 三层防护
3. Dependabot 已覆盖依赖层 CVE

**AI 处理规则**：

- ❌ AI **不得**主动创建 `.github/workflows/codeql.yml` 或启用 CodeQL
- ❌ AI **不得**把「无 CodeQL」作为风险写入报告——这是有意保留设计
- ✅ 仅当用户**明确要求**「启用 CodeQL」时，按 GitHub 官方模板创建配置

### 8.10 豁免规则：PR 模板双重保险

> ⚠️ **本节为有意保留的设计决策**，不是缺陷。

[.github/PULL_REQUEST_TEMPLATE.md](.github/PULL_REQUEST_TEMPLATE.md) 含 **9 项自检 checklist**，依赖贡献者手动勾选——v2.2 报告 §4.6 标记为 ⚠️「PR 自检依赖人工」。

**判定**：🟢 **有意保留**（豁免规则），因为核心 6 项已被 CI 强制约束，PR 模板仅作为「双重保险」。

**CI 已强制 vs PR 模板 checklist 对照表**：

| PR 自检项                     | CI 强制约束                                                            |
| ----------------------------- | ---------------------------------------------------------------------- |
| `npm run check:arch` 架构检查 | ✅ [scripts/check-architecture.js](scripts/check-architecture.js)      |
| `npm run lint` 代码风格       | ✅ ESLint max-lines 真阻断（v2.5 升级）                                |
| `npm run format` 代码格式     | ✅ Prettier check                                                      |
| 后端测试                      | ✅ vitest 配置 + CI workflow backend-test job                          |
| 架构约束（4 项）              | ✅ [.dependency-cruiser.json](.dependency-cruiser.json) 7 条 forbidden |
| 单文件 ≤500 行                | ✅ ESLint max-lines 真阻断                                             |
| **ADR 关联**                  | ⚠️ 无自动校验（仅人工 review）                                         |

**AI 处理规则**：

- ❌ AI **不得**主动建议引入 `danger.js` / `pr-labeler` 等 PR 自动校验工具
- ❌ AI **不得**把「PR 自检依赖人工」作为风险或 P2 问题写入报告
- ✅ 引用此豁免时，统一标注「**有意保留设计**」（不要用「风险/缺陷/漏洞」等措辞）

### 8.11 豁免规则：探索期测试不强制

> ⚠️ **本节为有意保留的设计决策**，不是缺陷。

探索期 P1 测试覆盖率任务（任务 4「补测试覆盖率至阈值 80h」+ 任务 5「settings/audit/database 3 模块 0 覆盖」），**整项豁免**。

**判定**：🟢 **有意保留**（豁免规则），与 §8.6 第 7 条「测试覆盖率不达阈值不关心」一致。

**理由**：

1. 项目处于探索开发阶段——核心功能边界仍在演进，写测试会因代码频繁变动而失效
2. CI 防线已足够保证架构正确性——depcruise + check-architecture + ESLint max-lines + 7 个 workflow job 全部就位
3. 测试覆盖率是「质量改进项」而非「质量底线」——架构约束已保证代码不会破坏系统
4. 资源投入产出比低——80 小时测试覆盖率工作对探索期价值不高

**AI 处理规则**：

- ❌ AI **不得**主动建议补测试覆盖率 / 写 .test.ts 文件 / 提升 vitest 阈值
- ❌ AI **不得**把「测试覆盖率 17/57/22/17 低于阈值」作为风险或 P1 问题写入报告
- ❌ AI **不得**主动补 settings/audit/database 3 模块的 .test.ts 文件
- ✅ 仅当用户**明确要求**「补测试」或「提升覆盖率」时，才按 v2.5 报告 §8.3 任务 4 实施
- ✅ 引用此豁免时，统一标注「**有意保留设计**」（不要用「风险/缺口/不足」等措辞）

**触发解除条件**（任一满足时重新评估）：

- 项目进入稳定维护期（模块边界冻结 ≥ 6 个月）
- 出现 1+ 长期贡献者（可分担测试编写工作量）
- 出现连续 3 次「重构引入 bug」的真实案例（测试能捕获）
- `@tance` 主动决定启动测试覆盖率工作

---

**最后更新**：2026-07-23 v2.3（合并 top-rules.md 项目特定规则到 §8.6 ~ §8.11，详见 [ADR-035](.trae/adr/035-agents-md-top-rules-merge.md)）

**维护者**：项目作者 + AI 协作（Trae）
