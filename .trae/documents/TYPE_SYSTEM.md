# ITops Agent 类型系统速查文档

> **⚠️ 本文档仅作类型索引地图参考，可能与代码不同步**。
>
> **遇到类型问题时，以代码为准**：
> 1. **`backend/src/repositories/types/`** — 数据库表类型（1:1 映射）
> 2. **`backend/src/modules/*/services/types.ts`** — 服务层领域类型
>
> **不要基于本文件做类型判断**——VS Code Ctrl+点击跳转到代码定义。

> 本文档列出后端所有核心数据模型和类型定义，用于 AI 辅助开发和人工快速理解数据模型。
> 类型系统遵循"双层定义"模式：`repositories/types/` 定义数据库表类型（1:1 映射），`modules/*/services/types.ts` 定义服务层领域类型。

---

## 目录

- [类型系统架构](#类型系统架构)
- [一、认证与授权 (auth)](#一认证与授权)
- [二、服务器管理 (servers)](#二服务器管理)
- [三、告警管理 (alerts)](#三告警管理)
- [四、AI 能力编排 (ai)](#四ai-能力编排)
- [五、工作流编排 (workflow)](#五工作流编排)
- [六、自动化运维 (auto)](#六自动化运维)
- [七、MCP 工具协议 (mcp)](#七mcp-工具协议)
- [八、容器与虚拟机 (containers)](#八容器与虚拟机)
- [九、数据中心 (dc)](#九数据中心)
- [十、网络设备 (network)](#十网络设备)
- [十一、系统基础设施 (infra)](#十一系统基础设施)
- [十二、其他模块](#十二其他模块)
- [核心枚举速查](#核心枚举速查)
- [类型文件路径索引](#类型文件路径索引)

---

## 类型系统架构

```
repositories/types/          ← 数据库表类型（1:1 映射 SQLite 表）
    ├── types/index.ts       ← 统一 re-export 入口
    └── 17 个模块类型文件 + index.ts（按业务域分组）
    
modules/*/services/types.ts  ← 服务层领域类型（DTO、枚举、接口契约）
types/index.ts               ← 共享领域类型（WorkflowNode, ExecutionContext 等）
types/errors.ts              ← 错误码枚举
constants/agentNames.ts      ← Agent 名称常量
```

**核心原则**：Repository 层定义与数据库表 1:1 映射的 Row 类型，Service 层定义业务领域类型，两者通过 Service 层转换，互不依赖。

---

## 一、认证与授权

### 数据库表类型

| 类型 | 表 | 关键字段 |
|------|-----|---------|
| `User` | users | id, username, password, role, enabled, password_must_change |
| `TokenBlacklistEntry` | token_blacklist | id, token, user_id, expires_at |
| `EncryptionKey` | encryption_keys | id, key_type, key_value, active |
| `Credential` | credentials | provider, encrypted_value, key_version |

### 共享类型

| 类型 | 用途 | 值 |
|------|------|-----|
| `UserRole` | 用户角色（RBAC 三级） | `'viewer' \| 'operator' \| 'admin'` |

> 注：历史 `CommandPolicy` 类型已随 `middleware/commandFilter.ts` 于 2026-07-06 删除（详见 [ADR-006 Deprecated](../adr/006-command-filter.md)）。

---

## 二、服务器管理

### 数据库表类型

| 类型 | 表 | 关键字段 |
|------|-----|---------|
| `Server` | servers | id, name, hostname, port, username, os_type, ssh_key_id, enabled |
| `SshKey` | ssh_keys | id, name, key_type, fingerprint, private_key, auth_type |
| `ServerGroup` | server_groups | id, name, parent_id, sort_order |
| `ServerGroupMapping` | server_group_mapping | server_id, group_id |
| `ServerCommandHistory` | server_command_history | server_id, command, stdout, stderr, success |
| `ComplianceCheck` | compliance_checks | server_id, check_name, check_results, status |
| `ServiceTopology` | service_topologies | source_server_id, target_server_id, dependency_type |
| `ServerMetric` | server_metrics | server_id, cpu_usage, memory_usage, disk_usage, collected_at |

### 服务层类型

| 类型 | 用途 | 关键字段 |
|------|------|---------|
| `ServerInfo` | SSH 连接参数 | id, hostname, port, username, password, private_key |
| `CommandResult` | 命令执行结果 | success, stdout, stderr, command, duration, error |
| `PooledConnection` | 连接池连接 | client, serverId, createdAt, lastUsedAt, inUse |
| `OSType` | 操作系统类型 | `'linux' \| 'windows' \| 'unknown'` |

---

## 三、告警管理

### 数据库表类型

| 类型 | 表 | 关键字段 |
|------|-----|---------|
| `Alert` | alerts | id, source, severity, title, content, status, alert_fingerprint |
| `AlertWebhookLog` | alert_webhook_logs | id, source, status, alert_count, processing_time_ms |
| `AlertNoiseReduction` | alert_noise_reduction | alert_fingerprint, occurrence_count, is_suppressed |
| `AlertWorkflowMapping` | alert_workflow_mappings | alert_source, workflow_id, enabled |
| `AlertCorrelationGroup` | alert_correlation_groups | title, status, root_alert_id, alert_count, auto_detected |
| `AlertCorrelationMember` | alert_correlation_members | group_id, alert_id, is_root |
| `AarsResponseLog` | aars_response_logs | alert_id, device_id, access_method, status, approval_status |
| `AarsConfig` | aars_config | enabled, min_severity, auto_execute_enabled, approval_timeout_minutes |
| `AutomataTrust` | automata_trust | operation_key, approval_count, success_count, success_rate |
| `AlertProviderConfig` | alert_provider_configs | provider_id, name, config, enabled |
| `AlertAutoAnalysis` | alert_auto_analysis | alert_id, device_id, device_type, status, diagnosis |

### 服务层类型 (AARS v2 自适应响应)

| 类型 | 用途 | 关键字段 |
|------|------|---------|
| `DeviceRuntimeProfile` | 设备运行时画像 | deviceId, type, accessMethod, osFamily, runningServices, baseline |
| `MetricsBaseline` | 7天基线 | cpuAvg, cpuStddev, memAvg, memStddev, trafficDailyAvg |
| `ProbeUnit` | 探针定义 | id, applicableOS, risk, commands, oids, infoGainWeight |
| `ProbeResult` | 探针结果 | probeId, success, rawOutput, parsed, durationMs |
| `RiskAssessment` | 三维风险评分 | overallRiskScore, dimensions, suggestedAction |
| `RiskDimensions` | 风险维度 | operationalRisk, urgencyScore, confidenceScore |
| `RemediationPlan` | 修复计划 | commands, rollbackCommands, summary, risk, requiresApproval |
| `VerificationChainResult` | 验证链结果 | result, stages, failedStage |

### 统一告警处理类型

| 类型 | 用途 | 值 |
|------|------|-----|
| `ProcessingStrategy` | 处理策略 | `'aars' \| 'workflow' \| 'hybrid' \| 'auto'` |
| `AlertProcessingContext` | 处理上下文 | alertId, title, severity, source, deviceId |
| `ProcessingDecision` | 处理决策 | strategy, reason, workflowId |
| `ProcessingResult` | 处理结果 | success, strategy, executionId, taskId |

---

## 四、AI 能力编排

### 数据库表类型

| 类型 | 表 | 关键字段 |
|------|-----|---------|
| `Agent` | agents | id, name, role, system_prompt, model, api_provider, primary_model_id |
| `AgentExecution` | agent_executions | agent_id, input_text, output_text, status, execution_time_ms, token_count |
| `AiModel` | ai_models | id, name, provider_type, api_key, model_id, enabled, is_default |
| `KnowledgeEntry` | knowledge_base | title, category, content, tags, solutions, source, usage_count |
| `RootCauseAnalysis` | root_cause_analyses | alert_id, title, status, root_cause, symptoms, recommendations |
| `CopilotConversation` | copilot_conversations | user_id, messages (JSON) |
| `AiRemediation` | ai_remediations | title, alert_id, status, strategy, diagnosis, risk_level |

### 服务层类型 — MultiAgent

| 类型 | 用途 | 关键字段/值 |
|------|------|------------|
| `AgentType` | 双层架构 | `'COORDINATOR' \| 'SPECIALIST'` |
| `SpecialistDomain` | 专业领域 | 见 [核心枚举速查](#核心枚举速查) |
| `TaskStatus` | 任务状态 | `'PENDING' \| 'IN_PROGRESS' \| 'COMPLETED' \| 'FAILED' \| 'DELEGATED'` |
| `TaskContext` | 任务上下文 | taskId, input, userId, timestamp, metadata |
| `TaskDecomposition` | 任务分解 | mainTask, subtasks, requiredDomains, estimatedComplexity |
| `SubTask` | 子任务 | id, description, assignedDomain, dependencies, priority |
| `ExecutionResult` | 执行结果 | success, output, error, metadata, duration, confidence |
| `AgentResponse` | Agent 响应 | taskId, agentId, agentName, agentType, status, result |

### 服务层类型 — Edge Agent

| 类型 | 用途 | 关键字段 |
|------|------|---------|
| `EdgeAgentType` | 代理类型 | `'HOST' \| 'CONTAINER' \| 'KUBERNETES' \| 'NETWORK' \| 'DATABASE'` |
| `EdgeAgentStatus` | 代理状态 | `'OFFLINE' \| 'CONNECTING' \| 'ONLINE' \| 'ERROR'` |
| `EdgeAgentConfig` | 代理配置 | agentId, agentType, serverUrl, heartbeatInterval |
| `HostInfo` | 主机信息 | hostname, os, osVersion, arch, cpuCount, totalMemory |
| `HostLoad` | 主机负载 | cpuUsage, memoryUsage, diskUsage, networkIn, networkOut |

---

## 五、工作流编排

### 数据库表类型

| 类型 | 表 | 关键字段 |
|------|-----|---------|
| `Workflow` | workflows | id, name, nodes, edges, agent_configs, is_template |
| `Task` | tasks | id, workflow_id, name, status, current_node_id, execution_variables, execution_depth |
| `ScheduledTask` | scheduled_tasks | id, workflow_id, schedule, enabled, last_run, next_run |
| `WorkflowExecutionLog` | workflow_execution_logs | task_id, node_id, node_type, status, duration_ms, branch_id |
| `WorkflowVariableTransfer` | workflow_variable_transfers | task_id, source_node_id, target_node_id, variable_name, transfer_type |

### 服务层类型 — DSL 定义

| 类型 | 用途 | 关键字段 |
|------|------|---------|
| `WorkflowDefinition` | 增强 DSL 定义 | id, triggers, steps, inputs, outputs, environment |
| `TriggerDefinition` | 触发器 | type (`'alert'\|'schedule'\|'webhook'\|'manual'\|'event'`), config, filter |
| `StepDefinition` | 步骤定义 | id, type (`'action'\|'condition'\|'parallel'\|'foreach'\|'wait'\|'task'`), provider, method |
| `WorkflowExecution` | DSL 执行状态 | id, workflowId, status, steps, inputs, outputs |
| `StepExecution` | 步骤执行状态 | id, stepId, status, output, error, duration |
| `RetryConfig` | 重试配置 | maxAttempts, backoff (initial, max, multiplier) |

### 增强节点类型

| 类型 | 用途 | 关键字段 |
|------|------|---------|
| `EnhancedNodeType` | 增强节点类型 | `'verification' \| 'risk_assess' \| 'decision' \| 'knowledge' \| 'rollback'` |
| `VerificationNodeConfig` | 验证节点 | gates (5级), server_id, stageOverrides, timeout |
| `RiskAssessNodeConfig` | 风险评估节点 | planSourceNodeId, alertSeverity, thresholds |
| `RiskAssessmentResult` | 风险评估结果 | overallRiskScore, dimensions, riskLevel, suggestedAction |
| `DecisionNodeConfig` | 决策节点 | rules, riskSourceNodeId, defaultAction |
| `KnowledgeNodeConfig` | 知识沉淀节点 | category, titleTemplate, deduplicate, similarityThreshold |
| `RollbackNodeConfig` | 回滚节点 | commandSourceNodeId, server_id, commandTimeout, verifyAfterRollback |

### 共享领域类型

| 类型 | 用途 | 关键字段 |
|------|------|---------|
| `WorkflowNode` | 前端节点 | id, type, data (label, agentId, approvalConfig), position |
| `WorkflowEdge` | 前端边 | id, source, target, animated |
| `WorkflowParsed` | 解析后工作流 | id, name, nodes, edges, agent_configs |
| `NodeResult` | 节点结果 | status (`'success'\|'failed'\|'pending'`), output, error |
| `ExecutionContext` | 执行上下文 | variables, previousResults, metadata (taskId, executionDepth) |
| `TaskLogEntry` | 任务日志 | type (`'thinking'\|'output'\|'error'`), content, nodeId |

---

## 六、自动化运维

### 数据库表类型

| 类型 | 表 | 关键字段 |
|------|-----|---------|
| `RemediationPolicy` | remediation_policies | id, name, alert_source, execution_mode, workflow_id, cooldown_seconds, enable_rollback |
| `RemediationExecution` | remediation_executions | policy_id, alert_id, status, approval_required, verification_status, rollback_triggered |
| `RemediationHistory` | remediation_history | policy_id, alert_source, execution_status, root_cause, duration_ms |
| `RemediationAudit` | remediation_audits | rca_id, policy_id, server_id, risk_level, status, is_rollback |
| `AutoScaleRule` | auto_scale_rules | name, target_type, target_id, metric_type, threshold, min_instances, max_instances |
| `AutoScaleHistory` | auto_scale_history | rule_id, action, previous_count, current_count, metric_value, result |

---

## 七、MCP 工具协议

### 服务层类型

| 类型 | 用途 | 关键字段 |
|------|------|---------|
| `RiskLevel` | 风险等级 | `'READONLY' \| 'LOW' \| 'MEDIUM' \| 'HIGH' \| 'DESTRUCTIVE'` |
| `ToolSecurityAnnotations` | 安全注解 | readOnlyHint, destructiveHint, idempotentHint, riskLevel, requiresApproval |
| `JsonRpcRequest` | JSON-RPC 请求 | jsonrpc, id, method, params |
| `JsonRpcResponse` | JSON-RPC 响应 | jsonrpc, id, result, error |
| `ToolDefinition` | 工具定义 | name, description, inputSchema, annotations |
| `RegisteredTool` | 注册工具 | name, title, description, inputSchema, domain, handler, annotations |
| `ToolCallResult` | 调用结果 | tool, content[], structuredContent, isError |
| `McpManifest` | 服务清单 | name, title, version, auth, rateLimit, tools |

---

## 八、容器与虚拟机

### 数据库表类型

| 类型 | 表 | 关键字段 |
|------|-----|---------|
| `VirtualMachine` | virtual_machines | id, name, host, status, os, cpu_cores, memory_mb, hypervisor, agent_id |
| `Container` | containers | id, container_id, name, image, status, host, port_mappings |
| `ContainerImage` | container_images | image_id, name, tag, size_bytes, host |
| `StorageVolume` | storage_volumes | name, driver, mount_point, size_gb, used_gb, status |
| `ComposeProject` | compose_projects | name, compose_content, status, service_count, running_count |
| `ImageRegistry` | image_registries | name, type, url, encrypted_password, status |
| `DockerEndpoint` | docker_endpoints | name, host, port, protocol, tls_ca, status |
| `VmMigration` | vm_migrations | vm_id, source_host, target_host, platform_id, status, progress |
| `VmSnapshotPolicy` | vm_snapshot_policies | name, platform_id, vm_id, cron_expression, retention |
| `VmPlatform` | vm_platforms | name, hypervisor_type, host, encrypted_password, status |
| `VmAuditLog` | vm_audit_logs | platform_id, vm_id, operation, status, started_at |

### 服务层类型 — VM 管理

| 类型 | 用途 | 关键字段/值 |
|------|------|------------|
| `HypervisorType` | 虚拟化平台 | `'vmware' \| 'kvm' \| 'proxmox' \| 'hyperv' \| 'ovirt' \| 'cloud'` |
| `VMStatus` | VM 状态 | `'running' \| 'stopped' \| 'paused' \| 'suspended' \| 'unknown'` |
| `VMPowerState` | 电源状态 | `'poweredOn' \| 'poweredOff' \| 'suspended' \| 'unknown'` |
| `VMStats` | VM 统计 | cpuUsagePercent, memoryUsagePercent, diskUsageBytes, networkTxBytes, uptimeSeconds |
| `VMSnapshot` | 快照 | name, createdAt, sizeBytes, isCurrent, parentId, childrenIds |
| `VMTemplate` | 模板 | name, hypervisorType, guestOs, memoryMB, numCPUs, disks |
| `HypervisorHost` | 主机 | name, hypervisorType, status, cpuModel, numCpus, memoryTotalMB, numVMs |
| `Datastore` | 数据存储 | name, type (`'vmfs'\|'nfs'\|'iscsi'\|'local'`), capacityBytes, freeBytes |
| `VirtualNetwork` | 虚拟网络 | name, type (`'standard'\|'distributed'\|'bridge'\|'ovs'`), vlanId |

---

## 九、数据中心

### 数据库表类型

| 类型 | 表 | 关键字段 |
|------|-----|---------|
| `DcRoom` | dc_rooms | name, label, width_m, depth_m, max_temperature, pue |
| `DcRack` | dc_racks | room_id, name, label, row_number, position_x, position_z, total_u, max_power_w |
| `DcRackSlot` | dc_rack_slots | rack_id, device_id, device_type, start_u, end_u, position_face |
| `DcDeviceLifecycle` | dc_device_lifecycle | device_id, action, from_rack_id, to_rack_id |
| `DcPdu` | dc_pdus | rack_id, type, power_capacity_w, current_load_w, input_voltage |
| `DeviceManufacturer` | device_manufacturers | name, slug, logo_url |
| `DeviceType` | device_types | manufacturer_id, model, slug, part_number, u_height, is_full_depth |
| `DcPowerPanel` | dc_power_panels | room_id, panel_type, voltage, amperage, phase_count |
| `DcPowerFeed` | dc_power_feeds | power_panel_id, rack_id, feed_type, voltage, amperage, current_load_w |
| `DcCable` | dc_cables | cable_type, cable_color, length_m, a_device_id, b_device_id |

---

## 十、网络设备

### 数据库表类型

| 类型 | 表 | 关键字段 |
|------|-----|---------|
| `NetworkDevice` | network_devices | id, name, ip_address, vendor, model, ssh_port, status, snmp_enabled |
| `NetworkInspectionHistory` | network_inspection_history | device_id, inspection_type, status, commands_executed, results |
| `NetworkConfigBackup` | network_config_backups | device_id, config_md5, config_text, config_size, status |
| `NetworkLldpNeighbor` | network_lldp_neighbors | device_id, local_interface, remote_device_name, remote_mgmt_ip |
| `NetworkTopologyLink` | network_topology_links | deviceA_id, deviceB_id, deviceA_interface, deviceB_interface |
| `SnmpCredential` | snmp_credentials | name, community, snmp_version, snmp_port, snmp_user |
| `SnmpTrapEvent` | snmp_trap_events | source_ip, trap_type, enterprise_oid, generic_type, specific_type |
| `SnmpPollingTask` | snmp_polling_tasks | device_id, poll_interval_seconds, poll_items, enabled |
| `SnmpInterfaceMetric` | snmp_interface_metrics | device_id, if_index, if_name, in_octets, out_octets, in_utilization |
| `NetworkDiscoveryJob` | network_discovery_jobs | name, start_ip, end_ip, status, progress, found_devices |
| `NetworkSubnet` | network_subnets | name, cidr, gateway, vlan_id, network_type, total_ips |
| `NetworkIp` | network_ips | subnet_id, ip_address, status, device_id, mac_address |

### 服务层类型 — 厂商适配器

| 类型 | 用途 | 关键字段/值 |
|------|------|------------|
| `VendorType` | 厂商类型 | `'huawei' \| 'cisco' \| 'h3c' \| 'ruijie' \| 'zte' \| 'fortinet' \| 'paloalto' \| 'juniper' \| 'arista' \| 'hpe' \| 'mikrotik' \| 'ubiquiti' \| 'dell' \| 'tplink' \| 'f5' \| 'ruijie_eg'` |
| `DeviceType` | 设备类型 | `'switch' \| 'router' \| 'firewall' \| 'loadbalancer' \| 'wlc' \| 'ap' \| 'gateway' \| 'unknown'` |
| `InspectionType` | 巡检类型 | 见 [核心枚举速查](#核心枚举速查) |
| `CommandTemplate` | 命令模板 | type, name, command, fallbackCommands, thresholds, minFirmware |

---

## 十一、系统基础设施

### 数据库表类型

| 类型 | 表 | 关键字段 |
|------|-----|---------|
| `Script` | scripts | name, description, category, language, content, tags |
| `Report` | reports | name, type, content, format, template_id, is_preset |
| `ReportSchedule` | report_schedules | template_id, cron_expression, enabled, recipients, format |
| `Setting` | settings | key, value |
| `AuditLog` | audit_logs | user_id, action, resource_type, resource_id, ip_address |
| `ToolLink` | tool_links | name, url, icon, category, image_icon, sort_order, is_external |
| `Notification` | notifications | type, title, content, status, recipient, related_alert_id, related_task_id |
| `NotificationConfig` | notification_configs | webhook_enabled, email_enabled, wechat_enabled, dingtalk_enabled |
| `ApprovalRequest` | approval_requests | task_id, node_id, node_label, status, approved_by, timeout_at, timeout_action |
| `ConfigTemplate` | config_templates | name, type, category, service_name, template_content, os_type, target_type, version |
| `ConfigTemplateHistory` | config_template_history | template_id, server_id, status, backup_path, result |

---

## 十二、其他模块

### database

| 类型 | 表 | 关键字段 |
|------|-----|---------|
| `DatabaseConnection` | database_connections | name, type, host, port, username, database_name, ssl_enabled, status |

### kubernetes

| 类型 | 表 | 关键字段 |
|------|-----|---------|
| `K8sContext` | k8s_contexts | name, cluster_url, namespace, auth_type, config, status, node_count, pod_count |

### change-management

| 类型 | 表 | 关键字段 |
|------|-----|---------|
| `ChangeRecord` | change_records | server_id, change_type, description, changed_by, status |

### monitor

| 类型 | 表 | 关键字段 |
|------|-----|---------|
| `BaselineMetric` | baseline_metrics | device_id, metric_name, sample_value, sampled_at |

### backup

| 类型 | 表 | 关键字段 |
|------|-----|---------|
| `BackupInfo` | 备份记录 | filename, filePath, size, type (`'auto'\|'manual'`), status, checksum |
| `BackupConfig` | 备份配置 | enabled, intervalHours, keepLast, compression, verifyAfterBackup |

---

## 核心枚举速查

### 状态枚举

| 枚举 | 所在文件 | 值 |
|------|---------|-----|
| `EdgeAgentStatus` | modules/ai/services/edge/types.ts | OFFLINE, CONNECTING, ONLINE, ERROR |
| `AgentType` | modules/ai/services/multiAgent/types.ts | COORDINATOR, SPECIALIST |
| `TaskStatus` | modules/ai/services/multiAgent/types.ts | PENDING, IN_PROGRESS, COMPLETED, FAILED, DELEGATED |
| `RiskLevel` | modules/mcp/services/types.ts | READONLY, LOW, MEDIUM, HIGH, DESTRUCTIVE |

### 专业领域

| 枚举 | 值 |
|------|-----|
| `SpecialistDomain` | ALERT_HANDLING, FAULT_DIAGNOSIS, LOG_ANALYSIS, SYSTEM_INSPECTION, CHANGE_EXECUTION, DOCUMENT_GENERATION, COMPLIANCE_CHECK, SERVER_OPERATION, NETWORK_INSPECTION, DATABASE_OPERATION, COMMAND_GENERATION |

### 审批/决策

| 概念 | 值 |
|------|-----|
| `ApprovalStatus` | pending, approved, rejected, timedout, not_needed |
| `DecisionAction` | auto_execute, request_approval, escalate_to_human, block |
| `VerificationResult` | passed, failed, partially_passed_with_warning |

### 虚拟化

| 枚举 | 值 |
|------|-----|
| `HypervisorType` | vmware, kvm, proxmox, hyperv, ovirt, cloud |
| `VMStatus` | running, stopped, paused, suspended, unknown |
| `VMPowerState` | poweredOn, poweredOff, suspended, unknown |

### 网络设备

| 枚举 | 值 |
|------|-----|
| `VendorType` | huawei, cisco, h3c, ruijie, zte, fortinet, paloalto, juniper, arista, hpe, mikrotik, ubiquiti, dell, tplink, f5, ruijie_eg |
| `DeviceType` | switch, router, firewall, loadbalancer, wlc, ap, gateway, unknown |
| `SnmpVersion` | v1, v2c, v3 |

### Agent 名称常量

| 常量 | 值 |
|------|-----|
| `AGENT_NAMES.SERVER_COMMAND` | 服务器命令执行 |
| `AGENT_NAMES.SYSTEM_INSPECTION` | 系统巡检 |
| `AGENT_NAMES.AUTO_INSPECTION` | 自动巡检 |
| `AGENT_NAMES.COMPLIANCE_CHECK` | 合规检查 |
| `AGENT_NAMES.ALERT_HANDLER` | 告警处理 |
| `AGENT_NAMES.FAULT_DIAGNOSIS` | 故障诊断 |
| `AGENT_NAMES.LOG_ANALYSIS` | 日志分析 |
| `AGENT_NAMES.CHANGE_EXECUTION` | 变更执行 |
| `AGENT_NAMES.DOC_GENERATION` | 文档生成 |
| `AGENT_NAMES.DATABASE_ADMIN` | 数据库运维 |

### 角色

| 角色 | 说明 |
|------|------|
| `viewer` | 只读，被大多数危险命令 blocked |
| `operator` | 操作员，被 filesystem_destructive / network_destructive / process_kill 等 blocked |
| `admin` | 管理员，仅被 system_critical (mkfs/fdisk/reboot/shutdown) blocked |

---

## 类型文件路径索引

| 分层 | 路径 |
|------|------|
| 数据库表类型（统一入口） | `repositories/types/index.ts` |
| 数据库表类型（17 个模块文件） | `repositories/types/` 下的各个文件 |
| 共享领域类型 | `types/index.ts` |
| 错误码 | `types/errors.ts` |
| 统一告警处理 | `types/unified-alert-processing.ts` |
| VM 管理类型 | `types/vmManagement.ts` |
| 配置修复类型 | `types/configRepair.ts` |
| Agent 名称常量 | `constants/agentNames.ts` |
| AARS v2 类型 | `modules/alerts/services/alertAutoResponse/types.ts` |
| MultiAgent 类型 | `modules/ai/services/multiAgent/types.ts` |
| Edge Agent 类型 | `modules/ai/services/edge/types.ts` |
| Provider 类型 | `modules/ai/services/providers/types.ts` |
| RCA 类型 | `modules/ai/services/rca/rootCauseAnalysisService/rcaTypes.ts` |
| 工作流 DSL 类型 | `modules/workflow/services/types.ts` |
| 增强节点类型 | `modules/workflow/services/enhancedNodeTypes.ts` |
| 工作流执行器类型 | `modules/workflow/services/workflowExecutor/types.ts` |
| SNMP 类型 | `modules/network/services/snmpTypes.ts` |
| 厂商适配器类型 | `modules/network/services/vendorAdapter/types.ts` |
| MCP 类型 | `modules/mcp/services/types.ts` |
| 修复服务类型 | `modules/auto/services/remediationService/types.ts` |
| SSH 类型 | `modules/servers/services/sshService/sshTypes.ts` |
| VM 适配器类型 | `modules/containers/services/vmManagement/vmAdapter.ts` |