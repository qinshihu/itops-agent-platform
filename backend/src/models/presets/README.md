# Preset 预设数据模块

存放数据库初始化时的所有预设数据 / 链接逻辑。

## 文件结构

| 文件 | 职责 |
|------|------|
| `init*.ts` (`initAgents` / `initAlertMappings` / `initConfigTemplates` / `initEnhancedWorkflows` / `initRemediationPolicies` / `initReports` / `initScheduledTasks` / `initScripts` / `initWorkflows`) | 各类预设数据初始化 |
| `linkRemediationWorkflows.ts` | remediation policies 与 workflows 的链接（v2.19 拆分后精简主入口 100 行） |
| └── `linkRemediationWorkflows/` | 链接逻辑与 17 条 extra policy preset 的 6 个子模块 |

## linkRemediationWorkflows/ 子模块

| 文件 | 行数 | 职责 |
|------|------|------|
| `bindingOps.ts` | 132 | `linkExistingPolicies` + `insertExtraPolicies` 纯函数（含事务）|
| `specialPolicies.ts` | 222 | 5 项特殊 preset（含 4 个 build 函数 + ExtraPolicy / WorkflowIds 类型）|
| `zabbixPolicies.ts` | 220 | 6 项 Zabbix preset |
| `prometheusPolicies.ts` | 90 | 2 项 Prometheus preset |
| `catchAllPolicies.ts` | 128 | 3 项兜底（含全来源 fallback）|
| `index.ts` | 18 | barrel export |

## 数据契约

`ExtraPolicy` interface（定义在 `specialPolicies.ts`）被所有 preset builder 使用，确保数据格式一致。preset 构造时接受 `WorkflowIds`（动态注入 workflow fallback 标识）+ `now`（时间戳），避免副作用。

## v2.19 拆分历史

- 原 663 行单文件 → 100 行主入口 + 6 个子模块（910 行总计，**每个 ≤ 500**）
- 桶兼容：原 `import { linkRemediationWorkflows } from './presets/linkRemediationWorkflows'` 仍可用
- 拆分原则遵循 architecture.md §3.3.1 + §六 文档同步规则
