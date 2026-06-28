# 监控模块 (`monitor/`)

## 职责
系统监控、健康检查、报表统计、成本分析。

## 内部结构
```
monitor/
├── routes/     # 4 路由
├── services/   # 4 服务
│   ├── healthService.ts      ← 健康检查
│   └── ...
```

## 依赖关系
- 依赖 `servers/`、`containers/`、`network/` 采集数据
- 前端对应 `modules/monitor/`（含大屏 Dashboard）
