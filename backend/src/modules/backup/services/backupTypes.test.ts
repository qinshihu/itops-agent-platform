import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from './backupTypes';

describe('backupTypes', () => {
  it('DEFAULT_CONFIG should have expected defaults', () => {
    expect(DEFAULT_CONFIG.enabled).toBe(true);
    expect(DEFAULT_CONFIG.intervalHours).toBe(24);
    expect(DEFAULT_CONFIG.keepLast).toBe(7);
    expect(DEFAULT_CONFIG.backupDir).toContain('backups');
    expect(DEFAULT_CONFIG.compression).toBe(true);
    expect(DEFAULT_CONFIG.verifyAfterBackup).toBe(true);
  });
});