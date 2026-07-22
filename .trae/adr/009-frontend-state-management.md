# ADR-009: 前端状态管理 — React Query + React Context

**日期**: 2026-07-04
**状态**: Accepted
**架构层**: 技术架构层

> **修订说明**（2026-07-20）：原标题为 "Zustand + React Query"，但实际决策与代码实现中**未使用 Zustand**——客户端全局状态（Auth/Theme/Toast）全部通过 React Context 实现。本次修订将标题与正文统一为 "React Query + React Context"，避免误导。

---

## 背景

前端需要管理两类状态：

1. **服务端状态** — API 数据（告警列表、服务器列表、Agent 配置等），需要缓存、自动刷新、乐观更新
2. **客户端状态** — UI 状态（侧边栏折叠、主题、Toast 消息、认证令牌等）

需要选择一个或多个状态管理方案来满足这些需求。

---

## 决策

### 服务端状态：@tanstack/react-query v5

- 所有 API 数据获取（alerts、servers、workflows、containers 等）统一通过 react-query 管理
- 提供开箱即用的缓存、后台刷新、loading/error 状态、重试、乐观更新
- 在 `api.ts` 中定义 `queryKey` 和 `queryFn`，在页面组件中通过 `useQuery`/`useMutation` 使用

### 客户端状态：React Context

| 状态                      | 方案                                  | 原因                             |
| ------------------------- | ------------------------------------- | -------------------------------- |
| Auth（用户、Token、角色） | React Context (`AuthContext`)         | 全局单例，跨组件树注入，极少变化 |
| Theme（暗色/亮色）        | React Context (`ThemeContext`)        | 全局单例，全局注入               |
| Toast 消息                | React Context (`ToastContext`)        | 全局注入，命令式 API             |
| 导航菜单配置              | 静态配置文件 (`config/navigation.ts`) | 纯数据，无需状态管理             |

> 早期方案曾考虑 Zustand，但评估后 3 个全局状态变更频率极低，Context 已足够，无需引入额外状态库。

---

## 替代方案评估

### Redux Toolkit

- ~~过度复杂~~：对于只有 1-2 个全局状态的场景，Store/Action/Reducer/Selector 全套过于沉重
- ~~样板代码~~：每个数据获取都要写 thunk + slice + selector

### MobX

- ~~学习曲线~~：装饰器语法和 observable 模式对团队来说是额外学习成本
- ~~与 React Query 功能重叠~~：不需要双向 observable

### 纯 Context

- ~~性能~~：大量 Context Provider 嵌套会导致不必要重渲染
- 仅用于 Auth/Theme/Toast 三个低频变更的全局状态，避免了性能问题

---

## 后果

### 正面

- React Query 自带请求去重、缓存失效、后台刷新，无需手动管理 loading/error 状态
- Context 仅用于 3 个真正的全局状态，避免了 prop drilling
- 无需引入额外状态库（如 Zustand/Redux），降低依赖与心智负担
- 减少代码量：不需要手写 reducer/action/thunk

### 负面

- 两套状态管理方案（React Query + Context）需要开发者理解各自适用场景
- React Query devtools bundle 增加包体积

### 缓解措施

- 在模块 README 中明确：API 数据 → react-query，全局 UI 状态 → Context
- devtools 仅在开发环境引入
