/**
 * WorkflowProviders 类型定义（2026-07-21 拆分）
 *
 * 把原 WorkflowProviders.tsx L20-72 的类型 + 常量抽出：
 * - WorkflowProvider：API 返回的 provider schema
 * - ProviderTestResult：测试执行结果
 * - TYPE_CONFIG：4 种类型的颜色/icon/label 常量
 * - TypeKey：TYPE_CONFIG 的 key 类型
 *
 * 拆分原则遵循 architecture.md §3.4.1 + 第 3 条「向后兼容的 import 路径」
 */
import { Bell, Play, FileCode, AlertTriangle } from 'lucide-react';

export interface WorkflowProvider {
  id: string;
  name: string;
  type: 'alert' | 'notification' | 'action' | 'script';
  configSchema: {
    type: 'object';
    properties: Record<
      string,
      { type?: string; description?: string; enum?: unknown[]; [key: string]: unknown }
    >;
    required?: string[];
  };
}

export interface ProviderTestResult {
  success: boolean;
  result?: string;
  error?: string;
}

export const TYPE_CONFIG = {
  notification: {
    label: '通知',
    icon: Bell,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
  },
  action: {
    label: '动作',
    icon: Play,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
  },
  script: {
    label: '脚本',
    icon: FileCode,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
  },
  alert: {
    label: '告警',
    icon: AlertTriangle,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
  },
} as const;

export type TypeKey = keyof typeof TYPE_CONFIG;
