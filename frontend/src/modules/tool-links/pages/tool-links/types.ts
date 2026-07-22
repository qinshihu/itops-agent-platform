/**
 * ToolLinks 类型定义（2026-07-21 拆分）
 *
 * 把原 ToolLinks.tsx 中的表单状态类型抽出
 * 注：ToolLink 类型仍在 api.ts 中（属于 API 契约）
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */

export type FormMode = 'create' | 'edit' | null;

export interface ToolLinkFormData {
  name: string;
  url: string;
  icon: string;
  category: string;
  description: string;
  sort_order: number;
  is_external: boolean;
}

export const DEFAULT_FORM_DATA: ToolLinkFormData = {
  name: '',
  url: '',
  icon: 'ExternalLink',
  category: '未分类',
  description: '',
  sort_order: 0,
  is_external: true,
};

export interface CategoryGroup {
  category: string;
  tools: import('../../api').ToolLink[];
}
