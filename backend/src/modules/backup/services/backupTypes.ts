import path from 'path';
import type { BackupInfo, BackupConfig } from '../../../repositories/types/backup';

export type { BackupInfo, BackupConfig };

export const DEFAULT_CONFIG: BackupConfig = {
  enabled: true,
  intervalHours: 24,
  keepLast: 7,
  backupDir: path.join(process.cwd(), 'backups'),
  compression: true,
  verifyAfterBackup: true
};
