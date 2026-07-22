/**
 * configParser 通用工具子模块（2026-07-21 拆分）
 *
 * 把原 configParser.ts L463-545 的 4 个 helper 抽出：
 * - flattenBlocks: 块树扁平化
 * - generateNewLine: 生成修改后的配置行（按 template.parser 分发 nginx/sysctl/sshd）
 * - getIndentLevel: 缩进级别计算（tab=4 / space=1）
 * - generateId: 块 ID 生成
 *
 * 这些 helper 在原类中是 private，主类通过 1-line delegate 调用
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import type { ConfigBlock, ConfigTemplate } from './types';

/** 扁平化所有 keyValue blocks */
export function flattenBlocks(blocks: ConfigBlock[]): ConfigBlock[] {
  const result: ConfigBlock[] = [];

  for (const block of blocks) {
    if (block.type === 'keyValue') {
      result.push(block);
    }
    if (block.children) {
      result.push(...flattenBlocks(block.children));
    }
  }

  return result;
}

/** 生成新行（按 template.parser 分发 nginx/sysctl/sshd） */
export function generateNewLine(
  template: ConfigTemplate,
  oldLine: string,
  change: { newValue?: string; key?: string },
): string {
  const indent = oldLine.match(/^\s*/)?.[0] || '';

  switch (template.parser) {
    case 'nginx':
      if (change.newValue) {
        return `${indent}${change.key} ${change.newValue};`;
      }
      return oldLine;
    case 'sysctl':
      if (change.newValue) {
        return `${indent}${change.key} = ${change.newValue}`;
      }
      return oldLine;
    case 'sshd':
      if (change.newValue) {
        return `${indent}${change.key} ${change.newValue}`;
      }
      return oldLine;
    default:
      if (change.newValue) {
        return `${indent}${change.key} ${change.newValue}`;
      }
      return oldLine;
  }
}

/** 获取缩进级别（tab=4 字符，space=1 字符） */
export function getIndentLevel(line: string): number {
  const match = line.match(/^(\s*)/);
  if (!match) return 0;
  let indent = 0;
  for (const char of match[1]) {
    indent += char === '\t' ? 4 : 1;
  }
  return Math.floor(indent / 4);
}

/** 生成块 ID（短随机字符串） */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}
