/**
 * SpecialistRegistry 单元测试
 *
 * 验证注册、查询、按领域/启用状态过滤、
 * selectBestSpecialistForTask 选择逻辑以及关键词匹配置信度评估。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock 依赖 ──
vi.mock("../../../../models/database", () => ({
  default: {}, db: {}, initializeDatabase: vi.fn(), performMaintenance: vi.fn(), getIOInstance: vi.fn(),
}));
vi.mock("../../../../utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() },
}));

import { SpecialistRegistry } from './SpecialistRegistry';
import { SpecialistBase } from './SpecialistBase';
import { SpecialistDomain } from './types';
import type { TaskContext, ExecutionResult, AgentCapability } from './types';
import { logger } from '../../../../utils/logger';

/**
 * 可控制的测试 Specialist。
 * 参照 coordinatorFlow.test.ts 中的 TestSpecialist 模式：
 *   - super() 调用传入正确参数
 *   - 实现 abstract execute()
 *   - 可重写 canHandleTask 控制返回值
 */
class TestSpecialist extends SpecialistBase {
  private handleConfidence: number;
  private canHandleFlag: boolean;

  constructor(
    id: string,
    name: string,
    domain: SpecialistDomain,
    skills: string[],
    canHandle = true,
    confidence = 0.8,
    confidenceThreshold = 0.3
  ) {
    const capabilities: AgentCapability = {
      domain,
      skills,
      confidenceThreshold,
    };
    super(name, domain, capabilities, 'You are a test specialist', 0.5, id);
    this.handleConfidence = confidence;
    this.canHandleFlag = canHandle;
  }

  async execute(context: TaskContext): Promise<ExecutionResult> {
    return this.buildResult(true, `executed: ${context.input}`, {
      confidence: this.handleConfidence,
      metadata: { taskId: context.taskId },
    });
  }

  canHandleTask(_taskInput: string): { canHandle: boolean; confidence: number; reason?: string } {
    return { canHandle: this.canHandleFlag, confidence: this.handleConfidence };
  }
}

/**
 * 不重写 canHandleTask 的 specialist，用于测试 SpecialistBase 的关键词匹配置信度评估。
 */
class KeywordSpecialist extends SpecialistBase {
  constructor(
    id: string,
    domain: SpecialistDomain,
    skills: string[],
    confidenceThreshold: number
  ) {
    super(
      id,
      domain,
      { domain, skills, confidenceThreshold },
      'system prompt',
      0.7,
      id
    );
  }

  async execute(context: TaskContext): Promise<ExecutionResult> {
    return this.buildResult(true, `handled: ${context.input}`);
  }
}

describe('SpecialistRegistry', () => {
  let registry: SpecialistRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new SpecialistRegistry();
  });

  describe('register / registerMany', () => {
    it('register 后可通过 getAll 取出该 specialist', () => {
      const s = new TestSpecialist('s1', 'Spec1', SpecialistDomain.SYSTEM_INSPECTION, ['检查']);
      registry.register(s);
      const all = registry.getAll();
      expect(all).toHaveLength(1);
      expect(all[0]).toBe(s);
    });

    it('重复注册相同 ID 会覆盖前一个并记录 warn', () => {
      const s1 = new TestSpecialist('dup-1', 'SpecA', SpecialistDomain.SYSTEM_INSPECTION, ['检查']);
      const s2 = new TestSpecialist('dup-1', 'SpecB', SpecialistDomain.SYSTEM_INSPECTION, ['巡检']);
      registry.register(s1);
      registry.register(s2);
      const all = registry.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].name).toBe('SpecB');
      expect(logger.warn).toHaveBeenCalled();
    });

    it('registerMany 批量注册多个 specialists', () => {
      const s1 = new TestSpecialist('m1', 'SpecA', SpecialistDomain.SYSTEM_INSPECTION, ['检查']);
      const s2 = new TestSpecialist('m2', 'SpecB', SpecialistDomain.ALERT_HANDLING, ['告警']);
      registry.registerMany([s1, s2]);
      expect(registry.getAll()).toHaveLength(2);
    });

    it('register 同时按领域建立索引', () => {
      registry.register(new TestSpecialist('idx-1', 'A', SpecialistDomain.ALERT_HANDLING, ['告警']));
      registry.register(new TestSpecialist('idx-2', 'B', SpecialistDomain.ALERT_HANDLING, ['alert']));
      registry.register(new TestSpecialist('idx-3', 'C', SpecialistDomain.LOG_ANALYSIS, ['log']));
      expect(registry.getByDomain(SpecialistDomain.ALERT_HANDLING)).toHaveLength(2);
      expect(registry.getByDomain(SpecialistDomain.LOG_ANALYSIS)).toHaveLength(1);
    });
  });

  describe('getAll / getEnabled', () => {
    it('getAll 返回所有已注册 specialists', () => {
      registry.registerMany([
        new TestSpecialist('a1', 'A', SpecialistDomain.SYSTEM_INSPECTION, ['检查']),
        new TestSpecialist('a2', 'B', SpecialistDomain.ALERT_HANDLING, ['告警']),
      ]);
      expect(registry.getAll()).toHaveLength(2);
    });

    it('空 registry 的 getAll 返回空数组', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('getEnabled 仅返回 enabled=true 的 specialists', () => {
      const enabled = new TestSpecialist('e1', 'Enabled', SpecialistDomain.SYSTEM_INSPECTION, ['检查']);
      const disabled = new TestSpecialist('e2', 'Disabled', SpecialistDomain.SYSTEM_INSPECTION, ['检查']);
      disabled.enabled = false;
      registry.registerMany([enabled, disabled]);
      const result = registry.getEnabled();
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('e1');
    });

    it('getEnabled 是 getAll 的子集', () => {
      const s1 = new TestSpecialist('sub-1', 'A', SpecialistDomain.SYSTEM_INSPECTION, ['检查']);
      const s2 = new TestSpecialist('sub-2', 'B', SpecialistDomain.ALERT_HANDLING, ['告警']);
      s2.enabled = false;
      registry.registerMany([s1, s2]);
      const enabled = registry.getEnabled();
      expect(enabled.length).toBeLessThanOrEqual(registry.getAll().length);
      expect(enabled.map(s => s.id)).toContain('sub-1');
      expect(enabled.map(s => s.id)).not.toContain('sub-2');
    });
  });

  describe('getById / getByDomain', () => {
    it('getById 根据 ID 返回对应 specialist', () => {
      const s = new TestSpecialist('gid-1', 'Spec', SpecialistDomain.LOG_ANALYSIS, ['log']);
      registry.register(s);
      expect(registry.getById('gid-1')).toBe(s);
    });

    it('getById 对未注册 ID 返回 undefined', () => {
      expect(registry.getById('non-existent')).toBeUndefined();
    });

    it('getByDomain 返回该领域所有 specialists', () => {
      registry.registerMany([
        new TestSpecialist('d1', 'SpecA', SpecialistDomain.ALERT_HANDLING, ['告警']),
        new TestSpecialist('d2', 'SpecB', SpecialistDomain.ALERT_HANDLING, ['alert']),
        new TestSpecialist('d3', 'SpecC', SpecialistDomain.LOG_ANALYSIS, ['log']),
      ]);
      expect(registry.getByDomain(SpecialistDomain.ALERT_HANDLING)).toHaveLength(2);
      expect(registry.getByDomain(SpecialistDomain.LOG_ANALYSIS)).toHaveLength(1);
    });

    it('getByDomain 对未注册领域返回空数组', () => {
      expect(registry.getByDomain(SpecialistDomain.COMPLIANCE_CHECK)).toEqual([]);
    });
  });

  describe('selectBestSpecialistForTask', () => {
    it('返回置信度最高的 specialist', () => {
      const low = new TestSpecialist('best-1', 'Low', SpecialistDomain.SYSTEM_INSPECTION, ['检查'], true, 0.5);
      const high = new TestSpecialist('best-2', 'High', SpecialistDomain.SYSTEM_INSPECTION, ['检查'], true, 0.9);
      registry.registerMany([low, high]);
      const result = registry.selectBestSpecialistForTask('检查 CPU');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('best-2');
    });

    it('当所有 specialist 都不能处理时返回 null', () => {
      const s = new TestSpecialist('none-1', 'Spec', SpecialistDomain.SYSTEM_INSPECTION, ['检查'], false, 0.1);
      registry.register(s);
      const result = registry.selectBestSpecialistForTask('不相干任务');
      expect(result).toBeNull();
    });

    it('禁用的 specialist 不参与选择', () => {
      const disabled = new TestSpecialist('skip-1', 'Disabled', SpecialistDomain.SYSTEM_INSPECTION, ['检查'], true, 0.9);
      disabled.enabled = false;
      registry.register(disabled);
      const result = registry.selectBestSpecialistForTask('检查 CPU');
      expect(result).toBeNull();
    });

    it('空 registry 返回 null', () => {
      const result = registry.selectBestSpecialistForTask('任意任务');
      expect(result).toBeNull();
    });

    it('只考虑 canHandle=true 的 specialist 并按 confidence 降序选择', () => {
      // 三个候选：一个 canHandle=false，两个 canHandle=true，置信度不同
      const cannot = new TestSpecialist('cant', 'Cant', SpecialistDomain.SYSTEM_INSPECTION, ['x'], false, 0.95);
      const mid = new TestSpecialist('mid', 'Mid', SpecialistDomain.SYSTEM_INSPECTION, ['y'], true, 0.6);
      const top = new TestSpecialist('top', 'Top', SpecialistDomain.SYSTEM_INSPECTION, ['z'], true, 0.85);
      registry.registerMany([cannot, mid, top]);
      const result = registry.selectBestSpecialistForTask('some task');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('top');
    });
  });

  describe('关键词匹配（SpecialistBase.assessConfidence）', () => {
    it('包含匹配关键词的任务获得更高置信度', () => {
      const s = new KeywordSpecialist(
        'kw-1',
        SpecialistDomain.SYSTEM_INSPECTION,
        ['system', 'inspection', 'cpu', 'health'],
        0.3
      );
      const matched = s.canHandleTask('system inspection for cpu health');
      expect(matched.canHandle).toBe(true);
      expect(matched.confidence).toBeGreaterThan(0.3);
    });

    it('不匹配任何关键词时 confidence 低于阈值且 canHandle 为 false', () => {
      const s = new KeywordSpecialist(
        'kw-2',
        SpecialistDomain.COMMAND_GENERATION,
        ['命令', '生成', 'command'],
        0.6
      );
      const matched = s.canHandleTask('完全无关的任务描述 xyz');
      expect(matched.canHandle).toBe(false);
      expect(matched.confidence).toBeLessThan(0.6);
    });

    it('部分匹配时 confidence 介于最小值与最大值之间', () => {
      const s = new KeywordSpecialist(
        'kw-3',
        SpecialistDomain.ALERT_HANDLING,
        ['告警', 'alert', 'critical', 'severity'],
        0.2
      );
      // 仅匹配 alert
      const matched = s.canHandleTask('please alert me');
      expect(matched.confidence).toBeGreaterThan(0.2);
      expect(matched.confidence).toBeLessThan(0.8);
    });

    it('空 skills 数组时 confidence 为最小值（0.2）', () => {
      const s = new KeywordSpecialist(
        'kw-4',
        SpecialistDomain.LOG_ANALYSIS,
        [],
        0.3
      );
      const matched = s.canHandleTask('anything');
      // skillCount===0 → 返回 minConfidence (0.2)，低于阈值 0.3 → canHandle=false
      expect(matched.confidence).toBe(0.2);
      expect(matched.canHandle).toBe(false);
    });
  });

  describe('unregister / clear', () => {
    it('unregister 移除已注册 specialist 并返回 true', () => {
      const s = new TestSpecialist('u-1', 'Spec', SpecialistDomain.SYSTEM_INSPECTION, ['检查']);
      registry.register(s);
      expect(registry.unregister('u-1')).toBe(true);
      expect(registry.getAll()).toHaveLength(0);
      expect(registry.getByDomain(SpecialistDomain.SYSTEM_INSPECTION)).toHaveLength(0);
    });

    it('unregister 对未注册 ID 返回 false', () => {
      expect(registry.unregister('not-there')).toBe(false);
    });

    it('unregister 后其它 specialist 不受影响', () => {
      registry.registerMany([
        new TestSpecialist('keep-1', 'A', SpecialistDomain.SYSTEM_INSPECTION, ['检查']),
        new TestSpecialist('keep-2', 'B', SpecialistDomain.ALERT_HANDLING, ['告警']),
      ]);
      registry.unregister('keep-1');
      expect(registry.getAll()).toHaveLength(1);
      expect(registry.getById('keep-2')).toBeDefined();
    });

    it('clear 清空所有注册', () => {
      registry.registerMany([
        new TestSpecialist('c-1', 'A', SpecialistDomain.SYSTEM_INSPECTION, ['检查']),
        new TestSpecialist('c-2', 'B', SpecialistDomain.ALERT_HANDLING, ['告警']),
      ]);
      registry.clear();
      expect(registry.getAll()).toHaveLength(0);
      expect(registry.getByDomain(SpecialistDomain.SYSTEM_INSPECTION)).toHaveLength(0);
    });
  });

  describe('getAllRegistryEntries', () => {
    it('返回所有 specialist 的 registry entry', () => {
      registry.register(new TestSpecialist('r-1', 'Spec', SpecialistDomain.LOG_ANALYSIS, ['log']));
      const entries = registry.getAllRegistryEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe('r-1');
      expect(entries[0].domain).toBe(SpecialistDomain.LOG_ANALYSIS);
      expect(entries[0].enabled).toBe(true);
    });

    it('registry entry 包含 capabilities 与 systemPrompt', () => {
      registry.register(new TestSpecialist('r-2', 'Spec', SpecialistDomain.ALERT_HANDLING, ['告警']));
      const entries = registry.getAllRegistryEntries();
      expect(entries[0].capabilities).toBeDefined();
      expect(entries[0].capabilities.skills).toContain('告警');
      expect(entries[0].systemPrompt).toBe('You are a test specialist');
    });

    it('空 registry 返回空数组', () => {
      expect(registry.getAllRegistryEntries()).toEqual([]);
    });
  });
});
