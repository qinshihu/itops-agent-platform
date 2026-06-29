import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../../../utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
import { localRuleEngine } from './localRuleEngine.ts';
describe('localRuleEngine', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('should be defined', () => { expect(localRuleEngine).toBeDefined(); });
  it('should have rule methods', () => {
    expect(typeof localRuleEngine.analyzeByRules).toBe('function');
    expect(typeof localRuleEngine.getRuleStats).toBe('function');
  });
  it('getRuleStats should return stats', () => {
    const stats = localRuleEngine.getRuleStats();
    expect(stats).toBeDefined();
  });
  it('recommendKnowledge should return array', () => {
    expect(Array.isArray(localRuleEngine.recommendKnowledge('CPU', 'High CPU'))).toBe(true);
  });
  it('executeWorkflowFallback should return result', () => {
    const r = localRuleEngine.executeWorkflowFallback('ssh', { title: 'Test', content: 'Test' });
    expect(r).toBeDefined();
  });
});
