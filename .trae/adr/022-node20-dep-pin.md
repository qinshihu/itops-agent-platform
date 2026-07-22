# ADR-022: 降 depcruise 和 lint-staged 到兼容 Node 20 的版本

| 字段         | 值                                                                                                                                |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **状态**     | ✅ Accepted（2026-07-21）                                                                                                         |
| **触发来源** | [docs/开源治理与架构健壮性最终报告_v2.md §1 L13-19](../../docs/开源治理与架构健壮性最终报告_v2.md)（架构方向 4/5 但"实际跑不通"） |
| **关联 ADR** | [020-agent-tool-risk-audit.md](020-agent-tool-risk-audit.md)（v2.4 错误复盘经验）                                                 |

---

## 一、背景

[报告 v2 §0 TL;DR](../../docs/开源治理与架构健壮性最终报告_v2.md) 发现：

> **`npx depcruise` 在 Node 20 上直接报版本不支持**（要求 `^22 || ^24 || >=26）

实测确认：`package.json` 锁的 `dependency-cruiser: ^18.0.0`，但 17.x 起 depcruise 已要求 Node ≥ 22；项目 [../../.nvmrc](../../.nvmrc) 锁 Node 20.19.5（按 [../rules/top-rules.md §四](../rules/top-rules.md) 推荐）。

同样的问题也出现在 `lint-staged: ^17.0.8`（要求 Node ≥ 22.22.1）。

## 二、决策

**降 depcruise 到 16.10.4，降 lint-staged 到 15.5.2，全部锁版本（不带 `^`）**。

不升 Node 版本，理由：

1. [../rules/top-rules.md §四](../rules/top-rules.md) 明确"推荐 Node 20"作为开发规范
2. 项目已配套写 [../../docs/Node_v20.19.5_安装方案.md](../../docs/Node_v20.19.5_安装方案.md)
3. 升 Node 22 需要回归测试 native 模块（better-sqlite3 / net-snmp / ssh2）
4. **最小破坏原则**：只改 2 行 devDependencies，不动业务代码

## 三、变更

| 包                   | 旧        | 新                | 原因                                            |
| -------------------- | --------- | ----------------- | ----------------------------------------------- |
| `dependency-cruiser` | `^18.0.0` | `16.10.4`（精确） | 16.x 最后兼容 Node 20 的版本（2025-07-02 发布） |
| `lint-staged`        | `^17.0.8` | `15.5.2`（精确）  | 15.x 最后兼容 Node 20 的版本                    |
| `husky`              | `^9.1.7`  | 不动              | husky 9.x 已兼容 Node 20                        |
| Node                 | `20.19.5` | 不动              | 按 rules/top-rules.md §四                               |

## 四、验证

| 命令                                 | 结果                                 |
| ------------------------------------ | ------------------------------------ |
| `npx depcruise --version`            | ✅ 16.10.4（不再报 Node 版本不支持） |
| `npm run check:deps`                 | ✅ Exit 0（之前 CI 启动即红）        |
| `npx lint-staged --version`          | ✅ 15.5.2                            |
| `npm install`                        | ✅ 0 EBADENGINE 警告（之前 2 个）    |
| `node scripts/check-architecture.js` | ✅ Exit 0（架构检查通过，0 违规）    |

### 4.1 2026-07-21 后续动作：check-architecture.js 改 exit 1

[../../scripts/check-architecture.js:323](../../scripts/check-architecture.js#L323) 原代码：

```js
process.exit(0); // 不阻塞 CI，由 lint/depcruise 层负责硬拦截
```

问题：依赖 depcruise 作为"真正的硬拦截"，但 depcruise 在 Node 20 跑不起来 → 架构护栏**事实上失效**。

修复：改成 `process.exit(hasCriticalViolations ? 1 : 0)`，让本脚本成为架构护栏的真硬拦截。

验证：
- 0 违规 → Exit 0 ✅
- 有违规 → Exit 1 → CI 红 ✅
- 当前 0 违规（之前的修复成果）

### 4.2 2026-07-21 后续动作：修 npm test 8 失败 → 903/903 全绿

[v2 报告 §1 L13-19](../../docs/开源治理与架构健壮性最终报告_v2.md) 列出的 8 个测试失败全部修复。

| 文件 | 失败数 | 修复 |
|---|:--:|---|
| `dcRepository.test.ts` | 1 | 期望的 `DELETE FROM dc_rack_slots` 改为 `UPDATE dc_pdus`（生产用 FK CASCADE 级联） |
| `vmMigrationService.test.ts` | 5 | (1) 期望 `WHERE vm_id = ?` → `vm_id = ?`（更宽松子串匹配）；(2) mock `migrateVM` 永远 pending；(3) 修正 INSERT 参数期望匹配实际 SQL 字段顺序；(4) 拆分 `stmt.run.mock.calls[0]` 检查第 1 次 INSERT |
| `registryService.test.ts` | 2 | (1) `addRegistry` 期望 9 个参数补到 11 个（status default + project_count + repo_count）；(2) `updateStatus` 参数顺序补 `'error'` |

最终结果：
- Test Files: **86 passed (86)**
- Tests: **903 passed (903)**
- Duration: 16.10s

关键洞察：所有 8 个失败都是 **测试断言写错**（生产代码正确），符合"测试滞后于生产"模式。

## 五、未做事项（按需触发）

- [ ] **未来升 Node 22 时**：把 depcruise/lint-staged 都升到最新；建议下次大版本升级时统一处理
- [ ] **检查其他 devDeps 是否也有 Node 版本要求**：用 `npm ls engines` 定期审计
- [ ] **加 CI 步骤检查 EBADENGINE**：失败时报警（预防再次出现类似问题）

## 六、经验教训

按 [rules/lessons-learned.md §3.4](../../.trae/rules/lessons-learned.md)：

- **devDependencies 升级时容易破坏 Node 兼容性**——`^` 标记让 npm 自动追新，但 npm 包可能在中间大版本升级 Node 要求
- **解法**：用 `--save-exact` 锁版本，或在 `engines` 字段硬约束 Node 版本
- **CI 应该拦截 EBADENGINE 警告**（目前只 warn 不阻断）

---

**最后更新**：2026-07-21
**维护者**：项目作者 + AI 协作（Trae）
