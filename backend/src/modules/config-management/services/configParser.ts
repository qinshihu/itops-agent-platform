/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * =============================================================================
 * 配置文件解析器
 * 支持 Nginx、Sysctl、SSH 等常见配置格式
 * =============================================================================
 */

import type { ConfigBlock, ConfigIssue, ConfigTemplate } from '../../../types/configRepair';

export class ConfigParser {
  private template: ConfigTemplate;

  constructor(template: ConfigTemplate) {
    this.template = template;
  }

  /**
   * 解析配置文件内容
   */
  parse(content: string): ConfigBlock[] {
    const lines = content.split('\n');
    const blocks: ConfigBlock[] = [];
    const stack: ConfigBlock[] = [];
    let lineNumber = 0;

    for (const rawLine of lines) {
      lineNumber++;
      const line = rawLine.trimEnd();
      
      if (line.trim() === '') {
        blocks.push({
          id: this.generateId(),
          type: 'empty',
          lineNumber,
          rawContent: line,
          indentLevel: this.getIndentLevel(rawLine),
        });
        continue;
      }

      if (line.trim().startsWith('#') || line.trim().startsWith(';')) {
        blocks.push({
          id: this.generateId(),
          type: 'comment',
          lineNumber,
          rawContent: line,
          indentLevel: this.getIndentLevel(rawLine),
        });
        continue;
      }

      const block = this.parseLine(rawLine, lineNumber);
      
      // 处理嵌套块
      while (stack.length > 0 && stack[stack.length - 1].indentLevel >= block.indentLevel) {
        stack.pop();
      }

      if (stack.length > 0) {
        const parent = stack[stack.length - 1];
        parent.children = parent.children || [];
        parent.children.push(block);
        block.parentId = parent.id;
      } else {
        blocks.push(block);
      }

      // 如果是块开始，压入栈
      if (block.type === 'block' && rawLine.includes('{')) {
        stack.push(block);
      }

      // 如果是块结束，弹出栈
      if (rawLine.trim() === '}') {
        stack.pop();
      }
    }

    return blocks;
  }

  /**
   * 解析单行
   */
  private parseLine(rawLine: string, lineNumber: number): ConfigBlock {
    const _line = rawLine.trim();
    const indentLevel = this.getIndentLevel(rawLine);

    // 根据解析器类型处理
    switch (this.template.parser) {
      case 'nginx':
        return this.parseNginxLine(rawLine, lineNumber, indentLevel);
      case 'sysctl':
        return this.parseSysctlLine(rawLine, lineNumber, indentLevel);
      case 'sshd':
        return this.parseSshdLine(rawLine, lineNumber, indentLevel);
      default:
        return this.parseGenericLine(rawLine, lineNumber, indentLevel);
    }
  }

  /**
   * 解析 Nginx 格式
   */
  private parseNginxLine(rawLine: string, lineNumber: number, indentLevel: number): ConfigBlock {
    const line = rawLine.trim();
    
    // 块开始
    if (line.includes('{') && !line.startsWith('#')) {
      const match = line.match(/^(\w+)\s*(.*?)\s*\{/);
      if (match) {
        return {
          id: this.generateId(),
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
        id: this.generateId(),
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
          id: this.generateId(),
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
      id: this.generateId(),
      type: 'keyValue',
      lineNumber,
      rawContent: rawLine,
      indentLevel,
    };
  }

  /**
   * 解析 Sysctl 格式
   */
  private parseSysctlLine(rawLine: string, lineNumber: number, indentLevel: number): ConfigBlock {
    const line = rawLine.trim();
    
    if (line.includes('=')) {
      const [key, ...valueParts] = line.split('=');
      return {
        id: this.generateId(),
        type: 'keyValue',
        lineNumber,
        rawContent: rawLine,
        key: key.trim(),
        value: valueParts.join('=').trim(),
        indentLevel,
      };
    }

    return {
      id: this.generateId(),
      type: 'keyValue',
      lineNumber,
      rawContent: rawLine,
      indentLevel,
    };
  }

  /**
   * 解析 SSHD 格式
   */
  private parseSshdLine(rawLine: string, lineNumber: number, indentLevel: number): ConfigBlock {
    const line = rawLine.trim();
    const parts = line.split(/\s+/);
    
    if (parts.length >= 2) {
      return {
        id: this.generateId(),
        type: 'keyValue',
        lineNumber,
        rawContent: rawLine,
        key: parts[0],
        value: parts.slice(1).join(' '),
        indentLevel,
      };
    }

    return {
      id: this.generateId(),
      type: 'keyValue',
      lineNumber,
      rawContent: rawLine,
      indentLevel,
    };
  }

  /**
   * 解析通用格式
   */
  private parseGenericLine(rawLine: string, lineNumber: number, indentLevel: number): ConfigBlock {
    const line = rawLine.trim();
    
    // 尝试常见分隔符
    const separators = ['=', ':', ' '];
    for (const sep of separators) {
      const index = line.indexOf(sep);
      if (index > 0 && index < line.length - 1) {
        return {
          id: this.generateId(),
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
      id: this.generateId(),
      type: 'keyValue',
      lineNumber,
      rawContent: rawLine,
      indentLevel,
    };
  }

  /**
   * 分析配置问题
   */
  analyze(blocks: ConfigBlock[]): ConfigIssue[] {
    const issues: ConfigIssue[] = [];

    switch (this.template.parser) {
      case 'nginx':
        issues.push(...this.analyzeNginx(blocks));
        break;
      case 'sysctl':
        issues.push(...this.analyzeSysctl(blocks));
        break;
      case 'sshd':
        issues.push(...this.analyzeSshd(blocks));
        break;
    }

    return issues;
  }

  /**
   * Nginx 配置分析
   */
  private analyzeNginx(blocks: ConfigBlock[]): ConfigIssue[] {
    const issues: ConfigIssue[] = [];
    const keyValues = this.flattenBlocks(blocks);

    // worker_processes 检查
    const workerProcesses = keyValues.find(kv => kv.key === 'worker_processes');
    if (workerProcesses) {
      const value = workerProcesses.value || '';
      if (value === '1' || (parseInt(value) < 2 && value !== 'auto')) {
        issues.push({
          id: this.generateId(),
          severity: 'medium',
          type: 'performance',
          rule: 'nginx-worker-processes',
          description: 'worker_processes 设置过低，建议设置为 auto 或 CPU 核心数',
          lineNumber: workerProcesses.lineNumber,
          key: workerProcesses.key,
          currentValue: value,
          suggestedValue: 'auto',
          fixable: true,
        });
      }
    } else {
      issues.push({
        id: this.generateId(),
        severity: 'medium',
        type: 'bestPractice',
        rule: 'nginx-worker-processes-missing',
        description: '缺少 worker_processes 配置',
        fixable: true,
      });
    }

    // worker_connections 检查
    const workerConnections = keyValues.find(kv => kv.key === 'worker_connections');
    if (workerConnections) {
      const value = parseInt(workerConnections.value || '0');
      if (value < 1024) {
        issues.push({
          id: this.generateId(),
          severity: 'medium',
          type: 'performance',
          rule: 'nginx-worker-connections',
          description: 'worker_connections 设置过低，建议至少 1024',
          lineNumber: workerConnections.lineNumber,
          key: workerConnections.key,
          currentValue: workerConnections.value,
          suggestedValue: '2048',
          fixable: true,
        });
      }
    }

    // keepalive_timeout 检查
    const keepaliveTimeout = keyValues.find(kv => kv.key === 'keepalive_timeout');
    if (keepaliveTimeout) {
      const value = parseInt(keepaliveTimeout.value || '0');
      if (value > 65) {
        issues.push({
          id: this.generateId(),
          severity: 'low',
          type: 'performance',
          rule: 'nginx-keepalive-timeout',
          description: 'keepalive_timeout 设置过长，可能占用连接资源',
          lineNumber: keepaliveTimeout.lineNumber,
          key: keepaliveTimeout.key,
          currentValue: keepaliveTimeout.value,
          suggestedValue: '65',
          fixable: true,
        });
      }
    }

    return issues;
  }

  /**
   * Sysctl 配置分析
   */
  private analyzeSysctl(blocks: ConfigBlock[]): ConfigIssue[] {
    const issues: ConfigIssue[] = [];
    const keyValues = this.flattenBlocks(blocks);

    // vm.swappiness 检查
    const swappiness = keyValues.find(kv => kv.key === 'vm.swappiness');
    if (swappiness) {
      const value = parseInt(swappiness.value || '0');
      if (value > 60) {
        issues.push({
          id: this.generateId(),
          severity: 'low',
          type: 'performance',
          rule: 'sysctl-swappiness',
          description: 'vm.swappiness 设置过高，可能导致频繁 swap',
          lineNumber: swappiness.lineNumber,
          key: swappiness.key,
          currentValue: swappiness.value,
          suggestedValue: '10',
          fixable: true,
        });
      }
    }

    // net.core.somaxconn 检查
    const somaxconn = keyValues.find(kv => kv.key === 'net.core.somaxconn');
    if (somaxconn) {
      const value = parseInt(somaxconn.value || '0');
      if (value < 1024) {
        issues.push({
          id: this.generateId(),
          severity: 'medium',
          type: 'performance',
          rule: 'sysctl-somaxconn',
          description: 'net.core.somaxconn 设置过低，可能限制连接数',
          lineNumber: somaxconn.lineNumber,
          key: somaxconn.key,
          currentValue: somaxconn.value,
          suggestedValue: '65535',
          fixable: true,
        });
      }
    }

    return issues;
  }

  /**
   * SSHD 配置分析
   */
  private analyzeSshd(blocks: ConfigBlock[]): ConfigIssue[] {
    const issues: ConfigIssue[] = [];
    const keyValues = this.flattenBlocks(blocks);

    // PermitRootLogin 检查
    const permitRootLogin = keyValues.find(kv => kv.key === 'PermitRootLogin');
    if (permitRootLogin) {
      const value = permitRootLogin.value?.toLowerCase();
      if (value === 'yes') {
        issues.push({
          id: this.generateId(),
          severity: 'critical',
          type: 'security',
          rule: 'sshd-permit-root-login',
          description: 'PermitRootLogin 设为 yes 存在安全风险，建议设为 no',
          lineNumber: permitRootLogin.lineNumber,
          key: permitRootLogin.key,
          currentValue: permitRootLogin.value,
          suggestedValue: 'no',
          fixable: true,
        });
      }
    } else {
      issues.push({
        id: this.generateId(),
        severity: 'high',
        type: 'security',
        rule: 'sshd-permit-root-login-missing',
        description: '缺少 PermitRootLogin 配置，默认可能允许 root 登录',
        fixable: true,
      });
    }

    // PasswordAuthentication 检查
    const passwordAuth = keyValues.find(kv => kv.key === 'PasswordAuthentication');
    if (passwordAuth) {
      const value = passwordAuth.value?.toLowerCase();
      if (value === 'yes') {
        issues.push({
          id: this.generateId(),
          severity: 'medium',
          type: 'security',
          rule: 'sshd-password-auth',
          description: 'PasswordAuthentication 设为 yes，建议使用 SSH 密钥',
          lineNumber: passwordAuth.lineNumber,
          key: passwordAuth.key,
          currentValue: passwordAuth.value,
          suggestedValue: 'no',
          fixable: true,
        });
      }
    }

    return issues;
  }

  /**
   * 扁平化所有块
   */
  private flattenBlocks(blocks: ConfigBlock[]): ConfigBlock[] {
    const result: ConfigBlock[] = [];
    
    for (const block of blocks) {
      if (block.type === 'keyValue') {
        result.push(block);
      }
      if (block.children) {
        result.push(...this.flattenBlocks(block.children));
      }
    }
    
    return result;
  }

  /**
   * 应用变更并生成新配置
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
   */
  private generateNewLine(oldLine: string, change: any): string {
    const indent = oldLine.match(/^\s*/)?.[0] || '';
    
    switch (this.template.parser) {
      case 'nginx':
        if (change.newValue) {
          return `${indent}${change.key} ${change.newValue};`;
        }
        break;
      case 'sysctl':
        if (change.newValue) {
          return `${indent}${change.key} = ${change.newValue}`;
        }
        break;
      case 'sshd':
        if (change.newValue) {
          return `${indent}${change.key} ${change.newValue}`;
        }
        break;
    }
    
    return oldLine;
  }

  /**
   * 获取缩进级别
   */
  private getIndentLevel(line: string): number {
    const match = line.match(/^(\s*)/);
    if (!match) return 0;
    let indent = 0;
    for (const char of match[1]) {
      indent += char === '\t' ? 4 : 1;
    }
    return Math.floor(indent / 4);
  }

  /**
   * 生成ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
}
