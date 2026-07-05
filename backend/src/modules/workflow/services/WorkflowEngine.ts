/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger';
import { providerRegistry } from '../../ai/services/providers';
import type {
  WorkflowDefinition,
  WorkflowExecution,
  WorkflowContext,
  StepExecution,
  StepDefinition
} from './types';
import type { WorkflowVariables } from './workflowExpressionEvaluator';

/**
 * 工作流执行引擎
 */
export class WorkflowEngine {
  /**
   * 执行工作流
   */
  async execute(
    definition: WorkflowDefinition,
    inputs: WorkflowVariables,
    context: Partial<WorkflowContext> = {}
  ): Promise<WorkflowExecution> {
    const executionId = randomUUID();
    const startedAt = Date.now();

    logger.info(`[WorkflowEngine] Starting workflow: ${definition.id} (${executionId})`);

    // 初始化执行状态
    const execution: WorkflowExecution = {
      id: executionId,
      workflowId: definition.id,
      trigger: 'manual',
      startedAt,
      status: 'running',
      inputs,
      steps: []
    };

    // 构建上下文
    const ctx: WorkflowContext = {
      execution,
      inputs,
      outputs: {},
      steps: {},
      environment: definition.environment || {},
      secrets: {},
      vars: {},
      ...context
    };

    try {
      // 验证输入
      this.validateInputs(definition, inputs);

      // 执行步骤
      await this.executeSteps(definition.steps, ctx);

      // 构建输出
      execution.outputs = this.buildOutputs(definition, ctx);
      execution.status = 'completed';

      logger.info(`[WorkflowEngine] Workflow completed: ${definition.id} (${executionId})`);
    } catch (error) {
      execution.status = 'failed';
      execution.error = error instanceof Error ? error.message : String(error);
      logger.error(`[WorkflowEngine] Workflow failed: ${definition.id} (${executionId})`, error);
      throw error;
    } finally {
      execution.endedAt = Date.now();
    }

    return execution;
  }

  /**
   * 执行步骤
   */
  private async executeSteps(
    steps: StepDefinition[],
    ctx: WorkflowContext
  ): Promise<void> {
    for (const step of steps) {
      await this.executeStep(step, ctx);
    }
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(
    step: StepDefinition,
    ctx: WorkflowContext
  ): Promise<void> {
    const stepExecution: StepExecution = {
      id: randomUUID(),
      stepId: step.id,
      name: step.name,
      status: 'pending'
    };

    ctx.execution.steps.push(stepExecution);
    ctx.steps[step.id] = stepExecution;

    // 检查条件
    if (step.condition) {
      const conditionResult = this.evaluateExpression(step.condition, ctx);
      if (!conditionResult) {
        stepExecution.status = 'skipped';
        logger.info(`[WorkflowEngine] Step skipped: ${step.id} (condition false)`);
        return;
      }
    }

    // 检查依赖
    if (step.dependencies && step.dependencies.length > 0) {
      for (const depId of step.dependencies) {
        const depStep = ctx.steps[depId];
        if (!depStep || depStep.status === 'failed') {
          if (step.continueOnError) {
            stepExecution.status = 'skipped';
            return;
          }
          throw new Error(`Dependency failed: ${depId}`);
        }
      }
    }

    stepExecution.status = 'running';
    stepExecution.startedAt = Date.now();

    try {
      switch (step.type) {
        case 'action':
          await this.executeAction(step, ctx);
          break;
        case 'condition':
          await this.executeCondition(step, ctx);
          break;
        case 'parallel':
          await this.executeParallel(step, ctx);
          break;
        case 'foreach':
          await this.executeForeach(step, ctx);
          break;
        case 'wait':
          await this.executeWait(step, ctx);
          break;
        case 'task':
          await this.executeTask(step, ctx);
          break;
        default:
          throw new Error(`Unknown step type: ${step.type}`);
      }

      stepExecution.status = 'completed';
    } catch (error) {
      stepExecution.status = 'failed';
      stepExecution.error = error instanceof Error ? error.message : String(error);
      logger.error(`[WorkflowEngine] Step failed: ${step.id}`, error);

      if (!step.continueOnError) {
        throw error;
      }
    } finally {
      stepExecution.endedAt = Date.now();
      stepExecution.duration = stepExecution.endedAt - stepExecution.startedAt!;
    }
  }

  /**
   * 执行 Action 步骤
   */
  private async executeAction(
    step: StepDefinition,
    ctx: WorkflowContext
  ): Promise<void> {
    if (!step.provider || !step.method) {
      throw new Error('Provider and method are required for action step');
    }

    // 解析参数
    const params = this.resolveParams(step.params || {}, ctx);

    // 执行方法
    logger.info(`[WorkflowEngine] Executing: ${step.provider}.${step.method}`);
    const result = await providerRegistry.execute(step.provider, step.method, params);

    // 保存输出
    ctx.steps[step.id].output = result;

    if (step.outputs) {
      for (const [key, expr] of Object.entries(step.outputs)) {
        ctx.vars[key] = this.evaluateExpression(expr, { ...ctx, result });
      }
    }
  }

  /**
   * 执行条件步骤
   */
  private async executeCondition(
    step: StepDefinition,
    ctx: WorkflowContext
  ): Promise<void> {
    if (!step.condition || !step.branches) {
      throw new Error('Condition and branches are required for condition step');
    }

    const conditionResult = this.evaluateExpression(step.condition, ctx);
    const branchName = conditionResult ? 'true' : 'false';
    const branchSteps = step.branches[branchName] || step.branches.default || [];

    logger.info(`[WorkflowEngine] Condition ${step.id} -> ${branchName}`);
    await this.executeSteps(branchSteps, ctx);
  }

  /**
   * 执行并行步骤
   */
  private async executeParallel(
    step: StepDefinition,
    ctx: WorkflowContext
  ): Promise<void> {
    if (!step.steps || step.steps.length === 0) {
      return;
    }

    logger.info(`[WorkflowEngine] Executing ${step.steps.length} steps in parallel`);
    await Promise.all(step.steps.map(subStep => this.executeStep(subStep, ctx)));
  }

  /**
   * 执行循环步骤
   */
  private async executeForeach(
    step: StepDefinition,
    ctx: WorkflowContext
  ): Promise<void> {
    if (!step.foreach || !step.steps || step.steps.length === 0) {
      throw new Error('Foreach expression and steps are required');
    }

    const items = this.evaluateExpression(step.foreach, ctx);
    if (!Array.isArray(items)) {
      throw new Error('Foreach expression must evaluate to an array');
    }

    logger.info(`[WorkflowEngine] Foreach ${step.id}: ${items.length} items`);

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemContext = {
        ...ctx,
        vars: {
          ...ctx.vars,
          item,
          index: i,
          first: i === 0,
          last: i === items.length - 1
        }
      };

      await this.executeSteps(step.steps, itemContext);
    }
  }

  /**
   * 执行等待步骤
   */
  private async executeWait(
    step: StepDefinition,
    ctx: WorkflowContext
  ): Promise<void> {
    if (!step.wait) {
      return;
    }

    if (step.wait.duration) {
      const ms = this.parseDuration(step.wait.duration);
      logger.info(`[WorkflowEngine] Waiting: ${step.wait.duration}`);
      await new Promise(resolve => setTimeout(resolve, ms));
    }

    if (step.wait.condition) {
      const startTime = Date.now();
      const timeout = 5 * 60 * 1000; // 5 分钟超时

      while (!this.evaluateExpression(step.wait.condition, ctx)) {
        if (Date.now() - startTime > timeout) {
          throw new Error('Wait condition timeout');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  /**
   * 执行任务步骤
   */
  private async executeTask(
    step: StepDefinition,
    ctx: WorkflowContext
  ): Promise<void> {
    // Task 步骤可以是复杂任务的封装
    await this.executeAction(step, ctx);
  }

  /**
   * 验证输入
   */
  private validateInputs(
    definition: WorkflowDefinition,
    inputs: WorkflowVariables
  ): void {
    if (!definition.inputs) {
      return;
    }

    for (const inputDef of definition.inputs) {
      const value = inputs[inputDef.name];

      // 检查必填
      if (inputDef.required && value === undefined) {
        throw new Error(`Input is required: ${inputDef.name}`);
      }

      // 使用默认值
      if (value === undefined && inputDef.default !== undefined) {
        inputs[inputDef.name] = inputDef.default;
      }

      // 验证器
      if (inputDef.validator && value !== undefined) {
        const valid = this.evaluateExpression(inputDef.validator, {
          inputs,
          value
        });
        if (!valid) {
          throw new Error(`Input validation failed: ${inputDef.name}`);
        }
      }
    }
  }

  /**
   * 构建输出
   */
  private buildOutputs(
    definition: WorkflowDefinition,
    ctx: WorkflowContext
  ): WorkflowVariables {
    const outputs: WorkflowVariables = {};

    if (definition.outputs) {
      for (const outputDef of definition.outputs) {
        outputs[outputDef.name] = this.evaluateExpression(outputDef.value, ctx);
      }
    }

    return outputs;
  }

  /**
   * 解析参数
   */
  private resolveParams(
    params: WorkflowVariables,
    ctx: WorkflowContext
  ): WorkflowVariables {
    const resolved: WorkflowVariables = {};

    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string') {
        resolved[key] = this.evaluateExpression(value, ctx);
      } else if (value && typeof value === 'object') {
        resolved[key] = this.resolveParams(value as WorkflowVariables, ctx);
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  /**
   * 评估表达式（简化实现）
   */
  private evaluateExpression(expression: string, context: any): any {
    // 简化实现：变量替换
    return expression.replace(/\${(\w+)}/g, (match, varName) => {
      const parts = varName.split('.');
      let result = context;

      for (const part of parts) {
        if (result && typeof result === 'object' && part in result) {
          result = result[part];
        } else {
          return match;
        }
      }

      return String(result);
    });
  }

  /**
   * 解析持续时间
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smh])$/);
    if (!match) {
      throw new Error(`Invalid duration: ${duration}`);
    }

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      default:
        throw new Error(`Unknown duration unit: ${unit}`);
    }
  }
}
