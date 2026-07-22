# ADR-019: `.trae/adr/` 与 `.trae/rules/` 与 `.trae/documents/` 同步到 git 跟踪

**状态**: Accepted | **日期**: 2026-07-08 | **决策者**: 项目作者 + AI 协作（Trae）

> **背景**：本 ADR 记录 ITops Agent 项目 `.gitignore` 第 39 行 `.trae/` 排除规则的调整决策：从完全排除 `.trae/` 改为"排除默认 + 用 `!` 反向重新允许 3 个公开子目录"。
>
> **关联**：[rules/top-rules.md §五 文档同步规则](../rules/top-rules.md) · [docs/项目全面分析报告\_v4 §9 优先级清单 + §10.3](../../docs/项目全面分析报告_v4.md) · ADR-016（routes→service 抽象）· ADR-017（infra 子域拆分）· ADR-018（enhancedNodeExecutor 拆分）

---

## 一、问题与背景

### 1.1 历史现状

`.gitignore` 第 39 行（修订前）：

```gitignore
# IDE & Editor
.idea/
.vscode/
.trae/
*.swp
*.swo
*~
```

`.trae/` 目录（修订前）：

- `.trae/.ignore` （空文件，已于 2026-07-08 增量-9 删除）
- `.trae/adr/` （19 份架构决策记录 markdown + 1 份 README = 20 个文件，含本 ADR-019 自身）
- `.trae/documents/` （6 个设计文档：API_REFERENCE / ARCHITECTURE_COMPLIANCE_GUIDE / GITHUB_SETUP / PRD / TECH_ARCHITECTURE / TYPE_SYSTEM）
- `.trae/rules/` （4 份规则文件：1.md / architecture.md / frontend.md / testing.md）

**总文件数**：30 个 markdown（全部是给 AI 阅读的项目规范与设计文档）。

> **更新**（2026-07-20）：rules/ 后续新增 `powershell.md` 和 `lessons-learned.md`，现规则文件共 6 份；adr/ 现共 19 ADR + 1 README；当前 `.trae/{adr,rules,documents}/` 总计 **32 份 markdown**。

### 1.2 暴露的问题

- **团队协作断裂**：`.trae/adr/` 内的 ADR（架构决策记录）是项目核心知识资产，但因 `.gitignore` 排除，无法被 git 跟踪，新加入的开发者无法通过 git log 看到决策历史
- **AI 协作不可见**：`.trae/rules/` 内的规则文件是 AI 编码时必须遵守的约束（4A 架构、DDD、编码规则），但因排除在不同机器上可能有微小差异
- **设计文档散落**：`.trae/documents/` 内的 PRD / 技术架构文档与 `docs/` 平级，但因排除在仓库外
- **违反 rules/top-rules.md §五 文档同步规则**："新增项目代码后，必须同步更新 .trae/ 目录下的文件描述（规则、ADR、模块 README）"——这条规则隐含 ADR 应该入库
- **v4 报告 §9 优先级清单明确登记**：🔴 高 → 🟡 中 待办"`.trae/` 同步到 git 跟踪（修改 .gitignore 第 39 行）"

### 1.3 决策触发点

2026-07-08 增量-9 完成 `.trae/` 清理（删除 `.ignore` 空文件 + `rules/git-commit-message.md` 未引用文件）后，`LS` 确认 `.trae/` 下剩余文件**全部是公开内容**（0 敏感信息）。是时候把 ADR / rules / documents 三个子目录入库了。

---

## 二、决策

### 2.1 调整方案

**修订后**的 `.gitignore` 第 39 行附近：

```gitignore
# IDE & Editor
.idea/
.vscode/
.trae/
# 重新允许 .trae/adr/ + .trae/rules/ + .trae/documents/ 入库
#（2026-07-08 增量-11 + ADR-019：架构决策记录、设计文档、规则文件全是公开内容，团队协作需要共享）
!.trae/
!.trae/adr/
!.trae/adr/**
!.trae/rules/
!.trae/rules/**
!.trae/documents/
!.trae/documents/**
*.swp
*.swo
*~
```

### 2.2 设计要点

#### 2.2.1 用 `!` 反向规则而非删除 `.trae/`

**为什么不直接删除 `.trae/` 排除？**

- 直接删除会让 `.trae/` 下未来可能新增的"敏感文件"（如 `.worktrees/` / `.claude/settings.json` / 临时草稿）自动入库
- 用 `!` 反向规则，未来新敏感文件只要不被 `!` 显式重新允许，就会继续被排除
- 更安全，符合"白名单"思路

#### 2.2.2 保留 `.trae/` 默认排除 + 重新允许 3 个子目录

**白名单 vs 黑名单对比**：

| 方式                                                                | 优点                 | 缺点                                |
| ------------------------------------------------------------------- | -------------------- | ----------------------------------- |
| **白名单（本次采用）**：先排除 `.trae/`，再 `!` 重新允许 3 个子目录 | 未来新增文件默认安全 | 需要为每个要入库的子目录写 `!` 规则 |
| **黑名单**：删除 `.trae/`，未来新增敏感文件需手动加排除规则         | 简单                 | 新增文件默认入库，可能误提交        |

**结论**：项目处于探索开发阶段，未来 `.trae/` 下可能新增临时调试产物、Claude/Copilot 配置、`.worktrees/` 等，**白名单模式更安全**。

#### 2.2.3 同时归档 ADR-019 自身

按"自指原则"，本次决策也要被未来 AI 看到——所以 ADR-019 本身必须入库。

### 2.3 入库的 3 个子目录详解

| 子目录             | 文件数                          | 入库理由                                                                 |
| ------------------ | ------------------------------- | ------------------------------------------------------------------------ |
| `.trae/adr/`       | 19 份 ADR + 1 份 README = 20 份 | 架构决策记录（ADR-001 ~ ADR-019 含本 ADR），记录"为什么这么做"的核心知识 |
| `.trae/rules/`     | 4 份                            | 4A 架构 + DDD + 前端编码 + 测试编写规范，所有 AI 工具必读                |
| `.trae/documents/` | 6 份                            | PRD / 技术架构 / API 参考 / 架构合规指南 / GitHub 设置 / 类型系统        |

**总入库文件数**：**30 份 markdown**（2026-07-08 当时）。

---

## 三、实施过程（2026-07-08 增量-11）

### 3.1 实施步骤

| 阶段 | 操作                                                     | 涉及文件        |
| ---- | -------------------------------------------------------- | --------------- |
| 1    | 检查 `.gitignore` 第 39 行现状                           | 1 文件          |
| 2    | 调研 `.trae/` 下文件是否含敏感信息                       | 30 文件清单     |
| 3    | 用 AskUserQuestion 与用户确认动作                        | 1 次交互        |
| 4    | 修改 `.gitignore`：先排除 + 用 `!` 反向重新允许 3 子目录 | 1 文件 9 行新增 |
| 5    | 创建本 ADR（ADR-019）                                    | 1 文件新增      |
| 6    | 更新 `.trae/adr/README.md` 索引                          | 1 文件          |
| 7    | 更新 v4 报告 §9 优先级清单 + 附录增量-11                 | 1 文件          |
| 8    | v4 §6.9 增加"已修复 ADR git 同步"章节                    | 1 文件          |

### 3.2 验证结果

| 验证项                                                 | 结果                               |
| ------------------------------------------------------ | ---------------------------------- |
| `git check-ignore .trae/adr/001-typescript-express.md` | ❌ not ignored（应不被忽略）       |
| `git check-ignore .trae/rules/top-rules.md`                    | ❌ not ignored                     |
| `git check-ignore .trae/documents/PRD.md`              | ❌ not ignored                     |
| `git check-ignore .trae/.worktrees/foo`（假设未来）    | ✅ ignored（默认排除）             |
| `git status --short` 列出待入库文件                    | 30 份 markdown + `.gitignore` 改动 |

### 3.3 git 操作建议（增量-11 不直接执行）

按 rules/top-rules.md 强制报告规则 #4（不在用户明确要求前自动 commit），本次只做：

- ✅ 修改 `.gitignore`
- ✅ 创建 ADR-019
- ✅ 更新 v4 报告
- ⏸ **不执行**：`git add .trae/` + `git commit`（等待用户手动 commit）

未来用户在本地执行：

```bash
git add .trae/adr/ .trae/rules/ .trae/documents/
git add .gitignore
git commit -m "feat(docs): 同步 .trae/{adr,rules,documents}/ 到 git 跟踪 (ADR-019)"
```

---

## 四、影响与收益

### 4.1 直接收益

- ✅ **30 份核心知识资产入库**（2026-07-08 当时；现 32 份）：团队成员 git clone 后立刻获得完整设计规范与决策历史
- ✅ **rules/top-rules.md §五 文档同步规则得到遵循**：ADR 真正成为"项目的核心宪法"
- ✅ **AI 协作一致性**：所有 AI 工具（Trae/Cursor/Copilot/Claude Code）clone 后读到相同规则
- ✅ **git 历史可追溯**：未来调整 ADR（如 ADR-020）可以通过 git diff 看到改动

### 4.2 间接收益

- ✅ **v4 报告 §9 优先级清单第 1 个 🔴 高/🟡 中 待办关闭**
- ✅ **架构规则 architecture.md §五 ADR-001 ~ ADR-019 链接全部生效**：之前是"伪链接"（文件不存在于仓库）
- ✅ **rules/top-rules.md §一 强制报告规则 #5** "项目代码发生变化时，必须同步更新本文件及 `.trae/` 下相关文档" 现在双向都生效

### 4.3 风险与缓解

| 风险                                                                  | 缓解措施                                                         |
| --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 未来 `.trae/` 下新增敏感文件（如 `.claude/settings.json` 含个人偏好） | 用 `!` 白名单模式，未来新增文件默认被排除，需手动 `!` 才入库     |
| ADR 写入冲突（多人同时改 ADR）                                        | markdown 是文本文件，git merge 可处理；建议大型 ADR 拆分到子目录 |
| 30 份 markdown 一次 commit 可能 history 混乱                          | 建议分 3 个 commit：`adr` / `rules` / `documents`，每批独立提交  |

---

## 五、未来演进

### 5.1 持续维护

- **新增 ADR 时**：在 `.trae/adr/` 创建 `019-xxx.md` 或更大编号，同步更新 `.trae/adr/README.md` 索引
- **新增规则文件**：在 `.trae/rules/` 创建（如 `security.md`），同步更新 `architecture.md` §五 参考资源
- **新增设计文档**：在 `.trae/documents/` 创建（如 `DEPLOYMENT.md`），同步更新 `docs/项目全面分析报告_v4.md` §10.3 迁移报告与文档

### 5.2 与其他 ADR 的关系

- **ADR-001 ~ ADR-018**：本次决策后，全部入库可读
- **ADR-006（命令过滤删除）**：本 ADR 决策时（2026-07-08）ADR-006 文件尚未单独建档；后已于 2026-07-09 重新建档为反向 ADR（Superseded），记录删除决策的来龙去脉

### 5.3 与其他规则文件的关系

- **rules/top-rules.md §五**：明确要求 ADR 与规则文件同步更新——本 ADR 决策符合这条规则
- **rules/architecture.md §五 参考资源**：列出 `.trae/adr/` 链接，本次决策后链接真正生效

---

## 六、参考资源

- **项目顶层规则**：[rules/top-rules.md §五 文档同步规则](../rules/top-rules.md)
- **架构规则**：[rules/architecture.md §五 参考资源](../rules/architecture.md)
- **完整 P1-5 全景**：[docs/P1-5_migration_batch4.md §六 P1-5 全量完成度量](../../docs/P1-5_migration_batch4.md)
- **v4 报告**：[docs/项目全面分析报告\_v4.md §9 优先级清单 + §10.3](../../docs/项目全面分析报告_v4.md)
- **git 文档**：[`.trae/documents/GITHUB_SETUP.md`](../documents/GITHUB_SETUP.md)
