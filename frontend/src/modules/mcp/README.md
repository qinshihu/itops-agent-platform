# MCP 模块（前端）

## 职责
MCP (Model Context Protocol) 工具协议管理：服务概览、工具浏览、外部 MCP 服务器管理、工具调用测试。

## 内部结构
```
mcp/
├── routes.tsx                            # 模块路由
├── api.ts                                # API 类型与调用
├── pages/
│   ├── McpOverview.tsx                   # MCP 服务概览
│   ├── ExternalServers.tsx               # 外部 MCP 服务器管理
│   ├── ToolBrowser.tsx                   # 工具浏览器
│   └── ToolTester.tsx                    # 工具调用测试
└── index.ts
```

## 对应后端
`backend/src/modules/mcp/`