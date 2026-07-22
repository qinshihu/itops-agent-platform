/**
 * SSHKey 表单 Modal（2026-07-21 拆分）
 *
 * 从原 SSHKeys.tsx L432-566 抽出
 * 新增/编辑凭证表单（name / auth_type / private_key / username / password / description）
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */
import clsx from 'clsx';
import { CheckCircle2, Key, Lock, User } from 'lucide-react';
import type { SSHKeyFormData } from './types';

export interface SSHKeyFormModalProps {
  isOpen: boolean;
  selectedKeyId: string | null;
  formData: SSHKeyFormData;
  setFormData: React.Dispatch<React.SetStateAction<SSHKeyFormData>>;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function SSHKeyFormModal({
  isOpen,
  selectedKeyId,
  formData,
  setFormData,
  onClose,
  onSubmit,
}: SSHKeyFormModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-surface rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold text-text-primary mb-6">
          {selectedKeyId ? '编辑认证凭证' : '添加认证凭证'}
        </h3>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">凭证名称</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="例如: production-key, switch-admin"
              className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">认证类型</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, auth_type: 'key' })}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors',
                  formData.auth_type === 'key'
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-background border-border text-text-secondary hover:border-primary/50',
                )}
              >
                <Key className="w-4 h-4" />
                SSH 密钥
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, auth_type: 'password' })}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors',
                  formData.auth_type === 'password'
                    ? 'bg-orange-500/10 border-orange-500 text-orange-500'
                    : 'bg-background border-border text-text-secondary hover:border-orange-500/50',
                )}
              >
                <Lock className="w-4 h-4" />
                账号密码
              </button>
            </div>
          </div>

          {formData.auth_type === 'key' ? (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                私钥 {selectedKeyId && '（留空则不修改）'}
              </label>
              <textarea
                value={formData.private_key}
                onChange={(e) => setFormData({ ...formData, private_key: e.target.value })}
                placeholder={selectedKeyId ? '留空以保持当前私钥不变' : '粘贴您的 SSH 私钥内容...'}
                rows={8}
                className="w-full px-4 py-2 bg-black/60 border border-border rounded-lg focus:outline-none focus:border-primary font-mono text-sm text-green-400 resize-none"
                required={!selectedKeyId}
              />
              <p className="mt-1 text-xs text-text-tertiary">
                支持 OpenSSH、RSA、EC、DSA 等格式的私钥
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  <User className="w-3.5 h-3.5 inline mr-1" />
                  用户名
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="例如: admin, root"
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  <Lock className="w-3.5 h-3.5 inline mr-1" />
                  密码
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={selectedKeyId ? '留空以保持当前密码不变' : '输入密码...'}
                  className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                  required={!selectedKeyId}
                />
                <p className="mt-1 text-xs text-text-tertiary">
                  密码将使用 AES-256-GCM 加密存储
                </p>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="凭证用途说明..."
              rows={2}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              {selectedKeyId ? '保存更改' : '添加凭证'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
