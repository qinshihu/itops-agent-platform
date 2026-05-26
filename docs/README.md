# 文档目录

ITOps Agent Platform 所有技术文档集合。

---

## 📚 文档清单

### 📖 用户文档

- [项目总览](../README.md) — 项目介绍、功能特性、快速开始
- [部署操作手册](../DEPLOYMENT.md) — 完整部署配置、常见问题、故障排查
- [快速部署指南](../QUICK_DEPLOY.md) — 简化版部署步骤，适合快速上手
- [测试指南](../TEST_GUIDE.md) — 测试方法和操作步骤
- [变更日志](../CHANGELOG.md) — 版本更新记录和变更说明

### ⚙️ 功能文档

- [Web SSH 终端](../WEB_TERMINAL.md) — 交互式远程终端功能、技术实现、使用说明
- [主机管理增强](../SERVER_MANAGEMENT.md) — 服务器分组管理、批量导入、信息采集功能
- [Zabbix 告警集成配置](./ZABBIX_CONFIG.md) — Zabbix 告警集成完整配置指南

### 👩‍💻 开发文档

- [开发指南](./DEVELOPMENT.md) — 本地开发环境搭建、开发流程、调试技巧
- [API 文档](./API.md) — 完整的后端 API 接口文档（含请求/响应示例
- [架构设计](./ARCHITECTURE.md) — 系统架构和技术设计说明
- [架构图](./ARCHITECTURE_DIAGRAM.md) — 系统架构图解、模块关系
- [技术实现细节](./TECHNICAL_IMPLEMENTATION.md) — 核心功能技术实现详解
- [自动修复设计](./AUTO_REMEDIATION_DESIGN.md) — 告警自动修复功能设计说明
- [架构决策记录](./arch/) — 关键技术选型决策过程和原因

### 🚀 部署与运维

- [生产环境最佳实践](./PRODUCTION.md) — 生产环境配置、安全加固、性能优化
- [CI/CD 配置指南](./CICD_SETUP.md) — 持续集成和持续部署配置说明
- [Docker 镜像仓库](../docker/README.md) — Docker 镜像构建和使用说明

---

## 🎯 推荐阅读路径

| 角色 | 推荐阅读顺序 |
|------|-------------|
| **新用户** | [项目总览](../README.md) → [快速部署指南](../QUICK_DEPLOY.md) → [测试指南](../TEST_GUIDE.md) |
| **部署/运维** | [部署操作手册](../DEPLOYMENT.md) → [生产环境最佳实践](./PRODUCTION.md) → [Zabbix 集成配置](./ZABBIX_CONFIG.md) |
| **开发人员** | [开发指南](./DEVELOPMENT.md) → [架构设计](./ARCHITECTURE.md) → [API 文档](./API.md) |
| **架构师** | [架构设计](./ARCHITECTURE.md) → [架构决策记录](./arch/) → [技术实现细节](./TECHNICAL_IMPLEMENTATION.md) |

---

## 📁 文档结构说明

```
ai/
├── README.md           # 项目根目录文档索引
├── DEPLOYMENT.md       # 完整部署操作手册
├── QUICK_DEPLOY.md    # 快速部署指南
├── TEST_GUIDE.md      # 测试指南
├── WEB_TERMINAL.md    # Web 终端功能文档
├── SERVER_MANAGEMENT.md # 主机管理文档
├── CHANGELOG.md       # 变更日志
└── docs/              # 详细文档目录
    ├── README.md      # 本文档（文档索引
    ├── DEVELOPMENT.md    # 开发指南
    ├── API.md          # API 文档
    ├── ARCHITECTURE.md  # 架构设计
    ├── ARCHITECTURE_DIAGRAM.md # 架构图
    ├── TECHNICAL_IMPLEMENTATION.md # 技术实现
    ├── PRODUCTION.md   # 生产环境配置
    ├── CICD_SETUP.md # CI/CD 配置
    ├── ZABBIX_CONFIG.md # Zabbix 集成
    ├── AUTO_REMEDIATION_DESIGN.md # 自动修复设计
    └── arch/          # 架构决策记录
```

---

## 💡 文档贡献指南

如发现文档错误或需要补充内容：

1. 找到对应文档，提交 Pull Request
2. 保持文档风格统一：中文 + 代码使用 Markdown 格式
3. 重要配置变更需同步更新相关文档
4. 新增功能需补充功能文档和测试文档
