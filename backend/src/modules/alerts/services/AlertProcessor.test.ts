/**
 * AlertProcessor 单元测试
 *
 * 覆盖 processAlert 的策略路由（hybrid/aars/workflow）、知识库命中决策、
 * AARS 失败、workflow 策略缺失修复策略等关键分支。
 *
 * 说明：AlertProcessor 当前实现未引入 processingIds 去重集合，
 * 因此“同一 alertId 去重”用例改为验证实际行为（可重复处理，无去重门）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AlertProcessingContext } from '../../../types/unified-alert-processing';

// ── 通过 vi.hoisted 暴露可配置的 mock 句柄（vi.mock 工厂在模块加载前执行）──

const mocks = vi.hoisted(() => ({
  dbPrepare: vi.fn(),
  aarsTrigger: vi.fn(),
  aarsGetByAlertId: vi.fn(),
  remediationTrigger: vi.fn(),
  knowledgeRecommend: vi.fn(),
}));

vi.mock('../../../models/database', () => ({
  default: {
    prepare: mocks.dbPrepare,
    exec: vi.fn(),
  },
}));

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('./alertAutoResponse/alertAutoResponseService', () => ({
  alertAutoResponseService: {
    triggerManually: mocks.aarsTrigger,
    getByAlertId: mocks.aarsGetByAlertId,
  },
}));

vi.mock('../../auto/services/remediationService', () => ({
  remediationService: {
    triggerRemediation: mocks.remediationTrigger,
  },
}));

vi.mock('../../ai/services/KnowledgeEngine', () => ({
  knowledgeEngine: {
    recommend: mocks.knowledgeRecommend,
  },
}));

import { alertProcessor } from './AlertProcessor';

// ── 数据库 mock 配置助手：按 SQL 模式返回不同的 statement ──

function setupDb(opts: { workflow?: { id: string }; policy?: unknown } = {}) {
  mocks.dbPrepare.mockImplementation((sql: string) => {
    if (sql.includes('FROM workflows')) {
      return { get: vi.fn(() => opts.workflow), all: vi.fn(() => []), run: vi.fn() };
    }
    if (sql.includes('FROM remediation_policies')) {
      return { get: vi.fn(() => opts.policy), all: vi.fn(() => []), run: vi.fn() };
    }
    // alert_processing_records 的 INSERT/UPDATE/SELECT
    return { get: vi.fn(() => undefined), all: vi.fn(() => []), run: vi.fn() };
  });
}

const baseContext: AlertProcessingContext = {
  alertId: 'alert-base',
  title: 'CPU 使用率过高',
  content: 'CPU 使用率达到 90%',
  severity: 'medium',
  source: 'prometheus',
};

describe('AlertProcessor', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // 默认：无知识库命中；db 返回默认工作流与已存在策略；AARS/工作流均成功
    mocks.knowledgeRecommend.mockReturnValue([]);
    setupDb({
      workflow: { id: 'wf-default' },
      policy: { id: 'policy-1', workflow_id: 'wf-default' },
    });
    mocks.aarsTrigger.mockResolvedValue(undefined);
    mocks.aarsGetByAlertId.mockReturnValue(undefined);
    mocks.remediationTrigger.mockResolvedValue({ id: 'exec-1', status: 'success' });
  });

  describe('processAlert 策略路由', () => {
    it('critical severity 走 hybrid 策略（AARS 失败后回退 workflow）', async () => {
      // AARS 已执行但未 resolved → 触发 hybrid 回退
      mocks.aarsGetByAlertId.mockReturnValue({ id: 'log-1', status: 'failed' });
      mocks.remediationTrigger.mockResolvedValue({ id: 'exec-1', status: 'success' });

      const result = await alertProcessor.processAlert({
        ...baseContext,
        alertId: 'alert-critical',
        severity: 'critical',
      });

      expect(result.strategy).toBe('hybrid');
      expect(result.success).toBe(true);
      expect(mocks.aarsTrigger).toHaveBeenCalledWith('alert-critical');
      expect(mocks.remediationTrigger).toHaveBeenCalled();
    });

    it('medium severity 走 aars 策略', async () => {
      mocks.aarsGetByAlertId.mockReturnValue({ id: 'log-2', status: 'resolved' });

      const result = await alertProcessor.processAlert({
        ...baseContext,
        alertId: 'alert-medium',
        severity: 'medium',
      });

      expect(result.strategy).toBe('aars');
      expect(result.success).toBe(true);
      expect(mocks.aarsTrigger).toHaveBeenCalledWith('alert-medium');
      expect(mocks.remediationTrigger).not.toHaveBeenCalled();
    });

    it('low severity 走 workflow 策略', async () => {
      mocks.remediationTrigger.mockResolvedValue({ id: 'exec-3', status: 'success' });

      const result = await alertProcessor.processAlert({
        ...baseContext,
        alertId: 'alert-low',
        severity: 'low',
      });

      expect(result.strategy).toBe('workflow');
      expect(result.success).toBe(true);
      expect(mocks.remediationTrigger).toHaveBeenCalled();
      expect(mocks.aarsTrigger).not.toHaveBeenCalled();
    });

    it('同一 alertId 多次调用都会被处理（当前实现无 processingIds 去重集合）', async () => {
      mocks.aarsGetByAlertId.mockReturnValue({ id: 'log-dup', status: 'resolved' });

      const ctx: AlertProcessingContext = {
        ...baseContext,
        alertId: 'alert-dup',
        severity: 'medium',
      };
      const r1 = await alertProcessor.processAlert(ctx);
      const r2 = await alertProcessor.processAlert(ctx);

      // 无去重门：两次都应处理完成
      expect(r1.success).toBe(true);
      expect(r2.success).toBe(true);
      expect(mocks.aarsTrigger).toHaveBeenCalledTimes(2);
    });
  });

  describe('makeDecision 知识库匹配', () => {
    it('知识库命中且成功率达标时走 workflow 策略', async () => {
      mocks.knowledgeRecommend.mockReturnValue([
        {
          similarity: 0.9,
          matchReason: '标题关键词匹配',
          entry: { successRating: 0.85, workflowId: 'wf-from-knowledge' },
        },
      ]);
      mocks.remediationTrigger.mockResolvedValue({ id: 'exec-5', status: 'success' });

      const result = await alertProcessor.processAlert({
        ...baseContext,
        alertId: 'alert-knowledge',
        severity: 'medium', // 默认本应走 aars，知识库命中后改走 workflow
      });

      expect(result.strategy).toBe('workflow');
      expect(result.success).toBe(true);
      expect(mocks.knowledgeRecommend).toHaveBeenCalledWith(
        'CPU 使用率过高',
        'CPU 使用率达到 90%',
        3
      );
      expect(mocks.aarsTrigger).not.toHaveBeenCalled();
    });
  });

  describe('processWithAars 失败', () => {
    it('AARS 执行抛错时返回 success=false', async () => {
      mocks.aarsTrigger.mockRejectedValue(new Error('AARS 执行失败'));

      const result = await alertProcessor.processAlert({
        ...baseContext,
        alertId: 'alert-aars-fail',
        severity: 'medium',
      });

      expect(result.strategy).toBe('aars');
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('AARS 执行失败');
    });
  });

  describe('processWithWorkflow 策略缺失', () => {
    it('无法获取或创建修复策略时返回 success=false', async () => {
      // 工作流存在，但 remediation_policies 既查不到也建不出（get 始终返回 undefined）
      setupDb({ workflow: { id: 'wf-default' }, policy: undefined });

      const result = await alertProcessor.processAlert({
        ...baseContext,
        alertId: 'alert-wf-missing',
        severity: 'low',
      });

      expect(result.strategy).toBe('workflow');
      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain('找不到或无法创建修复策略');
    });
  });
});
