import { randomUUID } from 'crypto';
import { generateCompletion } from '../llm/llmService';
import type {
  SpecialistDomain,
  AgentCapability,
  TaskContext,
  ExecutionResult,
  SpecialistRegistryEntry,
  ExecutionMetadata
} from './types';

/**
 * Specialist 基类
 * 所有专业领域 Agent 都需要继承这个基类
 */
export abstract class SpecialistBase {
  readonly id: string;
  readonly name: string;
  readonly domain: SpecialistDomain;
  readonly capabilities: AgentCapability;
  readonly systemPrompt: string;
  readonly temperature: number;
  enabled: boolean;

  constructor(
    name: string,
    domain: SpecialistDomain,
    capabilities: AgentCapability,
    systemPrompt: string,
    temperature = 0.7,
    id?: string
  ) {
    this.id = id || randomUUID();
    this.name = name;
    this.domain = domain;
    this.capabilities = capabilities;
    this.systemPrompt = systemPrompt;
    this.temperature = temperature;
    this.enabled = true;
  }

  /**
   * 检查是否能处理给定的任务
   */
  canHandleTask(taskInput: string): { canHandle: boolean; confidence: number; reason?: string } {
    const confidence = this.assessConfidence(taskInput);
    return {
      canHandle: confidence >= this.capabilities.confidenceThreshold,
      confidence,
      reason: confidence >= this.capabilities.confidenceThreshold
        ? `Specialist ${this.name} 可以处理此任务，置信度: ${confidence}`
        : `Specialist ${this.name} 置信度不足 (${confidence} < ${this.capabilities.confidenceThreshold})`
    };
  }

  /**
   * 评估对任务的置信度
   * 子类可以覆盖此方法实现更智能的评估
   */
  protected assessConfidence(taskInput: string): number {
    // 基础实现：关键词匹配
    const lowerInput = taskInput.toLowerCase();
    const keywordMatches = this.capabilities.skills.filter(skill =>
      lowerInput.includes(skill.toLowerCase())
    ).length;

    const maxConfidence = 0.8;
    const minConfidence = 0.2;
    const skillCount = this.capabilities.skills.length;

    if (skillCount === 0) return minConfidence;

    const matchRatio = keywordMatches / skillCount;
    return minConfidence + (maxConfidence - minConfidence) * matchRatio;
  }

  /**
   * 执行任务的核心方法
   * 子类必须实现此方法
   */
  abstract execute(context: TaskContext): Promise<ExecutionResult>;

  /**
   * 构建执行结果的辅助方法
   */
  protected buildResult(
    success: boolean,
    output: string,
    options?: {
      error?: string;
      metadata?: ExecutionMetadata;
      duration?: number;
      confidence?: number;
      nextActions?: string[];
    }
  ): ExecutionResult {
    const startTime = Date.now();
    return {
      success,
      output,
      error: options?.error,
      metadata: options?.metadata,
      duration: options?.duration ?? Date.now() - startTime,
      confidence: options?.confidence,
      nextActions: options?.nextActions
    };
  }

  /**
   * 使用 LLM 执行任务的通用模板方法
   * 子类可直接调用此方法避免重复代码
   */
  protected async executeWithLLM(context: TaskContext): Promise<ExecutionResult> {
    const startTime = Date.now();
    try {
      const response = await generateCompletion(
        context.input,
        this.systemPrompt,
        this.temperature,
        undefined,
        context.taskId,
        this.name
      );

      return this.buildResult(true, response, {
        duration: Date.now() - startTime,
        confidence: 0.8,
        metadata: { taskId: context.taskId }
      });
    } catch (error) {
      return this.buildResult(false, '', {
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      });
    }
  }

  /**
   * 转换为注册表条目格式
   */
  toRegistryEntry(): SpecialistRegistryEntry {
    return {
      id: this.id,
      name: this.name,
      domain: this.domain,
      capabilities: this.capabilities,
      systemPrompt: this.systemPrompt,
      temperature: this.temperature,
      enabled: this.enabled
    };
  }
}
