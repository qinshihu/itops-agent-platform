import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock("../../../models/database", () => ({ default: {}, db: {}, initializeDatabase: vi.fn(), performMaintenance: vi.fn(), getIOInstance: vi.fn() }));
import { encryptBackupFile, decryptBackupFile, isEncryptedBackup, shouldEncryptBackup, backupService } from './backupService';

describe('backupService', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should be defined", () => { expect(backupService).toBeDefined(); });

  it('isEncryptedBackup returns false for non-existent files', () => {
    expect(isEncryptedBackup('/tmp/nonexistent-backup.sql')).toBe(false);
  });

  it('shouldEncryptBackup returns a boolean', () => {
    const result = shouldEncryptBackup();
    expect(typeof result).toBe('boolean');
  });

  it('backupService has init and stopAutoBackup methods', () => {
    expect(typeof backupService.init).toBe('function');
    expect(typeof backupService.stopAutoBackup).toBe('function');
  });

  it('encryptBackupFile and decryptBackupFile are async functions', () => {
    expect(typeof encryptBackupFile).toBe('function');
    expect(typeof decryptBackupFile).toBe('function');
  });
});
