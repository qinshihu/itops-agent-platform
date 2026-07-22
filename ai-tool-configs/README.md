# ai-tool-configs/ — 其他 AI 编程工具配置文件（按需手动拉取）

> ⚠️ **使用本目录前必读**——**本目录的文件不是源真相，仅供参考模板**。
>
> **源真相（必须先读）**：
>
> 1. 根目录 **[AGENTS.md](../AGENTS.md)** — 项目所有 AI 工具的**统一入口**（含 §3 铁律 + §8 项目特定豁免/强规则）
> 2. **[.trae/](../.trae/) 目录** — Trae CN 的必读规则集（架构 / 强制报告 / 编码约束 / 豁免规则 / 错误复盘）
>
> **本目录的定位**：
>
> - 当你使用 **Cursor / Windsurf / Cody / Continue / Aider / Claude Code / GitHub Copilot** 等**非 Trae CN 工具**时，**根据本机开发环境与所用工具特性**，**复制对应文件到项目根目录**并**按需调整**（如路径前缀、文件名大小写、PowerShell vs bash 命令差异等），再开始 AI 开发
> - 项目维护者**只维护** [AGENTS.md](../AGENTS.md) + [.trae/](../.trae/) 一份源真相，**不主动同步更新本目录的派生配置**——避免「7 份派生文件漂移」浪费 token
> - **如发现本目录的派生配置与 AGENTS.md / .trae/ 不一致时，以 [AGENTS.md](../AGENTS.md) 为准**（各派生文件顶部已标注此约定）
>
> 本项目**默认只支持 Trae CN**（规则见根目录 [AGENTS.md](../AGENTS.md) 和 [.trae/rules/](../.trae/rules/)）。
>
> 如果你需要使用 Cursor / Windsurf / Cody / Continue / Aider / Claude Code 等其他工具，按下方说明**手动把对应文件复制到项目根目录**即可。

---

## 📦 包含的工具配置

| 文件                              | 用途                          | 对应工具                                              |
| --------------------------------- | ----------------------------- | ----------------------------------------------------- |
| `.cursorrules`                    | Cursor 编辑器入口规则         | [Cursor](https://cursor.com)                          |
| `.windsurfrules`                  | Windsurf 编辑器入口规则       | [Windsurf](https://codeium.com/windsurf)              |
| `.aider.conf.yml`                 | Aider CLI 配置                | [Aider](https://aider.chat)                           |
| `.continue/config.json`           | Continue.dev VS Code 扩展配置 | [Continue](https://continue.dev)                      |
| `.github/copilot-instructions.md` | GitHub Copilot 入口规则       | [GitHub Copilot](https://github.com/features/copilot) |
| `CLAUDE.md`                       | Claude Code 入口规则          | [Claude Code](https://claude.ai/code)                 |

---

## 🔧 使用方式（按需拉取）

### 方案 A：复制单个工具的配置

```bash
# Cursor
cp ai-tool-configs/.cursorrules ./

# Windsurf
cp ai-tool-configs/.windsurfrules ./

# Aider
cp ai-tool-configs/.aider.conf.yml ./

# Continue（保留目录结构）
mkdir -p .continue && cp ai-tool-configs/.continue/config.json .continue/

# GitHub Copilot
mkdir -p .github && cp ai-tool-configs/.github/copilot-instructions.md .github/

# Claude Code
cp ai-tool-configs/CLAUDE.md ./
```

Windows PowerShell 等价命令：

```powershell
# Cursor
Copy-Item ai-tool-configs\.cursorrules .\.cursorrules

# Windsurf
Copy-Item ai-tool-configs\.windsurfrules .\.windsurfrules

# Aider
Copy-Item ai-tool-configs\.aider.conf.yml .\.aider.conf.yml

# Continue（保留目录结构）
New-Item -ItemType Directory -Force -Path .continue | Out-Null
Copy-Item ai-tool-configs\.continue\config.json .continue\config.json

# GitHub Copilot
New-Item -ItemType Directory -Force -Path .github | Out-Null
Copy-Item ai-tool-configs\.github\copilot-instructions.md .github\copilot-instructions.md

# Claude Code
Copy-Item ai-tool-configs\CLAUDE.md .\CLAUDE.md
```

### 方案 B：全部拉取（不推荐）

如果你的团队必须支持多种 AI 工具：

```bash
# 一次性全部复制
cp ai-tool-configs/.cursorrules ./
cp ai-tool-configs/.windsurfrules ./
cp ai-tool-configs/.aider.conf.yml ./
mkdir -p .continue && cp ai-tool-configs/.continue/config.json .continue/
mkdir -p .github && cp ai-tool-configs/.github/copilot-instructions.md .github/
cp ai-tool-configs/CLAUDE.md ./
```

---

## 📚 核心规则入口（始终保留在根目录）

不管用哪个 AI 工具，都应该先读：

- **[AGENTS.md](../AGENTS.md)** — AI 编程工具统一入口（含 5 条铁律 + 命名规范 + 任务类型表）
- **[.trae/rules/architecture.md](../.trae/rules/architecture.md)** — 4A 分层 + DDD 24 模块清单
- **[.trae/rules/top-rules.md](../.trae/rules/top-rules.md)** — 顶层规则（强制报告、代码位置、开发方式）
- **[.trae/adr/](../.trae/adr/)** — 25+ 架构决策记录

> **不要修改本目录下的配置文件**。如需调整规则，统一改 [AGENTS.md](../AGENTS.md) 和 [.trae/rules/](../.trae/rules/)，然后本目录下的派生配置跟随更新。

---

## 🔄 同步策略

- 本目录文件**单向派生自** `AGENTS.md` + `.trae/rules/`
- 修改根目录规则后，对应工具的入口文件需手动更新（目前人工维护，未来可脚本化）
- 各工具入口文件顶部都标注了 `完整规则见 AGENTS.md（如有冲突，以 AGENTS.md 为准）`

---

**最后更新**：2026-07-21 — 由根目录 AI 工具配置文件迁移创建（v2 报告 §9.2 P1-#22 扩展）
