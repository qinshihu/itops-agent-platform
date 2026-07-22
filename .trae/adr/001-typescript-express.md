# ADR-001: TypeScript + Express 作为后端技术栈

**状态**: 已采纳 | **日期**: 2024-Q4 | **决策者**: 项目作者

> **更新 (2026-07-06)**：原文中关于 `commandFilter` 的描述已失效（commandFilter 已删除，详见 [ADR-006](./006-command-filter.md)）。保留历史记录，不影响 ADR-001 本身决策。

## 背景

项目需要选择后端技术栈。核心需求：
1. 前后端共享类型定义，减少字段不匹配问题
2. 生态丰富，快速开发
3. 个人主导项目，维护成本可控
4. 社区贡献者入门门槛低

## 决策

选择 **TypeScript + Express.js** 作为后端开发技术栈。

## 考虑的替代方案

| 方案 | 优点 | 缺点 | 决策 |
|------|------|------|------|
| **TypeScript + Express** | 前后端统一语言、类型共享、生态丰富、社区贡献门槛低 | 单线程模型，CPU 密集型场景弱 | ✅ 采纳 |
| Go + Gin | 高性能、单二进制部署、WASM 沙箱友好 | 学习曲线高、社区贡献门槛高、前后端类型不统一 | 未来考虑（Agent Runtime 重写时） |
| Python + FastAPI | AI 生态好、异步原生支持 | GIL 限制、部署复杂、依赖管理混乱 | 不采纳 |

## 后果

### 正面
- 前后端共享 TypeScript 类型，通过 Zod schema 统一接口契约
- Express 生态成熟，中间件丰富（helmet, cors, morgan, multer 等）
- 社区贡献者只需掌握 JS/TS 即可参与

### 负面
- Node.js 单线程模型对 CPU 密集型任务不友好（如大文件解析、复杂数据转换）
- 插件沙箱安全性不如 WASM（当前通过 commandFilter 在业务层补偿）
- 长期看 Go 更适合 AIOps Agent Runtime 的性能要求

### 缓解措施
- CPU 密集型任务通过 worker_threads 或外挂进程处理
- 安全策略通过 commandFilter 多层过滤补偿
- 如未来需要高性能 Agent 运行时，考虑 Go 重写核心，TS 保留应用层

## 相关

- ADR-002: SQLite 数据库选择
- ADR-003: ServiceContainer DI 模式
