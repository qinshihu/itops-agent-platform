import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock("../../../../models/database", () => ({ default: {}, db: {}, initializeDatabase: vi.fn(), performMaintenance: vi.fn(), getIOInstance: vi.fn() }));
import { rootCauseAnalysisService } from './rootCauseAnalysisService';

describe('rootCauseAnalysisService', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("should be defined", () => { expect(rootCauseAnalysisService).toBeDefined(); });
  it("should expose list method", () => { expect(typeof rootCauseAnalysisService.list).toBe('function'); });
  it("should expose getStats method", () => { expect(typeof rootCauseAnalysisService.getStats).toBe('function'); });
  it("should expose getByAlert method", () => { expect(typeof rootCauseAnalysisService.getByAlert).toBe('function'); });
  it("should expose autoAnalyze method", () => { expect(typeof rootCauseAnalysisService.autoAnalyze).toBe('function'); });
  it("should expose analyze method", () => { expect(typeof rootCauseAnalysisService.analyze).toBe('function'); });
});
