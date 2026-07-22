/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * configParser 主类（2026-07-21 拆分后精简版）
 *
 * 拆分后行为：
 * - 把原 547 行单类 ConfigParser 拆为：
 *   - parseOps.ts（解析层：parse + parseLine + 4 个 parseXxxLine）
 *   - analyzeOps.ts（验证层：analyze + analyzeNginx/Sysctl/Sshd）
 *   - utils.ts（flattenBlocks + generateNewLine + getIndentLevel + generateId）
 *   - types.ts（类型 barrel）
 *   - index.ts（barrel export）
 * - 主类保留方法签名 100% 兼容，1-line delegate 转发到子模块
 * - 外部 `import { ConfigParser } from './configParser'` 仍兼容
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 * P1-5 抽象满足：主类不直接访问 repositories（详见 configRepair/detection.ts 协调）
 */

import type { ConfigBlock, ConfigIssue, ConfigTemplate } from './configParser/types';
import {
  parse as parseFn,
  parseLine as parseLineFn,
  parseNginxLine as parseNginxLineFn,
  parseSysctlLine as parseSysctlLineFn,
  parseSshdLine as parseSshdLineFn,
  parseGenericLine as parseGenericLineFn,
} from './configParser/parseOps';
import {
  analyze as analyzeFn,
  analyzeNginx as analyzeNginxFn,
  analyzeSysctl as analyzeSysctlFn,
  analyzeSshd as analyzeSshdFn,
} from './configParser/analyzeOps';
import {
  flattenBlocks as flattenBlocksFn,
  generateNewLine as generateNewLineFn,
  getIndentLevel as getIndentLevelFn,
  generateId as generateIdFn,
} from './configParser/utils';

export class ConfigParser {
  private template: ConfigTemplate;

  constructor(template: ConfigTemplate) {
    this.template = template;
  }

  /**
   * 解析配置文件内容
   * 2026-07-21 拆分：委托给 configParser/parseOps
   */
  parse(content: string): ConfigBlock[] {
    return parseFn(this.template, content);
  }

  /**
   * 解析单行（按 template.parser dispatch）
   * 2026-07-21 拆分：委托给 configParser/parseOps
   */
  private parseLine(rawLine: string, lineNumber: number): ConfigBlock {
    return parseLineFn(this.template, rawLine, lineNumber);
  }

  private parseNginxLine(rawLine: string, lineNumber: number, indentLevel: number): ConfigBlock {
    return parseNginxLineFn(this.template, rawLine, lineNumber, indentLevel);
  }

  private parseSysctlLine(rawLine: string, lineNumber: number, indentLevel: number): ConfigBlock {
    return parseSysctlLineFn(this.template, rawLine, lineNumber, indentLevel);
  }

  private parseSshdLine(rawLine: string, lineNumber: number, indentLevel: number): ConfigBlock {
    return parseSshdLineFn(this.template, rawLine, lineNumber, indentLevel);
  }

  private parseGenericLine(rawLine: string, lineNumber: number, indentLevel: number): ConfigBlock {
    return parseGenericLineFn(this.template, rawLine, lineNumber, indentLevel);
  }

  /**
   * 分析配置问题
   * 2026-07-21 拆分：委托给 configParser/analyzeOps
   */
  analyze(blocks: ConfigBlock[]): ConfigIssue[] {
    return analyzeFn(this.template, blocks);
  }

  private analyzeNginx(blocks: ConfigBlock[]): ConfigIssue[] {
    return analyzeNginxFn(blocks);
  }

  private analyzeSysctl(blocks: ConfigBlock[]): ConfigIssue[] {
    return analyzeSysctlFn(blocks);
  }

  private analyzeSshd(blocks: ConfigBlock[]): ConfigIssue[] {
    return analyzeSshdFn(blocks);
  }

  /**
   * 扁平化所有块
   * 2026-07-21 拆分：委托给 configParser/utils
   */
  private flattenBlocks(blocks: ConfigBlock[]): ConfigBlock[] {
    return flattenBlocksFn(blocks);
  }

  /**
   * 应用变更并生成新配置
   * 2026-07-21 拆分：内联到主类（依赖 generateNewLine）
   */
  applyChanges(content: string, changes: any[]): string {
    const lines = content.split('\n');

    for (const change of changes) {
      if (change.type === 'modify' && change.lineNumber) {
        const idx = change.lineNumber - 1;
        if (lines[idx] !== undefined) {
          lines[idx] = this.generateNewLine(lines[idx], change);
        }
      } else if (change.type === 'add') {
        // 添加新行逻辑
      } else if (change.type === 'delete' && change.lineNumber) {
        // 删除行逻辑
      }
    }

    return lines.join('\n');
  }

  /**
   * 生成新行
   * 2026-07-21 拆分：委托给 configParser/utils
   */
  private generateNewLine(oldLine: string, change: any): string {
    return generateNewLineFn(this.template, oldLine, change);
  }

  private getIndentLevel(line: string): number {
    return getIndentLevelFn(line);
  }

  private generateId(): string {
    return generateIdFn();
  }
}
