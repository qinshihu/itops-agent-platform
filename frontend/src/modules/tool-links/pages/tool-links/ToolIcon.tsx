/**
 * ToolLink ToolIcon helper component（2026-07-21 拆分）
 *
 * 从原 ToolLinks.tsx L116-119 抽出
 * 用于在 UI 上显示用户配置的 icon（dynamic）
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */

import { ICON_MAP, DEFAULT_ICON } from './constants';

export interface ToolIconProps {
  iconName: string;
  className?: string;
}

/**
 * 通用 icon 渲染器
 * 根据 iconName 查表找 Lucide component，找不到 fallback 为 ExternalLink
 */
export function ToolIcon({ iconName, className }: ToolIconProps) {
  const Icon = ICON_MAP[iconName] || DEFAULT_ICON;
  return <Icon className={className || 'w-5 h-5'} />;
}
