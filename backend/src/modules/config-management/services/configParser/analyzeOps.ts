/**
 * configParser 分析验证子模块（2026-07-21 拆分）
 *
 * 把原 configParser.ts L254-458 的 4 个分析方法抽出：
 * - analyze: 公开入口，按 template.parser 分发 nginx/sysctl/sshd 验证
 * - analyzeNginx: worker_processes / worker_connections / keepalive_timeout 检查
 * - analyzeSysctl: vm.swappiness / net.core.somaxconn 检查
 * - analyzeSshd: PermitRootLogin / PasswordAuthentication 检查（安全相关）
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import type { ConfigBlock, ConfigIssue, ConfigTemplate } from './types';
import { flattenBlocks, generateId } from './utils';

/** 分析配置问题（公开入口） */
export function analyze(template: ConfigTemplate, blocks: ConfigBlock[]): ConfigIssue[] {
  const issues: ConfigIssue[] = [];

  switch (template.parser) {
    case 'nginx':
      issues.push(...analyzeNginx(blocks));
      break;
    case 'sysctl':
      issues.push(...analyzeSysctl(blocks));
      break;
    case 'sshd':
      issues.push(...analyzeSshd(blocks));
      break;
  }

  return issues;
}

/** Nginx 配置分析（worker_processes / worker_connections / keepalive_timeout） */
export function analyzeNginx(blocks: ConfigBlock[]): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const keyValues = flattenBlocks(blocks);

  // worker_processes 检查
  const workerProcesses = keyValues.find((kv) => kv.key === 'worker_processes');
  if (workerProcesses) {
    const value = workerProcesses.value || '';
    if (value === '1' || (parseInt(value) < 2 && value !== 'auto')) {
      issues.push({
        id: generateId(),
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
      id: generateId(),
      severity: 'medium',
      type: 'bestPractice',
      rule: 'nginx-worker-processes-missing',
      description: '缺少 worker_processes 配置',
      fixable: true,
    });
  }

  // worker_connections 检查
  const workerConnections = keyValues.find((kv) => kv.key === 'worker_connections');
  if (workerConnections) {
    const value = parseInt(workerConnections.value || '0');
    if (value < 1024) {
      issues.push({
        id: generateId(),
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
  const keepaliveTimeout = keyValues.find((kv) => kv.key === 'keepalive_timeout');
  if (keepaliveTimeout) {
    const value = parseInt(keepaliveTimeout.value || '0');
    if (value > 65) {
      issues.push({
        id: generateId(),
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

/** Sysctl 配置分析（vm.swappiness / net.core.somaxconn） */
export function analyzeSysctl(blocks: ConfigBlock[]): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const keyValues = flattenBlocks(blocks);

  // vm.swappiness 检查
  const swappiness = keyValues.find((kv) => kv.key === 'vm.swappiness');
  if (swappiness) {
    const value = parseInt(swappiness.value || '0');
    if (value > 60) {
      issues.push({
        id: generateId(),
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
  const somaxconn = keyValues.find((kv) => kv.key === 'net.core.somaxconn');
  if (somaxconn) {
    const value = parseInt(somaxconn.value || '0');
    if (value < 1024) {
      issues.push({
        id: generateId(),
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

/** SSHD 配置分析（PermitRootLogin / PasswordAuthentication 安全检查） */
export function analyzeSshd(blocks: ConfigBlock[]): ConfigIssue[] {
  const issues: ConfigIssue[] = [];
  const keyValues = flattenBlocks(blocks);

  // PermitRootLogin 检查
  const permitRootLogin = keyValues.find((kv) => kv.key === 'PermitRootLogin');
  if (permitRootLogin) {
    const value = permitRootLogin.value?.toLowerCase();
    if (value === 'yes') {
      issues.push({
        id: generateId(),
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
      id: generateId(),
      severity: 'high',
      type: 'security',
      rule: 'sshd-permit-root-login-missing',
      description: '缺少 PermitRootLogin 配置，默认可能允许 root 登录',
      fixable: true,
    });
  }

  // PasswordAuthentication 检查
  const passwordAuth = keyValues.find((kv) => kv.key === 'PasswordAuthentication');
  if (passwordAuth) {
    const value = passwordAuth.value?.toLowerCase();
    if (value === 'yes') {
      issues.push({
        id: generateId(),
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
