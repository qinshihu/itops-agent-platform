# 服务器模块 (`servers/`)

> **DDD 限界上下文**：服务器生命周期管理
> **聚合根**：`Server`、`SSHKey`、`ServerGroup`
> **最后刷新**：2026-07-22

## 职责

服务器生命周期管理：资产登记、SSH 连接池、远程桌面、终端、密钥管理、合规扫描、AI 命令。

## 内部结构（2026-07-22 实测）

```
servers/
├── routes.ts                  # 模块路由聚合（5 个子路由）
├── routes/                    # 5 路由文件
│   ├── serverRoutes.ts        # /servers/*       CRUD
│   ├── serverCommandRoutes.ts # /server-commands/* exec/test-connection/compliance
│   ├── serverGroupRoutes.ts   # /server-groups/* group tree + CRUD
│   ├── serverManagementRoutes.ts # /server-management/* collect-info/collect-metrics/import
│   └── sshKeyRoutes.ts        # /ssh-keys/*      CRUD + usage
├── services/                  # 11 业务服务（含 3 个测试文件）
│   ├── sshService.ts          ← SSH 连接池（生产级：重试、健康检查、合规扫描）
│   ├── serverCrudService.ts   ← routes 层抽象（ADR-016）
│   ├── sshKeyCrudService.ts   ← 凭证 routes 抽象
│   ├── serverInfoCollector.ts ← 采集 OS / IP / CPU / 内存 / 磁盘
│   ├── serverImportService.ts ← CSV/JSON 批量导入
│   └── ...
```

## 路由端点（受保护）

| 前缀                   | 来源                        | 说明                                               |
| ---------------------- | --------------------------- | -------------------------------------------------- |
| `/servers/*`           | `serverRoutes.ts`           | 服务器 CRUD + command-history + compliance-history |
| `/server-commands/*`   | `serverCommandRoutes.ts`    | SSH 命令执行 + 合规检查                            |
| `/server-groups/*`     | `serverGroupRoutes.ts`      | 服务器分组树                                       |
| `/server-management/*` | `serverManagementRoutes.ts` | 资产采集 + 性能采集 + 导入                         |
| `/ssh-keys/*`          | `sshKeyRoutes.ts`           | SSH 凭证 CRUD + usage                              |

## 依赖关系

- 被 `containers/`（Docker host）、`network/`（snmp credential）、`monitor/`（metrics 采集）依赖
- 仓储层：`serverRepository/` 5 子仓储
