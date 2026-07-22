# 网络模块 (`network/`)

> **DDD 限界上下文**：网络设备管理与发现（17 厂商适配器）
> **聚合根**：`NetworkDevice`、`Topology`、`SNMP`
> **最后刷新**：2026-07-22

## 职责
网络设备管理、拓扑发现、SNMP 采集、配置备份、VNC 代理、17 厂商命令解析适配器。

## 内部结构
```
network/
├── routes/                          # 7 路由文件
│   ├── networkDeviceRoutes.ts        ← 设备 CRUD
│   ├── networkAdvancedRoutes.ts      ← 高级操作（命令下发 / 配置备份）
│   ├── networkSubnetRoutes.ts        ← IP 子网规划
│   ├── networkDiscoveryRoutes.ts     ← 拓扑发现任务（异步）
│   ├── snmpRoutes.ts                 ← SNMP Get/Walk/Trap
│   ├── topologyRoutes.ts             ← 拓扑可视化数据
│   └── vncRoutes.ts                  ← VNC 代理 WebSocket 端点
├── services/                         # 30+ 业务服务（含 2 个测试文件）
│   ├── networkInspectionService/    ← 网络巡检（v2.14 拆分：inspection/execution/shell/summary + types + index）
│   ├── networkDiscovery/             ← 拓扑发现（icmp/snmp/jobManager + index）
│   ├── snmp/                         ← SNMP 子模块（collector/discovery/parser/service + index）
│   ├── vendorAdapter/                ← 17 厂商适配器（cisco/huawei/h3c/arista/dell/f5/fortinet/hpe/juniper/mikrotik/paloalto/panabit/ruijie/ruijie_eg/tplink/ubiquiti/zte + shared + types + index）
│   ├── vncProxyService.ts            ← VNC WebSocket 代理（被 socket.io 启动时调用 initialize(io)）
│   ├── networkDeviceService.ts       ← 设备 CRUD
│   ├── networkSubnetCrudService.ts   ← 子网 CRUD
│   ├── snmpCrudService.ts            ← SNMP CRUD
│   ├── networkCommandGenerator.ts    ← AI 生成巡检命令
│   ├── networkResultParser.ts        ← 厂商命令输出解析
│   ├── topologyService.ts            ← 拓扑生成
│   ├── snmpService.ts                ← SNMP 业务封装
│   ├── snmpPollingService.ts         ← SNMP 周期轮询
│   ├── snmpTrapService.ts            ← SNMP Trap 监听
│   ├── lldpDiscoveryService.ts       ← LLDP 邻居发现
│   └── ...
├── routes.ts                         # 路由聚合入口（含 networkDiscoveryRouter 命名导出）
├── index.ts
└── README.md
```

## 路由端点（受保护）

| 前缀 | 来源 | 说明 |
|------|------|------|
| `/vnc/*` | `vncRoutes.ts` | VNC WebSocket 代理 |
| `/network-devices/*` | `networkDeviceRoutes.ts` | 设备 CRUD（17 厂商适配器） |
| `/network-advanced/*` | `networkAdvancedRoutes.ts` | 命令下发 / 配置备份 / 高级操作 |
| `/network-subnets/*` | `networkSubnetRoutes.ts` | IP 子网规划 |
| `/snmp/*` | `snmpRoutes.ts` | SNMP Get/Walk/Trap |
| `/topology/*` | `topologyRoutes.ts` | 拓扑可视化数据 |

> 注：`networkDiscoveryRouter` 作为命名导出被外部（mcp 或其他模块）独立挂载（不在 `router.use()` 默认链中）。

## 依赖关系
- 依赖 `auth/`（JWT 鉴权中间件）
- 依赖 `audit/`（审计日志写入）
- 被 `monitor/`（监控面板）依赖

## 关键说明
- **17 厂商适配器**：`vendorAdapter/` 子目录覆盖 Cisco/Huawei/H3C/Arista/Dell/F5/Fortinet/HPE/Juniper/Mikrotik/PaloAlto/Panabit/Ruijie/RuijieEG/TPLink/Ubiquiti/ZTE，`shared.ts` 提供通用类型与正则
- **VNC 代理**：`vncProxyService.initialize(io)` 在 `app.ts` 启动序列中注入 socket.io 实例，注册 `vnc:*` 命名空间
- **LLDP / SNMP 拓扑发现**：`lldpDiscoveryService` + `snmpDiscovery` + `icmpDiscovery` 三种发现方式并行
- **大文件拆分**：v2.14（2026-07-21）`networkInspectionService.ts` 651 → 85 主类（保留） + 6 个子模块，决策见 ADR-031