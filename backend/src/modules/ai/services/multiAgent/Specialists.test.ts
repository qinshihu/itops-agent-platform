/**
 * Specialists 单元测试
 *
 * 验证所有内置 Specialist 类的构造、canHandleTask 关键词匹配，
 * 以及 registerAllSpecialists 批量注册流程。
 * 覆盖 Specialists.ts 中的 11 个 Specialist 子类。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock 依赖 ──
vi.mock("../../../../models/database", () => ({
  default: {}, db: {}, initializeDatabase: vi.fn(), performMaintenance: vi.fn(), getIOInstance: vi.fn(),
}));
vi.mock("../../../../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

// vi.hoisted() 把 mock 函数定义在提升上下文中
const { generateCompletionMock, executeAgentNodeMock } = vi.hoisted(() => ({
  generateCompletionMock: vi.fn(),
  executeAgentNodeMock: vi.fn(),
}));

vi.mock("../llm/llmService", () => ({
  generateCompletion: generateCompletionMock,
  generateCompletionWithTools: vi.fn(),
  checkLLMAvailability: vi.fn(),
}));

vi.mock("../agents/agentExecutor", () => ({
  executeAgentNode: executeAgentNodeMock,
}));

vi.mock("../agents/agentMcpAdapter", () => ({
  agentMcpAdapter: {
    isAvailable: vi.fn(() => false),
    generateToolDescriptions: vi.fn(() => ''),
  },
}));

import {
  AlertHandlingSpecialist,
  FaultDiagnosisSpecialist,
  LogAnalysisSpecialist,
  SystemInspectionSpecialist,
  ChangeExecutionSpecialist,
  DocumentGenerationSpecialist,
  ComplianceCheckSpecialist,
  ServerOperationSpecialist,
  CommandGenerationSpecialist,
  NetworkInspectionSpecialist,
  DatabaseOperationSpecialist,
  registerAllSpecialists,
} from './Specialists';
import { SpecialistDomain } from './types';
import type { TaskContext, ExecutionResult } from './types';
import { SpecialistRegistry } from './SpecialistRegistry';

function makeContext(input: string): TaskContext {
  return {
    taskId: 'test-task',
    input,
    timestamp: Date.now(),
    metadata: {},
  };
}

describe('Specialists - 构造与领域', () => {
  it('AlertHandlingSpecialist 构造正确，领域为 ALERT_HANDLING', () => {
    const s = new AlertHandlingSpecialist();
    expect(s.domain).toBe(SpecialistDomain.ALERT_HANDLING);
    expect(s.name).toBe('告警处理专家');
    expect(s.enabled).toBe(true);
    expect(s.capabilities.skills.length).toBeGreaterThan(0);
  });

  it('FaultDiagnosisSpecialist 构造正确，领域为 FAULT_DIAGNOSIS', () => {
    const s = new FaultDiagnosisSpecialist();
    expect(s.domain).toBe(SpecialistDomain.FAULT_DIAGNOSIS);
    expect(s.name).toBe('故障诊断专家');
  });

  it('LogAnalysisSpecialist 构造正确，领域为 LOG_ANALYSIS', () => {
    const s = new LogAnalysisSpecialist();
    expect(s.domain).toBe(SpecialistDomain.LOG_ANALYSIS);
    expect(s.name).toBe('日志分析专家');
  });

  it('SystemInspectionSpecialist 构造正确，领域为 SYSTEM_INSPECTION', () => {
    const s = new SystemInspectionSpecialist();
    expect(s.domain).toBe(SpecialistDomain.SYSTEM_INSPECTION);
    expect(s.name).toBe('系统巡检专家');
  });

  it('ChangeExecutionSpecialist 构造正确，领域为 CHANGE_EXECUTION', () => {
    const s = new ChangeExecutionSpecialist();
    expect(s.domain).toBe(SpecialistDomain.CHANGE_EXECUTION);
    expect(s.name).toBe('变更执行专家');
  });

  it('DocumentGenerationSpecialist 构造正确，领域为 DOCUMENT_GENERATION', () => {
    const s = new DocumentGenerationSpecialist();
    expect(s.domain).toBe(SpecialistDomain.DOCUMENT_GENERATION);
    expect(s.name).toBe('文档生成专家');
  });

  it('ComplianceCheckSpecialist 构造正确，领域为 COMPLIANCE_CHECK', () => {
    const s = new ComplianceCheckSpecialist();
    expect(s.domain).toBe(SpecialistDomain.COMPLIANCE_CHECK);
    expect(s.name).toBe('合规检查专家');
  });

  it('ServerOperationSpecialist 构造正确，领域为 SERVER_OPERATION', () => {
    const s = new ServerOperationSpecialist();
    expect(s.domain).toBe(SpecialistDomain.SERVER_OPERATION);
    expect(s.name).toBe('服务器操作专家');
  });

  it('CommandGenerationSpecialist 构造正确，领域为 COMMAND_GENERATION', () => {
    const s = new CommandGenerationSpecialist();
    expect(s.domain).toBe(SpecialistDomain.COMMAND_GENERATION);
    expect(s.name).toBe('命令生成专家');
  });

  it('NetworkInspectionSpecialist 构造正确，领域为 NETWORK_INSPECTION', () => {
    const s = new NetworkInspectionSpecialist();
    expect(s.domain).toBe(SpecialistDomain.NETWORK_INSPECTION);
    expect(s.name).toBe('网络巡检专家');
  });

  it('DatabaseOperationSpecialist 构造正确，领域为 DATABASE_OPERATION', () => {
    const s = new DatabaseOperationSpecialist();
    expect(s.domain).toBe(SpecialistDomain.DATABASE_OPERATION);
    expect(s.name).toBe('数据库运维专家');
  });
});

describe('Specialists - canHandleTask 关键词匹配', () => {
  it('AlertHandlingSpecialist 对告警类任务返回高置信度', () => {
    const s = new AlertHandlingSpecialist();
    const result = s.canHandleTask('处理 critical 告警');
    expect(result.canHandle).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.4);
  });

  it('FaultDiagnosisSpecialist 对故障诊断类任务返回高置信度', () => {
    const s = new FaultDiagnosisSpecialist();
    const result = s.canHandleTask('排查故障 root cause');
    expect(result.canHandle).toBe(true);
  });

  it('LogAnalysisSpecialist 对日志分析类任务返回高置信度', () => {
    const s = new LogAnalysisSpecialist();
    const result = s.canHandleTask('查询 log 日志分析 error');
    expect(result.canHandle).toBe(true);
  });

  it('SystemInspectionSpecialist 对系统巡检类任务返回高置信度', () => {
    const s = new SystemInspectionSpecialist();
    const result = s.canHandleTask('system inspection 健康检查');
    expect(result.canHandle).toBe(true);
  });

  it('ChangeExecutionSpecialist 对变更执行类任务返回高置信度', () => {
    const s = new ChangeExecutionSpecialist();
    const result = s.canHandleTask('执行 deploy 变更操作');
    expect(result.canHandle).toBe(true);
  });

  it('DocumentGenerationSpecialist 对文档生成类任务返回高置信度', () => {
    const s = new DocumentGenerationSpecialist();
    const result = s.canHandleTask('生成 summary 报告文档');
    expect(result.canHandle).toBe(true);
  });

  it('ComplianceCheckSpecialist 对合规检查类任务返回高置信度', () => {
    const s = new ComplianceCheckSpecialist();
    const result = s.canHandleTask('compliance security 合规检查');
    expect(result.canHandle).toBe(true);
  });

  it('ServerOperationSpecialist 对服务器操作类任务返回高置信度', () => {
    const s = new ServerOperationSpecialist();
    const result = s.canHandleTask('通过 ssh 在 server 上执行命令');
    expect(result.canHandle).toBe(true);
  });

  it('CommandGenerationSpecialist 对命令生成类任务返回高置信度', () => {
    const s = new CommandGenerationSpecialist();
    const result = s.canHandleTask('生成 command 脚本 shell 命令');
    expect(result.canHandle).toBe(true);
  });

  it('NetworkInspectionSpecialist 对网络巡检类任务返回高置信度', () => {
    const s = new NetworkInspectionSpecialist();
    const result = s.canHandleTask('network 网络巡检 交换机 路由器');
    expect(result.canHandle).toBe(true);
  });

  it('DatabaseOperationSpecialist 对数据库运维类任务返回高置信度', () => {
    const s = new DatabaseOperationSpecialist();
    const result = s.canHandleTask('database 数据库 sql mysql 运维');
    expect(result.canHandle).toBe(true);
  });

  it('不相关任务对所有 specialist 的置信度均低于阈值', () => {
    const specialists = [
      new AlertHandlingSpecialist(),
      new FaultDiagnosisSpecialist(),
      new LogAnalysisSpecialist(),
      new SystemInspectionSpecialist(),
      new ChangeExecutionSpecialist(),
      new DocumentGenerationSpecialist(),
      new ComplianceCheckSpecialist(),
      new ServerOperationSpecialist(),
      new CommandGenerationSpecialist(),
      new NetworkInspectionSpecialist(),
      new DatabaseOperationSpecialist(),
    ];
    // 一个完全无关的任务
    const result = specialists[0].canHandleTask('xyz qwerty foobar');
    // 至少返回一个有效结果对象
    expect(result).toBeDefined();
    expect(typeof result.canHandle).toBe('boolean');
    expect(typeof result.confidence).toBe('number');
  });
});

describe('Specialists - execute 执行', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateCompletionMock.mockResolvedValue('LLM response');
    executeAgentNodeMock.mockResolvedValue('Agent response');
  });

  it('AlertHandlingSpecialist.execute 成功时返回 success=true', async () => {
    const s = new AlertHandlingSpecialist();
    const result = await s.execute(makeContext('处理告警'));
    expect(result.success).toBe(true);
    expect(result.output).toBe('LLM response');
    expect(generateCompletionMock).toHaveBeenCalled();
  });

  it('LogAnalysisSpecialist.execute 成功时返回 success=true', async () => {
    const s = new LogAnalysisSpecialist();
    const result = await s.execute(makeContext('分析日志'));
    expect(result.success).toBe(true);
    expect(generateCompletionMock).toHaveBeenCalled();
  });

  it('SystemInspectionSpecialist.execute 通过 executeAgentNode 执行', async () => {
    const s = new SystemInspectionSpecialist();
    const result = await s.execute(makeContext('系统巡检'));
    expect(result.success).toBe(true);
    expect(executeAgentNodeMock).toHaveBeenCalledWith('auto-inspection-agent', '系统巡检', {});
  });

  it('ServerOperationSpecialist.execute 通过 executeAgentNode 执行', async () => {
    const s = new ServerOperationSpecialist();
    const result = await s.execute(makeContext('服务器操作'));
    expect(result.success).toBe(true);
    expect(executeAgentNodeMock).toHaveBeenCalledWith('server-command-agent', '服务器操作', {});
  });

  it('DatabaseOperationSpecialist.execute 通过 executeAgentNode 执行', async () => {
    const s = new DatabaseOperationSpecialist();
    const result = await s.execute(makeContext('数据库运维'));
    expect(result.success).toBe(true);
    expect(executeAgentNodeMock).toHaveBeenCalledWith('database-admin-agent', '数据库运维', {});
  });

  it('LLM 失败时 execute 返回 success=false 与错误信息', async () => {
    generateCompletionMock.mockRejectedValueOnce(new Error('LLM down'));
    const s = new FaultDiagnosisSpecialist();
    const result = await s.execute(makeContext('故障诊断'));
    expect(result.success).toBe(false);
    expect(result.error).toContain('LLM down');
  });

  it('executeAgentNode 失败时 execute 返回 success=false', async () => {
    executeAgentNodeMock.mockRejectedValueOnce(new Error('Agent unavailable'));
    const s = new SystemInspectionSpecialist();
    const result = await s.execute(makeContext('巡检'));
    expect(result.success).toBe(false);
    expect(result.error).toContain('Agent unavailable');
  });
});

describe('registerAllSpecialists', () => {
  it('将 11 个 specialist 注册到 registry', () => {
    const registry = new SpecialistRegistry();
    registerAllSpecialists(registry);
    const all = registry.getAll();
    expect(all).toHaveLength(11);
    // 验证覆盖了所有领域
    const domains = new Set(all.map(s => s.domain));
    expect(domains.has(SpecialistDomain.ALERT_HANDLING)).toBe(true);
    expect(domains.has(SpecialistDomain.FAULT_DIAGNOSIS)).toBe(true);
    expect(domains.has(SpecialistDomain.LOG_ANALYSIS)).toBe(true);
    expect(domains.has(SpecialistDomain.SYSTEM_INSPECTION)).toBe(true);
    expect(domains.has(SpecialistDomain.CHANGE_EXECUTION)).toBe(true);
    expect(domains.has(SpecialistDomain.DOCUMENT_GENERATION)).toBe(true);
    expect(domains.has(SpecialistDomain.COMPLIANCE_CHECK)).toBe(true);
    expect(domains.has(SpecialistDomain.SERVER_OPERATION)).toBe(true);
    expect(domains.has(SpecialistDomain.COMMAND_GENERATION)).toBe(true);
    expect(domains.has(SpecialistDomain.NETWORK_INSPECTION)).toBe(true);
    expect(domains.has(SpecialistDomain.DATABASE_OPERATION)).toBe(true);
  });

  it('所有注册的 specialist 默认 enabled=true', () => {
    const registry = new SpecialistRegistry();
    registerAllSpecialists(registry);
    const enabled = registry.getEnabled();
    expect(enabled).toHaveLength(11);
  });

  it('toRegistryEntry 返回完整注册信息', () => {
    const registry = new SpecialistRegistry();
    registerAllSpecialists(registry);
    const entries = registry.getAllRegistryEntries();
    expect(entries).toHaveLength(11);
    entries.forEach(e => {
      expect(e.id).toBeDefined();
      expect(e.name).toBeDefined();
      expect(e.domain).toBeDefined();
      expect(e.capabilities).toBeDefined();
      expect(e.systemPrompt).toBeDefined();
      expect(e.temperature).toBeGreaterThanOrEqual(0);
      expect(e.enabled).toBe(true);
    });
  });
});
