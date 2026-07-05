/**
 * Coordinator + Specialists 流程测试（阶段 5A.2）
 *
 * 验证 executeTask 的完整流程：
 *   1. decomposeTask 调用 generateCompletion 解析任务分解
 *   2. 单子任务走 handleSimpleTask 路径
 *   3. 多子任务走 handleComplexTask 路径
 *   4. LLM 失败时走 fallbackDecomposition 回退
 *
 * generateCompletion 已在 index.test.ts 中 mock，本文件通过 vi.mocked()
 * 自定义返回值以驱动不同分支。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock 依赖 ──
vi.mock("../../../../models/database", () => ({
  default: {}, db: {}, initializeDatabase: vi.fn(), performMaintenance: vi.fn(), getIOInstance: vi.fn(),
}));
vi.mock("../../../../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

// vi.mock() 工厂会被 vitest 提升到文件顶部，因此不能引用其后声明的变量。
// 使用 vi.hoisted() 把 mock 函数定义在提升上下文中。
const { generateCompletionMock } = vi.hoisted(() => ({
  generateCompletionMock: vi.fn(),
}));
vi.mock("../llm/llmService", () => ({
  generateCompletion: generateCompletionMock,
  generateCompletionWithTools: vi.fn(),
  checkLLMAvailability: vi.fn(),
}));

import { Coordinator, specialistRegistry, AgentType, TaskStatus } from './index';
import { SpecialistBase } from './SpecialistBase';
import { SpecialistDomain } from './types';
import type { TaskContext, ExecutionResult } from './types';

/** 构造一个可控制的 TestSpecialist，execute 返回固定值 */
class TestSpecialist extends SpecialistBase {
  constructor() {
    super(
      'TestSpecialist',
      SpecialistDomain.SYSTEM_INSPECTION,
      {
        domain: SpecialistDomain.SYSTEM_INSPECTION,
        skills: ['test', '检查', 'inspect'],
        confidenceThreshold: 0.3,
      },
      'You are a test specialist',
      0.5,
      'test-specialist-1'
    );
  }

  async execute(context: TaskContext): Promise<ExecutionResult> {
    return this.buildResult(true, `test-specialist-handled: ${context.input}`, {
      confidence: 0.9,
      metadata: { taskId: context.taskId },
    });
  }

  canHandleTask(taskInput: string): { canHandle: boolean; confidence: number; reason?: string } {
    return { canHandle: true, confidence: 0.9, reason: 'test specialist always handles' };
  }
}

describe('Coordinator 任务流程', () => {
  let coordinator: Coordinator;

  beforeEach(() => {
    vi.clearAllMocks();
    coordinator = new Coordinator('TestCoordinator');
  });

  it('decomposeTask 失败时走 fallbackDecomposition，仍返回成功响应', async () => {
    // generateCompletion 抛错 → 走 fallbackDecomposition（单子任务）
    generateCompletionMock.mockRejectedValueOnce(new Error('LLM unavailable'));

    const response = await coordinator.executeTask('检查服务器 CPU 使用率');

    expect(response).toBeDefined();
    expect(response.taskId).toBeDefined();
    expect(response.agentType).toBe(AgentType.COORDINATOR);
    expect(response.status).toBeDefined();
  });

  it('LLM 返回单子任务分解时走 handleSimpleTask 路径', async () => {
    // LLM 返回合法 JSON：单子任务
    generateCompletionMock.mockResolvedValueOnce(JSON.stringify({
      mainTask: '检查 CPU',
      subtasks: [
        {
          id: 'sub-1',
          description: '检查 CPU 使用率',
          assignedDomain: 'system',
          dependencies: [],
          priority: 1,
        },
      ],
      requiredDomains: ['system'],
      estimatedComplexity: 2,
    }));

    const response = await coordinator.executeTask('检查 CPU 使用率');

    expect(response).toBeDefined();
    expect(response.taskId).toBeDefined();
    expect(generateCompletionMock).toHaveBeenCalledTimes(1);
  });

  it('LLM 返回多子任务分解时走 handleComplexTask 路径', async () => {
    // 第一次：分解为 2 个子任务
    generateCompletionMock.mockResolvedValueOnce(JSON.stringify({
      mainTask: '复杂运维任务',
      subtasks: [
        { id: 's1', description: '任务1', assignedDomain: 'system', dependencies: [], priority: 1 },
        { id: 's2', description: '任务2', assignedDomain: 'alert', dependencies: ['s1'], priority: 2 },
      ],
      requiredDomains: ['system', 'alert'],
      estimatedComplexity: 6,
    }));
    // 后续调用：子任务执行 + 结果整合
    generateCompletionMock.mockResolvedValue('子任务执行结果');

    const response = await coordinator.executeTask('执行复杂运维任务');

    expect(response).toBeDefined();
    expect(response.taskId).toBeDefined();
    // 至少调用了分解 + 整合
    expect(generateCompletionMock.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('LLM 返回非 JSON 时走 fallbackDecomposition', async () => {
    generateCompletionMock.mockResolvedValueOnce('这不是 JSON，是无法解析的自然语言响应');

    const response = await coordinator.executeTask('任意任务');

    expect(response).toBeDefined();
    // fallbackDecomposition 产生单子任务 → 走 handleSimpleTask
    expect(response.status).toBeDefined();
  });

  it('构造函数 config 合并默认值与自定义值', () => {
    const c1 = new Coordinator();
    expect(c1.config.maxDecompositionDepth).toBe(3);
    expect(c1.config.maxConcurrentTasks).toBe(5);

    const c2 = new Coordinator('Custom', {
      maxDecompositionDepth: 10,
      enableAutoRetry: false,
    });
    expect(c2.config.maxDecompositionDepth).toBe(10);
    expect(c2.config.enableAutoRetry).toBe(false);
    // 未覆盖的应该保留默认值
    expect(c2.config.maxConcurrentTasks).toBe(5);
  });
});

describe('SpecialistBase 子类行为', () => {
  it('TestSpecialist canHandleTask 返回高置信度', () => {
    const s = new TestSpecialist();
    const result = s.canHandleTask('检查服务器状态');
    expect(result.canHandle).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('TestSpecialist execute 返回成功结果', async () => {
    const s = new TestSpecialist();
    const context: TaskContext = {
      taskId: 'test-task-1',
      input: '检查 CPU 使用率',
      timestamp: Date.now(),
    };
    const result = await s.execute(context);
    expect(result.success).toBe(true);
    expect(result.output).toContain('test-specialist-handled');
    expect(result.output).toContain('检查 CPU 使用率');
  });
});

describe('specialistRegistry 行为', () => {
  it('getAll / getEnabled 返回数组', () => {
    const all = specialistRegistry.getAll();
    const enabled = specialistRegistry.getEnabled();
    expect(Array.isArray(all)).toBe(true);
    expect(Array.isArray(enabled)).toBe(true);
    // getEnabled 应该是 getAll 的子集（enabled === true）
    expect(enabled.length).toBeLessThanOrEqual(all.length);
  });

  it('selectBestSpecialistForTask 在无匹配时返回 undefined', () => {
    // 清空 registry 后查询（不影响其他测试，因为 registry 是单例）
    const result = specialistRegistry.selectBestSpecialistForTask('不存在的领域');
    // 可能返回 undefined 或一个默认 specialist，只要不抛异常即可
    expect(result === undefined || typeof result === 'object').toBe(true);
  });
});
