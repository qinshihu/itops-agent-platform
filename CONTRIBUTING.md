# Contributing to ITOps Agent Platform

感谢你对 ITOps Agent Platform 项目的关注！我们欢迎任何形式的贡献，包括但不限于：

- 提交 Bug 报告
- 提出新功能建议
- 提交代码修复或功能实现
- 改进文档
- 翻译本地化

## 📋 目录

- [行为准则](#行为准则)
- [开发环境搭建](#开发环境搭建)
- [提交 Bug](#提交-bug)
- [提出新功能](#提出新功能)
- [提交 Pull Request](#提交-pull-request)
- [代码风格](#代码风格)
- [Git 提交规范](#git-提交规范)
- [开发流程](#开发流程)

## 行为准则

本项目采用 [Contributor Covenant](https://www.contributor-covenant.org/) 行为准则。参与本项目即表示你同意遵守其条款。

## 项目许可证

本项目整体采用 **Mozilla Public License 2.0 (MPL-2.0)**（见 [LICENSE](./LICENSE)）。

**关于 `frontend/package.json` 的双声明说明**：

- `"license": "MPL-2.0"` — 仓库整体许可证
- `"private": true` — **仅阻止 `npm publish` 到 npm registry**，与许可证无关

两者不冲突：MPL-2.0 适用于**源代码分发**，`private: true` 仅控制 **npm 私有包发布**。外部贡献者无需担心"private 是否意味着闭源"，本项目源代码 100% 开源在 GitHub 上。

## 开发环境搭建

### 前置要求

- Node.js 20.19.5（与 [.nvmrc](./.nvmrc) 一致，推荐使用 nvm/fnm 管理版本）
- npm >= 9.0.0
- Git
- Docker & Docker Compose（可选，用于容器化部署）

### 本地开发

```bash
# 1. Fork 并克隆仓库
git clone https://github.com/YOUR_USERNAME/itops-agent-platform.git
cd itops-agent-platform

# 2. 安装依赖
npm run install:all

# 3. 启动开发服务器（零配置，所有变量有默认值）
npm run dev
```

详细开发环境搭建请参考 [开发指南](./docs/DEVELOPMENT.md)。

## 提交 Bug

提交 Bug 时，请提供以下信息：

1. **清晰的标题**：简要描述问题
2. **复现步骤**：详细说明如何触发问题
3. **预期行为**：你认为应该发生什么
4. **实际行为**：实际发生了什么
5. **环境信息**：
   - 操作系统及版本
   - Node.js 版本
   - 浏览器及版本（前端问题）
   - Docker 版本（部署问题）
6. **日志信息**：相关错误日志（如有）
7. **截图或录屏**：UI 问题请附上截图

[提交 Bug →](https://github.com/qinshihu/itops-agent-platform/issues/new?template=bug_report.md)

## 提出新功能

提出新功能时，请说明：

1. **功能描述**：你想实现什么功能
2. **使用场景**：这个功能解决什么问题
3. **实现思路**：如果你有技术实现方案，欢迎分享
4. **替代方案**：是否有其他方式可以解决

[提出新功能 →](https://github.com/qinshihu/itops-agent-platform/issues/new?template=feature_request.md)

## 提交 Pull Request

### 准备工作

1. Fork 本仓库
2. 创建你的功能分支：`git checkout -b feat/your-feature-name`
3. 在你的分支上进行修改

### 提交代码

1. **遵循代码风格**：请参考 [代码风格](#代码风格)
2. **遵循 Git 提交规范**：请参考 [Git 提交规范](#git-提交规范)
3. **更新文档**：如果你的修改涉及功能变更，请同步更新相关文档
4. **测试通过**：确保所有测试通过

```bash
# 运行测试
cd backend && npm test

# 运行 Lint
npm run lint
```

5. **提交 PR**：推送到你的 Fork 并创建 Pull Request

### PR 要求

- PR 标题遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范
- 详细描述修改内容、修改原因和测试方法
- 如果修复了 Issue，请在 PR 描述中关联相关 Issue（如 `Fixes #123`）
- 保持 PR 的改动尽可能小，一个 PR 只做一件事

## 代码风格

### TypeScript

- 遵循项目现有的代码风格
- 使用 TypeScript 严格模式
- 变量和函数命名使用 `camelCase`
- 类和接口命名使用 `PascalCase`
- 常量命名使用 `UPPER_CASE`

### React

- 函数组件优先于类组件
- 使用 Hooks 管理状态和副作用
- 组件命名使用 `PascalCase`
- Props 类型定义完整

### 后端

项目采用 **4A 分层架构 + DDD 领域驱动设计**，共 24 个业务模块：

- **模块入口**：`backend/src/modules/<module>/` — 每个模块是独立的限界上下文
  - `routes/` — RESTful 路由（只做参数校验 + 调用服务 + 返回结果）
  - `services/` — 业务逻辑与服务编排
  - `README.md` — 模块职责与依赖说明
- **通用基础设施**：
  - `backend/src/middleware/` — 通用中间件（auth、errorHandler 等）
  - `backend/src/utils/` — 通用工具函数
  - `backend/src/repositories/` — 数据仓储层（业务代码必须通过 Repository 访问数据）
  - `backend/src/core/` — DI 容器与服务注册
- **架构规则**：
  - routes 层禁止直接操作 Repository，必须经过 Service 层
  - 模块间只能通过 services/ 跨模块通信，禁止直接 import 对方 routes/
  - core/ 禁止 import modules/ 下的任何代码
  - 详见 [`.trae/rules/architecture.md`](./.trae/rules/architecture.md)

### 前端

项目采用 **模块化架构**，共 23 个业务模块：

- **模块入口**：`frontend/src/modules/<module>/` — 每个模块是独立的限界上下文
  - `pages/` — 页面组件
  - `components/` — 模块级共享组件
  - `api.ts` — 模块 API 调用封装
  - `routes.ts` — 路由定义
- **通用基础设施**：
  - `frontend/src/components/` — 跨模块通用组件
  - `frontend/src/shared/` — 跨模块共享逻辑
  - `frontend/src/lib/` — 基础库封装（api、errorHandler 等）
  - `frontend/src/hooks/` — 通用自定义 Hooks
- **架构规则**：
  - 必须使用 React.lazy 做代码分割
  - API 调用统一通过 `@/lib/api` 实例，禁止直接用 axios
  - 禁止使用 `any` 类型，用 `unknown` 或具体类型替代
  - 详见 [`.trae/rules/frontend.md`](./.trae/rules/frontend.md)

## Git 提交规范

所有提交必须遵循 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<type>(<scope>): <subject>
```

**type 可选值**：

- `feat`: 新功能
- `fix`: Bug 修复
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 代码重构
- `test`: 测试相关
- `chore`: 构建过程或辅助工具变动

**scope 可选值**：

- `frontend`: 前端相关
- `backend`: 后端相关
- `docker`: Docker 配置
- `deploy`: 部署相关
- `ci`: CI/CD 配置
- `docs`: 文档

**示例**：

```
feat(backend): 添加服务器分组管理功能
fix(frontend): 修复工作流编辑器节点拖拽偏移问题
docs: 更新 API 文档中的认证接口说明
chore(docker): 优化 Dockerfile 减小镜像体积
```

## 开发流程

1. **选择 Issue**：从 [Issues](https://github.com/qinshihu/itops-agent-platform/issues) 中选择一个你想处理的问题，或创建新的 Issue
2. **评论认领**：在 Issue 下评论表示你想处理，等待维护者分配
3. **开发实现**：按照上述规范进行开发
4. **提交 PR**：完成开发后提交 PR
5. **Code Review**：等待维护者审查代码并根据反馈修改
6. **合并**：审查通过后由维护者合并到主分支

## 📧 联系方式

如有任何问题，欢迎通过以下方式联系：

- 创建 [Issue](https://github.com/qinshihu/itops-agent-platform/issues)
- 发送邮件至 <huawei_network@foxmail.com>
- 关注公众号 **IT Online** 留言

## 📄 许可证

本项目采用 [MPL-2.0](./LICENSE) 许可证。提交代码即表示你同意按照该许可证发布你的贡献。

---

再次感谢你的贡献！🎉
