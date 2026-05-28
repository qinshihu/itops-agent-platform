# 附录B API接口速查表

## 作者

**谭策** — 独立开发者 | AIOps 领域探索者

- 🌐 项目官网：[ITOpsAgentinfo](https://www.zjzwfw.cloud/ITOpsAgentinfo)
- 📝 博客：[zjzwfw.cloud](https://www.zjzwfw.cloud/)
- 📧 邮箱：<huawei_network@foxmail.com>
- 💬 微信公众号：**IT Online**

<p align="left">
  <img src="./frontend/public/wechaterweima.png" width="200" alt="IT Online 微信公众号">
</p>

## 许可证

[MPL-2.0](../../LICENSE) © 谭策



## B.1 概述

本速查表按功能分类列出 ITOps Agent Platform 后端的所有 RESTful API 接口。所有接口（除认证、Webhook 和健康检查外）均需要通过 `Bearer Token` 认证，即在请求头中添加 `Authorization: Bearer <token>`。

> **基础 URL**: `http://<host>:3001/api`
> **相关章节**: 第6章 后端开发基础、第9章 API开发实战

## B.2 认证相关接口 `/api/auth`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| POST | `/auth/login` | 用户登录，返回 access token 和 refresh token | 否 | 无 |
| POST | `/auth/refresh` | 刷新 access token | 否 | 无 |
| GET | `/auth/me` | 获取当前登录用户信息 | 是 | 无 |
| POST | `/auth/logout` | 退出登录，将 token 加入黑名单 | 是 | 无 |
| POST | `/auth/change-password` | 修改密码 | 是 | 无 |

**请求示例 登录**:
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin"}'
```

**响应示例**:
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": "uuid",
      "username": "admin",
      "email": "admin@example.com",
      "role": "admin",
      "passwordMustChange": false
    }
  }
}
```

## B.3 用户管理接口 `/api/users`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| GET | `/users` | 获取用户列表 | 是 | 无 |
| GET | `/users/:id` | 获取单个用户详情 | 是 | 无 |
| POST | `/users` | 创建用户 | 是 | admin |
| PUT | `/users/:id` | 更新用户信息 | 是 | admin |
| DELETE | `/users/:id` | 删除用户 | 是 | admin |

## B.4 服务器管理接口 `/api/servers`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| GET | `/servers` | 获取服务器列表 | 是 | 无 |
| GET | `/servers/:id` | 获取单个服务器详情 | 是 | 无 |
| POST | `/servers` | 添加服务器 | 是 | 无 |
| PUT | `/servers/:id` | 更新服务器信息 | 是 | 无 |
| DELETE | `/servers/:id` | 删除服务器 | 是 | admin, operator |
| GET | `/servers/:id/command-history` | 获取服务器命令执行历史 | 是 | 无 |
| GET | `/servers/:id/compliance-history` | 获取合规检查历史 | 是 | 无 |
| GET | `/servers/:id/command-history/export` | 导出命令执行历史 | 是 | 无 |
| GET | `/servers/:id/compliance-history/export` | 导出合规检查历史 | 是 | 无 |

## B.5 服务器分组接口 `/api/server-groups`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| GET | `/server-groups` | 获取分组列表 | 是 | 无 |
| GET | `/server-groups/tree` | 获取分组树形结构 | 是 | 无 |
| POST | `/server-groups` | 创建分组 | 是 | 无 |
| PUT | `/server-groups/:id` | 更新分组 | 是 | 无 |
| DELETE | `/server-groups/:id` | 删除分组 | 是 | 无 |
| POST | `/server-groups/:id/move` | 移动服务器到分组 | 是 | 无 |
| POST | `/server-groups/mapping` | 创建服务器-分组映射 | 是 | 无 |
| DELETE | `/server-groups/mapping` | 删除服务器-分组映射 | 是 | 无 |
| GET | `/server-groups/servers/:serverId` | 获取服务器所属分组 | 是 | 无 |
| GET | `/server-groups/groups/:groupId/servers` | 获取分组下的服务器 | 是 | 无 |

## B.6 服务器命令与合规接口 `/api/server-commands`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| POST | `/server-commands/:id/test` | 测试服务器连接 | 是 | admin, operator |
| POST | `/server-commands/:id/exec` | 在远程服务器执行命令 | 是 | admin, operator |
| GET | `/server-commands/compliance/checks` | 获取合规检查项列表 | 是 | 无 |
| POST | `/server-commands/:id/compliance` | 执行合规检查 | 是 | admin, operator |

## B.7 服务器运维管理接口 `/api/server-management`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| POST | `/server-management/:id/collect-info` | 收集单台服务器信息 | 是 | 无 |
| POST | `/server-management/collect-all` | 收集所有服务器信息 | 是 | 无 |
| POST | `/server-management/import` | 批量导入服务器 | 是 | 无 |
| GET | `/server-management/import-template` | 获取服务器导入模板 | 是 | 无 |

## B.8 Agent 管理接口 `/api/agents`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| GET | `/agents` | 获取 Agent 列表 | 是 | 无 |
| GET | `/agents/stats/summary` | 获取 Agent 统计摘要 | 是 | 无 |
| GET | `/agents/:id` | 获取单个 Agent 详情 | 是 | 无 |
| GET | `/agents/:id/executions` | 获取 Agent 执行历史 | 是 | 无 |
| POST | `/agents` | 创建 Agent | 是 | admin, operator |
| POST | `/agents/:id/test` | 测试 Agent | 是 | 无 |
| GET | `/agents/:id/test-input` | 获取 Agent 测试输入模板 | 是 | 无 |
| PUT | `/agents/:id` | 更新 Agent | 是 | admin, operator |
| DELETE | `/agents/:id` | 删除 Agent | 是 | admin, operator |
| POST | `/agents/import` | 导入 Agent 配置 | 是 | 无 |
| GET | `/agents/export/:id` | 导出 Agent 配置 | 是 | 无 |

## B.9 多 Agent 协作接口 `/api/multi-agent`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| POST | `/multi-agent/collaborate` | 多 Agent 协作执行 | 是 | 无 |
| GET | `/multi-agent/templates` | 获取协作模板列表 | 是 | 无 |
| POST | `/multi-agent/collaborate/from-template` | 基于模板发起协作 | 是 | 无 |
| GET | `/multi-agent/knowledge/search` | 搜索知识库 | 是 | 无 |
| POST | `/multi-agent/knowledge/inject` | 注入知识到 Agent | 是 | 无 |
| POST | `/multi-agent/knowledge` | 添加知识条目 | 是 | 无 |
| POST | `/multi-agent/knowledge/batch` | 批量添加知识 | 是 | 无 |
| GET | `/multi-agent/knowledge/:id/similar` | 查找相似知识 | 是 | 无 |
| GET | `/multi-agent/knowledge/statistics` | 获取知识统计 | 是 | 无 |
| GET | `/multi-agent/history` | 获取协作历史 | 是 | 无 |

## B.10 工作流管理接口 `/api/workflows`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| GET | `/workflows` | 获取工作流列表 | 是 | 无 |
| GET | `/workflows/:id` | 获取单个工作流详情 | 是 | 无 |
| POST | `/workflows` | 创建工作流 | 是 | admin, operator |
| PUT | `/workflows/:id` | 更新工作流 | 是 | admin, operator |
| DELETE | `/workflows/:id` | 删除工作流 | 是 | admin, operator |
| POST | `/workflows/import` | 导入工作流 | 是 | admin, operator |
| GET | `/workflows/export/:id` | 导出工作流 | 是 | 无 |

## B.11 任务管理接口 `/api/tasks`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| GET | `/tasks` | 获取任务列表 | 是 | 无 |
| GET | `/tasks/:id` | 获取单个任务详情 | 是 | 无 |
| POST | `/tasks` | 创建任务 | 是 | 无 |
| PUT | `/tasks/:id/pause` | 暂停任务 | 是 | 无 |
| PUT | `/tasks/:id/resume` | 恢复任务 | 是 | 无 |
| PUT | `/tasks/:id/cancel` | 取消任务 | 是 | 无 |
| PUT | `/tasks/:id/intervene` | 人工干预任务 | 是 | 无 |

## B.12 定时任务接口 `/api/scheduled-tasks`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| GET | `/scheduled-tasks` | 获取定时任务列表 | 是 | 无 |
| GET | `/scheduled-tasks/:id` | 获取单个定时任务详情 | 是 | 无 |
| POST | `/scheduled-tasks` | 创建定时任务 | 是 | admin, operator |
| PUT | `/scheduled-tasks/:id` | 更新定时任务 | 是 | admin, operator |
| DELETE | `/scheduled-tasks/:id` | 删除定时任务 | 是 | admin, operator |
| POST | `/scheduled-tasks/:id/toggle` | 启用/禁用定时任务 | 是 | 无 |
| POST | `/scheduled-tasks/:id/run` | 立即执行定时任务 | 是 | 无 |

## B.13 告警管理接口 `/api/alerts`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| GET | `/alerts` | 获取告警列表（支持分页、筛选） | 是 | 无 |
| GET | `/alerts/:id` | 获取单个告警详情 | 是 | 无 |
| POST | `/alerts` | 创建告警 | 是 | 无 |
| PUT | `/alerts/:id/acknowledge` | 确认告警 | 是 | 无 |
| PUT | `/alerts/:id/resolve` | 解决告警 | 是 | 无 |
| DELETE | `/alerts/:id` | 删除告警 | 是 | admin, operator |
| GET | `/alerts/stats/summary` | 获取告警统计摘要 | 是 | 无 |

## B.14 告警映射接口 `/api/alert-mappings`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| GET | `/alert-mappings` | 获取告警-工作流映射列表 | 是 | 无 |
| GET | `/alert-mappings/:id` | 获取单个映射详情 | 是 | 无 |
| POST | `/alert-mappings` | 创建告警映射 | 是 | 无 |
| PUT | `/alert-mappings/:id` | 更新告警映射 | 是 | 无 |
| DELETE | `/alert-mappings/:id` | 删除告警映射 | 是 | 无 |

## B.15 告警降噪接口 `/api/alert-noise`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| GET | `/alert-noise/stats` | 获取降噪统计 | 是 | 无 |
| GET | `/alert-noise/suppressed` | 获取已抑制告警列表 | 是 | 无 |
| POST | `/alert-noise/unsuppress` | 取消抑制告警 | 是 | 无 |
| POST | `/alert-noise/suppress` | 抑制告警 | 是 | 无 |
| POST | `/alert-noise/cleanup` | 清理过期降噪数据 | 是 | 无 |

## B.16 根因分析接口 `/api/root-cause-analysis`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| GET | `/root-cause-analysis` | 获取根因分析列表 | 是 | 无 |
| POST | `/root-cause-analysis` | 创建根因分析 | 是 | 无 |
| GET | `/root-cause-analysis/:id` | 获取单个根因分析详情 | 是 | 无 |
| PUT | `/root-cause-analysis/:id` | 更新根因分析 | 是 | 无 |
| POST | `/root-cause-analysis/:id/analyze` | 执行根因分析 | 是 | 无 |
| DELETE | `/root-cause-analysis/:id` | 删除根因分析 | 是 | 无 |
| GET | `/root-cause-analysis/alert/:alertId` | 根据告警 ID 获取关联分析 | 是 | 无 |

## B.17 自愈策略接口 `/api/remediation-policies`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| POST | `/remediation-policies` | 创建自愈策略 | 是 | admin, operator |
| GET | `/remediation-policies` | 获取自愈策略列表 | 是 | 无 |
| GET | `/remediation-policies/:id` | 获取单个策略详情 | 是 | 无 |
| PUT | `/remediation-policies/:id` | 更新策略 | 是 | admin, operator |
| DELETE | `/remediation-policies/:id` | 删除策略 | 是 | admin, operator |
| PATCH | `/remediation-policies/:id/toggle` | 启用/禁用策略 | 是 | 无 |
| GET | `/remediation-policies/:id/stats` | 获取策略执行统计 | 是 | 无 |

## B.18 自愈执行接口 `/api/remediation-executions`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| GET | `/remediation-executions` | 获取执行记录列表 | 是 | 无 |
| GET | `/remediation-executions/:id` | 获取单个执行记录详情 | 是 | 无 |
| POST | `/remediation-executions/:id/approve` | 审批执行请求 | 是 | 无 |
| POST | `/remediation-executions/:id/retry` | 重试执行 | 是 | 无 |

## B.19 知识库接口 `/api/knowledge`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| GET | `/knowledge` | 获取知识条目列表 | 是 | 无 |
| POST | `/knowledge` | 创建知识条目 | 是 | 无 |
| PUT | `/knowledge/:id` | 更新知识条目 | 是 | 无 |
| DELETE | `/knowledge/:id` | 删除知识条目 | 是 | 无 |
| GET | `/knowledge/search` | 搜索知识条目 | 是 | 无 |

## B.20 QAnything 知识库接口 `/api/knowledge/qanything`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| GET | `/knowledge/qanything/config` | 获取 QAnything 配置 | 是 | 无 |
| POST | `/knowledge/qanything/config` | 更新 QAnything 配置 | 是 | 无 |
| POST | `/knowledge/qanything/test` | 测试 QAnything 连接 | 是 | 无 |
| POST | `/knowledge/qanything/upload` | 上传知识文档 | 是 | 无 |
| POST | `/knowledge/qanything/upload-batch` | 批量上传知识文档 | 是 | 无 |
| GET | `/knowledge/qanything/document/:fileId` | 获取文档状态 | 是 | 无 |
| DELETE | `/knowledge/qanything/document/:fileId` | 删除文档 | 是 | 无 |

## B.21 脚本管理接口 `/api/scripts`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| GET | `/scripts` | 获取脚本列表 | 是 | 无 |
| GET | `/scripts/categories` | 获取脚本分类 | 是 | 无 |
| GET | `/scripts/:id` | 获取单个脚本详情 | 是 | 无 |
| POST | `/scripts` | 创建脚本 | 是 | admin, operator |
| PUT | `/scripts/:id` | 更新脚本 | 是 | admin, operator |
| DELETE | `/scripts/:id` | 删除脚本 | 是 | admin, operator |

## B.22 报告管理接口 `/api/reports`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| GET | `/reports/templates` | 获取报告模板列表 | 是 | 无 |
| GET | `/reports/templates/:id` | 获取单个报告模板详情 | 是 | 无 |
| POST | `/reports/templates` | 创建报告模板 | 是 | 无 |
| PUT | `/reports/templates/:id` | 更新报告模板 | 是 | 无 |
| DELETE | `/reports/templates/:id` | 删除报告模板 | 是 | 无 |
| GET | `/reports` | 获取报告列表 | 是 | 无 |
| GET | `/reports/:id` | 获取单个报告详情 | 是 | 无 |
| POST | `/reports/generate` | 生成报告 | 是 | 无 |
| GET | `/reports/:id/export` | 导出报告 | 是 | 无 |
| GET | `/reports/scheduled/all` | 获取所有定时报告 | 是 | 无 |
| GET | `/reports/scheduled/:id` | 获取单个定时报告 | 是 | 无 |
| POST | `/reports/scheduled` | 创建定时报告 | 是 | 无 |
| PUT | `/reports/scheduled/:id` | 更新定时报告 | 是 | 无 |
| DELETE | `/reports/scheduled/:id` | 删除定时报告 | 是 | 无 |

## B.23 通知管理接口 `/api/notifications`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| GET | `/notifications` | 获取通知列表 | 是 | 无 |
| PUT | `/notifications/:id/send` | 发送通知 | 是 | 无 |
| DELETE | `/notifications/:id` | 删除通知 | 是 | 无 |
| GET | `/notifications/stats/summary` | 获取通知统计摘要 | 是 | 无 |

## B.24 通知配置接口 `/api/notification-config`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| GET | `/notification-config` | 获取通知配置 | 是 | admin |
| PUT | `/notification-config` | 更新通知配置 | 是 | admin |

## B.25 系统设置接口 `/api/settings`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| GET | `/settings` | 获取系统设置 | 是 | 无 |
| PUT | `/settings` | 更新系统设置 | 是 | 无 |
| GET | `/settings/api-keys` | 获取 API Key 配置 | 是 | 无 |
| GET | `/settings/models` | 获取可用模型列表 | 是 | 无 |
| PUT | `/settings/api-keys` | 更新 API Key 配置 | 是 | 无 |
| DELETE | `/settings/api-keys/:provider` | 删除 API Key 配置 | 是 | 无 |

## B.26 审计日志接口 `/api/audit`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| GET | `/audit` | 获取审计日志列表（支持分页、筛选） | 是 | 无 |
| GET | `/audit/:id` | 获取单条审计日志详情 | 是 | 无 |
| GET | `/audit/stats/summary` | 获取审计统计摘要 | 是 | 无 |

## B.27 Webhook 接收接口 `/api/webhooks`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| POST | `/webhooks/prometheus` | 接收 Prometheus 告警 | 否 | 无 |
| POST | `/webhooks/zabbix` | 接收 Zabbix 告警 | 否 | 无 |
| POST | `/webhooks/grafana` | 接收 Grafana 告警 | 否 | 无 |
| POST | `/webhooks/aliyun` | 接收阿里云告警 | 否 | 无 |
| POST | `/webhooks/tencent` | 接收腾讯云告警 | 否 | 无 |
| POST | `/webhooks/auto` | 自动识别来源接收告警 | 否 | 无 |
| POST | `/webhooks/generic` | 接收通用格式告警 | 否 | 无 |

## B.28 仪表盘接口 `/api/dashboard`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| GET | `/dashboard/stats` | 获取仪表盘基础统计 | 是 | 无 |
| GET | `/dashboard/alert-trends` | 获取告警趋势数据 | 是 | 无 |
| GET | `/dashboard/task-trends` | 获取任务趋势数据 | 是 | 无 |
| GET | `/dashboard/agent-stats` | 获取 Agent 使用统计 | 是 | 无 |
| GET | `/dashboard/task-distribution` | 获取任务分布数据 | 是 | 无 |
| GET | `/dashboard/remediation-stats` | 获取自愈统计 | 是 | 无 |
| GET | `/dashboard/sla-stats` | 获取 SLA 统计 | 是 | 无 |
| GET | `/dashboard/server-metrics` | 获取服务器指标数据 | 是 | 无 |
| GET | `/dashboard/full` | 获取仪表盘完整数据 | 是 | 无 |
| GET | `/dashboard/alert-source-stats` | 获取告警来源统计 | 是 | 无 |

## B.29 AI Copilot 接口 `/api/copilot`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| GET | `/copilot/suggestions` | 获取智能建议 | 是 | 无 |
| GET | `/copilot/conversations` | 获取对话列表 | 是 | 无 |
| POST | `/copilot/conversations` | 创建新对话 | 是 | 无 |
| GET | `/copilot/conversations/:id` | 获取对话详情 | 是 | 无 |
| DELETE | `/copilot/conversations/:id` | 删除对话 | 是 | 无 |
| POST | `/copilot/chat` | 发送聊天消息 | 是 | 无 |

## B.30 数据库管理接口 `/api/database`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| GET | `/database/stats` | 获取数据库统计信息 | 是 | admin |
| POST | `/database/maintenance` | 执行数据库维护 | 是 | admin |
| POST | `/database/maintenance/all` | 执行全部维护操作 | 是 | admin |
| GET | `/database/indexes` | 获取索引信息 | 是 | admin |
| GET | `/database/suggestions` | 获取性能优化建议 | 是 | admin |

## B.31 备份管理接口 `/api/backups`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| GET | `/backups/status` | 获取备份状态 | 是 | admin |
| GET | `/backups/config` | 获取备份配置 | 是 | admin |
| PUT | `/backups/config` | 更新备份配置 | 是 | admin |
| GET | `/backups/history` | 获取备份历史 | 是 | admin |
| POST | `/backups/create` | 手动创建备份 | 是 | admin |
| DELETE | `/backups/:id` | 删除备份 | 是 | admin |
| POST | `/backups/restore/:id` | 从备份恢复 | 是 | admin |

## B.32 导入导出接口 `/api/import-export`

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| POST | `/import-export/servers/import` | 导入服务器数据 | 是 | admin |
| GET | `/import-export/servers/export` | 导出服务器数据 | 是 | admin |
| GET | `/import-export/alerts/export` | 导出告警数据 | 是 | admin |
| GET | `/import-export/audit-logs/export` | 导出审计日志 | 是 | admin |
| GET | `/import-export/reports/export` | 导出报告数据 | 是 | admin |
| GET | `/import-export/template/servers` | 下载服务器导入模板 | 否 | 无 |

## B.33 健康检查接口（公开）

| 方法 | 路径 | 描述 | 认证 | 角色限制 |
|------|------|------|------|----------|
| GET | `/health` | 完整健康检查 | 否 | 无 |
| GET | `/health/live` | 存活探针（Liveness） | 否 | 无 |
| GET | `/health/ready` | 就绪探针（Readiness） | 否 | 无 |
| GET | `/api/health/summary` | 健康摘要 | 是 | 无 |
| GET | `/api/health/history` | 健康历史 | 是 | 无 |

## B.34 WebSocket 实时通信

除 RESTful API 外，平台还提供 WebSocket 接口用于实时通信：

| 事件 | 方向 | 描述 |
|------|------|------|
| `connection` | 客户端→服务端 | 建立 WebSocket 连接 |
| `command_output` | 服务端→客户端 | 推送远程命令执行输出 |
| `terminal_input` | 客户端→服务端 | 发送 SSH 终端输入 |
| `alert_new` | 服务端→客户端 | 推送新告警 |
| `task_status` | 服务端→客户端 | 推送任务状态变更 |
| `notification` | 服务端→客户端 | 推送系统通知 |
| `agent_progress` | 服务端→客户端 | 推送 Agent 执行进度 |

**连接示例**:
```javascript
const socket = io('http://localhost:3001', {
  auth: { token: 'Bearer <your-jwt-token>' }
});

socket.on('command_output', (data) => {
  console.log(data.output);
});

socket.on('alert_new', (alert) => {
  console.log('新告警:', alert.title);
});
```

## B.35 通用响应格式

### 成功响应
```json
{
  "success": true,
  "message": "操作成功",
  "data": { ... }
}
```

### 错误响应
```json
{
  "success": false,
  "message": "错误描述",
  "error": "详细错误信息"
}
```

### 分页响应
```json
{
  "success": true,
  "data": { ... },
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

## B.36 通用查询参数

大多数列表接口支持以下查询参数：

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `page` | number | 1 | 页码 |
| `pageSize` | number | 20 | 每页数量 |
| `sort` | string | `created_at` | 排序字段 |
| `order` | string | `DESC` | 排序方向：ASC/DESC |
| `search` | string | 空 | 全文搜索关键词 |
| `status` | string | 空 | 按状态过滤 |
| `severity` | string | 空 | 按严重程度过滤 |
