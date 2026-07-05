// backup 模块类型定义

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
