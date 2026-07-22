/**
 * ToolLinks 常量与 icon 映射（2026-07-21 拆分）
 *
 * 把原 ToolLinks.tsx L3-114 的：
 * - 41 个 lucide-react icons imports
 * - ICON_OPTIONS（icon name 列表）
 * - iconMap（icon name → Lucide component 映射）
 * - ToolIcon（icon name → JSX element lookup 组件）
 * 全部抽出
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */

import {
  ExternalLink,
  Globe,
  Monitor,
  Activity,
  Shield,
  BarChart3,
  LineChart,
  Bell,
  Database,
  Terminal,
  Cloud,
  Lock,
  Radio,
  Server,
  Layers,
  BookOpen,
  MessageSquare,
  Clock,
  MapPin,
  GitBranch,
  Play,
  Zap,
  Users,
  Network,
  Key,
  FileSearch,
  FileText,
  FileCode,
  Wrench,
} from 'lucide-react';
import type React from 'react';

/** icon 名字列表（用作 icon 选择 UI） */
export const ICON_OPTIONS: ReadonlyArray<string> = [
  'ExternalLink',
  'Globe',
  'Monitor',
  'Activity',
  'Shield',
  'BarChart3',
  'LineChart',
  'Bell',
  'Database',
  'Terminal',
  'Cloud',
  'Lock',
  'Radio',
  'Server',
  'Layers',
  'BookOpen',
  'MessageSquare',
  'Clock',
  'MapPin',
  'GitBranch',
  'Play',
  'Zap',
  'Users',
  'Network',
  'Key',
  'FileSearch',
  'FileText',
  'FileCode',
  'Wrench',
];

/** icon name → Lucide React component 映射 */
export const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ExternalLink,
  Globe,
  Wrench,
  Monitor,
  Activity,
  Shield,
  BarChart3,
  LineChart,
  Bell,
  Database,
  Terminal,
  Cloud,
  Lock,
  Radio,
  Server,
  Layers,
  BookOpen,
  MessageSquare,
  Clock,
  MapPin,
  GitBranch,
  Play,
  Zap,
  Users,
  Network,
  Key,
  FileSearch,
  FileText,
  FileCode,
};

/** 默认 fallback icon */
export const DEFAULT_ICON = ExternalLink;
