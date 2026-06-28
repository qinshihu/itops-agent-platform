# 网络模块 (`network/`)

## 职责
网络设备管理、拓扑发现、SNMP 采集、配置备份。

## 内部结构
```
network/
├── routes/     # 7 路由
├── services/   # 15 服务
│   ├── vendorAdapter.ts      ← 厂商适配器（1074 行，需拆分）
│   ├── networkDiscovery.ts   ← 拓扑发现
│   └── ...
```

## 依赖关系
- 依赖 `auth/`（鉴权）
- 被 `monitor/`（监控面板）依赖
