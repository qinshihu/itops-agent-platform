# ADR-014: mcp 模块路由文件命名例外（routes.tsx）

## 状态

Accepted（2026-07-05）

## 背景

ADR-007 规定前端 23 个模块统一使用 `routes.ts` 作为路由定义文件名，目的是：

- 视觉一致性（一眼能识别"这是路由文件"）
- 工具链友好（编辑器、grep、Lint 工具无需特别处理 .tsx）
- 新人认知负担低（无需记忆例外）

实际状况：

- 22/23 模块遵循约定，使用 `routes.ts`（v5 实测）
- **唯一例外**：mcp 模块使用 `routes.tsx`（含 JSX 元素）

[mcp/routes.tsx](../../frontend/src/modules/mcp/routes.tsx) 第 17-21 行的代码：

```tsx
export const mcpRoutes = [
  { path: "mcp/overview", element: <McpOverview /> },
  { path: "mcp/tools", element: <ToolBrowser /> },
  { path: "mcp/external-servers", element: <ExternalServers /> },
  { path: "mcp/tester", element: <ToolTester /> },
];
```

注意：`element` 字段直接传入 **JSX 元素**（`<McpOverview />`），而非其他模块使用的 `lazy(() => import(...))` 函数引用。

## 决策

**保留 `routes.tsx` 命名**，不强制改为 `routes.ts`。理由：

### 1. 技术原因：当前实现与约定路径不兼容

其他 22 个模块的 routes.ts 模板：

```typescript
// 标准 routes.ts 模板
const McpOverview = lazy(() => import("./pages/McpOverview"));
export const mcpRoutes = [
  { path: "mcp/overview", element: McpOverview }, // 注意：这里没有尖括号
];
```

如果改回 `routes.ts`，必须删除 `lazy()` 包装（因为 `.ts` 文件不能写 JSX）。这会导致：

- 失去代码分割（一次性加载所有 MCP 页面）
- mcp 模块首屏体积增大 ~100-200 KB

### 2. 维护成本 vs 收益不匹配

强制统一命名的收益：

- 文件名一致性：0.5 分
- 工具链友好：0.2 分

改名的代价：

- 失去代码分割：性能下降
- 需修改导入路径（影响 ~3 个文件）
- 需修改 ESLint / depcruiser 规则白名单（如果之前特意放过）
- 测试失败风险

### 3. 已有先例和文档说明

- [项目全面分析报告_v8.md §三.2 23 个业务模块清单](../../docs/项目全面分析报告_v8.md) 已明确标注："唯一偏差：mcp 模块使用 `routes.tsx`（含 JSX 元素，功能正常）"
- 这是一个**已知偏差**，不是缺陷

## 影响

### 正面

- 保留 MCP 模块的代码分割能力
- 命名规则"几乎统一"，清晰传达"这是已知例外"
- 维护成本接近 0

### 负面

- 23 个模块的"模块结构完整率"永远卡在 22/23（95.7%）而非 23/23
- 新人看到 `.tsx` 可能困惑 → 通过本 ADR 文档解决

## 缓解措施

1. 本 ADR 在 `.trae/adr/014-mcp-routes-tsx-exception.md` 明确记录例外
2. ADR README 添加本条记录到列表
3. [rules/frontend.md §0 23 个前端模块清单](../rules/frontend.md) 已明确标注："唯一偏差：mcp 模块使用 `routes.tsx`（含 JSX 元素，功能正常）"（v6 报告已合并到 frontend.md）
4. 如果未来需要统一，可考虑：
   - **方案 A**（推荐）：保持现状 + 完善文档（本 ADR 即为此目的）
   - **方案 B**：将 MCP 页面拆分为轻量 wrapper 组件，从而改回 `routes.ts` 但保留 lazy
   - **方案 C**：通过 Vite 配置实现"无 JSX 的代码分割"（复杂，无收益）

## 何时重新评估

如果出现以下任一情况，重新评估本决策：

- mcp 模块被拆分/重构，且不再使用 JSX 直接渲染元素
- React.lazy 行为发生重大变化（如自动导入）
- TypeScript/Vite 工具链发生重大变化，使得 `.ts` 文件可以包含 JSX

## 相关

- **ADR-007**：前后端 1:1 映射（定义了 routes.ts 命名约定）
- [前端编码规范 §一 模块目录结构](../rules/frontend.md)：规定 routes.ts 为路由文件
- [rules/frontend.md §0 23 个前端模块清单](../rules/frontend.md)：已知偏差记录
- [mcp/routes.tsx](../../frontend/src/modules/mcp/routes.tsx)：例外文件
