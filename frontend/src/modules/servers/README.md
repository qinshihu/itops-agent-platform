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
│   ├── useServerActions.ts              # 服务器操作 hook (817 行)
│   ├── types.ts                          # 共享类型
│   ├── ServerListSection.tsx             # 服务器列表区域
│   ├── ServerFormModal.tsx               # 服务器表单弹窗
│   ├── ServerGroupSection.tsx            # 服务器分组区域
│   ├── SshKeySection.tsx                 # SSH 密钥区域
│   ├── SSHKeys.tsx                       # SSH 密钥管理
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