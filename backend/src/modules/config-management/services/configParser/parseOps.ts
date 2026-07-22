/**
 * configParser 解析子模块（2026-07-21 拆分）
 *
 * 把原 configParser.ts L21-249 的 5 个解析方法抽出：
 * - parse: 公开入口，按行循环构建 blocks + 处理嵌套关系
 * - parseLine: 内部 dispatch（按 template.parser 选 nginx/sysctl/sshd/generic）
 * - parseNginxLine / parseSysctlLine / parseSshdLine / parseGenericLine: 4 个具体解析器
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import type { ConfigBlock, ConfigTemplate } from './types';
import { getIndentLevel, generateId } from './utils';

/** 解析配置文件内容（公开入口） */
export function parse(template: ConfigTemplate, content: string): ConfigBlock[] {
  const lines = content.split('\n');
  const blocks: ConfigBlock[] = [];
  const stack: ConfigBlock[] = [];
  let lineNumber = 0;

  for (const rawLine of lines) {
    lineNumber++;
    const line = rawLine.trimEnd();

    if (line.trim() === '') {
      blocks.push({
        id: generateId(),
        type: 'empty',
        lineNumber,
        rawContent: line,
        indentLevel: getIndentLevel(rawLine),
      });
      continue;
    }

    if (line.trim().startsWith('#') || line.trim().startsWith(';')) {
      blocks.push({
        id: generateId(),
        type: 'comment',
        lineNumber,
        rawContent: line,
        indentLevel: getIndentLevel(rawLine),
      });
      continue;
    }

    const block = parseLine(template, rawLine, lineNumber);

    // 处理嵌套块
    while (stack.length > 0 && stack[stack.length - 1].indentLevel >= block.indentLevel) {
      stack.pop();
    }

    if (stack.length > 0) {
      if (!stack[stack.length - 1].children) {
        stack[stack.length - 1].children = [];
      }
      stack[stack.length - 1].children!.push(block);
    } else {
      blocks.push(block);
    }

    if (block.type === 'block' && !stack.find((b) => b.id === block.id)) {
      stack.push(block);
    }
  }

  return blocks;
}

/** parseLine dispatch（按 template.parser 选具体解析器） */
export function parseLine(template: ConfigTemplate, rawLine: string, lineNumber: number): ConfigBlock {
  const indentLevel = getIndentLevel(rawLine);

  // 根据解析器类型处理
  switch (template.parser) {
    case 'nginx':
      return parseNginxLine(template, rawLine, lineNumber, indentLevel);
    case 'sysctl':
      return parseSysctlLine(template, rawLine, lineNumber, indentLevel);
    case 'sshd':
      return parseSshdLine(template, rawLine, lineNumber, indentLevel);
    default:
      return parseGenericLine(template, rawLine, lineNumber, indentLevel);
  }
}

/** 解析 Nginx 格式 */
export function parseNginxLine(
  _template: ConfigTemplate,
  rawLine: string,
  lineNumber: number,
  indentLevel: number,
): ConfigBlock {
  const line = rawLine.trim();

  // 块开始
  if (line.includes('{') && !line.startsWith('#')) {
    const match = line.match(/^(\w+)\s*(.*?)\s*\{/);
    if (match) {
      return {
        id: generateId(),
        type: 'block',
        lineNumber,
        rawContent: rawLine,
        key: match[1],
        value: match[2] || undefined,
        indentLevel,
        children: [],
      };
    }
  }

  // 块结束
  if (line === '}') {
    return {
      id: generateId(),
      type: 'block',
      lineNumber,
      rawContent: rawLine,
      indentLevel,
    };
  }

  // 键值对
  if (line.endsWith(';')) {
    const parts = line.slice(0, -1).trim().split(/\s+/);
    if (parts.length >= 2) {
      return {
        id: generateId(),
        type: 'keyValue',
        lineNumber,
        rawContent: rawLine,
        key: parts[0],
        value: parts.slice(1).join(' '),
        indentLevel,
      };
    }
  }

  // 默认
  return {
    id: generateId(),
    type: 'keyValue',
    lineNumber,
    rawContent: rawLine,
    indentLevel,
  };
}

/** 解析 Sysctl 格式（key = value 形式） */
export function parseSysctlLine(
  _template: ConfigTemplate,
  rawLine: string,
  lineNumber: number,
  indentLevel: number,
): ConfigBlock {
  const line = rawLine.trim();

  if (line.includes('=')) {
    const [key, ...valueParts] = line.split('=');
    return {
      id: generateId(),
      type: 'keyValue',
      lineNumber,
      rawContent: rawLine,
      key: key.trim(),
      value: valueParts.join('=').trim(),
      indentLevel,
    };
  }

  return {
    id: generateId(),
    type: 'keyValue',
    lineNumber,
    rawContent: rawLine,
    indentLevel,
  };
}

/** 解析 SSHD 格式（空格分隔 key value） */
export function parseSshdLine(
  _template: ConfigTemplate,
  rawLine: string,
  lineNumber: number,
  indentLevel: number,
): ConfigBlock {
  const line = rawLine.trim();
  const parts = line.split(/\s+/);

  if (parts.length >= 2) {
    return {
      id: generateId(),
      type: 'keyValue',
      lineNumber,
      rawContent: rawLine,
      key: parts[0],
      value: parts.slice(1).join(' '),
      indentLevel,
    };
  }

  return {
    id: generateId(),
    type: 'keyValue',
    lineNumber,
    rawContent: rawLine,
    indentLevel,
  };
}

/** 通用解析（尝试常见分隔符 =, :, 空格） */
export function parseGenericLine(
  _template: ConfigTemplate,
  rawLine: string,
  lineNumber: number,
  indentLevel: number,
): ConfigBlock {
  const line = rawLine.trim();

  // 尝试常见分隔符
  const separators = ['=', ':', ' '];
  for (const sep of separators) {
    const index = line.indexOf(sep);
    if (index > 0 && index < line.length - 1) {
      return {
        id: generateId(),
        type: 'keyValue',
        lineNumber,
        rawContent: rawLine,
        key: line.slice(0, index).trim(),
        value: line.slice(index + 1).trim(),
        indentLevel,
      };
    }
  }

  return {
    id: generateId(),
    type: 'keyValue',
    lineNumber,
    rawContent: rawLine,
    indentLevel,
  };
}
