/**
 * 标签（Tag）相关的纯函数工具
 *
 * 从 useServerActions 抽出，使其更易测试。
 */

export interface TagInputHandlers {
  formTags: string;
  setFormTags: (next: string) => void;
  tagInputRef: React.RefObject<HTMLInputElement | null>;
}

/**
 * 解析当前输入框的标签列表
 */
export function parseCurrentTags(formTags: string): string[] {
  if (!formTags) return [];
  return formTags.split(',').map((t) => t.trim()).filter(Boolean);
}

/**
 * 获取最后一个未完成的标签片段（用于自动补全）
 */
export function getLastTagFragment(formTags: string): string {
  if (!formTags) return '';
  const lastCommaIndex = formTags.lastIndexOf(',');
  return lastCommaIndex >= 0
    ? formTags.substring(lastCommaIndex + 1).trim()
    : formTags.trim();
}

/**
 * 添加标签到输入框（替换最后一个片段）
 */
export function appendTagToInput(
  formTags: string,
  tag: string
): string {
  const lastCommaIndex = formTags.lastIndexOf(',');
  const beforeLast = lastCommaIndex >= 0 ? formTags.substring(0, lastCommaIndex + 1) : '';
  return beforeLast + tag + ', ';
}

/**
 * 从输入框移除指定标签
 */
export function removeTagFromInput(formTags: string, tagToRemove: string): string {
  const current = parseCurrentTags(formTags);
  return current.filter((t) => t !== tagToRemove).join(', ');
}

/**
 * 过滤标签建议（排除已选 + 按片段匹配）
 */
export function filterTagSuggestions(
  allTags: string[],
  currentTags: string[],
  fragment: string
): string[] {
  return allTags.filter((tag) => {
    if (currentTags.includes(tag)) return false;
    if (fragment) return tag.toLowerCase().includes(fragment.toLowerCase());
    return true;
  });
}