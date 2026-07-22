# ADR-011: WebSocket 事件协议 — Socket.io 房间模式

**日期**: 2026-07-04
**状态**: Accepted
**架构层**: 技术架构层

---

## 背景

系统需要实时推送以下事件到前端：
1. **任务执行进度** — 工作流节点的开始/思考/输出/完成/失败
2. **告警通知** — 新告警创建、告警状态变更
3. **Web 终端** — SSH 终端的实时输入输出流
4. **数据中心更新** — 3D 机房的实时状态推送

需要设计一套标准的 WebSocket 事件协议。

---

## 决策

### 传输层：Socket.io v4

- 自动降级（WebSocket → HTTP long-polling）
- 内置房间（Room）管理
- 自动重连
- 二进制支持（终端输出）

### 命名空间

```
/ (默认命名空间)   — 所有事件
```

不使用多命名空间，通过 room 实现隔离。

### 房间设计

| 房间 | 用途 | 订阅者 |
|------|------|--------|
| `task:<taskId>` | 单个任务的执行事件流 | 查看该任务详情的用户 |
| `alerts` | 告警全局通知 | 所有已登录用户 |
| `terminal:<sessionId>` | 单个终端会话的 I/O | 打开该终端的用户 |
| `dc:overview` | 数据中心 3D 概览实时数据 | 查看 3D 机房的用户 |

### 事件协议

#### 客户端 → 服务端

| 事件 | Payload | 说明 |
|------|---------|------|
| `task:subscribe` | `{ taskId: string }` | 订阅任务执行事件 |
| `task:unsubscribe` | `{ taskId: string }` | 取消订阅 |
| `terminal:input` | `{ sessionId: string, data: string }` | 终端输入 |

#### 服务端 → 客户端

| 事件 | Payload | 说明 |
|------|---------|------|
| `task:started` | `{ taskId, workflowName, createdAt }` | 任务开始 |
| `task:node:started` | `{ taskId, nodeId, nodeName, agentId }` | 节点开始执行 |
| `task:node:thinking` | `{ taskId, nodeId, content }` | Agent 思考过程（streaming） |
| `task:node:output` | `{ taskId, nodeId, content }` | Agent 输出 |
| `task:node:command` | `{ taskId, nodeId, command }` | 执行的命令 |
| `task:node:completed` | `{ taskId, nodeId, result }` | 节点完成 |
| `task:node:failed` | `{ taskId, nodeId, error }` | 节点失败 |
| `task:completed` | `{ taskId, summary, duration }` | 任务完成 |
| `task:failed` | `{ taskId, error }` | 任务失败 |
| `alert:new` | `{ id, source, severity, title, content }` | 新告警 |
| `alert:updated` | `{ id, status, resolvedAt }` | 告警状态更新 |
| `terminal:output` | `{ sessionId, data }` | 终端输出 |
| `dc:status` | `{ rooms, stats }` | 数据中心实时状态 |
| `remediation:started` | `{ alertId, title }` | 修复开始 |
| `remediation:completed` | `{ alertId, totalPolicies }` | 修复完成 |
| `remediation:error` | `{ alertId, error }` | 修复失败 |

---

## 替代方案评估

### 纯 WebSocket（ws 库）
- ~~缺少高级特性~~：需要手动实现房间、自动重连、心跳

### SSE（Server-Sent Events）
- ~~单向通信~~：终端输入需要客户端→服务端通信
- 仅用于 MCP SSE 传输端点（特殊场景）

### Polling（定期轮询）
- ~~性能差~~：频繁 HTTP 请求浪费带宽
- ~~实时性差~~：依赖轮询间隔

---

## 后果

### 正面
- Socket.io 房间模式天然适合任务粒度的事件隔离
- 任务节点事件粒度细，前端可以做丰富的进度展示（thinking 动画、流式输出）
- `task:*` 子事件命名空间清晰，便于前端按需处理
- 自动降级保证了兼容性

### 负面
- Socket.io 服务端需要额外内存维护连接状态
- 大量并发终端会话可能导致内存压力

### 缓解措施
- 终端会话超时自动关闭（30 分钟无活动）
- 任务完成后自动清理 room，释放资源
- 定期心跳检测断开僵尸连接
