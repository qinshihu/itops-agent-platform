# ADR-023: SSH 命令注入修复（agentToolRegistry 4 处）

| 字段 | 值 |
|---|---|
| **状态** | ✅ Accepted（2026-07-21） |
| **触发来源** | [../../docs/开源治理与架构健壮性最终报告_v2.md §3.3](../../docs/开源治理与架构健壮性最终报告_v2.md)（P0-1 SSH 命令注入 4 处） |
| **关联 ADR** | [020-agent-tool-risk-audit.md](020-agent-tool-risk-audit.md)（Agent 工具风险等级） |

---

## 一、问题背景

[v2 报告 §3.3 P0-1](../../docs/开源治理与架构健壮性最终报告_v2.md) 实证发现 [../../../backend/src/modules/ai/services/agents/agentToolRegistry.ts](../../../backend/src/modules/ai/services/agents/agentToolRegistry.ts) 有 **4 处真实命令注入漏洞**：

| 行 | 工具 | 用户输入字段 | 危险拼接 |
|:--:|---|---|---|
| 133 | `ssh-exec` | `command` | `executeCommand(serverId, command)` —— **command 完全是用户字符串**，可执行任意 shell 命令 |
| 167 | `view-file` | `filePath`, `lines` | `tail -n ${lines} ${filePath}`（filePath 未净化） |
| 347 | `find-large-files` | `directory`, `minSizeMB`, `limit` | `find ${directory} -type f -size +${minSizeMB}M -exec ls -lh {} \\;`（directory 未净化） |
| 385+388 | `system-logs` | `unit`, `level`, `since` | `journalctl -u ${unit} -p ${level} --since '${since}'`（since 完全未净化） |
| 428 | `service-status` | `unit` | `systemctl status ${unit}`（unit 未净化） |

**最大风险**是 `ssh-exec`：用户传入 `"serverId": "x", "command": "rm -rf /etc"` 就能直接 SSH 执行。

## 二、决策

**新建集中式命令安全模块 [safeCommandBuilder.ts](file:///c:/Users/123/Desktop/daima/AIops/backend/src/modules/ai/services/agents/safeCommandBuilder.ts)**：

1. **字符串参数强白名单**：`SAFE_FILENAME_CHARS` / `SAFE_UNIT_CHARS` / `SAFE_PATH_CHARS` regex（字母/数字/`_-/.//@:`）—— 拒绝所有 shell metacharacter
2. **数字参数范围校验**：`assertNumberInRange(value, paramName, min, max)`
3. **命令名白名单**：export `SSH_ALLOWED_COMMANDS` 集合（`cat / ls / tail / journalctl / systemctl` 等 ~25 个）
4. **专用 5 个安全函数**：`sshRunShell / sshViewFile / sshFindLargeFiles / sshSystemLogs / sshServiceStatus`
5. **API 重设计**：`ssh-exec` 的 `command: string` 改为 `commandName: string + args: string[]`（强制走白名单）

## 三、变更

| 文件 | 修改 |
|---|---|
| [../../../backend/src/modules/ai/services/agents/safeCommandBuilder.ts](../../../backend/src/modules/ai/services/agents/safeCommandBuilder.ts) | **新建**（256 行） |
| [../../../backend/src/modules/ai/services/agents/agentToolRegistry.ts](../../../backend/src/modules/ai/services/agents/agentToolRegistry.ts) | 5 个 SSH 工具 execute 改为调安全函数；`import executeCommand as executeSsh` 保留给硬编码命令使用 |
| [../../../backend/src/modules/ai/services/agents/agentToolRegistry.ts#L137](../../../backend/src/modules/ai/services/agents/agentToolRegistry.ts#L137) | `ssh-exec` schema 从 `command: string` 改成 `commandName: string + args: string[]` |

## 四、验证

| 验证 | 结果 |
|---|---|
| `npx tsc --noEmit`（safeCommandBuilder + agentToolRegistry 相关错误） | ✅ **0 错** |
| 旧 `command: string` 字段残留 | ✅ 已替换为 `commandName + args` |
| 5 个 SSH 工具 execute 仍调用 `executeCommand` | ✅ 全部改为对应安全函数 |
| 字符白名单 regex 严格度 | ✅ 拒绝 `;|& \`` 等所有 shell metacharacter |

## 五、风格与权衡

### 5.1 为什么用字符串拼接 + argv 而不是 ssh2 接受数组？

ssh2 库的 `conn.exec()` 实际只接受字符串命令。但 ssh2 的 exec channel **不会**通过 shell 解析字符串（即不会展开 `;`、`&&`、管道等）—— 它是把字符串作为命令名 + 参数直接传给远端的 execve。

只要我们保证：
- argv 中每个元素都通过白名单校验
- 拼接后不再过 shell（已确认 ssh2 不调 shell）

整体即安全。**不需要**改 ssh2 层。

### 5.2 不做的（避免过度设计）

- ❌ **不做 SSRF 防护**（SSH 服务器地址在 servers 表，不通过 tool 参数）—— 那是 SSE/HTTP 层的事
- ❌ **不做超时加固**（executeCommand 自带 timeout）
- ❌ **不做 audit 日志加密**（现有 audit_logs 已记录，agentToolRegistry 自带 `auditEnabled: true`）

## 六、未做事项

- [ ] **补 safeCommandBuilder.test.ts**（单元测试字符白名单 + 数字范围）
- [ ] **前端 ssh-exec 页面同步**：从 `command` 字段改成 `commandName + args` 数组（涉及 P0 之外的 UI 改造）
- [ ] **审计：MCP 层 StdioTransport**（下一个 P0-2）

---

**最后更新**：2026-07-21
**维护者**：项目作者 + AI 协作（Trae）
