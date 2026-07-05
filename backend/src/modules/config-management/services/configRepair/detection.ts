/**
 * 配置问题检测
 * 从 configRepairService.ts 提取的配置分析与模板匹配逻辑
 */

import { randomUUID } from 'crypto';
import { logger } from '../../../../utils/logger';
import type {
  ConfigTemplate,
  ConfigAnalysis,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  ConfigIssue,
} from '../../../../types/configRepair';
import { ConfigParser } from '../configParser';

export interface DetectionDeps {
  templates: Map<string, ConfigTemplate>;
  getTemplate: (templateId: string) => ConfigTemplate | null;
}

/**
 * 自动匹配模板
 */
export function findMatchingTemplate(deps: DetectionDeps, configPath: string): ConfigTemplate | null {
  for (const template of deps.templates.values()) {
    if (configPath.includes(template.path) || template.path.includes(configPath)) {
      return template;
    }
  }

  // 按文件名匹配
  const filename = configPath.split('/').pop() || '';
  for (const template of deps.templates.values()) {
    if (template.path.includes(filename)) {
      return template;
    }
  }

  return null;
}

/**
 * 分析配置文件
 */
export async function analyzeConfig(
  deps: DetectionDeps,
  deviceId: string,
  configPath: string,
  content: string,
  templateId?: string
): Promise<ConfigAnalysis> {
  let template: ConfigTemplate | null = null;

  if (templateId) {
    template = deps.getTemplate(templateId);
  } else {
    // 自动匹配模板
    template = findMatchingTemplate(deps, configPath);
  }

  if (!template) {
    // 使用通用模板
    template = {
      id: 'generic-' + randomUUID(),
      name: '通用配置',
      path: configPath,
      parser: 'custom',
      backupDir: '/tmp/config-backups',
      description: '通用配置文件',
      isPreset: false,
    };
  }

  const parser = new ConfigParser(template);
  const blocks = parser.parse(content);
  const issues = parser.analyze(blocks);

  // 统计
  const summary = {
    totalIssues: issues.length,
    critical: issues.filter(i => i.severity === 'critical').length,
    high: issues.filter(i => i.severity === 'high').length,
    medium: issues.filter(i => i.severity === 'medium').length,
    low: issues.filter(i => i.severity === 'low').length,
    fixable: issues.filter(i => i.fixable).length,
  };

  logger.info(`🔍 配置分析完成: ${configPath}, 发现 ${issues.length} 个问题`);

  return {
    path: configPath,
    blocks,
    issues,
    summary,
  };
}