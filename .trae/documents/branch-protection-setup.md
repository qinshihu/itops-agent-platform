# Branch Protection 配置指南（2026-07-21 P0-10）

> **角色定位**：本文档是 [GITHUB_SETUP.md §一 Branch 保护规则](./GITHUB_SETUP.md) 的**详细操作手册**。前者讲"配置哪些项、为什么"，本文档讲"在 GitHub UI 怎么点、字段填什么"。
>
> **触发来源**：[docs/开源治理与架构健壮性最终报告_v2.md §9.1 L365-369](../../docs/开源治理与架构健壮性最终报告_v2.md)

---

## 为什么必须配

[v2 报告 §3](../../docs/开源治理与架构健壮性最终报告_v2.md) 列出的全部 P0 项（`npm test` / `npm run lint` / `architecture-check`）目前是**可选项**——没强制检查，没有 Branch Protection 就直接绕过了。

**配 Branch Protection 后**，所有 P0 修复才有真实保护：
- ❌ 不允许直接 push 到 main（必须 PR + review + CI 全绿）
- ❌ 不允许 force push
- ❌ 一旦过时 approval 自动 invalidate

---

## 配置步骤（人工，30 分钟）

### 1. 打开仓库 Settings

```
https://github.com/<org>/AIops/settings/branches
```

### 2. 添加 Branch protection rule

**Branch name pattern**: `main`

### 3. 配置选项（按截图对应 UI）

#### ✅ Require a pull request before merging

- [x] Require approvals: **1**
- [x] Dismiss stale pull request approvals when new commits are pushed
- [x] Require review from Code Owners
- [x] ✅ **Require approval of the most recent reviewable push** (保持最新)
- [ ] ✅ Restrict who can dismiss pull request reviews (可选)

#### ✅ Require status checks to pass before merging

- [x] Require branches to be up to date before merging

**Required status checks**（必须勾选以下 3 个）：

| Check 名称 | 来源 |
|---|---|
| `lint` | [backend/package.json](file:///c:/Users/123/Desktop/daima/AIops/backend/package.json) 里 `npm run lint` |
| `test` | [backend/package.json](file:///c:/Users/123/Desktop/daima/AIops/backend/package.json) 里 `npm test` |
| `frontend-build` | [frontend/package.json](file:///c:/Users/123/Desktop/daima/AIops/frontend/package.json) 里 `npm run build` |
| `architecture-check` | [scripts/check-architecture.js](file:///c:/Users/123/Desktop/daima/AIops/scripts/check-architecture.js)（项目自定义） |
| `backend-build` | [backend/package.json](file:///c:/Users/123/Desktop/daima/AIops/backend/package.json) 里 `npm run build` |

> **注**：GitHub UI 会先展示最近一次跑过的 check 列表，**只有过去 7 天跑过的 check 才会出现**。所以新仓库必须先有一次 PR 跑通所有 CI 后才能勾选。

**解决方案**：
1. 先创建第一个 PR（可立刻合并）触发 CI
2. 等 CI 全部跑完（约 10-15 min）
3. 再回来 Branch protection 页面勾选

#### ✅ Require conversation resolution before merging

- [x] 勾选（防止讨论被人忽略）

#### ✅ Require signed commits

- [x] 勾选（提升安全性）

#### ✅ Require linear history

- [x] 勾选（禁止 merge commit，强制 rebase 或 squash）

#### ❌ Do not allow force pushes

- [x] **勾选** 默认开启

#### ❌ Do not allow deletions

- [x] **勾选** 默认开启

---

## v2 报告的 3 个核心 check 详细配置

### `lint` check
```yaml
name: lint
runs-on: ubuntu-latest
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version-file: '.nvmrc'
      cache: 'npm'
  - run: cd backend && npm ci
  - run: cd backend && npm run lint
```

### `test` check
```yaml
name: test
runs-on: ubuntu-latest
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version-file: '.nvmrc'
      cache: 'npm'
  - run: cd backend && npm ci
  - run: cd backend && npm test
```

### `architecture-check` check（自定义）
```yaml
name: architecture-check
runs-on: ubuntu-latest
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version-file: '.nvmrc'
      cache: 'npm'
  - run: cd backend && npm ci
  - run: node scripts/check-architecture.js
```

---

## 实际生效验证

### 实际效果：
- ❌ 直接 push 到 main 会被拒绝
- ❌ PR 合并按钮在 CI 红时变灰
- ❌ force push 到 main 会被拒绝
- ✅ 1 approval + CI 绿 → 可以 merge

### 紧急绕过（仅仓库 admin）：
Settings → Branches → Branch protection rules → "Allow specified actors to bypass required pull requests"

---

## 未做事项

- [ ] **应用本配置到 org/team 层**（让所有新 repo 默认按此规则）
- [ ] **Dependabot 配置**（v2 报告 §6.1 提到无 Dependabot）
- [ ] **CodeQL 配置**（v2 报告 §6.2 提到无 CodeQL）

---

**关联**：v2 报告 §9.1 P0 #10（治理任务，非技术决策，不需 ADR）
