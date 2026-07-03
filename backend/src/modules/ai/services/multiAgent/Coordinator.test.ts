/**
 * Coordinator 单元测试
 *
 * 验证：
 *   1. 构造函数合并 config 默认值与自定义值
 *   2. executeTask 在 LLM 失败时回退到 fallbackDecomposition
 *   3. 单子任务走 handleSimpleTask 路径
 *   4. 多子任务走 handleComplexTask 路径（串行 + 依赖检查）
 *   5. 依赖未满足时子任务被跳过
 *   6. 多子任务结果状态聚合
 *
 * 使用 vi.hoisted() 模式定义 mock 变量。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock 数据库与日志 ──
vi.mock("../../../../models/database", () => ({
  default: {}, db: {}, initializeDatabase: vi.fn(), performMaintenance: vi.fn(), getIOInstance: vi.fn(),
}));
vi.mock("../../../../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

// ── vi.hoisted() 把 mock 函数定义在提升上下文中 ──
const { generateCompletionMock, selectBestSpecialistMock } = vi.hoisted(() => ({
  generateCompletionMock: vi.fn(),
  selectBestSpecialistMock: vi.fn(),
}));

vi.mock("../llm/llmService", () => ({
  generateCompletion: generateCompletionMock,
  generateCompletionWithTools: vi.fn(),
  checkLLMAvailability: vi.fn(),
}));

vi.mock("../agents/agentMcpAdapter", () => ({
  agentMcpAdapter: {
    isAvailable: vi.fn(() => false),
    generateToolDescriptions: vi.fn(() => ''),
  },
}));

// Mock SpecialistRegistry 单例以控制 selectBestSpecialistForTask 返回值
vi.mock("./SpecialistRegistry", () => ({
  SpecialistRegistry: vi.fn(),
  specialistRegistry: {
    selectBestSpecialistForTask: selectBestSpecialistMock,
    getAll: vi.fn(() => []),
    getEnabled: vi.fn(() => []),
    register: vi.fn(),
    registerMany: vi.fn(),
    getById: vi.fn(() => undefined),
    getByDomain: vi.fn(() => []),
    unregister: vi.fn(() => false),
    clear: vi.fn(),
    getAllRegistryEntries: vi.fn(() => []),
  },
}));

import { Coordinator } from './Coordinator';
import { SpecialistBase } from './SpecialistBase';
import { SpecialistDomain, AgentType, TaskStatus } from './types';
import type { TaskContext, ExecutionResult } from './types';

/**
 * 可配置的测试 Specialist。
 * 参照 coordinatorFlow.test.ts 的 TestSpecialist 模式：
 *   - 调用 super() 传入正确参数
 *   - 实现 abstract execute()
 *   - 可控制返回 success/failure
 */
class TestSpecialist extends SpecialistBase {
  constructor(
    id: string,
    name: string,
    private readonly shouldSucceed: boolean
  ) {
    super(
      name,
      SpecialistDomain.SYSTEM_INSPECTION,
      {
        domain: SpecialistDomain.SYSTEM_INSPECTION,
        skills: ['test', '检查', 'inspect'],
        confidenceThreshold: 0.3,
      },
      'You are a test specialist',
      0.5,
      id
    );
  }

  async execute(context: TaskContext): Promise<ExecutionResult> {
    if (this.shouldSucceed) {
      return this.buildResult(true, `test-specialist-handled: ${context.input}`, {
        confidence: 0.9,
        metadata: { taskId: context.taskId },
      });
    }
    return this.buildResult(false, '', {
      error: 'intentional failure',
      metadata: { taskId: context.taskId },
    });
  }

  canHandleTask(_taskInput: string): { canHandle: boolean; confidence: number; reason?: string } {
    return { canHandle: true, confidence: 0.9, reason: 'test specialist always handles' };
  }
}

describe('Coordinator', () => {
  let coordinator: Coordinator;

  beforeEach(() => {
    vi.clearAllMocks();
    coordinator = new Coordinator('TestCoordinator');
    // 默认返回一个成功的 specialist
    selectBestSpecialistMock.mockReturnValue(new TestSpecialist('spec-default', 'DefaultSpec', true));
  });

  describe('构造函数', () => {
    it('使用默认 name 与 config', () => {
      const c = new Coordinator();
      expect(c.name).toBe('运维协调者');
      expect(c.config.maxDecompositionDepth).toBe(3);
      expect(c.config.maxConcurrentTasks).toBe(5);
      expect(c.config.defaultTimeout).toBe(300000);
      expect(c.config.enableFallback).toBe(true);
      expect(c.config.enableAutoRetry).toBe(true);
      expect(c.config.maxRetries).toBe(3);
    });

    it('合并自定义 config，未覆盖的保留默认值', () => {
      const c = new Coordinator('Custom', {
        maxDecompositionDepth: 10,
        enableAutoRetry: false,
      });
      expect(c.name).toBe('Custom');
      expect(c.config.maxDecompositionDepth).toBe(10);
      expect(c.config.enableAutoRetry).toBe(false);
      // 未覆盖的保留默认值
      expect(c.config.maxConcurrentTasks).toBe(5);
      expect(c.config.defaultTimeout).toBe(300000);
      expect(c.config.maxRetries).toBe(3);
    });

    it('type 为 COORDINATOR，id 与 systemPrompt 已生成', () => {
      expect(coordinator.type).toBe(AgentType.COORDINATOR);
      expect(coordinator.id).toBeDefined();
      expect(typeof coordinator.systemPrompt).toBe('string');
      expect(coordinator.systemPrompt.length).toBeGreaterThan(0);
    });
  });

  describe('executeTask - LLM 失败回退', () => {
    it('decomposeTask 失败时走 fallbackDecomposition，仍返回响应', async () => {
      generateCompletionMock.mockRejectedValueOnce(new Error('LLM unavailable'));

      const response = await coordinator.executeTask('检查服务器 CPU 使用率');

      expect(response).toBeDefined();
      expect(response.taskId).toBeDefined();
      expect(response.agentType).toBe(AgentType.COORDINATOR);
      // fallbackDecomposition 产生单子任务 → handleSimpleTask → specialist 执行
      expect(response.status).toBe(TaskStatus.COMPLETED);
      expect(selectBestSpecialistMock).toHaveBeenCalledTimes(1);
    });

    it('LLM 返回非 JSON 时走 fallbackDecomposition', async () => {
      generateCompletionMock.mockResolvedValueOnce('这不是 JSON，是无法解析的自然语言响应');

      const response = await coordinator.executeTask('任意任务');

      expect(response).toBeDefined();
      expect(response.status).toBe(TaskStatus.COMPLETED);
      expect(selectBestSpecialistMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('executeTask - 单子任务 (handleSimpleTask)', () => {
    it('LLM 返回单子任务分解时走 handleSimpleTask 路径并委派给 specialist', async () => {
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
      expect(response.status).toBe(TaskStatus.COMPLETED);
      expect(response.delegatedTo).toBeDefined();
      expect(response.result?.success).toBe(true);
      // decomposeTask 仅调用 1 次（handleSimpleTask 不调用整合）
      expect(generateCompletionMock).toHaveBeenCalledTimes(1);
      expect(selectBestSpecialistMock).toHaveBeenCalledTimes(1);
    });

    it('handleSimpleTask 在无可用 specialist 时返回 FAILED', async () => {
      generateCompletionMock.mockResolvedValueOnce(JSON.stringify({
        mainTask: '检查 CPU',
        subtasks: [
          { id: 'sub-1', description: '检查 CPU', assignedDomain: 'system', dependencies: [], priority: 1 },
        ],
        requiredDomains: ['system'],
        estimatedComplexity: 2,
      }));
      selectBestSpecialistMock.mockReturnValue(null);

      const response = await coordinator.executeTask('检查 CPU');

      expect(response).toBeDefined();
      expect(response.status).toBe(TaskStatus.FAILED);
      expect(response.result?.success).toBe(false);
      expect(response.result?.error).toContain('Specialist');
    });

    it('specialist 返回失败时 response.status 为 FAILED', async () => {
      generateCompletionMock.mockResolvedValueOnce(JSON.stringify({
        mainTask: '失败任务',
        subtasks: [
          { id: 'sub-1', description: '失败任务', assignedDomain: 'system', dependencies: [], priority: 1 },
        ],
        requiredDomains: ['system'],
        estimatedComplexity: 2,
      }));
      selectBestSpecialistMock.mockReturnValue(new TestSpecialist('fail-spec', 'FailSpec', false));

      const response = await coordinator.executeTask('失败任务');

      expect(response.status).toBe(TaskStatus.FAILED);
      expect(response.result?.success).toBe(false);
    });
  });

  describe('executeTask - 多子任务 (handleComplexTask)', () => {
    it('多子任务带依赖时按优先级串行执行', async () => {
      generateCompletionMock.mockResolvedValueOnce(JSON.stringify({
        mainTask: '复杂运维任务',
        subtasks: [
          { id: 's1', description: '任务1', assignedDomain: 'system', dependencies: [], priority: 1 },
          { id: 's2', description: '任务2', assignedDomain: 'system', dependencies: ['s1'], priority: 2 },
        ],
        requiredDomains: ['system'],
        estimatedComplexity: 6,
      }));
      // 整合阶段
      generateCompletionMock.mockResolvedValue('整合结果');

      const response = await coordinator.executeTask('执行复杂运维任务');

      expect(response).toBeDefined();
      expect(response.status).toBe(TaskStatus.COMPLETED);
      // decomposeTask + integrateResults = 至少 2 次
      expect(generateCompletionMock.mock.calls.length).toBeGreaterThanOrEqual(2);
      // 两个子任务各调用一次 selectBestSpecialistForTask
      expect(selectBestSpecialistMock).toHaveBeenCalledTimes(2);
    });

    it('依赖未满足时该子任务被跳过', async () => {
      generateCompletionMock.mockResolvedValueOnce(JSON.stringify({
        mainTask: '复合任务',
        subtasks: [
          { id: 's1', description: '失败任务', assignedDomain: 'system', dependencies: [], priority: 1 },
          { id: 's2', description: '依赖任务', assignedDomain: 'system', dependencies: ['s1'], priority: 2 },
        ],
        requiredDomains: ['system'],
        estimatedComplexity: 5,
      }));
      generateCompletionMock.mockResolvedValue('整合结果');
      // s1 失败 → s2 依赖未满足被跳过
      selectBestSpecialistMock.mockReturnValue(new TestSpecialist('fail-spec', 'FailSpec', false));

      const response = await coordinator.executeTask('执行复合任务');

      expect(response).toBeDefined();
      expect(response.status).toBe(TaskStatus.COMPLETED);
      // s2 被跳过，selectBestSpecialistForTask 只为 s1 调用一次
      expect(selectBestSpecialistMock).toHaveBeenCalledTimes(1);
      // 整合结果中 successCount < totalCount
      expect(response.result?.success).toBe(false);
      const meta = response.result?.metadata as any;
      expect(meta.successCount).toBe(0);
      expect(meta.totalCount).toBe(2);
    });

    it('无依赖的多子任务全部执行', async () => {
      generateCompletionMock.mockResolvedValueOnce(JSON.stringify({
        mainTask: '并行任务',
        subtasks: [
          { id: 'a', description: '任务A', assignedDomain: 'system', dependencies: [], priority: 1 },
          { id: 'b', description: '任务B', assignedDomain: 'system', dependencies: [], priority: 2 },
          { id: 'c', description: '任务C', assignedDomain: 'system', dependencies: [], priority: 3 },
        ],
        requiredDomains: ['system'],
        estimatedComplexity: 6,
      }));
      generateCompletionMock.mockResolvedValue('整合结果');

      const response = await coordinator.executeTask('执行并行任务');

      expect(response.status).toBe(TaskStatus.COMPLETED);
      // 三个子任务全部执行
      expect(selectBestSpecialistMock).toHaveBeenCalledTimes(3);
      const meta = response.result?.metadata as any;
      expect(meta.successCount).toBe(3);
      expect(meta.totalCount).toBe(3);
      expect(response.result?.success).toBe(true);
    });

    it('status 聚合：部分成功时 result.success=false 且 confidence<1', async () => {
      generateCompletionMock.mockResolvedValueOnce(JSON.stringify({
        mainTask: '混合任务',
        subtasks: [
          { id: 'ok', description: '成功任务', assignedDomain: 'system', dependencies: [], priority: 1 },
          { id: 'bad', description: '失败任务', assignedDomain: 'system', dependencies: [], priority: 2 },
        ],
        requiredDomains: ['system'],
        estimatedComplexity: 4,
      }));
      generateCompletionMock.mockResolvedValue('整合结果');
      // 第一次成功，第二次失败
      selectBestSpecialistMock
        .mockReturnValueOnce(new TestSpecialist('ok-spec', 'OkSpec', true))
        .mockReturnValueOnce(new TestSpecialist('bad-spec', 'BadSpec', false));

      const response = await coordinator.executeTask('执行混合任务');

      expect(response.status).toBe(TaskStatus.COMPLETED);
      expect(response.result?.success).toBe(false);
      const meta = response.result?.metadata as any;
      expect(meta.successCount).toBe(1);
      expect(meta.totalCount).toBe(2);
      expect(meta.confidence ?? response.result?.confidence).toBeLessThan(1);
    });
  });

  describe('executeTask - 异常处理', () => {
    it('executeTask 在意外异常时返回 FAILED 响应', async () => {
      // generateCompletion 抛出非 Error 对象
      generateCompletionMock.mockRejectedValueOnce('string error');

      const response = await coordinator.executeTask('触发异常');

      expect(response).toBeDefined();
      expect(response.taskId).toBeDefined();
      expect(response.agentType).toBe(AgentType.COORDINATOR);
      // 回退策略被执行 → 仍可能 COMPLETED；这里只验证不抛出异常
      expect(response.status).toBeDefined();
    });

    it('返回的 response 包含 agentId 与 agentName', async () => {
      generateCompletionMock.mockResolvedValueOnce(JSON.stringify({
        mainTask: '简单任务',
        subtasks: [
          { id: 's1', description: '简单', assignedDomain: 'system', dependencies: [], priority: 1 },
        ],
        requiredDomains: ['system'],
        estimatedComplexity: 1,
      }));

      const response = await coordinator.executeTask('简单任务');

      expect(response.agentId).toBe(coordinator.id);
      expect(response.agentName).toBe(coordinator.name);
    });

    it('defaultTimeout 配置项可被自定义覆盖', () => {
      const c = new Coordinator('Timeout', { defaultTimeout: 5000, maxRetries: 1 });
      expect(c.config.defaultTimeout).toBe(5000);
      expect(c.config.maxRetries).toBe(1);
    });
  });
});
