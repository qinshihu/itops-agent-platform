# 数据中心模块（前端）

## 页面
- `DataRoom.tsx` — 3D 机房视图
- `DataCenterManage/` — 数据中心管理（Tab 页面目录）

## 组件
- `DataRoom3D/` — 3D 场景核心组件（已拆分为 9 模块文件）

## 功能
- 3D 机房立体渲染（Three.js + React Three Fiber）
- hover 高亮 + 相机聚焦动画
- 机柜利用率热力图
- 线缆拓扑弧线渲染
- WebSocket 实时状态推送

## 对应后端
`backend/src/modules/dc/`
