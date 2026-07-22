/**
 * Agent 工具页 - 共享类型 + 常量配置
 * v2.1（2026-07-21）：从 AgentToolsPage.tsx 拆分
 *
 * 包含：
 * - AgentTool / ToolTestResult / ToolHistoryItem 类型
 * - CATEGORY_CONFIG / FALLBACK_CATEGORY_CONFIG / RISK_CONFIG
 * - getCategoryConfig(category) 工具函数
 * - parseToolArg(type, value) —— P2-9：把字符串按 schema 类型转换为真实类型
 */

import {
  Wrench,
  Terminal,
  Server,
  Container,
  Cpu,
  Network,
  Database,
  Bell,
  type LucideIcon,
} from 'lucide-react';

// ============================================================
// 类型定义
// ============================================================

export type AgentToolCategory =
  | 'ssh'
  | 'docker'
  | 'kubernetes'
  | 'system'
  | 'network'
  | 'database'
  | 'alerts';

export type AgentToolRiskLevel = 'readonly' | 'low' | 'medium' | 'high' | 'destructive';

export interface AgentTool {
  id: string;
  name: string;
  description: string;
  category: AgentToolCategory | string;
  riskLevel?: AgentToolRiskLevel;
  schema: {
    type: 'object';
    properties: Record<string, { type?: string; description?: string; [key: string]: unknown }>;
    required?: string[];
  };
}

export interface ToolTestResult {
  success: boolean;
  result?: string;
  error?: string;
}

export interface ToolHistoryItem {
  id: string;
  toolId: string;
  toolName: string;
  args: Record<string, unknown>;
  success: boolean;
  resultPreview: string;
  timestamp: number;
}

// ============================================================
// 类别配置（图标 + 颜色 + 中文标签）
// ============================================================

export interface CategoryConfig {
  label: string;
  icon: LucideIcon;
  color: string;
  bg: string;
  border: string;
}

export const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  ssh: {
    label: 'SSH/远程',
    icon: Terminal,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  system: {
    label: '系统/主机',
    icon: Server,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
  },
  docker: {
    label: '容器',
    icon: Container,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
  },
  kubernetes: {
    label: 'Kubernetes',
    icon: Cpu,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
  },
  network: {
    label: '网络',
    icon: Network,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
  },
  database: {
    label: '数据库',
    icon: Database,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
  },
  alerts: {
    label: '告警',
    icon: Bell,
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
  },
};

// P1-6（v2 2026-07-21）：兜底配置，避免后端返回未知 category 时 UI 崩溃
export const FALLBACK_CATEGORY_CONFIG: CategoryConfig = {
  label: '其他',
  icon: Wrench,
  color: 'text-gray-400',
  bg: 'bg-gray-500/10',
  border: 'border-gray-500/30',
};

export type CategoryKey = keyof typeof CATEGORY_CONFIG;

/** 安全地获取 category 配置：未知 category 自动兜底 */
export function getCategoryConfig(category: string): CategoryConfig {
  return CATEGORY_CONFIG[category] ?? FALLBACK_CATEGORY_CONFIG;
}

// ============================================================
// 风险等级配置（与后端 AgentToolRiskLevel 一一对应）
// ============================================================

export interface RiskConfig {
  label: string;
  color: string;
  bg: string;
  order: number;
}

export const RISK_CONFIG: Record<AgentToolRiskLevel, RiskConfig> = {
  readonly: { label: '只读', color: 'text-green-400', bg: 'bg-green-500/10', order: 0 },
  low: { label: '低风险', color: 'text-blue-400', bg: 'bg-blue-500/10', order: 1 },
  medium: { label: '中风险', color: 'text-yellow-400', bg: 'bg-yellow-500/10', order: 2 },
  high: { label: '高风险', color: 'text-orange-400', bg: 'bg-orange-500/10', order: 3 },
  destructive: { label: '破坏性', color: 'text-red-400', bg: 'bg-red-500/10', order: 4 },
};

// ============================================================
// P2-9（v2.1 2026-07-21）：testArgs 类型化工具函数
// ============================================================

/**
 * 根据 schema 类型把字符串值转换为真实类型
 *
 * | schema.type | 输入 | 输出 |
 * |---|---|---|
 * | 'boolean' | 'true' / 'false' / '' | true / false / undefined |
 * | 'number' / 'integer' | '123' / 'abc' | 123 / undefined（保留原值） |
 * | 'object' / 'array' | '{"a":1}' / '[1,2]' | 解析后的对象 / undefined（保留原值） |
 * | 其他 / 未指定 | 'hello' | 'hello' |
 *
 * 空字符串视为未填写，返回 undefined。
 */
export function parseToolArg(
  type: string | undefined,
  value: string | unknown,
): unknown {
  if (value === '' || value === undefined || value === null) return undefined;

  // 已是真实类型（动态编辑器返回），直接返回
  if (typeof value !== 'string') return value;

  switch (type) {
    case 'boolean': {
      const lower = value.toLowerCase();
      if (lower === 'true') return true;
      if (lower === 'false') return false;
      return undefined; // 不合法
    }
    case 'number':
    case 'integer': {
      const n = Number(value);
      return Number.isFinite(n) ? n : undefined;
    }
    case 'object':
    case 'array': {
      try {
        return JSON.parse(value);
      } catch {
        return undefined; // 不合法
      }
    }
    default:
      return value;
  }
}

/**
 * 把当前 testArgs 状态批量转换为真实类型对象（用于提交前）
 * 必填校验失败的字段会保留为 undefined，由调用方决定如何处理
 */
export function buildToolArgs(
  schema: AgentTool['schema'],
  testArgs: Record<string, unknown>,
): Record<string, unknown> {
  const props = schema.properties || {};
  const result: Record<string, unknown> = {};
  for (const [key, propSchema] of Object.entries(props)) {
    const type = (propSchema as { type?: string }).type;
    const raw = testArgs[key];
    if (raw === undefined || raw === '') continue;
    const parsed = parseToolArg(type, raw);
    if (parsed !== undefined) {
      result[key] = parsed;
    } else {
      // 类型不合法：保留原始字符串，让后端报错更清晰
      result[key] = raw;
    }
  }
  return result;
}