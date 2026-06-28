# 服务器模块 (`servers/`)

## 职责
服务器生命周期管理：资产登记、SSH 连接池、远程桌面、终端、密钥管理。

## 内部结构
```
servers/
├── routes/     # 5 路由
├── services/   # 6 服务
│   ├── sshService.ts        ← SSH 连接池（生产级：重试、健康检查、合规扫描）
│   └── ...
```

## 依赖关系
- 被 `containers/`、`network/`、`monitor/` 依赖
