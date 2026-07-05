/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Database, Loader2, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../../../lib/api';
import { getAxiosErrorMessage } from '../../../lib/errorHandler';
import { useAuth } from '../../../../contexts/AuthContext';

interface Backup {
  id: string;
  filename: string;
  size: number;
  createdAt: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BackupSettings() {
  const { t: _t } = useTranslation();
  const queryClient = useQueryClient();

  // 创建备份 mutation
  const createBackupMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post('/backups/create');
      return res.data;
    },
    onSuccess: () => {
      alert('备份创建成功！');
      queryClient.invalidateQueries({ queryKey: ['backupHistory'] });
    },
    onError: (err: unknown) => {
      alert(getAxiosErrorMessage(err, '备份创建失败'));
    }
  });

  // 备份历史查询
  const { data: backupHistoryData } = useQuery({
    queryKey: ['backupHistory'],
    queryFn: async () => {
      const res = await api.get('/backups/history');
      return res.data.data;
    }
  });
  const backupHistory = (backupHistoryData || []) as Backup[];

  // 恢复备份 mutation
  const restoreBackupMutation = useMutation({
    mutationFn: async (backupId: string) => {
      const res = await api.post(`/backups/restore/${backupId}`);
      return res.data;
    },
    onSuccess: () => {
      alert('备份恢复成功！系统将自动重启...');
    },
    onError: (err: unknown) => {
      alert(getAxiosErrorMessage(err, '备份恢复失败'));
    }
  });

  // 删除备份 mutation
  const deleteBackupMutation = useMutation({
    mutationFn: async (backupId: string) => {
      const res = await api.delete(`/backups/${backupId}`);
      return res.data;
    },
    onSuccess: () => {
      alert('备份删除成功！');
      queryClient.invalidateQueries({ queryKey: ['backupHistory'] });
    },
    onError: (err: unknown) => {
      alert(getAxiosErrorMessage(err, '备份删除失败'));
    }
  });

  // 上传备份 mutation
  const uploadBackupMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('backup', file);
      const res = await api.post('/backups/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return res.data;
    },
    onSuccess: () => {
      alert('备份上传成功！');
      queryClient.invalidateQueries({ queryKey: ['backupHistory'] });
    },
    onError: (err: unknown) => {
      alert(getAxiosErrorMessage(err, '备份上传失败'));
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
          <Database className="w-5 h-5" />
          数据库设置
        </h3>
        <p className="text-sm text-text-secondary mb-6">
          数据库配置和备份设置
        </p>
      </div>

      <div className="space-y-4">
        <div className="bg-background rounded-lg p-4">
          <h4 className="font-medium text-text-primary mb-2">数据库类型</h4>
          <p className="text-sm text-text-secondary">SQLite (当前)</p>
        </div>

        <div className="bg-background rounded-lg p-4">
          <h4 className="font-medium text-text-primary mb-2">数据路径</h4>
          <p className="text-sm text-text-secondary">./data/app.db</p>
        </div>

        <div className="bg-background rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-text-primary">数据备份</h4>
            <div className="flex gap-2">
              <label className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all cursor-pointer flex items-center gap-2">
                <Upload className="w-4 h-4" />
                上传备份
                <input 
                  type="file" 
                  accept=".db,.db.gz"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      uploadBackupMutation.mutate(file);
                      e.target.value = '';
                    }
                  }}
                />
              </label>
              <button
                onClick={() => createBackupMutation.mutate()}
                disabled={createBackupMutation.isPending}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {createBackupMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {createBackupMutation.isPending ? '创建中...' : '创建备份'}
              </button>
            </div>
          </div>
          
          {/* 备份历史列表 */}
          {backupHistory.length > 0 ? (
            <div className="space-y-2">
              {backupHistory.map((backup) => (
                <div key={backup.id} className="flex items-center justify-between p-3 bg-surface rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{backup.filename}</p>
                    <p className="text-xs text-text-secondary">
                      {new Date(backup.createdAt).toLocaleString()} • {formatFileSize(backup.size)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={async () => {
                        try {
                          const response = await fetch(`/api/backups/download/${backup.id}`, {
                            headers: {
                              'Authorization': `Bearer ${token}`
                            }
                          });
                          
                          if (!response.ok) {
                            throw new Error('下载失败');
                          }
                          
                          const blob = await response.blob();
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = backup.filename || `backup-${backup.id}.db`;
                          document.body.appendChild(a);
                          a.click();
                          window.URL.revokeObjectURL(url);
                          document.body.removeChild(a);
                        } catch (err) {
                          alert('下载失败：' + (err as Error).message);
                        }
                      }}
                      className="px-3 py-1 text-xs bg-green-500/10 text-green-400 hover:bg-green-500/20 rounded transition-colors"
                    >
                      下载
                    </button>
                    <button
                      onClick={() => restoreBackupMutation.mutate(backup.id)}
                      disabled={restoreBackupMutation.isPending}
                      className="px-3 py-1 text-xs bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                    >
                      恢复
                    </button>
                    <button
                      onClick={() => deleteBackupMutation.mutate(backup.id)}
                      disabled={deleteBackupMutation.isPending}
                      className="px-3 py-1 text-xs bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-secondary">暂无备份</p>
          )}
        </div>
      </div>
    </div>
  );
}
