import { describe, it, expect, vi, beforeEach } from 'vitest';

// 使用 vi.hoisted 定义需在 vi.mock 工厂与测试用例间共享的 mock 函数
const mocks = vi.hoisted(() => {
  const run = vi.fn(() => ({ changes: 1, lastInsertRowid: 1 }));
  const get = vi.fn(() => ({ status: 'running' }));
  const prepare = vi.fn(() => ({ run, get }));
  const ioToEmit = vi.fn();
  const ioTo = vi.fn(() => ({ emit: ioToEmit }));
  const ioEmit = vi.fn();
  return { run, get, prepare, ioTo, ioEmit, ioToEmit };
});

vi.mock("../../../models/database", () => ({
  default: { prepare: mocks.prepare },
  db: { prepare: mocks.prepare },
  initializeDatabase: vi.fn(),
  performMaintenance: vi.fn(),
  getIOInstance: vi.fn(() => ({ to: mocks.ioTo, emit: mocks.ioEmit })),
}));
vi.mock("../../../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("./workflowExecutor/basicNodeHandlers", () => ({
  handleApprovalNode: vi.fn(),
  handleAgentNode: vi.fn(),
}));
vi.mock("./workflowExecutor/enhancedNodeHandlers", () => ({
  handleVerificationNode: vi.fn(),
  handleRiskAssessNode: vi.fn(),
  handleDecisionNode: vi.fn(),
  handleKnowledgeNode: vi.fn(),
  handleRollbackNode: vi.fn(),
}));
vi.mock("./workflowExecutor/finalizeWorkflow", () => ({
  finalizeWorkflow: vi.fn(),
  generateWorkflowExecutionReport: vi.fn(),
}));

import { executeWorkflow } from './workflowExecutor';
import { handleAgentNode } from './workflowExecutor/basicNodeHandlers';
import { finalizeWorkflow, generateWorkflowExecutionReport } from './workflowExecutor/finalizeWorkflow';
import type { WorkflowParsed, WorkflowNode, WorkflowEdge } from '../../../types';

describe('workflowExecutor', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should be defined", () => { expect(executeWorkflow).toBeDefined(); });

  const baseWorkflow: WorkflowParsed = {
    id: 'wf-1',
    name: '测试工作流',
    description: '测试用',
    nodes: [
      { id: 'n1', type: 'agent', data: { label: 'Agent节点', agentId: 'test-agent' }, position: { x: 0, y: 0 } },
    ],
    edges: [],
    agent_configs: {},
    is_template: 0,
    created_at: '',
    updated_at: '',
  };

  it('executeWorkflow 被调用时不抛异常（mock db 返回有效数据）', async () => {
    vi.mocked(handleAgentNode).mockResolvedValue('continue');
    vi.mocked(finalizeWorkflow).mockResolvedValue(undefined);

    await expect(executeWorkflow('task-1', baseWorkflow, '初始输入')).resolves.not.toThrow();
    expect(mocks.prepare).toHaveBeenCalled();
  });

  it('节点执行的基本流程：agent 节点执行后调用 finalizeWorkflow', async () => {
    vi.mocked(handleAgentNode).mockResolvedValue('continue');
    vi.mocked(finalizeWorkflow).mockResolvedValue(undefined);

    await executeWorkflow('task-2', baseWorkflow, '输入');

    expect(handleAgentNode).toHaveBeenCalledTimes(1);
    expect(finalizeWorkflow).toHaveBeenCalledWith(
      'task-2',
      baseWorkflow,
      baseWorkflow.nodes,
      expect.any(Object),
      ['n1'],
      'completed'
    );
  });

  it('错误路径：循环依赖时将任务标记为 failed 并提前返回', async () => {
    const cyclicNodes: WorkflowNode[] = [
      { id: 'a', type: 'agent', data: { label: '节点A', agentId: 'agent-a' }, position: { x: 0, y: 0 } },
      { id: 'b', type: 'agent', data: { label: '节点B', agentId: 'agent-b' }, position: { x: 100, y: 0 } },
    ];
    const cyclicEdges: WorkflowEdge[] = [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'a' },
    ];
    const cyclicWorkflow: WorkflowParsed = {
      ...baseWorkflow,
      id: 'wf-cyclic',
      name: '循环依赖工作流',
      nodes: cyclicNodes,
      edges: cyclicEdges,
    };

    await executeWorkflow('task-cyclic', cyclicWorkflow);

    expect(handleAgentNode).not.toHaveBeenCalled();
    expect(mocks.run).toHaveBeenCalledWith('failed', 'task-cyclic');
    expect(finalizeWorkflow).not.toHaveBeenCalled();
  });

  it('错误路径：节点处理器抛出异常时将任务标记为 failed', async () => {
    vi.mocked(handleAgentNode).mockRejectedValue(new Error('Agent执行失败'));
    vi.mocked(generateWorkflowExecutionReport).mockResolvedValue(undefined);

    await executeWorkflow('task-error', baseWorkflow, '输入');

    expect(handleAgentNode).toHaveBeenCalledTimes(1);
    expect(mocks.run).toHaveBeenCalledWith('failed', 'task-error');
    expect(generateWorkflowExecutionReport).toHaveBeenCalledWith(
      'task-error',
      baseWorkflow,
      expect.any(Array),
      expect.any(Object),
      expect.any(Array),
      'failed',
      'Agent执行失败'
    );
  });
});
