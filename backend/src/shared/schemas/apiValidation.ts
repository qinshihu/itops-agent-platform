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
