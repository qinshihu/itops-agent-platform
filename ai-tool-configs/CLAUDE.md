# CLAUDE.md —— Claude Code 入口

> **重要**：本项目 AI 协作的完整规则集中在 [AGENTS.md](./AGENTS.md)。
>
> 本文件**只**包含 Claude Code 特有的简短提示，目的是在多份 AI 入口文件间避免内容漂移。

---

## 进入本项目工作时

1. **第一件事**：阅读 [AGENTS.md](./AGENTS.md)
2. 任务类型对照 §4 常见任务表（新增实体 / 新增 Agent 工具 / 修 Bug / 跨模块联动）
3. 改动后必跑 `npm run lint` + `npx tsc --noEmit`

## Claude Code 特有提示

- **长输出优先使用文件**：分析报告、方案计划写到 `docs/`，不要直接输出超长内容
- **使用 Edit/Write 而非 sed**：修改项目文件请用专用工具，避免 PowerShell 中文编码问题
- **模块定位**：参考 [architecture.md §1.2](./.trae/rules/architecture.md) 24 个模块清单
- **架构决策**：写到 `.trae/adr/NNN-<slug>.md` 之前先看 [ADR-019](./.trae/adr/019-trae-adr-git-tracking.md) 的格式
- **大文件**：单文件 >500 行必须拆分（既有豁免清单见 [architecture.md §3.3](./.trae/rules/architecture.md)）

## 中文回复

- 用户消息默认中文 → 用中文回复
- 代码注释跟项目语言保持一致（项目以中文注释为主）
- 命名严格遵循 AGENTS.md §3 命名规范

---

**更多规则**：见 [AGENTS.md](./AGENTS.md) §2 铁律和 §6 错误对照表
**最后更新**：2026-07-21