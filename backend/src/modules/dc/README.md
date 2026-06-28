# 数据中心模块 (`dc/`)

## 职责
数据中心基础设施管理：机房 3D 可视化、机柜/槽位管理、设备管理、供电线路、线缆拓扑。

## 内部结构
```
dc/
├── routes/     ← 2 路由文件（已从 dcInfrastructureRoutes.ts 拆分）
├── services/   ← dcStatusService（WebSocket 实时状态推送）
```

## 依赖关系
- 独立模块，不依赖其他业务模块
- 前端对应 `modules/dc/`（含 DataRoom3D 3D 渲染组件）

## 关键说明
- 3D 场景使用 Three.js + React Three Fiber，支持 hover 高亮、相机聚焦、热力图
- WebSocket 实时推送通过 `dcStatusService.ts` 5 秒轮询数据库
- 借鉴 NetBox DCIM 数据模型扩展了设备制造商、型号、供电、线缆表
