import { z } from 'zod';

export const authSchemas = {
  login: z.object({
    username: z.string().min(1, '用户名不能为空').max(64),
    password: z.string().min(1, '密码不能为空').max(128),
  }),
  register: z.object({
    username: z.string().min(2, '用户名至少2个字符').max(64),
    password: z.string().min(8, '密码至少8个字符').max(128),
    email: z.string().email('邮箱格式不正确').max(255),
    role: z.enum(['admin', 'operator', 'viewer']).default('viewer'),
  }),
};

export const serverSchemas = {
  createServer: z.object({
    name: z.string().min(1, '服务器名称不能为空').max(100),
    hostname: z.string().min(1, '主机名不能为空').max(255),
    port: z.coerce.number().int().min(1).max(65535).default(22),
    username: z.string().min(1, '用户名不能为空').max(64),
    password: z.string().max(255).optional(),
    private_key: z.string().optional(),
    use_ssh_key: z.coerce.number().int().min(0).max(1).default(0),
    description: z.string().max(500).optional(),
    os_type: z.enum(['linux', 'windows', 'unknown']).default('linux'),
    tags: z.array(z.string()).optional(),
    ssh_key_id: z.string().uuid().optional(),
  }),
  updateServer: z.object({
    name: z.string().min(1).max(100).optional(),
    hostname: z.string().min(1).max(255).optional(),
    port: z.coerce.number().int().min(1).max(65535).optional(),
    username: z.string().min(1).max(64).optional(),
    password: z.string().max(255).optional(),
    use_ssh_key: z.coerce.number().int().min(0).max(1).optional(),
    description: z.string().max(500).optional(),
    enabled: z.coerce.number().int().min(0).max(1).optional(),
    os_type: z.enum(['linux', 'windows', 'unknown']).optional(),
    tags: z.array(z.string()).optional(),
    ssh_key_id: z.string().uuid().optional(),
  }),
  serverId: z.object({
    id: z.string().uuid('无效的服务器ID'),
  }),
};

export const alertSchemas = {
  updateAlert: z.object({
    status: z.enum(['new', 'confirmed', 'in_progress', 'resolved', 'resolved_auto', 'ignored']),
    assigned_to: z.string().uuid().optional(),
    notes: z.string().max(2000).optional(),
  }),
  alertId: z.object({
    id: z.string().uuid('无效的告警ID'),
  }),
};

export const taskSchemas = {
  taskId: z.object({
    id: z.string().uuid('无效的任务ID'),
  }),
  createTask: z.object({
    name: z.string().min(1, '任务名称不能为空').max(200),
    workflow_id: z.string().uuid('无效的工作流ID'),
    input_data: z.record(z.unknown()).optional(),
  }),
};

export const workflowSchemas = {
  workflowId: z.object({
    id: z.string().uuid('无效的工作流ID'),
  }),
  createWorkflow: z.object({
    name: z.string().min(1, '工作流名称不能为空').max(200),
    description: z.string().max(1000).optional(),
    nodes: z.string().min(2, '节点配置不能为空'),
    edges: z.string().default('[]'),
    is_template: z.coerce.number().int().min(0).max(1).default(0),
  }),
};

export const agentSchemas = {
  agentId: z.object({
    id: z.string().uuid('无效的Agent ID'),
  }),
  createAgent: z.object({
    name: z.string().min(1, 'Agent名称不能为空').max(100),
    avatar: z.string().max(100).default('🤖'),
    role: z.string().max(100).optional(),
    system_prompt: z.string().max(5000).optional(),
    model: z.string().max(100).default('doubao-4o'),
    temperature: z.coerce.number().min(0).max(2).default(0.7),
    enabled: z.coerce.number().int().min(0).max(1).default(1),
    category: z.string().max(50).optional().nullable(),
    tags: z.array(z.string()).optional(),
    description: z.string().max(500).optional().nullable(),
    api_provider: z.string().max(50).default('doubao'),
    primary_model_id: z.string().uuid().optional().nullable(),
    fallback_model_id: z.string().uuid().optional().nullable(),
  }),
  updateAgent: z.object({
    name: z.string().min(1, 'Agent名称不能为空').max(100).optional(),
    avatar: z.string().max(100).optional(),
    role: z.string().max(100).optional(),
    system_prompt: z.string().max(5000).optional(),
    model: z.string().max(100).optional(),
    temperature: z.coerce.number().min(0).max(2).optional(),
    enabled: z.coerce.number().int().min(0).max(1).optional(),
    category: z.string().max(50).optional().nullable(),
    tags: z.array(z.string()).optional(),
    description: z.string().max(500).optional().nullable(),
    api_provider: z.string().max(50).optional(),
    primary_model_id: z.string().uuid().optional().nullable(),
    fallback_model_id: z.string().uuid().optional().nullable(),
  }),
  testAgent: z.object({
    input: z.string().min(1, '测试输入不能为空'),
    serverId: z.string().uuid().optional(),
    serverIds: z.array(z.string().uuid()).optional(),
    context: z.record(z.unknown()).optional(),
    databaseId: z.string().uuid().optional(),
  }),
  listExecutions: z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().min(0).default(0),
    status: z.string().optional(),
  }),
  importAgents: z.object({
    agents: z.array(z.object({
      name: z.string().min(1, 'Agent名称不能为空').max(100),
      avatar: z.string().max(100).default('🤖'),
      role: z.string().max(100).optional(),
      system_prompt: z.string().max(5000).optional(),
      model: z.string().max(100).default('doubao-4o'),
      temperature: z.coerce.number().min(0).max(2).default(0.7),
      enabled: z.coerce.boolean().default(true),
      category: z.string().max(50).optional(),
      tags: z.array(z.string()).optional(),
      description: z.string().max(500).optional(),
    })),
  }),
  testTool: z.object({
    toolId: z.string().min(1, '工具ID不能为空'),
    args: z.record(z.unknown()).optional(),
  }),
  listAgentsQuery: z.object({
    category: z.string().optional(),
    enabled: z.enum(['true', 'false']).optional(),
    search: z.string().optional(),
  }),
};

export const remediationSchemas = {
  createPolicy: z.object({
    name: z.string().min(1, '策略名称不能为空').max(200),
    description: z.string().max(1000).optional(),
    alert_severity: z.string().min(1).max(20),
    alert_title_pattern: z.string().max(500).optional(),
    alert_source: z.string().max(100).optional(),
    alert_keywords: z.string().max(1000).optional(),
    alert_tags: z.string().max(1000).optional(),
    workflow_id: z.string().uuid('无效的工作流ID'),
    execution_mode: z.enum(['auto', 'manual', 'approve_first']),
    cooldown_minutes: z.coerce.number().int().min(0).max(1440).default(30),
    max_executions_per_day: z.coerce.number().int().min(1).max(1000).default(10),
    enabled: z.coerce.number().int().min(0).max(1).default(1),
    auto_verify: z.coerce.number().int().min(0).max(1).default(0),
    verify_workflow_id: z.string().uuid().optional(),
    rollback_workflow_id: z.string().uuid().optional(),
  }),
  policyId: z.object({
    id: z.string().uuid('无效的策略ID'),
  }),
  approveExecution: z.object({
    approved: z.boolean(),
    reason: z.string().max(500).optional(),
  }),
};

// ── 通用校验 Schema ──
export const commonSchemas = {
  idParam: z.object({
    id: z.string().uuid('无效的ID'),
  }),
};

// ── 变更管理校验 Schema ──
export const changeSchemas = {
  createChange: z.object({
    server_id: z.string().uuid('无效的服务器ID'),
    change_type: z.string().min(1, '变更类型不能为空').max(50),
    description: z.string().max(2000).optional(),
    changed_by: z.string().max(64).optional(),
    status: z.enum(['pending', 'approved', 'rejected', 'executing', 'completed', 'failed', 'rolled_back']).optional(),
    related_alert_id: z.string().uuid().optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
};

// ── 备份管理校验 Schema ──
export const backupSchemas = {
  updateConfig: z.object({
    enabled: z.boolean().optional(),
    schedule: z.string().max(100).optional(),
    retentionDays: z.coerce.number().int().min(1).max(365).optional(),
    encryptBackups: z.boolean().optional(),
    includeAttachments: z.boolean().optional(),
  }),
};

// ── 服务器分组校验 Schema ──
export const serverGroupSchemas = {
  createGroup: z.object({
    name: z.string().min(1, '分组名称不能为空').max(100),
    description: z.string().max(500).optional(),
    parent_id: z.string().uuid().optional().nullable(),
    sort_order: z.coerce.number().int().min(0).default(0),
  }),
  updateGroup: z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional().nullable(),
    parent_id: z.string().uuid().optional().nullable(),
    sort_order: z.coerce.number().int().min(0).optional(),
  }),
  moveGroup: z.object({
    new_parent_id: z.string().uuid().optional().nullable(),
    sort_order: z.coerce.number().int().min(0).optional(),
  }),
  groupMapping: z.object({
    server_id: z.string().uuid('无效的服务器ID'),
    group_id: z.string().uuid('无效的分组ID'),
  }),
  groupId: z.object({
    id: z.string().uuid('无效的分组ID'),
  }),
};

// ── 告警创建与 Provider 配置校验 Schema ──
export const alertCreateSchemas = {
  createAlert: z.object({
    source: z.string().max(100).default('unknown'),
    severity: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
    title: z.string().min(1, '告警标题不能为空').max(500),
    content: z.string().max(10000).optional(),
    metadata: z.record(z.unknown()).optional(),
    related_task_id: z.string().uuid().optional(),
  }),
  createProviderConfig: z.object({
    provider_id: z.string().min(1, 'Provider ID 不能为空').max(100),
    name: z.string().min(1, '配置名称不能为空').max(100),
    config: z.record(z.unknown()).optional(),
    enabled: z.coerce.boolean().optional(),
  }),
  updateProviderConfig: z.object({
    name: z.string().min(1).max(100).optional(),
    config: z.record(z.unknown()).optional(),
    enabled: z.coerce.boolean().optional(),
  }),
  fetchAlerts: z.object({
    providerId: z.string().min(1, 'Provider ID 不能为空').max(100),
    config: z.record(z.unknown()).optional(),
  }),
};

// ── 告警工作流映射校验 Schema ──
export const alertMappingSchemas = {
  createMapping: z.object({
    alert_source: z.string().max(100).optional(),
    alert_severity: z.string().max(50).optional(),
    alert_title_pattern: z.string().max(500).optional(),
    workflow_id: z.string().uuid('无效的工作流ID'),
    enabled: z.coerce.number().int().min(0).max(1).default(1),
  }),
  updateMapping: z.object({
    alert_source: z.string().max(100).optional(),
    alert_severity: z.string().max(50).optional(),
    alert_title_pattern: z.string().max(500).optional(),
    workflow_id: z.string().uuid().optional(),
    enabled: z.coerce.number().int().min(0).max(1).optional(),
  }),
  mappingId: z.object({
    id: z.string().uuid('无效的映射ID'),
  }),
};

// ── 定时任务校验 Schema ──
export const scheduledTaskSchemas = {
  createTask: z.object({
    name: z.string().min(1, '任务名称不能为空').max(200),
    description: z.string().max(1000).optional(),
    workflow_id: z.string().uuid('无效的工作流ID').optional(),
    schedule: z.string().max(100).optional(),
    cron_expression: z.string().max(100).optional(),
    enabled: z.coerce.number().int().min(0).max(1).default(1),
  }),
  updateTask: z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    workflow_id: z.string().uuid().optional(),
    schedule: z.string().max(100).optional(),
    cron_expression: z.string().max(100).optional(),
    enabled: z.coerce.number().int().min(0).max(1).optional(),
  }),
  taskId: z.object({
    id: z.string().uuid('无效的定时任务ID'),
  }),
};

// ── 服务器命令校验 Schema ──
export const serverCommandSchemas = {
  execCommand: z.object({
    command: z.string().min(1, '命令不能为空').max(10000),
    timeout: z.coerce.number().int().min(1000).max(300000).optional(),
  }),
};

// ── 服务器导入校验 Schema ──
export const serverImportSchemas = {
  importServer: z.object({
    name: z.string().min(1, '服务器名称不能为空').max(100),
    hostname: z.string().min(1, '主机名不能为空').max(255),
    port: z.coerce.number().int().min(1).max(65535).default(22),
    username: z.string().min(1, '用户名不能为空').max(64),
    password: z.string().max(255).optional(),
    private_key: z.string().optional(),
    use_ssh_key: z.coerce.number().int().min(0).max(1).default(0),
    description: z.string().max(500).optional(),
    tags: z.array(z.string()).optional(),
    group_id: z.string().uuid().optional(),
  }),
  importServers: z.object({
    servers: z.array(z.object({
      name: z.string().min(1, '服务器名称不能为空').max(100),
      hostname: z.string().min(1, '主机名不能为空').max(255),
      port: z.coerce.number().int().min(1).max(65535).default(22),
      username: z.string().min(1, '用户名不能为空').max(64),
      password: z.string().max(255).optional(),
      private_key: z.string().optional(),
      use_ssh_key: z.coerce.number().int().min(0).max(1).default(0),
      description: z.string().max(500).optional(),
      tags: z.array(z.string()).optional(),
      group_id: z.string().uuid().optional(),
    })).min(1, '请提供至少一个服务器'),
    test_connection: z.coerce.boolean().default(true),
  }),
};

// ── AARS 配置校验 Schema ──
export const aarsSchemas = {
  updateConfig: z.object({
    enabled: z.coerce.boolean().optional(),
    min_severity: z.string().optional(),
    auto_execute_enabled: z.coerce.boolean().optional(),
    approval_timeout_minutes: z.coerce.number().int().min(1).optional(),
    max_concurrent: z.coerce.number().int().min(1).optional(),
    ssh_timeout_sec: z.coerce.number().int().min(1).optional(),
    verify_interval_sec: z.coerce.number().int().min(1).optional(),
  }),
};

// ── 工作流创建/更新补充 Schema ──
// (createWorkflow 已定义，这里补充 update 和 import)
export const workflowExtendedSchemas = {
  updateWorkflow: z.object({
    name: z.string().min(1, '工作流名称不能为空').max(200).optional(),
    description: z.string().max(1000).optional(),
    nodes: z.array(z.unknown()).optional(),
    edges: z.array(z.unknown()).optional(),
    agent_configs: z.record(z.unknown()).optional(),
    is_template: z.coerce.number().int().min(0).max(1).optional(),
  }),
  importWorkflow: z.object({
    workflow: z.object({
      name: z.string().min(1, '工作流名称不能为空').max(200),
      description: z.string().max(1000).optional(),
      nodes: z.array(z.unknown()).optional(),
      edges: z.array(z.unknown()).optional(),
      agent_configs: z.record(z.unknown()).optional(),
    }),
  }),
};

// ── 任务干预校验 Schema ──
export const taskExtendedSchemas = {
  intervene: z.object({
    node_id: z.string().min(1, '节点ID不能为空'),
    action: z.enum(['skip', 'modify']),
    data: z.unknown().optional(),
  }),
};


// ── MCP 审批流程 schemas（v4 修复，approvalFlow.ts 引用但原本未导出） ──

export const mcpApprovalSchemas = {
  createTicket: z.object({
    toolName: z.string().min(1).max(100),
    userId: z.string().min(1).max(100),
    reason: z.string().max(500).optional(),
    ttlMs: z.number().int().min(1000).max(24 * 60 * 60 * 1000).optional(),
  }),
  approveTicket: z.object({
    ticketId: z.string().min(1).max(100),
    approverId: z.string().min(1).max(100),
  }),
  registerExternalServer: z.object({
    id: z.string().min(1).max(100),
    name: z.string().min(1).max(100),
    endpoint: z.string().url().max(500),
    apiKey: z.string().optional(),
  }),
  externalServerId: z.object({
    id: z.string().min(1).max(100),
  }),
};

// ── 告警降噪 schemas（v4 修复，alertNoiseRoutes.ts 引用但原本未导出） ──

export const alertNoiseSchemas = {
  unsuppress: z.object({
    fingerprint: z.string().min(1).max(200),
  }),
  suppress: z.object({
    fingerprint: z.string().min(1).max(200),
    reason: z.string().min(1).max(500),
    durationMinutes: z.number().int().min(1).max(30 * 24 * 60).optional(),
  }),
  cleanup: z.object({
    daysToKeep: z.number().int().min(1).max(365).optional(),
  }),
};

// ── Prometheus 主动查询 schemas（2026-07-22 修复，prometheusRoutes.ts 引用但原本未导出） ──

const prometheusClientOptions = z.object({
  url: z.string().url('Prometheus URL 必须为合法 URL'),
  basicAuth: z
    .object({
      username: z.string().min(1).max(100),
      password: z.string().max(500),
    })
    .optional(),
  bearerToken: z.string().max(2000).optional(),
  timeoutMs: z.number().int().min(1000).max(60000).optional(),
});

export const prometheusSchemas = {
  base: prometheusClientOptions,
  query: prometheusClientOptions.extend({
    promql: z.string().min(1, 'PromQL 不能为空').max(2000),
    time: z.string().max(50).optional(),
  }),
  queryRange: prometheusClientOptions.extend({
    promql: z.string().min(1).max(2000),
    start: z.union([z.string().max(50), z.number()]),
    end: z.union([z.string().max(50), z.number()]),
    step: z.union([z.string().max(50), z.number()]),
  }),
  series: prometheusClientOptions.extend({
    match: z.array(z.string().min(1).max(500)).min(1).max(50),
    start: z.string().max(50).optional(),
    end: z.string().max(50).optional(),
  }),
};

// ── Zabbix 主动查询 schemas（2026-07-22 修复，zabbixRoutes.ts 引用但原本未导出） ──

const zabbixClientOptions = z.object({
  url: z.string().url('Zabbix API URL 必须为合法 URL'),
  apiToken: z.string().min(1).max(2000).optional(),
  timeoutMs: z.number().int().min(1000).max(60000).optional(),
});

export const zabbixSchemas = {
  test: zabbixClientOptions,
  hosts: zabbixClientOptions.extend({
    filter: z.record(z.unknown()).optional(),
  }),
  items: zabbixClientOptions.extend({
    hostIds: z.array(z.string().min(1).max(100)).optional(),
    itemIds: z.array(z.string().min(1).max(100)).optional(),
    output: z.enum(['extend', 'shorten']).optional(),
    filter: z.record(z.unknown()).optional(),
  }),
  history: zabbixClientOptions.extend({
    itemIds: z.array(z.string().min(1).max(100)).min(1).max(100),
    timeFrom: z.union([z.string().max(50), z.number()]),
    timeTill: z.union([z.string().max(50), z.number()]),
    history: z.number().int().min(0).max(10).optional(),
    limit: z.number().int().min(1).max(10000).optional(),
  }),
  triggers: zabbixClientOptions.extend({
    triggerIds: z.array(z.string().min(1).max(100)).optional(),
    hostIds: z.array(z.string().min(1).max(100)).optional(),
    output: z.enum(['extend', 'shorten']).optional(),
    filter: z.record(z.unknown()).optional(),
    onlyActive: z.boolean().optional(),
  }),
  problems: zabbixClientOptions.extend({
    hostIds: z.array(z.string().min(1).max(100)).optional(),
    severity: z.array(z.number().int().min(0).max(10)).optional(),
    recent: z.boolean().optional(),
    limit: z.number().int().min(1).max(10000).optional(),
  }),
};

// ── 告警关联 schemas（v4 修复，alertCorrelationRoutes.ts 引用但原本未导出） ──

export const alertCorrelationSchemas = {
  createGroup: z.object({
    alert_ids: z.array(z.string().min(1).max(100)).min(2).max(100),
    title: z.string().min(1).max(200),
  }),
};
