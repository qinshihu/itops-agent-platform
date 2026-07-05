/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'crypto';
import { logger } from '../../../../utils/logger';
import { generateCompletion } from '../llm/llmService';
import type { SpecialistBase } from './SpecialistBase';
import { specialistRegistry } from './SpecialistRegistry';
import { agentMcpAdapter } from '../agents/agentMcpAdapter';
import type {
  CoordinatorConfig,
  TaskContext,
  TaskDecomposition,
  SubTask,
  ExecutionResult,
  AgentResponse} from './types';
import {
  AgentType,
  TaskStatus,
  SpecialistDomain
} from './types';

/**
 * Coordinator 协调者 Agent
 * 负责任务分解、分配、协调和结果整合
 */
export class Coordinator {
  readonly id: string;
  readonly name: string;
  readonly type: AgentType = AgentType.COORDINATOR;
  readonly config: CoordinatorConfig;
  readonly systemPrompt: string;

  constructor(
    name = '运维协调者',
    config?: Partial<CoordinatorConfig>
  ) {
    this.id = randomUUID();
    this.name = name;
    this.config = {
      maxDecompositionDepth: 3,
      maxConcurrentTasks: 5,
      defaultTimeout: 300000,
      enableFallback: true,
      enableAutoRetry: true,
      maxRetries: 3,
      ...config
    };
    this.systemPrompt = this.buildSystemPrompt();
  }

  /**
   * 构建系统提示词
   */
  private buildSystemPrompt(): string {
    const domainList = Object.values(SpecialistDomain).join(', ');
    const mcpToolList = agentMcpAdapter.isAvailable()
      ? `\n可用的 MCP 运维工具（可直接调用查询数据）：\n${agentMcpAdapter.generateToolDescriptions().substring(0, 2000)}`
      : '';

    return `你是一个专业的运维任务协调者（Coordinator）。你的职责是：

1. 理解用户的运维任务需求
2. 将复杂任务分解为多个子任务
3. 将任务分配给合适的专业 Agent（Specialist）
4. 协调多个 Agent 的执行顺序
5. 整合所有 Agent 的执行结果，生成最终报告

可用的专业领域（Specialist Domains）：
${domainList}
${mcpToolList}

任务分解原则：
- 复杂任务应该被分解为多个独立的子任务
- 子任务之间应该有清晰的依赖关系
- 每个子任务应该能够被单个 Specialist 处理
- 子任务应该按照优先级排序
- 如果有可用的 MCP 工具，可以直接调用获取数据

请用专业、清晰的方式进行任务协调。`;
  }

  /**
   * 执行完整的任务处理流程
   */
  async executeTask(input: string, userId?: string): Promise<AgentResponse> {
    const taskId = randomUUID();
    const startTime = Date.now();
    const context: TaskContext = {
      taskId,
      input,
      userId,
      timestamp: startTime,
      metadata: {}
    };

    logger.info(`🚀 Coordinator 开始处理任务: ${taskId}`);

    try {
      // 1. 任务分析与分解
      const decomposition = await this.decomposeTask(input);
      logger.info(`任务分解完成，复杂度: ${decomposition.estimatedComplexity}, 子任务数: ${decomposition.subtasks.length}`);

      // 2. 如果任务简单，直接找最合适的 Specialist 处理
      if (decomposition.subtasks.length === 1) {
        return await this.handleSimpleTask(context, decomposition.subtasks[0]);
      }

      // 3. 复杂任务：协调节点执行
      return await this.handleComplexTask(context, decomposition);

    } catch (error) {
      logger.error('Coordinator 执行失败:', error);
      return {
        taskId,
        agentId: this.id,
        agentName: this.name,
        agentType: AgentType.COORDINATOR,
        status: TaskStatus.FAILED,
        result: {
          success: false,
          output: '',
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime
        }
      };
    }
  }

  /**
   * 任务分解
   */
  private async decomposeTask(input: string): Promise<TaskDecomposition> {
    const prompt = `请分析以下运维任务，并将其分解为子任务（如果需要）：

任务描述：
${input}

请以 JSON 格式返回，结构如下：
{
  "mainTask": "主要任务描述",
  "subtasks": [
    {
      "id": "subtask-1",
      "description": "子任务描述",
      "assignedDomain": "领域名称（从可用领域中选择）",
      "dependencies": [],
      "priority": 1
    }
  ],
  "requiredDomains": ["需要的领域列表"],
  "estimatedComplexity": 1-10的数字
}

如果任务很简单，只需要一个子任务即可。`;

    try {
      const llmResponse = await generateCompletion(prompt, this.systemPrompt, 0.3, undefined, this.id, this.name);
      return this.parseDecompositionResponse(llmResponse, input);
    } catch (_error) {
      logger.warn('LLM 任务分解失败，使用简单分解策略');
      return this.fallbackDecomposition(input);
    }
  }

  /**
   * 解析 LLM 的分解响应
   */
  private parseDecompositionResponse(response: string, originalInput: string): TaskDecomposition {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return this.validateDecomposition(parsed, originalInput);
      }
    } catch {
      // 解析失败，使用回退策略
    }
    return this.fallbackDecomposition(originalInput);
  }

  /**
   * 验证分解结果
   */
  private validateDecomposition(parsed: any, originalInput: string): TaskDecomposition {
    if (!parsed.subtasks || !Array.isArray(parsed.subtasks)) {
      return this.fallbackDecomposition(originalInput);
    }

    // 确保 subtasks 有必要的字段
    const subtasks = parsed.subtasks.map((st: any, index: number) => ({
      id: st.id || `subtask-${index + 1}`,
      description: st.description || st.content || `子任务 ${index + 1}`,
      assignedDomain: this.normalizeDomain(st.assignedDomain || st.domain),
      dependencies: st.dependencies || [],
      priority: st.priority || index + 1,
      timeout: st.timeout
    }));

    return {
      mainTask: parsed.mainTask || originalInput,
      subtasks,
      requiredDomains: parsed.requiredDomains || [],
      estimatedComplexity: parsed.estimatedComplexity || 3
    };
  }

  /**
   * 规范化领域名称
   */
  private normalizeDomain(domain: string): SpecialistDomain {
    const domainLower = domain.toLowerCase().replace(/[_-]/g, ' ');
    const domainMap: Record<string, SpecialistDomain> = {
      'alert': SpecialistDomain.ALERT_HANDLING,
      '告警': SpecialistDomain.ALERT_HANDLING,
      'fault': SpecialistDomain.FAULT_DIAGNOSIS,
      '故障': SpecialistDomain.FAULT_DIAGNOSIS,
      'diagnosis': SpecialistDomain.FAULT_DIAGNOSIS,
      'log': SpecialistDomain.LOG_ANALYSIS,
      '日志': SpecialistDomain.LOG_ANALYSIS,
      'system': SpecialistDomain.SYSTEM_INSPECTION,
      'inspection': SpecialistDomain.SYSTEM_INSPECTION,
      '巡检': SpecialistDomain.SYSTEM_INSPECTION,
      'change': SpecialistDomain.CHANGE_EXECUTION,
      '变更': SpecialistDomain.CHANGE_EXECUTION,
      'document': SpecialistDomain.DOCUMENT_GENERATION,
      '文档': SpecialistDomain.DOCUMENT_GENERATION,
      'compliance': SpecialistDomain.COMPLIANCE_CHECK,
      '合规': SpecialistDomain.COMPLIANCE_CHECK,
      'server': SpecialistDomain.SERVER_OPERATION,
      '服务器': SpecialistDomain.SERVER_OPERATION,
      'network': SpecialistDomain.NETWORK_INSPECTION,
      '网络': SpecialistDomain.NETWORK_INSPECTION,
      'database': SpecialistDomain.DATABASE_OPERATION,
      '数据库': SpecialistDomain.DATABASE_OPERATION,
      'command': SpecialistDomain.COMMAND_GENERATION,
      '命令': SpecialistDomain.COMMAND_GENERATION
    };

    for (const [key, value] of Object.entries(domainMap)) {
      if (domainLower.includes(key)) {
        return value;
      }
    }

    // 默认使用系统巡检
    return SpecialistDomain.SYSTEM_INSPECTION;
  }

  /**
   * 回退分解策略（简单任务）
   */
  private fallbackDecomposition(input: string): TaskDecomposition {
    return {
      mainTask: input,
      subtasks: [{
        id: 'subtask-1',
        description: input,
        assignedDomain: SpecialistDomain.SYSTEM_INSPECTION,
        dependencies: [],
        priority: 1
      }],
      requiredDomains: [SpecialistDomain.SYSTEM_INSPECTION],
      estimatedComplexity: 2
    };
  }

  /**
   * 处理简单任务
   */
  private async handleSimpleTask(context: TaskContext, _subtask: SubTask): Promise<AgentResponse> {
    const specialist = specialistRegistry.selectBestSpecialistForTask(context.input);

    if (!specialist) {
      return {
        taskId: context.taskId,
        agentId: this.id,
        agentName: this.name,
        agentType: AgentType.COORDINATOR,
        status: TaskStatus.FAILED,
        result: {
          success: false,
          output: '',
          error: '没有找到合适的 Specialist 处理此任务',
          duration: Date.now() - context.timestamp
        }
      };
    }

    logger.info(`将任务分配给 Specialist: ${specialist.name}`);

    const result = await this.executeSpecialist(specialist, context);

    return {
      taskId: context.taskId,
      agentId: this.id,
      agentName: this.name,
      agentType: AgentType.COORDINATOR,
      status: result.success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
      result,
      delegatedTo: specialist.id,
      reasoning: `任务已分配给 ${specialist.name} 处理`
    };
  }

  /**
   * 处理复杂任务
   */
  private async handleComplexTask(context: TaskContext, decomposition: TaskDecomposition): Promise<AgentResponse> {
    const results: Map<string, ExecutionResult> = new Map();
    const subtaskContexts: Map<string, TaskContext> = new Map();

    // 按优先级排序子任务
    const sortedSubtasks = [...decomposition.subtasks].sort((a, b) => a.priority - b.priority);

    logger.info(`开始执行 ${sortedSubtasks.length} 个子任务`);

    for (const subtask of sortedSubtasks) {
      // 检查依赖
      const dependenciesMet = subtask.dependencies.every(depId => {
        const depResult = results.get(depId);
        return depResult?.success;
      });

      if (!dependenciesMet) {
        logger.warn(`子任务 ${subtask.id} 的依赖未满足，跳过`);
        continue;
      }

      // 为子任务创建上下文
      const subtaskContext: TaskContext = {
        taskId: `${context.taskId}-${subtask.id}`,
        input: subtask.description,
        userId: context.userId,
        timestamp: Date.now(),
        metadata: {
          parentTaskId: context.taskId,
          subtaskId: subtask.id,
          priority: subtask.priority
        }
      };
      subtaskContexts.set(subtask.id, subtaskContext);

      // 选择 Specialist
      const specialist = specialistRegistry.selectBestSpecialistForTask(subtask.description);
      if (!specialist) {
        results.set(subtask.id, {
          success: false,
          output: '',
          error: '没有找到合适的 Specialist',
          duration: 0
        });
        continue;
      }

      // 执行 Specialist
      logger.info(`执行子任务 ${subtask.id}: ${subtask.description} (${specialist.name})`);
      const result = await this.executeSpecialistWithRetry(specialist, subtaskContext);
      results.set(subtask.id, result);
    }

    // 整合结果
    const finalResult = await this.integrateResults(context, decomposition, results, subtaskContexts);

    return {
      taskId: context.taskId,
      agentId: this.id,
      agentName: this.name,
      agentType: AgentType.COORDINATOR,
      status: TaskStatus.COMPLETED,
      result: finalResult
    };
  }

  /**
   * 执行 Specialist（带重试）
   */
  private async executeSpecialistWithRetry(
    specialist: SpecialistBase,
    context: TaskContext
  ): Promise<ExecutionResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await this.executeSpecialist(specialist, context);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(`Specialist 执行失败 (尝试 ${attempt}/${this.config.maxRetries}):`, error);

        if (attempt < this.config.maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    return {
      success: false,
      output: '',
      error: lastError?.message || '执行失败',
      duration: Date.now() - context.timestamp
    };
  }

  /**
   * 执行单个 Specialist
   */
  private async executeSpecialist(
    specialist: SpecialistBase,
    context: TaskContext
  ): Promise<ExecutionResult> {
    const startTime = Date.now();
    try {
      const result = await specialist.execute(context);
      logger.info(`Specialist ${specialist.name} 执行完成: ${result.success ? '成功' : '失败'}`);
      return result;
    } catch (error) {
      logger.error(`Specialist ${specialist.name} 执行异常:`, error);
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      };
    }
  }

  /**
   * 整合所有结果
   */
  private async integrateResults(
    context: TaskContext,
    decomposition: TaskDecomposition,
    results: Map<string, ExecutionResult>,
    _subtaskContexts: Map<string, TaskContext>
  ): Promise<ExecutionResult> {
    const startTime = Date.now();

    const successCount = Array.from(results.values()).filter(r => r.success).length;
    const totalCount = decomposition.subtasks.length;

    const summaryPrompt = `请整合以下运维任务的执行结果，生成最终报告：

主要任务：${decomposition.mainTask}

子任务执行结果：
${Array.from(results.entries()).map(([subtaskId, result]) => `
子任务 ${subtaskId}:
- 状态: ${result.success ? '✅ 成功' : '❌ 失败'}
- 输出: ${result.output.substring(0, 500)}
- 错误: ${result.error || '无'}
`).join('\n')}

请提供：
1. 整体执行摘要
2. 成功的部分
3. 失败的部分及原因
4. 建议的后续行动`;

    try {
      const integratedSummary = await generateCompletion(
        summaryPrompt,
        this.systemPrompt,
        0.5,
        undefined,
        this.id,
        this.name
      );

      return {
        success: successCount === totalCount,
        output: integratedSummary,
        metadata: {
          successCount,
          totalCount,
          subtaskResults: Object.fromEntries(results),
          decomposition
        },
        duration: Date.now() - startTime,
        confidence: successCount / totalCount
      };
    } catch (_error) {
      // LLM 整合失败，使用简单总结
      return this.fallbackIntegration(startTime, decomposition, results);
    }
  }

  /**
   * 回退整合策略
   */
  private fallbackIntegration(
    startTime: number,
    decomposition: TaskDecomposition,
    results: Map<string, ExecutionResult>
  ): ExecutionResult {
    const successCount = Array.from(results.values()).filter(r => r.success).length;
    const totalCount = decomposition.subtasks.length;

    let output = `# 任务执行总结\n\n`;
    output += `## 总体状态\n`;
    output += `- 任务总数: ${totalCount}\n`;
    output += `- 成功: ${successCount}\n`;
    output += `- 失败: ${totalCount - successCount}\n\n`;
    output += `## 详细结果\n`;

    for (const [subtaskId, result] of results) {
      output += `### ${subtaskId}\n`;
      output += `- 状态: ${result.success ? '✅ 成功' : '❌ 失败'}\n`;
      output += `- 输出: ${result.output.substring(0, 300)}\n`;
      if (result.error) {
        output += `- 错误: ${result.error}\n`;
      }
      output += '\n';
    }

    return {
      success: successCount === totalCount,
      output,
      metadata: {
        successCount,
        totalCount,
        subtaskResults: Object.fromEntries(results),
        decomposition
      },
      duration: Date.now() - startTime
    };
  }
}
