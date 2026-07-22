# ITops Agent 安全开发规范

> 本文档汇总**所有安全相关规则与决策**，作为 AI 辅助开发和新贡献者排查安全问题的**第一入口**。
>
> 具体决策背景与权衡过程见 `../adr/` 下的对应 ADR；本文档只做"安全主题 → ADR 索引 + 编码约束"的快速导航。
>


---

## 一、必读顺序

排查安全问题或编写涉及安全的代码时，按以下顺序阅读：

1. **[architecture.md §六 安全设计原则](./architecture.md)** —— SSH 不做命令过滤的总体原则
2. **[本文件 §二 ~ §六](#目录)** —— 各安全主题的"快速索引 + 编码约束"
3. **对应 ADR** —— 决策背景与权衡细节
4. **[lessons-learned.md](./lessons-learned.md)** —— 历史安全相关错误案例

---

## 📑 目录（Table of Contents）

| §   | 主题                          | 核心 ADR               |
| --- | ----------------------------- | ---------------------- |
| 二  | SSH 命令执行安全              | ADR-023、ADR-006       |
| 三  | 认证与授权（JWT + 3 级 RBAC） | ADR-010                |
| 四  | Agent 工具风险等级与审计追踪  | ADR-020                |
| 五  | 双工具系统的安全边界          | ADR-021                |
| 六  | 安全开发禁止事项（6 条铁律）  | ADR-016、ADR-020、ADR-023 |
| 七  | 安全审计追踪与日志            | ADR-020 §审计要求      |

---

## 二、SSH 命令执行安全

### 2.1 设计原则（2026-07-21 强化）

按 [architecture.md §六](./architecture.md)：

- **SSH 执行层面不做任何命令过滤限制**，允许用户和 AI 输入任何命令
- **不做**：命令过滤、可识别 AI 调用、强制 AI 路径不可执行系统级命令
- **不做的原因**：服务器端通过账号权限控制（Linux `sudoers` / SSH `authorized_keys` `command=`）就能解决
- **原则**：先保证这个功能**能用、好用、易用**，纯前端过滤属于吃力不讨好

### 2.2 已修复的 SSH 命令注入漏洞

[ADR-023 SSH 命令注入修复（agentToolRegistry 4 处）](../adr/023-ssh-command-injection-fix.md) — 2026-07-21 P0-1 闭环。

修复前 5 处真实命令注入漏洞（agentToolRegistry）：

| 行 | 工具 | 用户输入字段 | 危险拼接 |
|:--:|---|---|---|
| 133 | `ssh-exec` | `command` | `executeCommand(serverId, command)` —— command 完全用户字符串 |
| 167 | `view-file` | `filePath`, `lines` | `tail -n ${lines} ${filePath}` |
| 347 | `find-large-files` | `directory`, `minSizeMB` | `find ${directory} -type f -size +${minSizeMB}M ...` |
| 385+388 | `system-logs` | `unit`, `level`, `since` | `journalctl -u ${unit} -p ${level} --since '${since}'` |
| 428 | `service-status` | `unit` | `systemctl status ${unit}` |

### 2.3 SSH 工具安全模式（safeCommandBuilder）

详见 [ADR-023 §二 决策](../adr/023-ssh-command-injection-fix.md)，核心做法：

1. **字符串参数强白名单**：3 个 regex（`SAFE_FILENAME_CHARS` / `SAFE_UNIT_CHARS` / `SAFE_PATH_CHARS`），拒绝所有 shell metacharacter
2. **数字参数范围校验**：`assertNumberInRange(value, paramName, min, max)`
3. **命令名白名单**：~25 个（`cat / ls / tail / journalctl / systemctl` 等）
4. **API 重设计**：`ssh-exec` 的 `command: string` 改为 `commandName: string + args: string[]`

### 2.4 历史决策（已 Deprecated）

[ADR-006 SSH 命令安全过滤](../adr/006-command-filter.md) — 2026-07-06 Deprecated。

`middleware/commandFilter.ts` 已删除。原 6 层过滤 + 3 级角色方案被淘汰，理由：

1. 6 层过滤经常**误判合法命令**
2. 编码绕过检测永远跑不过用户
3. 纯前端过滤属于吃力不讨好
4. **实际企业环境靠 Linux `sudoers` 与 SSH `authorized_keys` `command=` 控制账号权限更彻底**

---

## 三、认证与授权（JWT + 3 级 RBAC）

详见 [ADR-010 认证与授权方案 — JWT + 3 级 RBAC](../adr/010-authentication-authorization.md)。

### 3.1 角色分级

| 角色 | 权限范围 |
|---|---|
| `viewer` | 只读访问（查看状态、查询数据） |
| `operator` | 执行运维操作（修复、配置变更） |
| `admin` | 系统管理（用户管理、角色分配、AI 配置） |

### 3.2 RBAC 应用范围

- ✅ **路由级访问控制**（按 `requireRole()` 中间件）
- ❌ **命令执行层不再做角色过滤**（按 architecture.md §六，2026-07-06 ADR-006 Deprecated 后）

### 3.3 RBAC 安全护栏

[ADR-024 P0-4 userRoutes role 白名单](../adr/024-p0-batch-fixes.md)：

- 限制 `role` 字段只能为 `[admin/operator/viewer]`
- 拒绝删除最后一个 admin
- 拒绝禁用最后一个 admin

---

## 四、Agent 工具风险等级与审计追踪

详见 [ADR-020 Agent 工具增加风险等级与审计追踪](../adr/020-agent-tool-risk-audit.md)。

### 4.1 风险等级模型

每个 agent 工具（`agentToolRegistry`）必须标注：

```typescript
{
  riskLevel: 'low' | 'medium' | 'high' | 'critical',  // 风险等级
  auditEnabled: boolean,                                // 是否强制审计
}
```

### 4.2 风险等级判定（参考）

| 等级 | 典型操作 | 审计要求 |
|---|---|---|
| `low` | 只读查询（`list-servers`、`get-metrics`） | 可选 |
| `medium` | 修改性操作（`update-config`、`restart-service`） | 必须审计 |
| `high` | 远程执行（`ssh-exec`、`docker-exec`） | 必须审计 + 用户确认 |
| `critical` | 破坏性操作（`delete-database`、`rm-rf`） | 必须审计 + 双因素确认（未来） |

### 4.3 审计追踪实现

- 写入 `audit_log` 表（[ADR-020 §审计要求](../adr/020-agent-tool-risk-audit.md)）
- 记录字段：执行者、工具名、参数、结果、时间戳、风险等级
- `/audit-logs` 页面（P1-6 新增的 `audit/` 模块）提供查询界面

---

## 五、双工具系统的安全边界

详见 [ADR-021 双工具系统设计](../adr/021-dual-tool-system-design.md)。

### 5.1 两套工具系统对比

| 工具系统 | 归属模块 | 消费者 | 风险模型 |
|---|---|---|---|
| `agentToolRegistry`（24 工具） | `ai/` | ai Agent 内部 Node.js 代码 | `riskLevel` + `auditEnabled` |
| `mcp/toolRegistry`（13+ 平台 + 外部） | `mcp/` | LLM Agent / 外部 MCP client | 6 层 securityGate + approvalFlow |

### 5.2 安全边界设计原因

- **agent 工具是 ai Agent 私有的执行能力**（内部信任边界）
- **mcp 工具是对外开放的协议能力**（外部信任边界）
- 两者的安全模型**正交、刻意并存**——不能为了"统一"硬塞到同一 registry

### 5.3 新增工具时的安全判定

详见 [ADR-021 §六 新增工具判定标准](../adr/021-dual-tool-system-design.md)：

1. **LLM Agent 通过 MCP 调用** → 放 `mcp/toolRegistry`
2. **ai Agent 内部执行** → 放 `agentToolRegistry`，必须含 `riskLevel` + `auditEnabled`
3. **只在 routes 用一次的简单函数** → 不要做成 registry

---

## 六、安全开发禁止事项（6 条铁律）

> ⚠️ 以下每条都有**真实事故或架构违规**支撑，不是凭空规定。违反任意一条 → CI 拦截或人工 review 拒绝。

### 6.1 ❌ 禁止在 SSH 命令拼接用户输入

**事故**：ADR-023 P0-1 已修复 5 处真实命令注入漏洞。

**正确做法**：使用 `safeCommandBuilder.ts`（`backend/src/modules/ai/services/agents/safeCommandBuilder.ts`）的安全函数，或为新工具加白名单校验。

### 6.2 ❌ 禁止 routes 直接 import `repositories/`

**依据**：[ADR-016 routes→service 抽象决策](../adr/016-routes-service-abstraction.md) + architecture.md §3.2。CI 规则 `routes-禁止直访-Repository` severity: error。

**正确做法**：每个 routes 文件必须通过 `services/` 中的 CRUD service（如 `agentCrudService.ts`）访问数据。

### 6.3 ❌ 禁止 `core/` import `modules/` 的代码

**依据**：architecture.md §1.4 技术架构层约束。CI 自动校验（dependency-cruise）。

**正确做法**：基础设施层只依赖同层（`core/` ↔ `core/`、`utils/` ↔ `utils/`），不引用业务模块。

### 6.4 ❌ 禁止跨模块直接 import 对方的 `routes/`

**依据**：architecture.md §2.1 领域间通信规则 + ADR-016。

**正确做法**：模块间只能通过 `services/` 跨模块通信。

### 6.5 ❌ 禁止把敏感信息写进日志/响应

**隐性规则**（架构规则未明文，但属于安全常识）：

- API 响应中**不得**返回密码、Token、API Key、私钥
- 日志中**不得**输出明文密码（即使是 debug 模式）
- 错误响应**不得**包含堆栈跟踪（仅 `error.message`）

### 6.6 ❌ 禁止修改已有的 migration 脚本

**依据**：architecture.md §1.3 + 历史事故（不可逆数据损坏）。

**正确做法**：新增表/字段必须**新增** migration 脚本（`v0023_xxx.sql`），永不改 `v0001_xxx.sql`。

---

## 七、安全审计追踪与日志

### 7.1 审计日志（`audit_log` 表）

由 P1-6 新增的 `audit/` 模块提供：

- 关键操作自动审计（登录、配置变更、修复执行、审批等）
- `/audit-logs` 页面提供按用户/时间/操作类型查询
- 详见 [modules/audit/README.md](../../backend/src/modules/audit/README.md)

### 7.2 高危操作必须审计

按 [ADR-020 §风险等级](../adr/020-agent-tool-risk-audit.md)：

- `riskLevel: medium` 及以上的工具**必须**写入 `audit_log`
- 审计失败 → 工具调用失败（不允许"静默审计"）

### 7.3 日志脱敏

详见 [ADR-020 §6 日志脱敏](../adr/020-agent-tool-risk-audit.md)：

- 密码字段：`*` 替换
- API Key：前缀保留 + 后 4 位 + `***`
- SSH private key：**绝不记录**

---

## 八、与记忆系统的关联

按 [lessons-learned.md](./lessons-learned.md)：

- 安全相关错误 → **L3 重大**（必须新建规则或 ADR）
- 安全相关警告 → **L2 中等**（更新现有规则）
- 安全相关提示 → **L1 轻微**（追加 AGENTS.md §10.4 记忆）

已沉淀的安全相关案例（详见 [lessons-learned.md §八 案例库](./lessons-learned.md)）：

| 日期 | 案例 | 级别 | 沉淀位置 |
|---|---|---|---|
| 2026-07-21 | SSH 命令注入修复（agentToolRegistry 5 处） | L3 | ADR-023 |
| 2026-07-21 | Agent 工具风险等级与审计追踪 | L3 | ADR-020 |
| 2026-07-21 | P0 批量修复（CI + 安全 + lint） | L3 | ADR-024 |
| 2026-07-06 | SSH 命令过滤（Deprecated 反向 ADR） | L3 | ADR-006 |

---

## 九、参考资源

- **架构规则**：[architecture.md §六 安全设计原则](./architecture.md)
- **错误复盘**：[lessons-learned.md](./lessons-learned.md)
- **ADR 索引**：[adr/README.md](../adr/README.md)
- **测试规范**：[testing.md](./testing.md)
- **依赖检查**：`.dependency-cruiser.json` — CI 自动校验模块间依赖合法性

---

---