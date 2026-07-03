import path from 'path';

export interface BackupInfo {
  id: string;
  filename: string;
  filePath: string;
  size: number;
  createdAt: string;
  type: 'auto' | 'manual';
  status: 'completed' | 'failed' | 'in_progress';
  error?: string;
  verified: boolean;
  checksum?: string;
}

export interface BackupConfig {
  enabled: boolean;
  intervalHours: number;
  keepLast: number;
  backupDir: string;
  compression: boolean;
  verifyAfterBackup: boolean;
}

export const DEFAULT_CONFIG: BackupConfig = {
  enabled: true,
  intervalHours: 24,
  keepLast: 7,
  backupDir: path.join(process.cwd(), 'backups'),
  compression: true,
  verifyAfterBackup: true
};
