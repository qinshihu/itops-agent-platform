import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { isEncryptedBackup, shouldEncryptBackup } from './backupCrypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('backupCrypto', () => {
  describe('shouldEncryptBackup', () => {
    const originalEnv = process.env.BACKUP_ENCRYPTION_ENABLED;

    afterEach(() => {
      if (originalEnv === undefined) {
        delete process.env.BACKUP_ENCRYPTION_ENABLED;
      } else {
        process.env.BACKUP_ENCRYPTION_ENABLED = originalEnv;
      }
    });

    it('should return true by default (no env var set)', () => {
      delete process.env.BACKUP_ENCRYPTION_ENABLED;
      expect(shouldEncryptBackup()).toBe(true);
    });

    it('should return true when BACKUP_ENCRYPTION_ENABLED=true', () => {
      process.env.BACKUP_ENCRYPTION_ENABLED = 'true';
      expect(shouldEncryptBackup()).toBe(true);
    });

    it('should return false when BACKUP_ENCRYPTION_ENABLED=false', () => {
      process.env.BACKUP_ENCRYPTION_ENABLED = 'false';
      expect(shouldEncryptBackup()).toBe(false);
    });
  });

  describe('isEncryptedBackup', () => {
    it('should return false for a non-encrypted file (empty)', () => {
      const tmpFile = path.join(os.tmpdir(), `test-backup-${Date.now()}.tmp`);
      fs.writeFileSync(tmpFile, 'not encrypted content');
      try {
        expect(isEncryptedBackup(tmpFile)).toBe(false);
      } finally {
        fs.unlinkSync(tmpFile);
      }
    });

    it('should return false for a non-existent file', () => {
      expect(isEncryptedBackup('/nonexistent/file/path.bak')).toBe(false);
    });
  });
});