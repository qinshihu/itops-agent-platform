# 网络模块（前端）

## 职责
网络设备管理：网络设备、网络拓扑、SNMP 配置、网络发现。

## 内部结构
```
network/
├── routes.ts                             # 模块路由
├── pages/
│   ├── NetworkDevices.tsx                # 网络设备入口（re-export 到 network-devices/）
│   ├── Networks.tsx                      # 网络管理（v2.28 拆分后精简主入口 132 行）
│   │   └── networks/                     # 子模块（v2.28 新建）
│   │       ├── types.ts                          # SubnetInfo + IpInfo + IpListData + 4 map（82）
│   │       ├── useNetworksData.ts                # 7 state + 2 query + 4 mutation + 6 handler（294）
│   │       ├── SubnetStatsCards.tsx              # 3 统计卡片（48）
│   │       ├── SubnetSearchFilter.tsx            # 搜索 + 类型过滤（51）
│   │       ├── SubnetListHeader.tsx              # 列表头 + 刷新 + 新建（41）
│   │       ├── SubnetCard.tsx                    # 单子网卡（含信息 + 用量 + 操作）（110）
│   │       ├── SubnetCreateModal.tsx             # 创建/编辑 modal（160）
│   │       ├── SubnetDetailView.tsx              # 选中子网详情 + IP 表格 + 批量操作（133）
│   │       ├── IpListTable.tsx                   # IP 列表 table（114）
│   │       └── index.ts                          # barrel（37）
│   ├── Topology.tsx                      # 拓扑视图
│   ├── SNMP.tsx                          # SNMP 配置入口（聚合 snmp/ 子目录）
│   ├── NetworkDiscovery.tsx              # 网络发现
│   ├── snmp/                             # SNMP 子模块（v5 新增）
│   │   ├── SnmpTrapsTab.tsx              # Trap 配置 Tab
│   │   ├── SnmpQueryTab.tsx              # SNMP 查询 Tab
│   │   ├── SnmpCredentialsTab.tsx        # 凭据管理 Tab
│   │   └── types.ts                      # SNMP 子模块类型
│   └── network-devices/                  # 网络设备子模块（v5 新增）
│       ├── useNetworkDevices.ts          # 设备列表 hook
│       ├── types.ts                      # 设备子模块类型
│       ├── InspectionModal.tsx           # 单设备巡检弹窗
│       └── BatchInspectModal.tsx         # 批量巡检弹窗
├── components/
│   ├── NetworkDeviceCard.tsx             # 设备卡片
│   ├── SnmpInspectionResult.tsx          # SNMP 巡检结果
│   └── TopologyGraph.tsx                 # 拓扑图渲染
└── index.ts
```

## 对应后端
`backend/src/modules/network/`

## 刷新记录
- **2026-07-23**：
  - 删除 `api.ts`（死代码，零调用方；已统一走 `import api from '@/lib/api'`）
  - 删除 `components/SnmpCredentials.tsx`（死代码，与 `pages/snmp/SnmpCredentialsTab.tsx` 功能重复）
  - `useNetworkDevices.handleSnmpInspect` 适配后端 `{success, data, message}` 格式
- **2026-07-22**：核对 5 主页面 + 4 子模块（snmp/network-devices）