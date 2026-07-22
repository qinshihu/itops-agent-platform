# ITops Agent 前端编码规范

> 本文档定义前端 23 个 DDD 模块的编码规范（v5 实测 P1-6 后从 18 扩展到 23）。所有 AI 辅助开发工具在生成/修改前端代码时必须遵守本规则。
>

---

## 当前 23 个前端模块清单（2026-07-22 实测）

| #   | 模块                 | 入口                                              | 核心页面                                                                      |
| --- | -------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | `ai/`                | `routes.ts`                                       | Agents、AgentEditor、Knowledge、RCA、AIInsights、AiRemediations、AI Models    |
| 2   | `alerts/`            | `routes.ts`                                       | Alerts、AlertMappings、AlertProviders、AlertAutoAnalysis、AlertCorrelation、AlertNoise、InspectionCenter |
| 3   | `auth/`              | `routes.ts`                                       | Login、Users、ForcePasswordChange（auth 含公开 + 受保护路由）                 |
| 4   | `auto/`              | `routes.ts`                                       | RemediationPolicies、RemediationExecutions、RemediationDashboard、AutoScale、RemediationWorkbench |
| 5   | `backup/`            | `routes.ts`                                       | BackupSettings                                                                |
| 6   | `change-management/` | `routes.ts`                                       | Approvals                                                                     |
| 7   | `config-management/` | `routes.ts`                                       | ConfigTemplates                                                               |
| 8   | `containers/`        | `routes.ts`                                       | Containers、Images、Volumes、VirtualMachines、ContainerDetail、ComposeEditor、VMMigrations、ImageRegistry、SnapshotPolicies |
| 9   | `database/`          | `routes.ts`                                       | DbConnections                                                                 |
| 10  | `dc/`                | `routes.ts`                                       | DataRoom（3D 可视化）、DataCenterManage                                       |
| 11  | `infra/`             | `routes.ts`                                       | Tools（其余 Settings/Scripts/ToolLinks/AuditLogs 已拆为独立模块，见 #19-#23） |
| 12  | `kubernetes/`        | `routes.ts`                                       | Kubernetes（Pods/Nodes/Services/Deployments）                                 |
| 13  | `mcp/`               | `routes.tsx`（**唯一 routes.tsx**，详见 ADR-014） | McpOverview、ToolBrowser、ToolTester、ExternalServers                         |
| 14  | `monitor/`           | `routes.ts`                                       | Dashboard、BigScreen、Reports、CostAnalysis、PrometheusQuery、ZabbixQuery    |
| 15  | `network/`           | `routes.ts`                                       | NetworkDevices、Topology、SNMP、NetworkDiscovery、Networks                    |
| 16  | `notification/`      | `routes.ts`                                       | Notifications、NotificationSettings                                           |
| 17  | `servers/`           | `routes.ts`                                       | Servers、SSHKeys、RemoteDesktop、TerminalPage                                 |
| 18  | `workflow/`          | `routes.ts`                                       | Workflows、WorkflowEditor、WorkflowProviders、Tasks、ScheduledTasks           |
| 19  | `audit/`             | `routes.ts`                                       | AuditLogs（**P1-6 新增**）                                                    |
| 20  | `import-export/`     | `routes.ts`                                       | ImportExport（**P1-6 新增**）                                                 |
| 21  | `tool-links/`        | `routes.ts`                                       | ToolLinks（工具箱 CRUD，**P1-6 新增**）                                       |
| 22  | `scripts/`           | `routes.ts`                                       | Scripts（脚本/终端/AI 命令，**P1-6 新增**）                                   |
| 23  | `settings/`          | `routes.ts`                                       | Settings、Providers（系统设置/AI 模型，**P1-6 新增**）                        |

> **注**：后端 `linkage/` 模块（联动统计/巡检中心）已存在，但前端尚未实现对应模块，待后续按业务需要补建。
>
> **后端模块清单**：24 个后端 DDD 模块（聚合根视角）见 [architecture.md §1.2](./architecture.md)；本表是前端视角（页面入口）。

所有 23 个模块通过 [`frontend/src/modules/_routes.tsx`](../../frontend/src/modules/_routes.tsx) 统一聚合，新增模块需在此注册。

### 1.0 共享层（frontend/src 顶层）

```
frontend/src/
├── App.tsx                    # 根组件（ErrorBoundary + ThemeProvider + AuthProvider + ToastProvider + QueryClient + BrowserRouter）
├── main.tsx                   # React 入口
├── index.css                  # Tailwind 入口
├── components/                # 跨模块组件（仅 ErrorDisplay）
├── config/                    # 全局配置
│   ├── navigation.ts          # 侧边栏导航分组（10 个分组，含 nav.* i18n key）
│   └── vendors.ts             # 厂商列表（被 infra/components/AddDeviceModal 共用）
├── contexts/                  # 全局 Context
│   ├── AuthContext.tsx        # JWT + refreshToken 流转
│   ├── ThemeContext.tsx       # 主题切换（dark/light）
│   └── ToastContext.tsx       # 全局 Toast 通知
├── hooks/                     # 全局 Hook（useEscapeKey）
├── i18n/                      # 国际化（locales/en.json + zh-CN.json + index.ts）
├── lib/                       # 共享工具
│   ├── api.ts                 # axios 实例 + JWT 自动注入 + refreshToken 401 重试
│   ├── date.ts                # date-fns 封装
│   ├── errorHandler.ts        # getAxiosErrorMessage 统一错误处理
│   ├── logger.ts              # 前端 logger（DEBUG / INFO / WARN / ERROR）
│   ├── useSocketIO.ts         # Socket.io 客户端封装
│   └── xss.ts                 # XSS 防御（escapeHtml + sanitizeInput）
├── modules/                   # 23 个业务模块（DDD 限界上下文）
└── shared/                    # 跨模块共享
    ├── components/            # ErrorBoundary / ProtectedRoute / MarkdownOutput
    ├── layouts/               # Layout（主布局）
    └── pages/                 # NotFound / FrontendTests
```

---

## 一、模块目录结构

每个模块必须遵循以下标准结构：

```
modules/<module>/
├── index.ts          # barrel export: 导出 routes + api
├── api.ts            # API 调用封装 + 本地类型定义
├── routes.ts         # 路由定义（React.lazy 代码分割）
├── pages/            # 页面组件
│   ├── <Entity>/     # 实体子页面目录（可选）
│   │   ├── index.tsx # 主页面组件
│   │   ├── types.ts  # 页面级类型
│   │   └── useXxx.ts # 页面级 Hook
│   └── types.ts      # 页面共享类型（可选）
├── components/       # 模块级共享组件（可选）
└── README.md         # 模块文档
```

**规则**：

- `index.ts` 只做 re-export，不包含任何实现代码
- `routes.ts` 只定义路由数组，不包含业务逻辑
- 页面组件放在 `pages/`，跨页面复用的组件放在 `components/`
- 超过 3 个相关页面/组件时应创建子目录

---

## 二、组件编写规范

### 2.1 组件定义

```typescript
// ✅ 正确的页面组件结构
import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Table, Button, Modal, message } from 'antd';
import { ReloadOutlined, PlusOutlined } from '@ant-design/icons';
import { getAxiosErrorMessage } from '@/lib/errorHandler';
import api from '@/lib/api';
import type { Server } from './types';

export default function Servers() {
  // 1. Hooks 调用（状态、路由、数据获取）
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);

  const { data: servers, isLoading, refetch } = useQuery({
    queryKey: ['servers'],
    queryFn: async () => {
      const { data } = await api.get('/servers');
      return data.data as Server[];
    },
    staleTime: 30000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/servers/${id}`),
    onSuccess: () => {
      message.success('删除成功');
      refetch();
    },
    onError: (err) => message.error(getAxiosErrorMessage(err, '删除失败')),
  });

  // 2. 派生状态（如有）
  const activeServers = servers?.filter(s => s.status === 'active') ?? [];

  // 3. 渲染
  return (
    <div className="h-full overflow-auto p-6">
      {/* 页面内容 */}
    </div>
  );
}
```

### 2.2 Imports 顺序

1. React 核心（`react`, `react-router-dom`）
2. 第三方 UI 库（`antd`, `@ant-design/icons`, `lucide-react`）
3. 第三方数据/工具库（`@tanstack/react-query`, `axios`）
4. 项目内模块（`@/lib/*`, `@/contexts/*`, `@/hooks/*`）
5. 同模块相对路径导入（`./types`, `./components/*`）

### 2.3 导出方式

| 对象类型    | 导出方式                       | 示例                                    |
| ----------- | ------------------------------ | --------------------------------------- |
| 页面组件    | `export default function`      | `export default function Servers() {}`  |
| 子组件      | `export function`（命名导出）  | `export function ServerList() {}`       |
| 自定义 Hook | `export function`（命名导出）  | `export function useServerActions() {}` |
| API 对象    | `export const xxxApi = {}`     | `export const serversApi = {}`          |
| 类型/接口   | `export interface`（逐个导出） | `export interface Server {}`            |
| 路由数组    | `export const xxxRoutes = []`  | `export const serverRoutes = []`        |

---

## 三、API 调用规范

### 3.1 axios 实例（lib/api.ts）

项目使用统一的 axios 实例，配置了：

- `baseURL: '/api/v1'`
- `timeout: 120000`
- 请求拦截器：自动注入 `Authorization: Bearer <token>`
- 响应拦截器：自动提取 `response.data.data`（后端统一返回 `{ success, data, message }`）

### 3.2 模块 API 封装

每个模块在 `api.ts` 中封装 API 调用：

```typescript
import api from "@/lib/api";

// 1. 定义本地类型
export interface Server {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
}

export interface ServerInput {
  name: string;
  hostname: string;
  port: number;
  username: string;
}

// 2. 导出 API 对象
export const serversApi = {
  async listServers(): Promise<Server[]> {
    const { data } = await api.get("/servers");
    return data.data;
  },

  async createServer(input: ServerInput): Promise<Server> {
    const { data } = await api.post("/servers", input);
    return data.data;
  },

  async updateServer(id: string, input: Partial<ServerInput>): Promise<Server> {
    const { data } = await api.put(`/servers/${id}`, input);
    return data.data;
  },

  async deleteServer(id: string): Promise<void> {
    await api.delete(`/servers/${id}`);
  },
};

export default serversApi;
```

### 3.3 错误处理

统一使用 `getAxiosErrorMessage(err, fallback)` 提取错误信息：

```typescript
import { getAxiosErrorMessage } from "@/lib/errorHandler";

// 模式 A: 在 useMutation 的 onError 中使用
const createMutation = useMutation({
  mutationFn: (input) => api.post("/servers", input),
  onError: (err: unknown) =>
    message.error(getAxiosErrorMessage(err, "创建失败")),
});

// 模式 B: 在 try/catch 中使用
try {
  await api.delete(`/servers/${id}`);
} catch (error) {
  message.error(getAxiosErrorMessage(error, "删除失败，请重试"));
}
```

---

## 四、路由规范

### 4.1 路由定义

```typescript
import { lazy } from "react";

const Servers = lazy(() => import("./pages/Servers"));
const SSHKeys = lazy(() => import("./pages/SSHKeys"));

export const serverRoutes = [
  { path: "servers", element: Servers },
  { path: "ssh-keys", element: SSHKeys },
  { path: "remote-desktop", element: RemoteDesktop },
  { path: "remote-desktop/:serverId", element: RemoteDesktop },
];
```

### 4.2 路由聚合

所有模块路由在 `modules/_routes.tsx` 中统一聚合：

```typescript
import { serverRoutes } from "./servers/routes";
import { alertRoutes } from "./alerts/routes";
// ... 其他 16 个模块

export const protectedRoutes = [
  ...aiRoutes,
  ...alertRoutes,
  ...authRoutes,
  /* ... */ ...serverRoutes,
  ...workflowRoutes,
];
```

**规则**：

- 必须使用 `React.lazy` 做代码分割
- 路由 path 是相对路径（不含模块前缀），由父级路由拼接
- 路由数组命名格式：`<module>Routes`（camelCase）

---

## 五、Hook 编写规范

### 5.1 聚合 Hook 模式（复杂页面）

当页面有多个 useState + useQuery + useMutation 时，抽取为聚合 Hook：

```typescript
import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { message } from "antd";
import { getAxiosErrorMessage } from "@/lib/errorHandler";
import api from "@/lib/api";
import type { Server } from "./types";

export function useServerActions() {
  const queryClient = useQueryClient();

  // --- State ---
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // --- Data Fetching ---
  const {
    data: servers,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["servers"],
    queryFn: async () => {
      const { data } = await api.get("/servers");
      return data.data as Server[];
    },
    staleTime: 30000,
  });

  // --- Mutations ---
  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/servers/${id}`),
    onSuccess: () => {
      message.success("删除成功");
      queryClient.invalidateQueries({ queryKey: ["servers"] });
    },
    onError: (err) => message.error(getAxiosErrorMessage(err, "删除失败")),
  });

  // --- Handlers ---
  const handleDelete = useCallback(
    (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation],
  );

  // --- Return ---
  return {
    // state
    selectedServer,
    setSelectedServer,
    isModalOpen,
    setIsModalOpen,
    // data
    servers,
    isLoading,
    refetch,
    // handlers
    handleDelete,
    // mutations
    deleteMutation,
  };
}
```

### 5.2 轻量级 Hook 模式（单一职责）

```typescript
import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";

export function useAlertSocket(token: string | null, onRefetch: () => void) {
  const [wsConnected, setWsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token) return;
    const socket = io(window.location.origin, {
      auth: { token },
      reconnectionAttempts: 5,
    });
    socket.on("connect", () => setWsConnected(true));
    socket.on("disconnect", () => setWsConnected(false));
    socket.on("alert:update", onRefetch);
    socketRef.current = socket;
    return () => {
      socket.disconnect();
    };
  }, [token, onRefetch]);

  return { wsConnected };
}
```

---

## 六、类型定义规范

类型文件放在 `pages/types.ts` 或 `pages/<Entity>/types.ts`：

```typescript
// ✅ 正确的类型定义
export interface Server {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  use_ssh_key: number;
  os_type?: "linux" | "windows" | "unknown";
  description?: string;
  tags?: string[];
  groups?: Array<{ id: string; name: string }>;
}

export interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  command: string;
  duration: number;
}

// 常量可以与类型放在同一文件
export const deviceTypeColors: Record<string, string> = {
  server: "blue",
  network_device: "purple",
  pdu: "orange",
};
```

**规则**：

- 使用 `export interface` 逐个导出，禁用 `export default`
- 可选字段使用 `?` 标记
- 联合类型使用字面量联合（`'linux' | 'windows'`），避免 `string`
- 禁止使用 `any`；用 `unknown` 或具体类型替代
- 常量与类型放在同一文件是允许的

---

## 七、UI 组件使用规范

### 7.1 UI 库

| 库                    | 用途                                                                                                               | 导入方式                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| **Ant Design**        | Table, Modal, Form, Input, Select, Tag, Button, Card, Tabs, Descriptions, Drawer, Popconfirm, message, Spin, Empty | `import { Table, Modal } from 'antd'`                              |
| **@ant-design/icons** | 系统图标                                                                                                           | `import { ReloadOutlined, PlusOutlined } from '@ant-design/icons'` |
| **lucide-react**      | 轻量状态图标（告警/监控页面）                                                                                      | `import { Bell, CheckCircle, AlertCircle } from 'lucide-react'`    |
| **Tailwind CSS**      | 所有布局/间距/颜色                                                                                                 | `className="h-full overflow-auto p-6"`                             |

### 7.2 样式原则

- **布局** 使用 Tailwind CSS 工具类，不依赖 antd 的 `Layout` 组件
- **复杂组件**（Table/Form/Modal/Descriptions）使用 Ant Design
- **简单提示** 使用 `message.success()` / `message.error()`
- **确认操作** 使用 `Popconfirm`
- **复杂弹窗** 使用 `Modal` + `Form`

---

## 八、禁止事项

1. ❌ 禁止在 `index.ts` 中编写实现代码（只做 re-export）
2. ❌ 禁止在 `routes.ts` 中编写业务逻辑
3. ❌ 禁止使用 `any` 类型（用 `unknown` 或具体类型替代）
4. ❌ 禁止直接调用 `axios` 而不通过 `@/lib/api` 实例
5. ❌ 禁止在组件中直接使用 `localStorage` 读写 token（通过 `AuthContext` + 内部 localStorage 操作封装）
6. ❌ 禁止使用 `as` 类型断言绕过类型检查（除非在测试中）
7. ❌ 禁止创建超过 500 行的新页面组件（[top-rules.md §3.2.A](./top-rules.md) 强制）
8. ❌ 禁止在 `catch` 中吞掉错误而不调用 `message.error` 或 `toast.error`
9. ❌ 禁止绕过 `api.ts` 的 401 自动刷新逻辑（直接拦截 axios 或覆盖 instance.interceptors）
10. ❌ 禁止把 `routes.ts` 改为 `routes.tsx`（除 mcp 模块外，详见 [ADR-014](../adr/014-mcp-routes-tsx-exception.md)）

## 九、与代码现状对齐（2026-07-22 全面阅读核对）

- **App.tsx 包裹顺序**（严格）：`ErrorBoundary` → `ThemeProvider` → `ThemedConfigProvider(antd)` → `AuthProvider` → `ToastProvider` → `QueryClientProvider` → `BrowserRouter` → `Routes`
- **路由懒加载**：所有模块页面用 `React.lazy(() => import('./pages/...'))`，未直接 import；App.tsx 提供 `SuspenseRoute` + `PageLoader` 占位
- **模块入口约定**：每个模块必须同时导出 `xxxRoutes`（用于 `_routes.tsx` 聚合）和/或 `publicRoutes`（auth 模块）；mcp 模块为例外用 `routes.tsx` 命名
- **Navigation.ts 分组**：10 个 `nav.*` 分组（home / serverMgmt / containersVirtualization / dataCenter / autoExecution / alertsAI / mcp / autoRemediation / knowledgeReports / systemUsers），所有 menu 项的 `name` 用 i18n key（`nav.*`），`href` 用绝对路径
- **axios 实例（lib/api.ts）**：
  - `baseURL: '/api/v1'` + `timeout: 120000`
  - 请求拦截器自动注入 `Authorization: Bearer <token>`（从 localStorage 读）
  - 响应拦截器自动 `response.data = response.data.data`（后端统一返回 `{ success, data, message }`）
  - 401 自动用 `refreshToken` 调用 `/auth/refresh` 刷新（带失败队列处理），刷新失败跳 `/login`
  - 错误统一 `Promise.reject(new Error(message))` 抛出
- **AuthContext**：`login(token, user, refreshToken)` / `logout()` / `updateUser()`；启动时调用 `/auth/me` 验证 token 有效性，无效则清 localStorage
- **i18n**：当前 `i18n/index.ts` 已配置但未深度接入（top-rules §一 第 4 条：探索期可延后），各模块页面优先使用中文 hardcode
