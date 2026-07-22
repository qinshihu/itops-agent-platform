# ADR-003: ServiceContainer 依赖注入模式

**状态**: 已采纳 | **日期**: 2025-Q1 | **决策者**: 项目作者

## 背景

项目原有 `app.ts` 中存在"星型依赖"问题：`app.ts` 直接 import 所有模块的服务，初始化顺序硬编码，服务生命周期管理分散在 `app.ts` 各处的 try-catch 中。需要一种统一的方式管理服务初始化和关闭。

核心需求：
1. 声明式服务注册（名称 + 工厂 + 依赖）
2. 按依赖顺序自动初始化
3. 按逆序优雅关闭
4. 测试时可替换特定服务为 mock

## 决策

采用自研轻量级 **ServiceContainer** DI 容器，位于 `core/serviceContainer.ts`。

## 考虑的替代方案

| 方案 | 优点 | 缺点 | 决策 |
|------|------|------|------|
| **自研 ServiceContainer** | 零依赖、轻量（250行）、拓扑排序、类型安全、项目语义自然 | 需要自己实现 | ✅ 采纳 |
| InversifyJS | 装饰器丰富、功能完整 | 侵入性强、代码量大、与 Express 风格不匹配 | 不采纳 |
| Tsyringe | 微软出品、简洁 | 依赖 `reflect-metadata`、装饰器实验性 | 不采纳 |
| 无 DI | 简单直接 | `app.ts` 越来越臃肿、初始化顺序不可控 | 已弃用 |

## 设计要点

### 拓扑排序初始化
```typescript
// 声明依赖关系，容器自动按拓扑序初始化
container.register('alertService', factory, ['rootCauseAnalysisService', 'credentialService']);
container.register('notificationService', factory, ['credentialService']);
// 自动排序: credentialService → alertService | notificationService
```

### 循环依赖检测
拓扑排序过程中自动检测，发现循环依赖立即抛错。

### 测试 Mock 支持
```typescript
container.replace('serverRepository', mockServerRepo); // 测试中注入 mock
```

### 组装层分离
- `core/serviceContainer.ts` 是纯 DI 容器，不依赖任何业务模块
- `serviceRegistry.ts` 是组装层（Composition Root），负责导入所有模块并注册
- `app.ts` 只调用 `initAllServices()`，不关心内部顺序

## 后果

### 正面
- `app.ts` 从 300+ 行精简到 150 行，只负责服务器生命周期
- 服务初始化顺序由依赖声明自动推导，不会遗漏
- 优雅关闭有统一入口，不会漏关资源
- 测试 mock 注入简单，不需要 mock 整个模块

### 负面
- 新增了 250 行自研代码需要维护
- 服务注册需要通过工厂函数，写法略微繁琐
- 类型安全通过 `ServiceMap` 接口手工维护，新增服务时需同步更新

## 相关

- ADR-001: 技术栈选择
