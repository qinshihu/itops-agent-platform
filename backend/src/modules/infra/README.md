# 系统级基础设施模块 (`infra/`)

> **DDD 限界上下文**：系统级基础设施服务（**非业务模块**）
> **聚合根**：无（仅服务容器）
> **最后刷新**：2026-07-22

## 职责
跨模块共用的系统级基础设施服务：**优雅重启 + 关闭钩子注册**。

## 内部结构
```
infra/
├── services/                # 1 业务服务
│   └── restartService.ts    # gracefulRestart + registerShutdownHook + setServerInstances
├── routes.ts                # 空路由占位（已抽离到独立子域）
├── index.ts                 # 模块导出
└── README.md
```

## 依赖关系
- `schedulerService`（workflow 模块，优雅关闭时停止任务调度）
- 被 `backup/` 模块调用（恢复备份后重启服务、注册关闭钩子）

## 关键说明

### 历史演进（2026-07-07 完成的 P1-6 子域拆分）
- 早期 infra 模块包含 6 路由 + 12 服务，过载
- 已抽离 7 个子域：
  - `settings/` — 系统设置（阶段 1）
  - `scripts/` — 脚本/终端（阶段 2）
  - `audit/` — 审计日志（阶段 3）
  - `tool-links/` — 工具链接（阶段 6）
  - `linkage/` — 联动统计（阶段 7）
  - `import-export/` — 数据导入导出（阶段 8）
- `reportService` 已迁到 `monitor/services/reportService.ts`（业务归属更准确）
- `notificationChannels.test.ts` 孤儿测试已清理（已迁到 notification/）

### 当前定位
infra/ 现为"系统级基础设施服务容器"，仅保留 `restartService`。
- HTTP 路由集合已清空（占位 `Router()`）
- 模块主要服务于跨模块基础能力（重启、关闭流程）

### 未来演进
- 若新增"跨模块基础设施服务"（如系统时钟同步、配置中心等），可继续放在此模块
- 若新增"有路由的业务子域"，应单独建模块而非塞回 infra
