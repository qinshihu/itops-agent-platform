# 网络模块（前端）

## 职责
网络设备管理：网络设备、网络拓扑、SNMP 配置、网络发现。

## 内部结构
```
network/
├── routes.ts                             # 模块路由
├── api.ts                                # API 类型与调用 (492 行)
├── pages/
│   ├── NetworkDevices.tsx                # 网络设备
│   ├── Networks.tsx                      # 网络管理
│   ├── Topology.tsx                      # 拓扑视图
│   ├── SNMP.tsx                          # SNMP 配置
│   └── NetworkDiscovery.tsx              # 网络发现
├── components/
│   ├── NetworkDeviceCard.tsx             # 设备卡片
│   ├── SnmpCredentials.tsx               # SNMP 凭据
│   ├── SnmpInspectionResult.tsx          # SNMP 巡检结果
│   └── TopologyGraph.tsx                 # 拓扑图渲染
└── index.ts
```

## 对应后端
`backend/src/modules/network/`