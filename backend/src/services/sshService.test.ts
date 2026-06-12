import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
vi.mock('../models/database', () => ({ default: { prepare: vi.fn(() => ({ get: vi.fn(), run: vi.fn(), all: vi.fn(() => []) })) }, db: {} }));
import { executeCommand, testConnection, getComplianceHistory } from './sshService';
describe('sshService', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it('should be defined', () => {
    expect(typeof executeCommand).toBe('function');
    expect(typeof testConnection).toBe('function');
  });
  it('getComplianceHistory should return array', () => {
    const h = getComplianceHistory('srv-1');
    expect(Array.isArray(h)).toBe(true);
  });
});
