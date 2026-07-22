/**
 * agents/databaseAdminAgent.ts — 数据库运维 Agent
 *
 * 调用 dbskiter 执行数据库诊断/监控/安全/锁分析
 */

import { dbConnectionRepository } from '../../../../repositories';
import { logger } from '../../../../utils/logger';
import { executeAgentWithLLM } from '../llm/llmService';
import { decrypt } from '../../../auth/services/encryptionService';
import {
  executeDbskiter,
  inferDatabaseOperation,
  formatResultToMarkdown,
} from '../../../database/services/dbskiterService';
import type { AgentExecutionContext } from './agentCore';

/**
 * 数据库运维 Agent：调用 dbskiter 执行数据库诊断/监控/安全/锁分析
 *
 * 参数说明：
 * - input: [string] 用户输入
 * - context: [AgentExecutionContext] 上下文，可能包含 databaseId（数据库连接ID）
 */
export async function executeDatabaseAdminAgent(
  agentId: string,
  input: string,
  context?: AgentExecutionContext
): Promise<string> {
  logger.info('🗄️ executeDatabaseAdminAgent called with:', { input, context });

  // 从上下文中获取 databaseId
  const databaseId = context?.databaseId as string | undefined;

  // 如果没有 databaseId，返回错误提示
  if (!databaseId) {
    return '## 数据库运维执行失败\n\n**错误**: 未选择数据库连接。请先在数据库连接管理中配置数据库，然后在测试时选择目标数据库。';
  }

  // 查询数据库连接信息
  const dbConn = dbConnectionRepository.getById(databaseId);

  if (!dbConn) {
    return '## 数据库运维执行失败\n\n**错误**: 找不到指定的数据库连接。请检查数据库连接 ID 是否正确。';
  }

  if (!dbConn.enabled) {
    return `## 数据库运维执行失败\n\n**错误**: 数据库连接 "${dbConn.name}" 已被禁用。`;
  }

  // 解密密码
  let decryptedPassword: string;
  try {
    decryptedPassword = decrypt(dbConn.password);
  } catch (_e) {
    decryptedPassword = dbConn.password; // 兼容未加密存储的历史数据
  }

  // 构建 dbskiter 连接对象
  const connection = {
    dialect: dbConn.db_type,
    host: dbConn.host,
    port: dbConn.port,
    user: dbConn.username,
    password: decryptedPassword,
    database: dbConn.database,
  };

  // 推断运维意图
  let options = inferDatabaseOperation(input, connection);

  // 如果无法推断，兜底：默认健康检查
  if (!options) {
    logger.warn('无法从输入推断数据库运维意图，使用默认健康检查');
    options = { connection, operation: 'monitor', subCommand: 'health' };
  }

  logger.info('🗄️ 推断的数据库运维操作:', { operation: options.operation, subCommand: options.subCommand });

  // 执行 dbskiter
  const result = await executeDbskiter(options);

  // 如果 dbskiter 执行失败，直接返回错误信息
  if (!result.success) {
    const operationLabel = `${options.operation}${options.subCommand ? ' ' + options.subCommand : ''}`;
    return formatResultToMarkdown(result, operationLabel);
  }

  // 构建 LLM 分析提示
  const rawData = typeof result.data === 'object' ? JSON.stringify(result.data, null, 2) : result.stdout;
  const prompt = `【数据库运维原始数据】\n\n用户请求：${input}\n\n数据库：${dbConn.name} (${dbConn.db_type}://${dbConn.host}:${dbConn.port}/${dbConn.database})\n\n执行操作：${options.operation} ${options.subCommand || ''}\n\n原始采集数据：\n\`\`\`json\n${rawData.substring(0, 12000)}\n\`\`\`\n\n请基于以上原始数据，为用户提供一份专业的数据库运维分析报告。要求：\n1. 用自然语言描述数据库当前状态\n2. 指出关键指标和潜在问题\n3. 给出具体的优化建议或处理方案\n4. 报告结构清晰，包含摘要、详细分析、建议三个部分\n`;

  try {
    logger.info('🤖 调用 LLM 分析 dbskiter 原始数据...');
    const analysis = await executeAgentWithLLM(agentId, prompt);
    return analysis;
  } catch (error) {
    logger.error('LLM 分析失败，返回原始数据:', error);
    const operationLabel = `${options.operation}${options.subCommand ? ' ' + options.subCommand : ''}`;
    return formatResultToMarkdown(result, operationLabel);
  }
}