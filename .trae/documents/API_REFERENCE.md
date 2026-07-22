# ITops Agent API 接口参考文档

> **⚠️ 本文档仅作 API 索引地图参考，可能与代码不同步**。
>
> **遇到 API 问题时，以代码为准**：
> 1. **`backend/src/modules/_registry.ts`** — 权威源：路由注册表
> 2. **`backend/src/modules/<module>/routes.ts`** — 单模块路由
> 3. **Zod schema** 在 `backend/src/modules/<module>/routes/*.ts` 维护（请求/响应参数）
>
> **不要基于本文件做接口调用决策**——具体端点路径、参数、响应格式以代码为准。

> 本文档列出所有后端 API 端点，用于 AI 辅助开发和人工快速查阅。
> 所有 API 前缀为 `/api/v1`（认证相关为 `/api/v1/auth`，Webhook 为 `/api/v1/webhooks`，MCP 网关为 `/api/v1/mcp`）。

---

## 目录

- [认证 (auth)](#1-auth---认证)
- [用户管理 (users)](#2-users---用户管理)
- [服务器 (servers)](#3-servers---服务器管理)
- [告警 (alerts)](#4-alerts---告警管理)
- [AI (ai)](#5-ai---ai-能力编排)
- [工作流 (workflow)](#6-workflow---工作流编排)
- [自动化 (auto)](#7-auto---自动化运维)
- [MCP (mcp)](#8-mcp---工具协议)
- [容器 (containers)](#9-containers---容器与虚拟机)
- [数据中心 (dc)](#10-dc---数据中心基础设施)
- [Kubernetes](#11-kubernetes---集群管理)
- [网络 (network)](#12-network---网络设备管理)
- [基础设施 (infra)](#13-infra---系统基础设施) — *已拆分，仅保留历史说明*
- [系统设置 (settings)](#14-settings--系统设置) — *P1-6 新增*
- [脚本与终端 (scripts)](#15-scripts--脚本与终端) — *P1-6 新增*
- [审计日志 (audit)](#16-audit--审计日志) — *P1-6 新增*
- [工具箱 (tool-links)](#17-tool-links--工具箱) — *P1-6 新增*
- [导入导出 (import-export)](#18-import-export--导入导出) — *P1-6 新增*
- [巡检中心 (linkage)](#19-linkage--巡检中心) — *P1-6 新增*
- [数据库 (database)](#20-database---数据库连接)
- [变更管理 (change-management)](#21-change-management---变更管理)
- [配置管理 (config-management)](#22-config-management---配置管理)
- [备份 (backup)](#23-backup---备份管理)
- [通知 (notification)](#24-notification---通知管理)
- [监控 (monitor)](#25-monitor---监控仪表盘)

---

## 1. auth — 认证

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| POST | `/api/v1/auth/login` | 登录 | body: `username`, `password` |
| POST | `/api/v1/auth/refresh` | 刷新 Token | body: `refreshToken` |
| POST | `/api/v1/auth/logout` | 登出 | — |
| GET | `/api/v1/auth/me` | 当前用户信息 | — |
| POST | `/api/v1/auth/change-password` | 修改密码 | body: `oldPassword`, `newPassword` |

## 2. users — 用户管理

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/api/v1/users` | 用户列表 | — |
| GET | `/api/v1/users/:id` | 用户详情 | — |
| POST | `/api/v1/users` | 创建用户 | body: `username`, `password`, `role` |
| PUT | `/api/v1/users/:id` | 更新用户 | — |
| DELETE | `/api/v1/users/:id` | 删除用户 | — |
| POST | `/api/v1/users/:id/unlock` | 解锁用户 | — |

## 3. servers — 服务器管理

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| **服务器 CRUD** | | | |
| GET | `/api/v1/servers` | 服务器列表 | — |
| GET | `/api/v1/servers/:id` | 服务器详情 | — |
| POST | `/api/v1/servers` | 创建服务器 | body: `name`, `hostname`, `port`, `username`, `password`, `os_type` |
| PUT | `/api/v1/servers/:id` | 更新服务器 | — |
| DELETE | `/api/v1/servers/:id` | 删除服务器 | — |
| **命令执行** | | | |
| POST | `/api/v1/server-commands/:id/exec` | 执行命令 | body: `command` |
| GET | `/api/v1/server-commands/:id/history` | 命令历史 | — |
| **SSH 密钥** | | | |
| GET | `/api/v1/ssh-keys` | SSH 密钥列表 | — |
| POST | `/api/v1/ssh-keys` | 创建密钥 | body: `name`, `key_type`, `private_key` |
| PUT | `/api/v1/ssh-keys/:id` | 更新密钥 | — |
| DELETE | `/api/v1/ssh-keys/:id` | 删除密钥 | — |
| **服务器分组** | | | |
| GET | `/api/v1/server-groups` | 分组列表 | — |
| POST | `/api/v1/server-groups` | 创建分组 | — |
| PUT | `/api/v1/server-groups/:id` | 更新分组 | — |
| DELETE | `/api/v1/server-groups/:id` | 删除分组 | — |
| **合规检查** | | | |
| GET | `/api/v1/compliance` | 合规检查列表 | — |
| POST | `/api/v1/compliance/:serverId/check` | 执行合规检查 | — |
| **服务拓扑** | | | |
| GET | `/api/v1/service-topology` | 服务拓扑数据 | — |
| **指标** | | | |
| GET | `/api/v1/server-metrics/:serverId` | 服务器指标 | — |

## 4. alerts — 告警管理

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| **告警 CRUD** | | | |
| GET | `/api/v1/alerts` | 告警列表 | query: `status`, `severity`, `page`, `limit` |
| GET | `/api/v1/alerts/:id` | 告警详情 | — |
| POST | `/api/v1/alerts` | 创建告警 | — |
| PUT | `/api/v1/alerts/:id` | 更新告警 | — |
| DELETE | `/api/v1/alerts/:id` | 删除告警 | — |
| POST | `/api/v1/alerts/:id/acknowledge` | 确认告警 | — |
| POST | `/api/v1/alerts/:id/resolve` | 解决告警 | — |
| GET | `/api/v1/alerts/stats` | 告警统计 | — |
| **告警 Provider** | | | |
| GET | `/api/v1/alerts/providers` | Provider 列表 | — |
| POST | `/api/v1/alerts/providers` | 创建 Provider | — |
| **告警映射** | | | |
| GET | `/api/v1/alert-mappings` | 映射列表 | — |
| POST | `/api/v1/alert-mappings` | 创建映射 | — |
| PUT | `/api/v1/alert-mappings/:id` | 更新映射 | — |
| DELETE | `/api/v1/alert-mappings/:id` | 删除映射 | — |
| **告警降噪** | | | |
| GET | `/api/v1/alert-noise/stats` | 降噪统计 | — |
| POST | `/api/v1/alert-noise/suppress` | 抑制告警 | — |
| POST | `/api/v1/alert-noise/restore` | 恢复告警 | — |
| **告警关联** | | | |
| GET | `/api/v1/alert-correlation` | 关联组列表 | — |
| POST | `/api/v1/alert-correlation` | 创建关联组 | — |
| **AARS 自适应响应** | | | |
| GET | `/api/v1/alert-auto-response` | 响应配置 | — |
| POST | `/api/v1/alert-auto-response` | 创建响应策略 | — |
| **Webhook 接收（公开）** | | | |
| POST | `/api/v1/webhooks/prometheus` | Prometheus 告警 | — |
| POST | `/api/v1/webhooks/zabbix` | Zabbix 告警 | — |
| POST | `/api/v1/webhooks/grafana` | Grafana 告警 | — |
| POST | `/api/v1/webhooks/aliyun` | 阿里云告警 | — |
| POST | `/api/v1/webhooks/tencent` | 腾讯云告警 | — |
| POST | `/api/v1/webhooks/generic` | 通用 Webhook | — |

## 5. ai — AI 能力编排

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| **Agent 管理** | | | |
| GET | `/api/v1/agents` | Agent 列表 | query: `type`, `status` |
| GET | `/api/v1/agents/:id` | Agent 详情 | — |
| POST | `/api/v1/agents` | 创建 Agent | body: `name`, `type`, `config` |
| PUT | `/api/v1/agents/:id` | 更新 Agent | — |
| DELETE | `/api/v1/agents/:id` | 删除 Agent | — |
| GET | `/api/v1/agents/:id/history` | Agent 执行历史 | — |
| POST | `/api/v1/agents/:id/test` | 测试 Agent | — |
| GET | `/api/v1/agents/tools/list` | 可用工具列表 | — |
| POST | `/api/v1/agents/tools/test` | 测试工具调用 | — |
| **AI 模型** | | | |
| GET | `/api/v1/ai-models` | 模型列表 | — |
| GET | `/api/v1/ai-models/:id` | 模型详情 | — |
| POST | `/api/v1/ai-models` | 创建模型配置 | — |
| PUT | `/api/v1/ai-models/:id` | 更新模型 | — |
| DELETE | `/api/v1/ai-models/:id` | 删除模型 | — |
| POST | `/api/v1/ai-models/:id/test` | 测试模型连接 | — |
| **知识库** | | | |
| GET | `/api/v1/knowledge` | 知识条目列表 | — |
| POST | `/api/v1/knowledge` | 创建知识条目 | — |
| PUT | `/api/v1/knowledge/:id` | 更新条目 | — |
| DELETE | `/api/v1/knowledge/:id` | 删除条目 | — |
| GET | `/api/v1/knowledge/search` | 搜索知识库 | query: `q` |
| **根因分析 (RCA)** | | | |
| GET | `/api/v1/root-cause-analysis` | RCA 列表 | — |
| GET | `/api/v1/root-cause-analysis/:id` | RCA 详情 | — |
| POST | `/api/v1/root-cause-analysis` | 创建 RCA | — |
| POST | `/api/v1/root-cause-analysis/:id/analyze` | 执行分析 | — |
| GET | `/api/v1/root-cause-analysis/stats` | RCA 统计 | — |
| **Multi-Agent** | | | |
| GET | `/api/v1/multi-agent` | 多 Agent 任务列表 | — |
| POST | `/api/v1/multi-agent` | 创建多 Agent 任务 | — |
| GET | `/api/v1/multi-agent/specialists` | Specialist 列表 | — |
| **Copilot** | | | |
| GET | `/api/v1/copilot` | 对话列表 | — |
| POST | `/api/v1/copilot` | 创建对话 | — |
| POST | `/api/v1/copilot/:id/chat` | 发送消息 | body: `message` |
| DELETE | `/api/v1/copilot/:id` | 删除对话 | — |
| **AI 修复** | | | |
| GET | `/api/v1/ai-remediations` | AI 修复记录 | — |
| **QAnything** | | | |
| GET | `/api/v1/knowledge/qanything/config` | QAnything 配置 | — |
| PUT | `/api/v1/knowledge/qanything/config` | 更新配置 | — |
| POST | `/api/v1/knowledge/qanything/upload` | 上传文档 | — |
| GET | `/api/v1/knowledge/qanything/documents` | 文档列表 | — |

## 6. workflow — 工作流编排

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| **工作流 CRUD** | | | |
| GET | `/api/v1/workflows` | 工作流列表 | — |
| GET | `/api/v1/workflows/:id` | 工作流详情 | — |
| POST | `/api/v1/workflows` | 创建工作流 | body: `name`, `nodes`, `edges`, `agent_configs` |
| PUT | `/api/v1/workflows/:id` | 更新工作流 | — |
| DELETE | `/api/v1/workflows/:id` | 删除工作流 | — |
| POST | `/api/v1/workflows/:id/execute` | 执行工作流 | — |
| GET | `/api/v1/workflows/:id/executions` | 执行历史 | — |
| **任务管理** | | | |
| GET | `/api/v1/tasks` | 任务列表 | — |
| GET | `/api/v1/tasks/:id` | 任务详情 | — |
| POST | `/api/v1/tasks/:id/cancel` | 取消任务 | — |
| POST | `/api/v1/tasks/:id/retry` | 重试任务 | — |
| POST | `/api/v1/tasks/:id/approve` | 审批通过 | — |
| POST | `/api/v1/tasks/:id/reject` | 审批拒绝 | — |
| GET | `/api/v1/tasks/:id/logs` | 任务日志 | — |
| **定时任务** | | | |
| GET | `/api/v1/scheduled-tasks` | 定时任务列表 | — |
| POST | `/api/v1/scheduled-tasks` | 创建定时任务 | — |
| PUT | `/api/v1/scheduled-tasks/:id` | 更新定时任务 | — |
| DELETE | `/api/v1/scheduled-tasks/:id` | 删除定时任务 | — |
| **工作流变量传递** | | | |
| GET | `/api/v1/workflow-variables/:taskId` | 变量传递记录 | — |
| **工作流 Provider** | | | |
| GET | `/api/v1/workflow-providers` | Provider 列表 | — |
| POST | `/api/v1/workflow-providers` | 创建 Provider | — |

## 7. auto — 自动化运维

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| **修复策略** | | | |
| GET | `/api/v1/remediation-policies` | 策略列表 | — |
| GET | `/api/v1/remediation-policies/:id` | 策略详情 | — |
| POST | `/api/v1/remediation-policies` | 创建策略 | — |
| PUT | `/api/v1/remediation-policies/:id` | 更新策略 | — |
| DELETE | `/api/v1/remediation-policies/:id` | 删除策略 | — |
| GET | `/api/v1/remediation-policies/stats` | 策略统计 | — |
| **修复执行** | | | |
| GET | `/api/v1/remediation-executions` | 执行列表 | — |
| POST | `/api/v1/remediation-executions` | 创建执行 | — |
| POST | `/api/v1/remediation-executions/:id/approve` | 审批执行 | — |
| POST | `/api/v1/remediation-executions/:id/execute` | 执行修复 | — |
| POST | `/api/v1/remediation-executions/:id/rollback` | 回滚修复 | — |
| POST | `/api/v1/remediation-executions/:id/verify` | 验证修复 | — |
| **修复审计** | | | |
| GET | `/api/v1/remediation-audits` | 审计列表 | — |
| POST | `/api/v1/remediation-audits/:id/approve` | 审批审计 | — |
| POST | `/api/v1/remediation-audits/:id/execute` | 执行审计 | — |
| **自动伸缩** | | | |
| GET | `/api/v1/auto-scale` | 伸缩规则 | — |
| GET | `/api/v1/auto-scale/history` | 伸缩历史 | — |
| GET | `/api/v1/auto-scale/summary` | 伸缩摘要 | — |

## 8. mcp — 工具协议

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| **MCP 网关（公开）** | | | |
| POST | `/api/v1/mcp` | MCP JSON-RPC 网关 | — |
| **MCP 服务管理** | | | |
| GET | `/api/v1/mcp/services` | MCP 服务列表 | — |
| POST | `/api/v1/mcp/services` | 注册 MCP 服务 | — |
| DELETE | `/api/v1/mcp/services/:id` | 注销服务 | — |
| **工具管理** | | | |
| GET | `/api/v1/mcp/tools` | 工具列表 | — |
| GET | `/api/v1/mcp/tools/:name` | 工具详情 | — |
| POST | `/api/v1/mcp/tools/:name/call` | 调用工具 | — |
| **外部 MCP 服务器** | | | |
| GET | `/api/v1/mcp/external-servers` | 外部服务器列表 | — |
| POST | `/api/v1/mcp/external-servers` | 添加外部服务器 | — |
| PUT | `/api/v1/mcp/external-servers/:id` | 更新配置 | — |
| DELETE | `/api/v1/mcp/external-servers/:id` | 删除配置 | — |
| POST | `/api/v1/mcp/external-servers/:id/connect` | 连接测试 | — |

## 9. containers — 容器与虚拟机

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| **容器管理** | | | |
| GET | `/api/v1/containers` | 容器列表 | — |
| GET | `/api/v1/containers/:id` | 容器详情 | — |
| POST | `/api/v1/containers/:id/start` | 启动容器 | — |
| POST | `/api/v1/containers/:id/stop` | 停止容器 | — |
| POST | `/api/v1/containers/:id/restart` | 重启容器 | — |
| DELETE | `/api/v1/containers/:id` | 删除容器 | — |
| GET | `/api/v1/containers/:id/logs` | 容器日志 | — |
| GET | `/api/v1/containers/:id/stats` | 容器统计 | — |
| **Docker 端点** | | | |
| GET | `/api/v1/docker` | 端点列表 | — |
| POST | `/api/v1/docker` | 创建端点 | — |
| PUT | `/api/v1/docker/:id` | 更新端点 | — |
| DELETE | `/api/v1/docker/:id` | 删除端点 | — |
| **镜像管理** | | | |
| GET | `/api/v1/images` | 镜像列表 | — |
| POST | `/api/v1/images/pull` | 拉取镜像 | — |
| DELETE | `/api/v1/images/:id` | 删除镜像 | — |
| POST | `/api/v1/images/cleanup` | 清理未使用镜像 | — |
| **虚拟机管理** | | | |
| GET | `/api/v1/virtual-machines` | VM 列表 | — |
| GET | `/api/v1/virtual-machines/platforms` | VM 平台列表 | — |
| POST | `/api/v1/virtual-machines` | 创建 VM | — |
| PUT | `/api/v1/virtual-machines/:id` | 更新 VM | — |
| DELETE | `/api/v1/virtual-machines/:id` | 删除 VM | — |
| POST | `/api/v1/virtual-machines/:id/start` | 启动 VM | — |
| POST | `/api/v1/virtual-machines/:id/stop` | 停止 VM | — |
| POST | `/api/v1/virtual-machines/:id/restart` | 重启 VM | — |
| POST | `/api/v1/virtual-machines/:id/snapshot` | 创建快照 | — |
| POST | `/api/v1/virtual-machines/:id/clone` | 克隆 VM | — |
| GET | `/api/v1/virtual-machines/stats` | VM 统计 | — |
| **卷管理** | | | |
| GET | `/api/v1/volumes` | 卷列表 | — |
| POST | `/api/v1/volumes` | 创建卷 | — |
| DELETE | `/api/v1/volumes/:id` | 删除卷 | — |
| **镜像仓库** | | | |
| GET | `/api/v1/registries` | 仓库列表 | — |
| POST | `/api/v1/registries` | 创建仓库 | — |
| PUT | `/api/v1/registries/:id` | 更新仓库 | — |
| DELETE | `/api/v1/registries/:id` | 删除仓库 | — |
| **VM 迁移** | | | |
| GET | `/api/v1/vm-migrations` | 迁移列表 | — |
| POST | `/api/v1/vm-migrations` | 创建迁移 | — |
| **快照策略** | | | |
| GET | `/api/v1/snapshot-policies` | 策略列表 | — |
| POST | `/api/v1/snapshot-policies` | 创建策略 | — |
| PUT | `/api/v1/snapshot-policies/:id` | 更新策略 | — |
| DELETE | `/api/v1/snapshot-policies/:id` | 删除策略 | — |

## 10. dc — 数据中心基础设施

**路由前缀**: `/api/v1/dc-infrastructure`

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| **机房管理** | | | |
| GET | `/api/v1/dc-infrastructure/rooms` | 机房列表 | — |
| POST | `/api/v1/dc-infrastructure/rooms` | 创建机房 | body: `name`, `width_m`, `depth_m` |
| PUT | `/api/v1/dc-infrastructure/rooms/:id` | 更新机房 | — |
| DELETE | `/api/v1/dc-infrastructure/rooms/:id` | 删除机房 | — |
| **机柜管理** | | | |
| GET | `/api/v1/dc-infrastructure/racks` | 机柜列表 | query: `room_id`, `status`, `search` |
| POST | `/api/v1/dc-infrastructure/racks` | 创建机柜 | body: `name`, `room_id`, `total_u` |
| PUT | `/api/v1/dc-infrastructure/racks/:id` | 更新机柜 | — |
| DELETE | `/api/v1/dc-infrastructure/racks/:id` | 删除机柜 | — |
| **U位管理** | | | |
| GET | `/api/v1/dc-infrastructure/slots` | 所有 U 位（3D 场景） | — |
| GET | `/api/v1/dc-infrastructure/slots/:rackId` | 按机柜获取 U 位 | — |
| POST | `/api/v1/dc-infrastructure/slots` | 分配 U 位 | body: `rack_id`, `device_id`, `start_u`, `end_u` |
| PUT | `/api/v1/dc-infrastructure/slots/:id` | 更新 U 位 | — |
| DELETE | `/api/v1/dc-infrastructure/slots/:id` | 移除 U 位 | — |
| **PDU 管理** | | | |
| GET | `/api/v1/dc-infrastructure/pdus` | PDU 列表 | — |
| POST | `/api/v1/dc-infrastructure/pdus` | 创建 PDU | body: `name`, `type`, `rack_id` |
| PUT | `/api/v1/dc-infrastructure/pdus/:id` | 更新 PDU | — |
| DELETE | `/api/v1/dc-infrastructure/pdus/:id` | 删除 PDU | — |
| **制造商/设备型号** | | | |
| GET | `/api/v1/dc-infrastructure/manufacturers` | 制造商列表 | — |
| POST | `/api/v1/dc-infrastructure/manufacturers` | 创建制造商 | — |
| DELETE | `/api/v1/dc-infrastructure/manufacturers/:id` | 删除制造商 | — |
| GET | `/api/v1/dc-infrastructure/device-types` | 设备型号列表 | query: `manufacturer_id` |
| POST | `/api/v1/dc-infrastructure/device-types` | 创建型号 | — |
| PUT | `/api/v1/dc-infrastructure/device-types/:id` | 更新型号 | — |
| DELETE | `/api/v1/dc-infrastructure/device-types/:id` | 删除型号 | — |
| **配电柜/供电线路** | | | |
| GET | `/api/v1/dc-infrastructure/power-panels` | 配电柜列表 | — |
| POST | `/api/v1/dc-infrastructure/power-panels` | 创建配电柜 | — |
| DELETE | `/api/v1/dc-infrastructure/power-panels/:id` | 删除配电柜 | — |
| GET | `/api/v1/dc-infrastructure/power-feeds` | 供电线路列表 | — |
| POST | `/api/v1/dc-infrastructure/power-feeds` | 创建供电线路 | — |
| DELETE | `/api/v1/dc-infrastructure/power-feeds/:id` | 删除供电线路 | — |
| **线缆管理** | | | |
| GET | `/api/v1/dc-infrastructure/cables` | 线缆列表 | — |
| GET | `/api/v1/dc-infrastructure/cables/scene` | 3D 场景线缆 | — |
| POST | `/api/v1/dc-infrastructure/cables` | 创建线缆 | — |
| DELETE | `/api/v1/dc-infrastructure/cables/:id` | 删除线缆 | — |
| **导入导出** | | | |
| GET | `/api/v1/dc-infrastructure/export` | 导出数据中心数据 | — |
| POST | `/api/v1/dc-infrastructure/import` | 导入数据中心数据 | — |
| **其他** | | | |
| GET | `/api/v1/dc-infrastructure/overview` | 3D 总览数据 | — |
| GET | `/api/v1/dc-infrastructure/devices` | 设备分布 | — |
| GET | `/api/v1/dc-infrastructure/lifecycle` | 生命周期 | — |
| GET | `/api/v1/dc-infrastructure/health` | 健康检查 | — |

## 11. kubernetes — 集群管理

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/api/v1/k8s/contexts` | K8s 集群列表 | — |
| POST | `/api/v1/k8s/contexts` | 导入集群 | body: `name`, `cluster_url`, `config` |
| PUT | `/api/v1/k8s/contexts/:id` | 更新集群 | — |
| DELETE | `/api/v1/k8s/contexts/:id` | 删除集群 | — |
| GET | `/api/v1/k8s/pods` | Pod 列表 | query: `context_id` |
| GET | `/api/v1/k8s/nodes` | Node 列表 | query: `context_id` |
| GET | `/api/v1/k8s/services` | Service 列表 | query: `context_id` |
| GET | `/api/v1/k8s/deployments` | Deployment 列表 | query: `context_id` |
| POST | `/api/v1/k8s/deployments/:name/scale` | 扩缩容 | body: `replicas`, `context_id` |

## 12. network — 网络设备管理

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| **网络设备** | | | |
| GET | `/api/v1/networks` | 网络列表 | — |
| POST | `/api/v1/networks` | 创建网络 | — |
| PUT | `/api/v1/networks/:id` | 更新网络 | — |
| DELETE | `/api/v1/networks/:id` | 删除网络 | — |
| GET | `/api/v1/network-devices` | 设备列表 | — |
| POST | `/api/v1/network-devices` | 创建设备 | body: `name`, `ip_address`, `vendor` |
| PUT | `/api/v1/network-devices/:id` | 更新设备 | — |
| DELETE | `/api/v1/network-devices/:id` | 删除设备 | — |
| **SNMP** | | | |
| GET | `/api/v1/snmp/credentials` | SNMP 凭证列表 | — |
| POST | `/api/v1/snmp/credentials` | 创建凭证 | — |
| DELETE | `/api/v1/snmp/credentials/:id` | 删除凭证 | — |
| POST | `/api/v1/snmp/scan` | SNMP 扫描 | — |
| GET | `/api/v1/snmp/interfaces/:deviceId` | 接口指标 | — |
| GET | `/api/v1/snmp/traps` | Trap 事件 | — |
| **网络发现** | | | |
| GET | `/api/v1/network-discovery` | 发现任务列表 | — |
| POST | `/api/v1/network-discovery` | 创建发现任务 | body: `name`, `start_ip`, `end_ip` |
| GET | `/api/v1/network-discovery/:id/results` | 发现结果 | — |
| **拓扑** | | | |
| GET | `/api/v1/network-topology` | 拓扑数据 | — |
| GET | `/api/v1/network-topology/links` | 拓扑链路 | — |
| **子网** | | | |
| GET | `/api/v1/subnets` | 子网列表 | — |
| POST | `/api/v1/subnets` | 创建子网 | — |
| DELETE | `/api/v1/subnets/:id` | 删除子网 | — |
| **巡检** | | | |
| POST | `/api/v1/network-inspection/:deviceId` | 执行网络巡检 | — |
| GET | `/api/v1/network-inspection/:deviceId/history` | 巡检历史 | — |

## 13. infra — 系统基础设施

> **注**：按 [ADR-017](../adr/017-infra-subdomain-splitting.md)，infra 模块已于 2026-07-07 拆分为 6 个独立子域。
> infra 模块当前**0 个 HTTP 路由**，仅保留 `restartService.ts` 作为系统级服务（被 backup/workflow 模块通过 service 调用）。
> 原列在 infra 下的端点已迁至以下独立模块章节：[§14 settings](#14-settings--系统设置) / [§15 scripts](#15-scripts--脚本与终端) / [§16 audit](#16-audit--审计日志) / [§17 tool-links](#17-tool-links--工具箱) / [§18 import-export](#18-import-export--导入导出) / [§19 linkage](#19-linkage--巡检中心)。

## 14. settings — 系统设置（P1-6 新增）

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/api/v1/settings` | 系统设置 | — |
| PUT | `/api/v1/settings` | 更新设置 | — |
| GET | `/api/v1/settings/api-keys` | API 密钥列表 | — |
| POST | `/api/v1/settings/api-keys` | 创建 API 密钥 | — |
| DELETE | `/api/v1/settings/api-keys/:id` | 删除 API 密钥 | — |
| GET | `/api/v1/settings/models` | 可用模型列表 | — |

## 15. scripts — 脚本与终端（P1-6 新增）

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/api/v1/scripts` | 脚本列表 | query: `category`, `search` |
| GET | `/api/v1/scripts/:id` | 脚本详情 | — |
| POST | `/api/v1/scripts` | 创建脚本 | — |
| PUT | `/api/v1/scripts/:id` | 更新脚本 | — |
| DELETE | `/api/v1/scripts/:id` | 删除脚本 | — |
| GET | `/api/v1/scripts/categories` | 脚本分类 | — |

## 16. audit — 审计日志（P1-6 新增）

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/api/v1/audit` | 审计日志列表 | — |
| GET | `/api/v1/audit/stats` | 审计统计 | — |

## 17. tool-links — 工具箱（P1-6 新增）

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/api/v1/tool-links` | 链接列表 | — |
| POST | `/api/v1/tool-links` | 创建链接 | — |
| PUT | `/api/v1/tool-links/:id` | 更新链接 | — |
| DELETE | `/api/v1/tool-links/:id` | 删除链接 | — |
| POST | `/api/v1/tool-links/:id/icon` | 上传图标 | — |

## 18. import-export — 导入导出（P1-6 新增）

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/api/v1/import-export/servers` | 导出服务器 | — |
| POST | `/api/v1/import-export/servers` | 导入服务器 | — |
| GET | `/api/v1/import-export/alerts` | 导出告警 | — |
| POST | `/api/v1/import-export/alerts` | 导入告警 | — |
| GET | `/api/v1/import-export/audit-logs` | 导出审计日志 | — |
| GET | `/api/v1/import-export/reports` | 导出报告 | — |

## 19. linkage — 巡检中心（P1-6 新增）

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/api/v1/inspection` | 巡检结果 | — |
| POST | `/api/v1/inspection/run` | 执行巡检 | — |
| GET | `/api/v1/inspection/history` | 巡检历史 | — |

## 20. database — 数据库连接

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/api/v1/db-connections` | 连接列表 | — |
| GET | `/api/v1/db-connections/:id` | 连接详情 | — |
| POST | `/api/v1/db-connections` | 创建连接 | body: `name`, `type`, `host`, `port`, `username`, `database_name` |
| PUT | `/api/v1/db-connections/:id` | 更新连接 | — |
| DELETE | `/api/v1/db-connections/:id` | 删除连接 | — |
| POST | `/api/v1/db-connections/:id/test` | 测试连接 | — |
| GET | `/api/v1/database/stats` | 数据库统计 | — |
| GET | `/api/v1/database/maintenance` | 维护信息 | — |
| GET | `/api/v1/database/optimization` | 优化建议 | — |

## 21. change-management — 变更管理

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| **变更记录** | | | |
| GET | `/api/v1/changes` | 变更列表 | — |
| GET | `/api/v1/changes/:id` | 变更详情 | — |
| POST | `/api/v1/changes` | 创建变更 | — |
| PUT | `/api/v1/changes/:id` | 更新变更 | — |
| DELETE | `/api/v1/changes/:id` | 删除变更 | — |
| POST | `/api/v1/changes/:id/root-cause` | 标记根因 | — |
| **审批** | | | |
| GET | `/api/v1/approvals` | 审批列表 | — |
| GET | `/api/v1/approvals/:id` | 审批详情 | — |
| POST | `/api/v1/approvals/:id/approve` | 通过审批 | — |
| POST | `/api/v1/approvals/:id/reject` | 拒绝审批 | — |

## 22. config-management — 配置管理

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| **配置模板** | | | |
| GET | `/api/v1/config-templates` | 模板列表 | — |
| GET | `/api/v1/config-templates/:id` | 模板详情 | — |
| POST | `/api/v1/config-templates` | 创建模板 | — |
| PUT | `/api/v1/config-templates/:id` | 更新模板 | — |
| DELETE | `/api/v1/config-templates/:id` | 删除模板 | — |
| POST | `/api/v1/config-templates/:id/render` | 渲染模板 | — |
| POST | `/api/v1/config-templates/:id/apply` | 应用模板到服务器 | — |
| **配置修复** | | | |
| POST | `/api/v1/config-repair/analyze` | 分析配置问题 | — |
| POST | `/api/v1/config-repair/plan` | 生成修复计划 | — |
| POST | `/api/v1/config-repair/execute` | 执行修复 | — |
| POST | `/api/v1/config-repair/rollback` | 回滚修复 | — |
| GET | `/api/v1/config-repair/records` | 修复记录 | — |
| **Docker Compose** | | | |
| GET | `/api/v1/compose` | Compose 项目列表 | — |
| POST | `/api/v1/compose` | 创建项目 | — |
| PUT | `/api/v1/compose/:id` | 更新项目 | — |
| DELETE | `/api/v1/compose/:id` | 删除项目 | — |
| POST | `/api/v1/compose/:id/start` | 启动项目 | — |
| POST | `/api/v1/compose/:id/stop` | 停止项目 | — |
| GET | `/api/v1/compose/:id/logs` | 项目日志 | — |
| POST | `/api/v1/compose/:id/validate` | 验证 compose 文件 | — |

## 23. backup — 备份管理

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/api/v1/backups/status` | 备份状态 | — |
| GET | `/api/v1/backups/config` | 备份配置 | — |
| PUT | `/api/v1/backups/config` | 更新配置 | body: `enabled`, `intervalHours`, `keepLast` |
| GET | `/api/v1/backups/history` | 备份历史 | — |
| POST | `/api/v1/backups` | 创建备份 | — |
| POST | `/api/v1/backups/:id/restore` | 恢复备份 | — |
| GET | `/api/v1/backups/:id/download` | 下载备份 | — |

## 24. notification — 通知管理

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/api/v1/notifications` | 通知列表 | — |
| GET | `/api/v1/notifications/:id` | 通知详情 | — |
| POST | `/api/v1/notifications` | 创建通知 | — |
| PUT | `/api/v1/notifications/:id` | 标记已读 | — |
| DELETE | `/api/v1/notifications/:id` | 删除通知 | — |
| GET | `/api/v1/notification-configs` | 通知渠道配置 | — |
| PUT | `/api/v1/notification-configs` | 更新渠道配置 | body: `webhook_enabled`, `email_enabled`, `wechat_enabled`, `dingtalk_enabled`, `feishu_enabled`, `telegram_enabled` |

## 25. monitor — 监控仪表盘

| 方法 | 路径 | 说明 | 参数 |
|------|------|------|------|
| GET | `/api/v1/dashboard/full` | 完整监控面板数据 | — |
| GET | `/api/v1/dashboard/big-screen` | 大屏数据 | — |
| GET | `/api/v1/reports` | 报表列表 | — |
| GET | `/api/v1/reports/:id` | 报表详情 | — |
| POST | `/api/v1/reports` | 创建报表 | — |
| DELETE | `/api/v1/reports/:id` | 删除报表 | — |
| GET | `/api/v1/report-schedules` | 报表调度 | — |
| POST | `/api/v1/report-schedules` | 创建调度 | — |
| PUT | `/api/v1/report-schedules/:id` | 更新调度 | — |
| DELETE | `/api/v1/report-schedules/:id` | 删除调度 | — |
| GET | `/api/v1/cost-analysis` | 成本分析 | — |

---

## 附录

### 认证说明

- 除 `/api/v1/auth/*`、`/api/v1/webhooks/*`、`/api/v1/mcp` 外，所有 API 需要 `Authorization: Bearer <token>` 请求头
- Token 通过 `/api/v1/auth/login` 获取
- Token 过期后通过 `/api/v1/auth/refresh` 刷新

### 响应格式

所有 API 统一返回：

```json
{
  "success": true,
  "data": { ... },
  "message": "操作成功"
}
```

### 对应前端模块

| 后端模块 | 前端模块 | 前端路径 |
|---------|---------|---------|
| auth | auth | `src/modules/auth/` |
| servers | servers | `src/modules/servers/` |
| alerts | alerts | `src/modules/alerts/` |
| ai | ai | `src/modules/ai/` |
| workflow | workflow | `src/modules/workflow/` |
| auto | auto | `src/modules/auto/` |
| mcp | mcp | `src/modules/mcp/` |
| containers | containers | `src/modules/containers/` |
| dc | dc | `src/modules/dc/` |
| kubernetes | kubernetes | `src/modules/kubernetes/` |
| network | network | `src/modules/network/` |
| infra | infra | `src/modules/infra/` |
| database | database | `src/modules/database/` |
| change-management | change-management | `src/modules/change-management/` |
| config-management | config-management | `src/modules/config-management/` |
| backup | backup | `src/modules/backup/` |
| notification | notification | `src/modules/notification/` |
| monitor | monitor | `src/modules/monitor/` |