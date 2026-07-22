# 数据中心模块 (`dc/`)

> **DDD 限界上下文**：数据中心基础设施（DCIM）
> **聚合根**：`Room`、`Rack`、`Device`、`Power`
> **最后刷新**：2026-07-22

## 职责
数据中心基础设施（DCIM）：机房 3D 可视化、机柜/槽位管理、设备管理、供电线路、线缆拓扑。
借鉴 NetBox DCIM 数据模型。

## 内部结构
```
dc/
├── routes/   ← 已从 src/routes/dc/ 加载（13 个子路由，注册在 src/modules/_registry.ts）
├── services/                       # 4 业务服务（含 2 个测试文件）
│   ├── dcStatusService.ts          ← 5s WebSocket 实时状态推送
│   ├── dcRoomEnvironmentService.ts ← 30s 模拟采集机房温湿度 + PDU/馈线功率
│   └── dcSlotService.ts            ← U 位分配/迁位/移除业务规则
```

## 路由总表

> `dc/routes.ts` 同时挂载 `/dc` 和 `/dc-infrastructure` 两个外部别名（同一路由实例），共 13 个子路由聚合自 `routes/index.ts`（2026-07-21 P1-#15 从 `src/routes/dc/` 迁回 `modules/dc/routes/`）。

| 前缀 | 端点 | 权限 | 说明 |
|------|------|------|------|
| `/dc/rooms`（或 `/dc-infrastructure/rooms`） | CRUD | GET 开放 / 写 requireRole('admin','operator') / DELETE requireRole('admin') | 机房 |
| `/dc/racks` | CRUD | 同上 | 机柜 |
| `/dc/slots` | CRUD + `/batch` | 同上 + 写 requireRole | U 位（3D 场景一次性加载用 /batch） |
| `/dc/slots/:rackId` | GET | 开放 | 按机柜 |
| `/dc/devices` | GET | 开放 | 设备分布（按机房/机柜分组） |
| `/dc/devices/unallocated` | GET | 开放 | 未分配设备 |
| `/dc/lifecycle` | GET | 开放 | 生命周期记录 |
| `/dc/pdus` | CRUD | 同 rooms | PDU/UPS |
| `/dc/overview` | GET | 开放 | 3D 概览 |
| `/dc/cables` | CRUD + `/scene` + `/topology/:rackId` | 同上 | 线缆 |
| `/dc/manufacturers` | CRUD | 同上 | 设备制造商 |
| `/dc/device-types` | CRUD | 同上 | 设备型号 |
| `/dc/power-panels` | CRUD | 同上 | 配电柜 |
| `/dc/power-feeds` | CRUD + `/rack/:id` | 同上 | 供电线路 |
| `/dc/export` | GET | 开放 | JSON 导出（含 version 字段） |
| `/dc/import` | POST | 开放 | JSON 导入（带版本兼容性检查） |
| `/dc/health` | GET | 开放 | 健康检查 |

## 数据模型（v028-v058, 共 10 个迁移）

| 迁移 | 表 | 说明 |
|------|----|------|
| v028 | `dc_rooms` / `dc_racks` / `dc_rack_slots` / `dc_pdus` / `dc_device_lifecycle` | 基础设施核心 5 表 |
| v030 | ALTER `dc_rooms` 加 `current_temperature/humidity` | 机房实时环境 |
| v032 | `device_manufacturers` | 设备制造商（NetBox 借鉴） |
| v033 | `device_types` | 设备型号（NetBox 借鉴） |
| v034 | `device_type_slot_definitions` | 设备型号槽位定义 |
| v035 | `dc_power_panels` | 配电柜 |
| v036 | `dc_power_feeds` | 馈线 |
| v037 | `dc_cables` | 线缆 |
| v041 | ALTER `dc_rooms` 加 `pue / total_power_kw` | PUE + 总功率 |
| v058 | 重建 3 表 | CHECK 约束 + FK（slot.device_type、rack.room_id、pdu.rack_id） |

## 业务规则

- **U 位分配/移位/移除**下沉到 `dcSlotService`：
  - 冲突检测（区间相交 → 409）
  - 容量校验（end_u > total_u → 400）
  - 设备型号 u_height 继承（自动算 end_u，缺省用 slot_definitions）
  - 生命周期自动记录（mount / moved / unmounted）
- **机房删除**事务化（先 PDU 关联置 null，再删 racks，最后删 room；FK CASCADE 自动清理 slots）

## 依赖关系
- 仓储层：`repositories/dcRepository/` 7 个子仓储
- 不依赖其他业务模块
- 前端对应 `frontend/src/modules/dc/`：
  - `pages/DataCenterManage/index.tsx`（13 Tab）
  - `pages/DataRoom.tsx`（3D 场景入口）
  - `components/DataRoom3D/`（Three.js + R3F）
  - `pages/DataCenterManage/useNetboxResources.ts`（NetBox 资源 hook，独立于 useDataCenter）

## 关键说明
- 3D 场景使用 Three.js + React Three Fiber，支持 hover 高亮、相机聚焦、热力图
- WebSocket 实时推送通过 `dcStatusService.ts` 5 秒轮询数据库
- 借鉴 NetBox DCIM 数据模型扩展了设备制造商、型号、供电、线缆表
- 服务启动时同步启动 `dcRoomEnvironmentService`（30s 模拟采集）
- 3D 场景尺寸常量从 `cables.ts/scene` 端点读 `dc_rooms.layout_config.perU/rackW/rackGap`（无配置走默认值）

## WebSocket 事件

| 事件 | 方向 | 触发 | 数据 |
|------|------|------|------|
| `dc:status` | 后端 → 前端 | 5s 轮询 | `{ timestamp, summary, rackUtil, roomEnv }` |
