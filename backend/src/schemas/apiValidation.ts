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
