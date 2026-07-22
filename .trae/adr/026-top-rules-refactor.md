# ADR-026: 1.md → top-rules.md 重构决策

> **状态**：已采纳（2026-07-21 v2.1）
> **触发来源**：根目录 AI 工具配置文件统一收纳到 `ai-tool-configs/` 后，发现 `.trae/rules/top-rules.md` 也存在类似的"无语义文件名 + 章节自相矛盾"问题
> **关联**：[top-rules.md](../rules/top-rules.md) · [ai-tool-configs/README.md](../../ai-tool-configs/README.md)

---

## 一、问题

`.trae/rules/top-rules.md`（157 行，10 章节）存在以下问题：

1. **文件名无语义**：`.trae/rules/` 下其他规则都是语义化命名（`architecture.md` / `frontend.md` / `powershell.md` / `lessons-learned.md` / `testing.md`），`1.md` 是唯一数字命名，新人不知道这是什么文件
2. **顶部自相矛盾**：第一行说"适用于所有 AI 辅助开发工具（Trae/Cursor/Copilot/Claude Code 等）"，但 §二明确"开发阶段不维护其他工具的入口"
3. **章节重叠**：
   - §三「代码位置」+ §四「本地开发方式」+ §五「开发阶段说明」三章加起来信息交叉
   - §九「UI/配置」+ §十「本地 Node 环境」各只有 3-4 行，作为独立章节太单薄
4. **业务原则混入流程规则**：§七 SSH / §八 AI/LLM / §九 UI 三大业务领域原则跟其他流程规则混在一个文件里
5. **顶部 blockquote 跟正文重复**：顶部 4 条 blockquote 跟下面章节正文内容重复
6. **无 TOC**：158 行文件 + 10 章节，新人不知道先读哪一章

---

## 二、决策

### 2.1 文件重命名

**`1.md` → `top-rules.md`**

理由：

- 跟 `architecture.md` / `frontend.md` 等命名风格一致
- "top" 强调"顶层规则"语义（vs `architecture.md` 是架构详细规则）
- 文件名直接体现"AI 必读首条规则"的核心定位

### 2.2 章节重组

**优化前 10 章 → 优化后 9 章（含新增 §九迁移说明）**：

| 优化前                  | 优化后                     | 说明             |
| ----------------------- | -------------------------- | ---------------- |
| §一 强制报告规则        | §一 强制报告规则           | 不变             |
| §二 AI 工具支持范围     | §二 AI 工具支持范围        | 不变             |
| §三 代码位置            | §四 代码位置与开发方式     | 合并 §三/§四/§五 |
| §四 本地开发方式        | §四.4.2 代码位置与开发方式 | 并入 §四         |
| §五 开发阶段说明        | §五 探索开发阶段约束       | 精简             |
| §六 文档同步规则        | §六 文档同步规则           | 不变             |
| §七 SSH 功能设计原则    | → 迁到 architecture.md §六 | 业务领域原则分离 |
| §八 AI/LLM 模块设计原则 | → 迁到 architecture.md §七 | 业务领域原则分离 |
| §九 UI/配置管理原则     | → 迁到 architecture.md §八 | 业务领域原则分离 |
| §十 本地 Node 环境      | §八 本地 Node 环境         | 保持             |

**新增章节**：

- §三 文档路径与编码（合并原 blockquote 顶部规则 + PowerShell 编码规则）
- §四.4.2 合并原 §三 + §四
- §七 PowerShell 编码禁令（从原 §六分离出来，强化独立章节）
- §九 迁移到 architecture.md 的业务原则（指针章节）

### 2.3 增加 TOC

顶部加 📑 目录章节，新人可跳读。

### 2.4 修正自相矛盾

顶部"适用范围"由"Trae/Cursor/Copilot/Claude Code 等所有 AI 工具"改为"**Trae CN**（项目默认 AI 工具）"，并指向 `ai-tool-configs/`。

---

## 三、跨文件影响

`1.md` 被 **58 处**跨文件引用，需要批量更新：

- `AGENTS.md`（3 处）
- `.trae/README.md`（4 处）
- `.trae/adr/*.md`（多份 ADR）
- `.trae/rules/{powershell,lessons-learned}.md`（多处）
- `ai-tool-configs/*`（多处）
- `.github/PULL_REQUEST_TEMPLATE.md`（1 处）
- `backend/src/utils/env.ts`（1 处，代码注释）
- `local-dev/README.md`（1 处）

**处理方式**：用 Node.js `fs.readFileSync/writeFileSync` 批量替换（避免 PowerShell 编码陷阱，详见 [powershell.md §2.4](../rules/powershell.md#24-强制规则批量文件操作只能用-nodejs2026-07-21-新增-15-事件)）。

---

## 四、不采纳的方案

### 方案 B（最小修改）

只重命名 + 修正自相矛盾。

**否决理由**：用户（项目维护者）选择了方案 A「全面重构」。方案 B 不能解决 §三+§四+§五 章节重叠、§九+§十 各只有 3-4 行、顶部 blockquote 跟正文重复等问题。

### 方案 C（保持现状）

不改 1.md。

**否决理由**：1.md 已存在的 6 个问题（见 §一）会持续影响新人 onboarding 和维护效率。

---

## 五、验收标准

- ✅ `top-rules.md` 创建完毕，含 TOC + 9 章节
- ✅ `1.md` 已删除
- ✅ 58 处跨文件引用全部从 `1.md` 更新到 `top-rules.md`
- ✅ ESLint 0 errors / Tests 903/903 / depcruise 0 errors
- ✅ ADR-026 创建完毕（本文档）

---

## 六、迁移清单（执行记录）

- [x] 2026-07-21 创建 `top-rules.md`
- [x] 2026-07-21 创建 ADR-026（本文档）
- [x] 2026-07-21 批量更新 58 处跨文件引用（Node.js 脚本，22 个文件改动）
- [x] 2026-07-21 删除 `1.md`
- [x] 2026-07-21 把业务原则（SSH/AI/UI）迁到 `architecture.md §六/§七/§八`
- [x] 2026-07-21 更新 `.trae/README.md` 索引（v6.2 版本）
- [x] 2026-07-21 depcruise 验证通过（0 errors）
- [x] 2026-07-21 ESLint 验证（后端 0 errors，前端 6 errors 均为历史遗留）

---

**最后更新**：2026-07-21（v2.1：top-rules.md 重构决策）
