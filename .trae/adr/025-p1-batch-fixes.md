# ADR-025: P1 第一批 + #15 完整 + #16a 启动

> 🏷️ **ADR 类型**：批量修复类（2026-07-21 v6.4 加标签）
> **与决策类 ADR 的区别**：本 ADR 记录"v2 报告 §9.2 列举的 P1 必修项**逐个修复**的过程"，**状态为 In Progress（持续）**。读者应理解为"修复进度跟踪"而非"决策背景"。具体架构决策见关联的 ADR-016/ADR-017。

| 字段 | 值 |
|---|---|
| **状态** | 🔄 In Progress（持续） |
| **触发来源** | [../../docs/开源治理与架构健壮性最终报告_v2.md §9.2 #15–#26](../../docs/开源治理与架构健壮性最终报告_v2.md) |
| **关联 ADR** | [023-ssh-command-injection-fix.md](023-ssh-command-injection-fix.md)、[024-p0-batch-fixes.md](024-p0-batch-fixes.md) |

---

## 一、本次推进清单（2026-07-21）

| P1 # | 项 | 状态 | 工时 |
|:-:|---|:--:|:-:|
| #21 | `.cursorrules` | ✅ | 5min |
| #22 | `.windsurfrules` + `.continue/config.json` + `.aider.conf.yml` | ✅ | 10min |
| #23 | ADR README 主题反向索引 + 快速决策树 | ✅ | 30min |
| #26 | `en.json` 补 5 个 mcp key | ✅ | 5min |
| #18 | `v022_config_templates.ts` 变量名错配 + migrations 跳号注释 | ✅ | 1h |
| #17 | `max-lines` 自定义 ESLint rule `no-restricted-eslint-disable` | ✅ | 2h |
| **#15** | **`src/routes/dc/` 14 文件迁移 `modules/dc/routes/`** | ✅ | **30min**（vs 估算 8h） |
| **#16a 第一步** | **抽出 `BigScreenStatCard.tsx`（5 helpers + StatCard）** | ✅ | **15min** |

**总计**: ~5h 工时完成 8 个 P1 项（v2 报告估算 ~38h）。

---

## 二、P1-#15 决策与执行（最关键）

### 决策
把 legacy `src/routes/dc/`（**已删除**，本链接仅作历史记录）14 文件迁移到 `modules/dc/routes/` 子目录，删除 legacy，符合 **AGENTS.md §铁律 1 分层单向依赖**（模块代码应在 `modules/<m>/routes/`，不应有外部 `src/routes/<m>/`）。

### 执行步骤

1. **备份还原**：误用 PowerShell `Set-Content` 把 UTF-8 中文变成乱码 → `git checkout HEAD -- backend/src/routes/dc/` 恢复
2. **二进制拷贝**：用 `node fs.readFileSync/writeFileSync` 二进制级拷贝，保留 UTF-8 完整字节
3. **批改 import**：用 node 字符串 replace 把 `'../../repositories'` 等改成 `'../../../repositories'`（14 文件 × 3 种 import 路径）
4. **改 modules/dc/routes.ts**：从 `'../../routes/dc'` 改 `'./routes'`
5. **删 legacy**：`Remove-Item -Recurse -Force`
6. **验证**：`tsc --noEmit` + `npm test` + `eslint`

### 为什么实际工时 30min 不是 8h

- **legacy 路径完全独立**：14 个文件本身没有任何外部 import（只 import middleware/repositories/utils），迁移纯属"换层"
- **没有反向依赖**：其他模块没有 `import ... from 'src/routes/dc/...'`
- **`_registry.ts` 已正确指向 `modules/dc/routes.ts`**：因为 `routes.ts` import 的是 legacy，所以只需改这一行
- **没有 service 层重构**：v2 报告 #15 没要求"把业务逻辑从 routes 移到 services"（那是 #19 范畴）

### 文件清单（迁移的 14 个）

[cables.ts](file:///c:/Users/123/Desktop/daima/AIops/backend/src/modules/dc/routes/cables.ts)、[devices.ts](file:///c:/Users/123/Desktop/daima/AIops/backend/src/modules/dc/routes/devices.ts)、[deviceTypes.ts](file:///c:/Users/123/Desktop/daima/AIops/backend/src/modules/dc/routes/deviceTypes.ts)、[exportImport.ts](file:///c:/Users/123/Desktop/daima/AIops/backend/src/modules/dc/routes/exportImport.ts)、[index.ts](file:///c:/Users/123/Desktop/daima/AIops/backend/src/modules/dc/routes/index.ts)、[lifecycle.ts](file:///c:/Users/123/Desktop/daima/AIops/backend/src/modules/dc/routes/lifecycle.ts)、[manufacturers.ts](file:///c:/Users/123/Desktop/daima/AIops/backend/src/modules/dc/routes/manufacturers.ts)、[overview.ts](file:///c:/Users/123/Desktop/daima/AIops/backend/src/modules/dc/routes/overview.ts)、[pdus.ts](file:///c:/Users/123/Desktop/daima/AIops/backend/src/modules/dc/routes/pdus.ts)、[powerFeeds.ts](file:///c:/Users/123/Desktop/daima/AIops/backend/src/modules/dc/routes/powerFeeds.ts)、[powerPanels.ts](file:///c:/Users/123/Desktop/daima/AIops/backend/src/modules/dc/routes/powerPanels.ts)、[racks.ts](file:///c:/Users/123/Desktop/daima/AIops/backend/src/modules/dc/routes/racks.ts)、[rooms.ts](file:///c:/Users/123/Desktop/daima/AIops/backend/src/modules/dc/routes/rooms.ts)、[slots.ts](file:///c:/Users/123/Desktop/daima/AIops/backend/src/modules/dc/routes/slots.ts)

**全部 moved**: `src/routes/dc/{cables,devices,deviceTypes,exportImport,index,lifecycle,manufacturers,overview,pdus,powerFeeds,powerPanels,racks,rooms,slots}.ts` → `src/modules/dc/routes/{同}.ts`

### 关键 bug 教训：PowerShell 编码陷阱（第 3 次发生 · 已写入 [powershell.md](../../.trae/rules/powershell.md) §1.5 + §2.4 + §七）

- **现象**：用 PowerShell `Set-Content` 写文件后中文变乱码（`/锟？` 替代正常字符）
- **根因**：PowerShell 5.1 `Set-Content` 默认编码是 ASCII，把已读入内存的字符串按 ASCII 重写
- **解决**：放弃 PowerShell 改文件内容，统一用 `node fs.readFileSync/writeFileSync` 二进制级操作
- **强化的规则**：见 [1.md §三 顶部告警](../rules/top-rules.md)（2026-07-21 新增）+ [powershell.md §2.4 强制规则](../rules/powershell.md)（批量文件操作只能 node fs）
- **关联规则文件变更**：
  - [.trae/rules/powershell.md §1.5 第三次事件回顾](../rules/powershell.md#15-第三次事件回顾2026-07-21--p1-15)
  - [.trae/rules/powershell.md §2.4 强制规则：批量文件操作只能用 Node.js](../rules/powershell.md#24-强制规则批量文件操作只能用-nodejs2026-07-21-新增-15-事件)
  - [.trae/rules/powershell.md §七 第三次事件复盘](../rules/powershell.md#2026-07-21-p1-15-srcroutesdc-14-文件编码事故第三次--北京时间-0200-0300)
  - [.trae/rules/powershell.md §5.2 禁止操作 + 强制自检](../rules/powershell.md#52-ai-禁止的操作)
  - [.trae/rules/top-rules.md §四 顶部 ⚠️ 告警](../rules/top-rules.md)

---

## 三、P1-#16a 启动

[BigScreenDashboard.tsx](file:///c:/Users/123/Desktop/daima/AIops/frontend/src/modules/monitor/pages/BigScreenDashboard.tsx)（935 行）抽出**第一步**：

- **新建** [BigScreenStatCard.tsx](file:///c:/Users/123/Desktop/daima/AIops/frontend/src/modules/monitor/pages/big-screen/BigScreenStatCard.tsx)：包含
  - `<StatCard>` 组件
  - `getStatusColor(status)` helper
  - `getSeverityBadge(severity)` helper
  - `getSystemStatusIcon(status)` helper
  - `getStatusFooterText(status, waitingApproval)` helper
  - `getStatusFooterColor(status)` helper

- **改动** BigScreenDashboard.tsx：删除上述 inline 定义 + import 全部新外部 helpers
  - 935 → **909 行**（−26 行）

### 剩余 P1-#16a 工作（4-6h）

BigScreenDashboard 还需拆：
1. **HeaderSection**（标题编辑 + top 栏服务器/Agent/Tasks 计数 + 时钟 + 全屏按钮）
2. **AlertBanner**（critical alert + error banner）
3. **ServerMetricsPanel**（CPU/内存/网络/磁盘 + 4 张 metric 卡片）
4. **AgentSlaPanel**（Agent / SLA / 任务进度）
5. **AlertTaskChart**（alert trend + task trend + recent alerts list）
6. **RemediationStatsPanel**（remediation records + pie chart）
7. **FooterStatusBar**（系统状态 + 自动刷新计时）

每个 ~150 行，目标是 7 个文件 ≤ 200 行，主文件 ≤ 200 行。

### 为什么没完整拆 8 个

- 每个子组件拆出要：
  - 抽 props interface（每个 prop 名字 + type）
  - 替换所有内联 JSX 引用为新组件
  - 跑 tsc + lint 验证
  - 启动 react dev server 验证不挂
- 风险随改动次数累加
- 建议**每次会话只拆 1-2 文件**，避免一次性引入多风险

---

## 四、未完成 P1-#16 全清单

| 项 | 文件 | 行数 | 状态 | 预计工时 |
|---|---|---:|---|:-:|
| #16a 第一步 | BigScreenStatCard 抽出 | -26 行 | ✅ | 已用 15min |
| #16a 完整 | BigScreenDashboard 拆 7 子组件 | 909→~150×8 | ⏳ | 4-6h |
| #16b | WorkflowProviders.tsx | 831 | ⏳ | 8h |
| #16c | agentToolRegistry.ts | 783 | ⏳ | 8h |

**剩余总工时 ~24h**。每次会话可安全推进 1-2h 拆 1-2 子组件。

---

## 五、风格与权衡

### 5.1 #15 是"路径搬运"而不是"重构"

v2 报告 #15 字面要求是"迁回 modules/dc/routes/，删 14 个文件"。**不要求**重构 service 层（business logic 还在 routes 里直接 try-catch 调 repository，违反铁律 2）。那是 #19 P1 范畴。

我们**严格按 v2 报告字面要求**执行，没有过度工程。后续 #19 P1 再做：
- 把 14 个 routes 文件里的业务逻辑抽到 services
- 每个 service ≤ 500 行（拆多次）

### 5.2 PowerShell 编码陷阱为何以前没遇到？

- 之前 P0 修复都是用 IDE（Trae 自带 Read/Write）UTF-8 安全
- 本次 #15 需要"批处理 14 文件"，自然想到 PowerShell `Set-Content`
- **教训**：跨多文件批处理用 node fs，避免 shell encoding 变体

### 5.3 P1-#16 为什么拆得不完整？

- 风险控制：每个新拆组件若 props 接口错误，**整个大屏不渲染**
- 验证门槛：每次拆完需要 react dev server smoke test（本 session 没条件做）
- 时序稳妥：**建议每次只拆 1-2 文件**，避免一次 session 出多 bug

---

**最后更新**：2026-07-21
**维护者**：项目作者 + AI 协作（Trae）
