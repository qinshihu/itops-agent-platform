# GitHub 仓库设置指南

> 开源到 GitHub 后，按本文档逐步配置仓库设置，确保外部贡献者的代码质量。

---

## 一、Branch 保护规则（必须配置）

**详细操作步骤**（含 GitHub UI 路径、具体 status check 名称、推荐配置项）见 **[branch-protection-setup.md](./branch-protection-setup.md)**。

本文档 §二 ～ §八 介绍其他 7 项仓库配置（默认分支 / PR / Labels / Actions / 安全 / 验证 / CI）。

---

## 二、默认分支设置

```
仓库主页 → Settings → General → Default branch
```

- 默认分支设置为 `main`

---

## 三、PR 合并策略

```
仓库主页 → Settings → General → Pull Requests
```

| 配置项 | 推荐设置 | 说明 |
|------|:--:|------|
| Allow merge commits | ✅ 勾选 | 保留完整提交历史 |
| Allow squash merging | ✅ 勾选 | 允许将多个 commit 压缩为一个 |
| Allow rebase merging | ✅ 勾选 | 允许线性历史 |

**推荐**：默认使用 Squash and merge，保持 main 分支干净。

---

## 四、Labels 标签管理

建议创建以下标签，方便 Issue/PR 分类：

| 标签名 | 颜色 | 用途 |
|------|:--:|------|
| `bug` | `#d73a4a` | Bug 修复 |
| `feature` | `#0e8a16` | 新功能 |
| `docs` | `#0075ca` | 文档更新 |
| `refactor` | `#fbca04` | 代码重构 |
| `architecture` | `#5319e7` | 架构变更 |
| `good first issue` | `#7057ff` | 适合新贡献者 |
| `help wanted` | `#008672` | 需要帮助 |
| `breaking` | `#b60205` | 破坏性变更 |

---

## 五、Actions 权限

```
仓库主页 → Settings → Actions → General
```

| 配置项 | 设置 |
|------|:--:|
| Actions permissions | Allow all actions and reusable workflows |
| Fork pull request workflows from outside collaborators | Require approval for first-time contributors |

---

## 六、安全设置

### 6.1 依赖安全扫描

```
仓库主页 → Settings → Security → Code security and analysis
```

| 配置项 | 设置 |
|------|:--:|
| Dependabot alerts | ✅ 启用 |
| Dependabot security updates | ✅ 启用 |
| Code scanning (CodeQL) | ✅ 启用（推荐） |

### 6.2 秘密扫描

```
仓库主页 → Settings → Security → Secret scanning
```

| 配置项 | 设置 |
|------|:--:|
| Secret scanning alerts | ✅ 启用 |
| Push protection | ✅ 启用（防止 `.env` 等敏感文件被提交） |

---

## 七、验证：检查你的配置是否生效

完成以上配置后，做一次验证：

1. 创建一个测试分支，直接 push 到 main → 应该被拒绝
2. 创建一个 PR，不勾选 PR 模板 checklist → 应该能发现
3. 在 PR 中引入一个 `any` 类型 → CI 应该报 ESLint error
4. 在 PR 中引入 `core/ → modules/` 依赖 → CI 应该报架构违规

---

## 八、CI 自动检查清单

配置完成后，每个 PR 会触发以下检查：

```
✅ tsc --noEmit            — 类型错误拦截
✅ ESLint                   — no-console + no-explicit-any 拦截
✅ check-architecture.js    — core→modules、跨模块路由拦截
✅ depcruise               — 循环依赖、禁止路径拦截
✅ vitest run              — 后端测试 + 前端测试
✅ vite build              — 前端构建验证
✅ coverage thresholds     — 后端 lines 30% / branches 25% / functions 60% + 前端 lines 20%
```

**任何一项失败，PR 无法合并。**