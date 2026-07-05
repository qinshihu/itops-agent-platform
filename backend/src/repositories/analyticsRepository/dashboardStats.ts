/**
 * dashboardStats — 仪表盘概览 / 告警趋势 / 任务趋势 / Agent 统计 / 任务分布 / 完整仪表盘
 * 对应 dashboardRoutes.ts
 */

import db from '../../models/database';
import type {
  AnalyticsRow,
  DashboardStats,
  AlertTrendPoint,
  TaskTrendPoint,
  AgentStatsResult,
  AgentStatItem,
  TaskDistribution,
  FullDashboard,
} from './types';

/** 仪表盘概览统计 */
export function getDashboardStats(): DashboardStats {
  const serverStats = db.prepare('SELECT COUNT(*) as total, SUM(enabled) as enabled FROM servers').get() as { total: number; enabled: number } | undefined;
  const agentStats = db.prepare('SELECT COUNT(*) as total, SUM(enabled) as enabled FROM agents').get() as { total: number; enabled: number } | undefined;
  const taskStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
    FROM tasks
  `).get() as { total: number; running: number; completed: number; failed: number; pending: number } | undefined;
  const alertStats = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) as active,
      SUM(CASE WHEN severity = 'critical' AND status = 'new' THEN 1 ELSE 0 END) as critical,
      SUM(CASE WHEN severity = 'high' AND status = 'new' THEN 1 ELSE 0 END) as high
    FROM alerts
  `).get() as { total: number; active: number; critical: number; high: number } | undefined;
  const workflowCount = db.prepare('SELECT COUNT(*) as total, SUM(is_template) as templates FROM workflows').get() as { total: number; templates: number } | undefined;
  const knowledgeCount = db.prepare('SELECT COUNT(*) as total FROM knowledge_base').get() as { total: number } | undefined;

  const successRate = (taskStats?.total || 0) > 0
    ? parseFloat((((taskStats?.completed || 0) / (taskStats?.total || 1)) * 100).toFixed(1))
    : 0;

  return {
    servers: { total: serverStats?.total || 0, enabled: serverStats?.enabled || 0 },
    agents: { total: agentStats?.total || 0, enabled: agentStats?.enabled || 0 },
    tasks: {
      total: taskStats?.total || 0,
      running: taskStats?.running || 0,
      completed: taskStats?.completed || 0,
      failed: taskStats?.failed || 0,
      pending: taskStats?.pending || 0,
      successRate,
    },
    alerts: {
      total: alertStats?.total || 0,
      active: alertStats?.active || 0,
      critical: alertStats?.critical || 0,
      high: alertStats?.high || 0,
    },
    workflows: { total: workflowCount?.total || 0, templates: workflowCount?.templates || 0 },
    knowledge: { total: knowledgeCount?.total || 0 },
  };
}

/** 告警趋势（按小时聚合） */
export function getAlertTrends(hours: number): AlertTrendPoint[] {
  return db.prepare(`
    SELECT
      strftime('%Y-%m-%d %H:00:00', created_at) as time_bucket,
      COUNT(*) as total,
      SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) as critical,
      SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) as high,
      SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) as medium,
      SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) as low
    FROM alerts
    WHERE created_at >= datetime('now', ? || ' hours')
    GROUP BY time_bucket
    ORDER BY time_bucket ASC
  `).all(`-${hours}`) as AlertTrendPoint[];
}

/** 任务趋势（按小时聚合） */
export function getTaskTrends(hours: number): TaskTrendPoint[] {
  return db.prepare(`
    SELECT
      strftime('%Y-%m-%d %H:00:00', created_at) as time_bucket,
      COUNT(*) as total,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as running
    FROM tasks
    WHERE created_at >= datetime('now', ? || ' hours')
    GROUP BY time_bucket
    ORDER BY time_bucket ASC
  `).all(`-${hours}`) as TaskTrendPoint[];
}

/** Agent 统计（含执行次数和成功率） */
export function getAgentStats(): AgentStatsResult {
  const agents = db.prepare(`
    SELECT
      a.id, a.name, a.avatar, a.role, a.enabled, a.usage_count,
      (SELECT COUNT(*) FROM agent_executions ae WHERE ae.agent_id = a.id) as total_executions,
      (SELECT COUNT(*) FROM agent_executions ae WHERE ae.agent_id = a.id AND ae.status = 'success') as success_count,
      (SELECT COUNT(*) FROM agent_executions ae WHERE ae.agent_id = a.id AND ae.status = 'error') as error_count
    FROM agents a
    ORDER BY a.usage_count DESC
  `).all() as Array<{ total_executions?: number; success_count?: number; [key: string]: unknown }>;

  const agentsWithRates: AgentStatItem[] = agents.map(a => ({
    ...(a as unknown as AgentStatItem),
    successRate: (a.total_executions || 0) > 0
      ? parseFloat((((a.success_count || 0) / (a.total_executions || 1)) * 100).toFixed(1))
      : null,
  }));

  const totalExecutions = agentsWithRates.reduce((sum, a) => sum + (a.total_executions || 0), 0);
  const totalSuccess = agentsWithRates.reduce((sum, a) => sum + (a.success_count || 0), 0);
  const overallSuccessRate = totalExecutions > 0
    ? parseFloat(((totalSuccess / totalExecutions) * 100).toFixed(1))
    : 0;

  const todayExecutions = db.prepare(`
    SELECT COUNT(*) as count FROM agent_executions
    WHERE created_at >= datetime('now', 'start of day')
  `).get() as { count: number } | undefined;

  return {
    agents: agentsWithRates,
    overall: {
      totalExecutions,
      totalSuccess,
      overallSuccessRate,
      todayExecutions: todayExecutions?.count || 0,
    },
  };
}

/** 任务分布（按状态 + 按工作流） */
export function getTaskDistribution(): TaskDistribution {
  const byStatus = db.prepare(`
    SELECT status, COUNT(*) as count FROM tasks GROUP BY status
  `).all() as Array<{ status: string; count: number }>;

  const byWorkflow = db.prepare(`
    SELECT w.name, COUNT(*) as count
    FROM tasks t
    JOIN workflows w ON t.workflow_id = w.id
    GROUP BY t.workflow_id
    ORDER BY count DESC
    LIMIT 10
  `).all() as Array<{ name: string; count: number }>;

  return { byStatus, byWorkflow };
}

/** 完整仪表盘（stats + 最近任务/告警 + 服务器列表） */
export function getFullDashboard(): FullDashboard {
  const stats = getDashboardStats();

  const recentTasks = db.prepare(`
    SELECT id, name, status, created_at, workflow_id, execution_order, node_results, current_node_id
    FROM tasks ORDER BY created_at DESC LIMIT 10
  `).all() as Array<AnalyticsRow>;

  const recentAlerts = db.prepare(`
    SELECT id, title, severity, status, created_at
    FROM alerts WHERE status = 'new' ORDER BY created_at DESC LIMIT 10
  `).all() as Array<AnalyticsRow>;

  const servers = db.prepare('SELECT id, name, hostname, enabled, last_connected FROM servers ORDER BY name').all() as Array<AnalyticsRow>;

  return {
    stats,
    recentTasks,
    recentAlerts,
    servers,
  };
}
