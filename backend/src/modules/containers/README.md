# 容器/虚拟机模块 (`containers/`)

## 职责
容器和虚拟机全生命周期管理：Docker/KVM/Proxmox 适配、镜像仓库、卷管理、快照策略。

## 内部结构
```
containers/
├── routes/          # 8 路由文件
├── services/        # 7 服务文件
│   ├── vmManagement/
│   │   ├── proxmoxAdapter.ts  ← Proxmox VE 适配（1238 行）
│   │   ├── kvmAdapter.ts      ← KVM 适配（1094 行）
│   │   └── ...
│   └── dockerService.ts       ← Docker 管理
```

## 依赖关系
- 依赖 `servers/`（SSH 连接）
- 被 `monitor/`（监控面板）依赖
