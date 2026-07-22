/**
 * SSH 配置 Tab section（2026-07-21 拆分）
 *
 * 从原 AddDeviceModal.tsx L346-470 抽出
 * 包含：SSH 端口 / 设备型号 / 认证方式 toggle / 用户名密码 / Enable 密码
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 5 + lessons-learned §3.5
 */
import { Lock, Key, User } from 'lucide-react';
import type { AddDeviceFormData, Credential } from './types';

export interface SshConfigSectionProps {
  form: AddDeviceFormData;
  setForm: React.Dispatch<React.SetStateAction<AddDeviceFormData>>;
  isEditing: boolean;
  useCredential: boolean;
  setUseCredential: (b: boolean) => void;
  credentials: Credential[];
}

export function SshConfigSection({
  form,
  setForm,
  isEditing,
  useCredential,
  setUseCredential,
  credentials,
}: SshConfigSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Lock className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium text-text-primary">SSH 连接配置</span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">SSH 端口</label>
          <input
            type="number"
            value={form.ssh_port}
            onChange={(e) => setForm({ ...form, ssh_port: parseInt(e.target.value, 10) || 22 })}
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text-primary focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">设备型号</label>
          <input
            type="text"
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            placeholder="例：S5735-L48T4X-A"
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text-primary placeholder-text-secondary/50 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-sm font-medium text-text-primary mb-2">认证方式</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setUseCredential(true)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                useCredential
                  ? 'bg-primary/10 border-primary text-primary'
                  : 'bg-background border-border text-text-secondary hover:border-primary/50'
              }`}
            >
              <Key className="w-4 h-4" />
              选择凭证
            </button>
            <button
              type="button"
              onClick={() => setUseCredential(false)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                !useCredential
                  ? 'bg-orange-500/10 border-orange-500 text-orange-500'
                  : 'bg-background border-border text-text-secondary hover:border-orange-500/50'
              }`}
            >
              <User className="w-4 h-4" />
              手动输入
            </button>
          </div>
        </div>

        {useCredential ? (
          <div className="col-span-2">
            <label className="block text-sm font-medium text-text-primary mb-1">
              认证凭证 <span className="text-red-500">*</span>
            </label>
            <select
              value={form.ssh_key_id}
              onChange={(e) => setForm({ ...form, ssh_key_id: e.target.value })}
              className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text-primary focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
            >
              <option value="">（不设置 SSH 凭证）</option>
              {credentials
                .filter((c) => c.auth_type === 'password')
                .map((cred) => (
                  <option key={cred.id} value={cred.id}>
                    {cred.name} ({cred.username || '无用户名'})
                  </option>
                ))}
            </select>
            <p className="mt-1 text-xs text-text-secondary/60">
              可选择已有的账号密码凭证；纯 SNMP 设备可跳过
            </p>
          </div>
        ) : (
          <>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                用户名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                placeholder="admin"
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text-primary placeholder-text-secondary/50 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                required={!useCredential}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">
                密码 {!isEditing && <span className="text-red-500">*</span>}
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder={isEditing ? '留空则不修改' : '设备登录密码'}
                className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text-primary placeholder-text-secondary/50 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                required={!isEditing && !useCredential}
              />
            </div>
          </>
        )}

        <div>
          <label className="block text-sm font-medium text-text-primary mb-1">Enable 密码</label>
          <input
            type="password"
            value={form.enable_password}
            onChange={(e) => setForm({ ...form, enable_password: e.target.value })}
            placeholder="特权模式密码（可选）"
            className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-text-primary placeholder-text-secondary/50 focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
