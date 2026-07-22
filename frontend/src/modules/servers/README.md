# 服务器模块（前端）

## 职责
服务器管理：服务器列表、SSH 密钥、远程桌面、Web 终端、合规检查、AI 命令执行。

## 内部结构
```
servers/
├── routes.ts                             # 模块路由
├── api.ts                                # API 类型与调用 (367 行)
├── pages/
│   ├── Servers.tsx                       # 服务器入口（1 行，re-export）
│   ├── servers/
│   │   ├── index.tsx                     # 服务器主页面
│   │   ├── ServerToolbar.tsx             # 工具栏
│   │   ├── ServerImportSection.tsx       # 导入区域
│   │   ├── ServerGroupModal.tsx          # 分组弹窗
│   │   ├── ServerDeleteConfirmModal.tsx  # 删除确认弹窗
│   │   ├── ServerComplianceOptionsModal.tsx  # 合规选项弹窗
│   │   ├── CommandHistorySection.tsx     # 命令历史
│   │   └── ComplianceHistorySection.tsx  # 合规历史
│   ├── useServerActions.ts              # 服务器操作 Hook 桶导出（18 行，拆分自原 801 行）
│   │   └── useServerActions/             # 拆分后的 6 个子模块（架构遵循 frontend.md §5.1）
│   │       ├── types.ts                  # 共享类型 (43 行)
│   │       ├── state.ts                  # 全部 useState + ESC + tag click-outside (251 行)
│   │       ├── queries.ts                # 4 个 useQuery + 衍生数据 (132 行)
│   │       ├── mutations.ts              # 11 个 useMutation (223 行)
│   │       ├── handlers.ts               # 15 个 handle* 函数 + tag utils (450 行)
│   │       ├── useServerActions.ts       # 主 Hook 编排 (196 行)
│   │       └── index.ts                  # barrel export (9 行)
│   ├── types.ts                          # 共享类型
│   ├── ServerListSection.tsx             # 服务器列表区域
│   ├── ServerFormModal.tsx               # 服务器表单弹窗
│   ├── ServerGroupSection.tsx            # 服务器分组区域
│   ├── SshKeySection.tsx                 # SSH 密钥区域
│   ├── SSHKeys.tsx                       # SSH 密钥管理（v2.25 拆分后精简主入口 115 行）
│   │   ├── ssh-keys/                      # v2.25 子模块
│   │   │   ├── types.ts                          # UsageServer + AuthType + SSHKeyFormData（36）
│   │   │   ├── constants.ts                      # KEY_TYPE_TEXT + KEY_TYPE_COLOR + getter（39）
│   │   │   ├── useSSHKeysData.ts                 # 全部 hooks + handlers（297）
│   │   │   ├── SSHKeysHeader.tsx                 # header + 安全说明 + 搜索（84）
│   │   │   ├── SSHKeyCard.tsx                    # 凭证卡（含展开 + 用例）（202）
│   │   │   ├── SSHKeyFormModal.tsx               # 新增/编辑表单（168）
│   │   │   ├── DeleteSSHKeyModal.tsx             # 删除确认（72）
│   │   │   └── index.ts                          # barrel（12）
│   ├── CommandSection.tsx                # 命令执行区域
│   ├── AiCommandSection.tsx              # AI 命令区域
│   ├── ComplianceSection.tsx             # 合规检查区域
│   ├── RemoteDesktop.tsx                 # 远程桌面
│   └── TerminalPage.tsx                  # Web 终端
├── components/
│   └── WebTerminal.tsx                   # Web 终端组件
└── index.ts
```

## 对应后端
`backend/src/modules/servers/`

## 刷新记录
- **2026-07-22**：核对 v2.25 拆分后 useServerActions/ 与 ssh-keys/ 子模块结构