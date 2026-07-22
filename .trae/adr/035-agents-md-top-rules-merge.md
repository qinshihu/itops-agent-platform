# ADR-035: AGENTS.md 与 top-rules.md 职责合并决策

> **状态**：已采纳（2026-07-23）
> **触发来源**：用户提问「top-rules.md 规则文件里有些东西是不是需要放到 AGENTS.md 里，怎样比较合理」
> **关联**：[AGENTS.md](../../AGENTS.md) · [top-rules.md](../rules/top-rules.md) · [ADR-026](./026-top-rules-refactor.md)

---

## 一、问题

[AGENTS.md](../../AGENTS.md)（v2.2 精简版，171 行）与 [.trae/rules/top-rules.md](../rules/top-rules.md)（617 行）**职责边界模糊**，导致以下 3 个具体问题：

### 1.1 双份维护风险

AGENTS.md §4「规则索引」表 + top-rules.md 各章节存在**职责重叠**——AGENTS.md 是「入口+极简铁律」，top-rules.md 是「业务规则详解」。两个文件都在 `.trae/rules/` 治理范畴内，按 v2.2 设计应该是「AGENTS.md 做指针、top-rules.md 做详情」，但实际有 8 处 top-rules.md 独有的项目级规则 AGENTS.md 完全没有覆盖。

### 1.2 多 AI 工具入口不完整

AGENTS.md 顶部说明「所有 AI 编程工具（Trae / Cursor / Copilot / Claude Code 等）阅读本项目的第一份入口文档」——但 8 个项目特定的豁免/强规则（§九 CODEOWNERS / §十 Dependabot / §十一 PR 模板 / §十二 测试豁免 等）**只在 top-rules.md**，导致 Cursor/Copilot/Claude Code 等非 Trae CN 工具读 AGENTS.md 时看不到这些豁免规则，可能误把「有意保留的设计」报告为 P0/P1 风险。

### 1.3 §8「项目记忆」语义边界不清

AGENTS.md §8 项目记忆（2026-07-21 v2.1 整合）职责分工写的是「§8.4 经验教训=项目级 L1 / §8.5 全局规则索引=跨项目」，但实际上 v2.1 整合时**遗漏了 top-rules.md 中 8 个项目特定规则**——这些应该属于 §8「项目特定 L1」层面，但被错误地归到 top-rules.md「Trae CN 专属」层面。

---

## 二、决策

### 2.1 总体策略：迁移 + 角色重新划分

**把 top-rules.md 中 8 个「项目级」关键章节迁到 AGENTS.md §8 项目记忆**（扩展 §8 为多小节），top-rules.md 退化为「Trae CN 工具专属入口 + 详细编码指南的指针」。

### 2.2 角色重新划分

| 文件                       | 新角色                                          | 范围                                                              | 行数预算 |
| -------------------------- | ----------------------------------------------- | ----------------------------------------------------------------- | -------- |
| **AGENTS.md**              | **所有 AI 工具的统一入口 + 项目特定规则集中地** | 全部 6+ AI 工具 + 项目特定豁免/强规则                             | ≤ 600 行 |
| **top-rules.md**           | **Trae CN 工具专属入口 + 编码指南索引**         | 仅 Trae CN 必读 + 指向其他规则文件的指针                          | ≤ 150 行 |
| **其他 .trae/rules/\*.md** | 各领域详细规则（不变）                          | architecture/frontend/powershell/testing/lessons-learned/security | 不限     |

### 2.3 内容迁移矩阵

**从 top-rules.md 迁到 AGENTS.md §8**（8 个章节）：

| top-rules.md 原章节               | 迁到 AGENTS.md                                                               | 说明                                           |
| --------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------- |
| §一 强制报告规则（8 条）          | AGENTS.md §2「AI 工作流」补充 + §8.6「强制报告规则」                         | 工作流已涵盖"完成后必须汇报"，剩余 6 条放 §8.6 |
| §三.3 max-lines + PowerShell 禁令 | AGENTS.md §3「铁律」补充（铁律 3/6：单文件 ≤ 500 行） + §8.7「强制编码约束」 | max-lines 升级为铁律级别（已 CI 强制）         |
| §七 PowerShell 编码禁令           | AGENTS.md §8.7「强制编码约束」（与 max-lines 合并）                          | PS 禁令放项目特定规则层                        |
| §九 CODEOWNERS 单点 owner         | AGENTS.md §8.8「豁免规则：单点 owner」                                       | 「有意保留」标记                               |
| §十 Dependabot + CodeQL           | AGENTS.md §8.9「豁免规则：自动化扫描分层」                                   | 「有意保留」标记                               |
| §十一 PR 模板 checklist           | AGENTS.md §8.10「豁免规则：PR 模板双重保险」                                 | 「有意保留」标记                               |
| §十二 测试覆盖率豁免              | AGENTS.md §8.11「豁免规则：探索期测试不强制」                                | 「有意保留」标记                               |

**top-rules.md 保留**（不迁）：

| top-rules.md 章节                        | 保留原因                                           |
| ---------------------------------------- | -------------------------------------------------- |
| §二 AI 工具支持范围                      | Trae CN 专属（其他工具通过 ai-tool-configs/ 入口） |
| §四 三种开发方式 + 长跑进程独立 Terminal | 详细开发指南（不是项目级豁免/强规则）              |
| §五 探索期 + 临时脚本存放                | 开发流程详细规则                                   |
| §六 文档同步规则                         | 详细文档管理规则                                   |
| §十三 迁移说明                           | 维护性章节（迁完后改为指向 AGENTS.md 的指针）      |
| 附录 A ADR 索引                          | Trae CN 必读的 ADR 索引                            |

---

## 三、实施步骤

1. **创建本 ADR**（ADR-035）记录决策
2. **AGENTS.md §8 扩展**为 6 个新小节（§8.6 ~ §8.11），从 top-rules.md 迁入 8 个关键章节
3. **AGENTS.md §3 铁律表**新增铁律 6「单文件 ≤ 500 行（ESLint 强制）」+ 顶部维护原则更新
4. **top-rules.md 精简**：删除 §一/§三.3/§七/§九/§十/§十一/§十二 + §十三；保留 §二/§四/§五/§六 + 附录 A
5. **top-rules.md 顶部维护原则**加一行「本文件只描述 Trae CN 专属规则；项目级豁免/强规则见 [AGENTS.md §8](../../AGENTS.md#8-项目记忆2026-07-21-v21-新增)」
6. **附录 A ADR 索引**更新：移除 ADR-027/028/029/030「拟新增」标记，改为「已在 AGENTS.md §8.8-§8.11 落地，无需新建 ADR」

---

## 四、职责边界澄清（避免未来再次漂移）

| 决策类型                                                   | 写到哪个文件？                                                |
| ---------------------------------------------------------- | ------------------------------------------------------------- |
| **跨项目通用规则**（如 Python venv、fnm、Docker 路径）     | `~/.trae-cn/user_rules/rule-*.md`（已在 AGENTS.md §8.5 索引） |
| **项目特定豁免/强规则**（CODEOWNERS 单点 owner、测试豁免） | `AGENTS.md §8.6 ~ §8.11`                                      |
| **AI 通用铁律**（分层单向依赖、routes 只做 3 件事）        | `AGENTS.md §3`                                                |
| **架构详细规则**（4A 分层、DDD 边界、模块结构）            | `.trae/rules/architecture.md`                                 |
| **Trae CN 工具专属**（编码指南、PowerShell 详细禁令）      | `.trae/rules/top-rules.md`                                    |
| **业务领域原则**（SSH / AI/LLM / UI 配置）                 | `.trae/rules/architecture.md` §六/§七/§八                     |
| **编码安全详细案例**（PowerShell 3 次事故回顾）            | `.trae/rules/powershell.md`                                   |
| **测试规则详细案例**                                       | `.trae/rules/testing.md`                                      |
| **错误复盘流程**                                           | `.trae/rules/lessons-learned.md`                              |
| **新决策的 ADR**                                           | `.trae/adr/NNN-slug.md`                                       |

**核心原则**：

- **AGENTS.md §8 是「项目特定规则单一权威源」**——任何项目特定豁免/强规则都必须放这里，不重复到 top-rules.md
- **top-rules.md 是「Trae CN 工具入口」**——不再包含跨 AI 工具通用的项目规则
- **避免在两个文件中出现相同规则**——一旦发现重复，立即选定一个文件为权威源，另一个文件改为指针

---

## 五、触发再评估条件

- 项目进入稳定维护期（模块边界冻结 ≥ 6 个月）——重新评估是否需要把 §8 拆分为 `AGENTS.md` + `project-rules.md` 两个文件
- 出现 2+ 长期外部贡献者——评估是否需要把豁免规则（§8.8-§8.11）拆为独立 `.trae/rules/exemptions.md` 方便引用
- AI 工具数量 > 10 个——评估是否需要把 ai-tool-configs 重新整合回根目录

---

**最后更新**：2026-07-23
