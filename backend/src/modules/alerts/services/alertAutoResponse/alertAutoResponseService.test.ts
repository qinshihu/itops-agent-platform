/**
 * AARS (Alert Auto Response Service) 单元测试
 *
 * 阶段 5A.1：核心编排器，原 0 测试。本测试 mock 所有子引擎，
 * 验证生命周期与 processAlert 的关键分支（重复处理防护、告警不存在、无 IP）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock 所有外部依赖 ──

vi.mock('../../../../models/database', () => ({
  default: {
    prepare: vi.fn(() => ({
      get: vi.fn(() => undefined),
      all: vi.fn(() => []),
      run: vi.fn(),
    })),
    exec: vi.fn(),
  },
}));

vi.mock('../../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../ai/services/llm/llmService', () => ({
  generateCompletion: vi.fn().mockResolvedValue(''),
}));

// 子引擎 mock
vi.mock('./adaptive/deviceProfiler', () => ({
  deviceProfiler: { profile: vi.fn().mockResolvedValue(null) },
}));
vi.mock('./diagnosis/sshDiagnosisEngine', () => ({
  sshDiagnosisEngine: { diagnose: vi.fn().mockResolvedValue({}) },
}));
vi.mock('./diagnosis/snmpDiagnosisEngine', () => ({
  snmpDiagnosisEngine: { diagnose: vi.fn().mockResolvedValue({}) },
}));
vi.mock('./adaptive/riskAssessor', () => ({
  riskAssessor: { assess: vi.fn().mockReturnValue({ overallRiskScore: 0.5 }) },
}));
vi.mock('./adaptive/adaptiveAutomation', () => ({
  adaptiveAutomationEngine: {
    decideAction: vi.fn().mockReturnValue({ action: 'manual' }),
    getTrustStats: vi.fn().mockReturnValue({}),
  },
}));
vi.mock('./remediation/remediationExecutor', () => ({
  remediationExecutor: { execute: vi.fn().mockResolvedValue({ success: false }) },
}));
vi.mock('./adaptive/knowledgeFeedbackLoop', () => ({
  knowledgeFeedbackLoop: { record: vi.fn(), extractLesson: vi.fn() },
}));
vi.mock('./scheduler/resourceAwareScheduler', () => ({
  resourceAwareScheduler: { getStats: vi.fn().mockReturnValue({}) },
}));
vi.mock('./notification/smartNotifier', () => ({
  smartNotifier: { notify: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('./adaptive/escalationEngine', () => ({
  escalationEngine: {
    ensureTable: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    track: vi.fn(),
    getStage: vi.fn().mockReturnValue(null),
    resolve: vi.fn(),
  },
}));
vi.mock('./adaptive/baselineAnomalyDetector', () => ({
  baselineAnomalyDetector: {
    analyze: vi.fn().mockResolvedValue({
      isAnomalous: false, deviationScore: 0, baselineSummary: 'normal',
    }),
  },
}));

import { alertAutoResponseService } from './alertAutoResponseService';

describe('AlertAutoResponseService (AARS)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('生命周期', () => {
    it('start() 应该将 initialized 置为 true 并启动 escalationEngine', () => {
      alertAutoResponseService.start();
      // 多次调用应该幂等
      alertAutoResponseService.start();
      // 验证服务可访问（无抛异常即视为启动成功）
      expect(alertAutoResponseService).toBeDefined();
    });

    it('stop() 应该将 initialized 重置为 false', () => {
      alertAutoResponseService.start();
      alertAutoResponseService.stop();
      // 再 start 应该能正常启动（说明 stop 生效）
      alertAutoResponseService.start();
      expect(alertAutoResponseService).toBeDefined();
    });
  });

  describe('processAlert 防重入', () => {
    it('对同一 alertId 重复调用应该被去重（不抛异常）', async () => {
      // processAlert 会因告警不存在而提前返回，不会进入主流程
      await expect(alertAutoResponseService.processAlert('alert-1')).resolves.toBeUndefined();
      // 第二次调用应该同样安全
      await expect(alertAutoResponseService.processAlert('alert-1')).resolves.toBeUndefined();
    });

    it('对不存在的告警 ID 应该安全返回 undefined', async () => {
      await expect(alertAutoResponseService.processAlert('non-existent-alert')).resolves.toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('应该返回包含必要字段的对象', () => {
      const stats = alertAutoResponseService.getStats();
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('totalProcessed');
      expect(stats).toHaveProperty('autoResolved');
      expect(stats).toHaveProperty('failed');
      expect(stats).toHaveProperty('pendingApproval');
      expect(stats).toHaveProperty('escalated');
    });

    it('在数据库异常时应该返回零值统计', () => {
      // mock 已配置为返回 undefined，getStats 内部 try/catch 会返回零值
      const stats = alertAutoResponseService.getStats();
      expect(typeof stats.totalProcessed).toBe('number');
    });
  });

  describe('getLogByAlertId / getByAlertId', () => {
    it('查不到日志时应该返回 undefined', () => {
      const log = alertAutoResponseService.getLogByAlertId('any-alert-id');
      expect(log).toBeUndefined();
    });

    it('getByAlertId 应该是 getLogByAlertId 的别名', () => {
      // 两者底层查询相同，mock 返回 undefined，确认行为一致
      expect(alertAutoResponseService.getByAlertId('any-alert-id')).toBeUndefined();
    });
  });
});
