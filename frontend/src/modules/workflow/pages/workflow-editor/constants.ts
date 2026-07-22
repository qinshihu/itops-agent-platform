/**
 * useWorkflowEditor 常量（2026-07-21 拆分）
 *
 * 把原 useWorkflowEditor.ts L203-210 的 NON_CORE_DEFAULTS 抽出
 * 注：审批节点默认 config 留在 dropHandlers（更紧凑）
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 4 + lessons-learned §3.5
 */

export interface NonCoreNodeDefault {
  label: string;
  description: string;
  data: Record<string, unknown>;
}

/** 6 类流程控制节点默认配置（condition / loop / parallel / http / notify / delay） */
export const NON_CORE_NODE_DEFAULTS: Record<string, NonCoreNodeDefault> = {
  condition: {
    label: '条件分支',
    description: '',
    data: { expression: '{{status}} == "ok"', defaultBranch: 'false', allowFailure: true },
  },
  loop: {
    label: '循环',
    description: '',
    data: {
      sourceKey: 'items',
      maxIterations: 100,
      currentItemKey: 'item',
      currentIndexKey: 'index',
      allowFailure: true,
    },
  },
  parallel: {
    label: '并行分支',
    description: '',
    data: { maxConcurrency: 5, waitAll: true, timeoutMs: 300000, allowFailure: true },
  },
  http: {
    label: 'HTTP 请求',
    description: '',
    data: { url: '', method: 'GET', headers: '', body: '', timeoutMs: 30000, allowFailure: true },
  },
  notify: {
    label: '通知',
    description: '',
    data: {
      channel: 'wechat',
      severity: 'info',
      title: '',
      message: '',
      recipients: '',
      allowFailure: true,
    },
  },
  delay: {
    label: '延时/等待',
    description: '',
    data: { durationMs: 5000, waitCondition: '', allowFailure: true },
  },
};

/** history 队列最大长度（超出后 shift 最早项） */
export const MAX_HISTORY = 50;

/** 时间戳前缀用作 ReactFlow 节点 id（避免重复） */
export const NODE_ID_PREFIX = 'node-' as const;
