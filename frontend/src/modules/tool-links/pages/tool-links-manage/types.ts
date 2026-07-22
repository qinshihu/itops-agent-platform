/**
 * 工具链接管理 - 类型定义
 *
 * 从原 infra/pages/tool-links-manage/types.ts 抽离（2026-07-08 增量-12）。
 */

export interface ToolLink {
  id: string;
  name: string;
  url: string;
  icon: string;
  image_icon: string | null;
  category: string;
  description: string | null;
  sort_order: number;
  is_external: number;
  created_at: string;
  updated_at: string;
}

export interface ToolLinkFormData {
  name: string;
  url: string;
  icon: string;
  category: string;
  description: string;
  sort_order: number;
  is_external: boolean;
}

export const ICON_OPTIONS = [
  'ExternalLink', 'Globe', 'Monitor', 'Activity', 'Shield', 'BarChart3',
  'LineChart', 'Bell', 'Database', 'Terminal', 'Cloud', 'Lock', 'Radio',
  'Server', 'Layers', 'BookOpen', 'MessageSquare', 'Clock', 'MapPin',
  'GitBranch', 'Play', 'Zap', 'Users', 'Network', 'Key', 'FileSearch',
  'FileText', 'FileCode', 'Wrench', 'Cog', 'Search', 'AlertTriangle',
];

export const EMPTY_FORM: ToolLinkFormData = {
  name: '',
  url: '',
  icon: 'ExternalLink',
  category: '未分类',
  description: '',
  sort_order: 0,
  is_external: true,
};
