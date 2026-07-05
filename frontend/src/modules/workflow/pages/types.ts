/** 共享类型定义 — Tasks 模块 */

export interface TaskLogEntry {
  type: string;
  content: string;
  timestamp: Date;
}

export interface TaskDisplay {
  id: string;
  name: string;
  workflow_id: string;
  status: string;
  start_time: string;
  end_time: string;
  current_node_id: string;
  node_results?: Record<string, Record<string, unknown>>;
  logs: TaskLogEntry[];
  created_at: string;
  execution_order?: string[];
  report_id?: string;
}

export interface WorkflowDisplay {
  id: string;
  name: string;
  nodes: Record<string, unknown>[];
}

export interface Report {
  id: string;
  name: string;
  content: string;
  created_at: string;
  format?: string;
  task_id?: string;
}

/**
 * 解析任务的 JSON 字段（execution_order、node_results、logs）
 * API 返回的字段可能是 JSON 字符串，需要解析为对象/数组
 */
export function parseTaskData(raw: Record<string, unknown>): Record<string, unknown> {
  const parsed = { ...raw };

  for (const field of ['execution_order', 'node_results']) {
    if (typeof parsed[field] === 'string') {
      try {
        parsed[field] = JSON.parse(parsed[field] as string);
      } catch {
        parsed[field] = undefined;
      }
    }
  }

  return parsed;
}

/** 解析任务的日志字段 */
export function parseTaskLogs(raw: Record<string, unknown>): TaskLogEntry[] {
  const logs = raw.logs;

  if (Array.isArray(logs)) {
    return (logs as TaskLogEntry[]).map(log => ({
      ...log,
      timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
    }));
  }

  if (typeof logs === 'string') {
    try {
      const jsonLogs = JSON.parse(logs);
      if (Array.isArray(jsonLogs)) {
        return jsonLogs.map((log: TaskLogEntry) => ({
          ...log,
          timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
        }));
      }
    } catch {
      // parse failure, return empty
    }
  }

  return [];
}
