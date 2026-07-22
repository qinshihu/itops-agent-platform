/**
 * 安全设置（密码修改 + CORS 配置）
 *
 * 从原 infra/pages/settings/SecuritySettings.tsx 抽离（2026-07-08 增量-12）。
 */

import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Shield as _Shield, Lock, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../../../contexts/AuthContext';
import { validatePassword, getPasswordStrength } from '../../../../utils/passwordValidator';
import api from '../../../../lib/api';
import { getAxiosErrorMessage } from '@/lib/errorHandler';

export default function SecuritySettings() {
  const { t: _t } = useTranslation();
  const [searchParams] = useSearchParams();
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [passwordError, setPasswordError] = useState('');

  const handlePasswordChange = async () => {
    setPasswordError('');
    setPasswordStatus('saving');

    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的新密码不一致');
      setPasswordStatus('error');
      setTimeout(() => setPasswordStatus('idle'), 3000);
      return;
    }

    const passwordCheck = validatePassword(newPassword);
    if (!passwordCheck.valid) {
      setPasswordError(passwordCheck.message);
      setPasswordStatus('error');
      setTimeout(() => setPasswordStatus('idle'), 3000);
      return;
    }

    try {
      const response = await api.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });

      if (response.data.success) {
        setPasswordStatus('saved');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');

        if (user) {
          const updatedUser = { ...user, passwordMustChange: false };
          updateUser(updatedUser);
        }

        navigate('/settings', { replace: true });

        setTimeout(() => setPasswordStatus('idle'), 3000);
      } else {
        setPasswordError(response.data.error || response.data.message || '密码修改失败');
        setPasswordStatus('error');
        setTimeout(() => setPasswordStatus('idle'), 3000);
      }
    } catch (err: unknown) {
      setPasswordError(getAxiosErrorMessage(err, '密码修改失败'));
      setPasswordStatus('error');
      setTimeout(() => setPasswordStatus('idle'), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* 修改密码 */}
      <div className="bg-background rounded-lg p-6">
        <h4 className="font-medium text-text-primary mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5" />
          修改密码
        </h4>
        {searchParams.get('changePassword') === 'true' && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-start gap-2 text-yellow-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">首次登录需要修改密码</p>
              <p className="text-xs mt-1">为了您的账户安全，请修改默认密码后继续使用</p>
            </div>
          </div>
        )}
        <div className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">当前密码</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="请输入当前密码"
              className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">新密码</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="请输入新密码（至少8位）"
              className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
            />
            {newPassword && (
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">密码强度</span>
                  <span className={`text-sm font-medium ${getPasswordStrength(newPassword).color}`}>
                    {getPasswordStrength(newPassword).label}
                  </span>
                </div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full ${
                        i <= getPasswordStrength(newPassword).score
                          ? getPasswordStrength(newPassword).color.replace('text-', 'bg-')
                          : 'bg-border'
                      }`}
                    />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {Object.entries(validatePassword(newPassword).details).map(([key, value]) => (
                    <div key={key} className={`flex items-center gap-1 ${value ? 'text-status-success' : 'text-text-tertiary'}`}>
                      {value ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-current" />}
                      <span>
                        {key === 'minLength' && '至少8位'}
                        {key === 'uppercase' && '大写字母'}
                        {key === 'lowercase' && '小写字母'}
                        {key === 'number' && '数字'}
                        {key === 'special' && '特殊字符'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">确认新密码</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入新密码"
              className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
            />
            {confirmPassword && newPassword && (
              <div className="mt-1 flex items-center gap-1 text-xs">
                {newPassword === confirmPassword ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-status-success" />
                    <span className="text-status-success">密码匹配</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 text-status-failed" />
                    <span className="text-status-failed">密码不匹配</span>
                  </>
                )}
              </div>
            )}
          </div>
          {passwordError && (
            <p className="text-sm text-status-failed flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {passwordError}
            </p>
          )}
          <div className="flex items-center gap-2">
            {passwordStatus === 'saving' && (
              <Loader2 className="w-4 h-4 animate-spin text-text-secondary" />
            )}
            {passwordStatus === 'saved' && (
              <p className="text-sm text-status-success flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                密码修改成功
              </p>
            )}
            <button
              onClick={handlePasswordChange}
              disabled={passwordStatus === 'saving'}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {passwordStatus === 'saving' && (
                <Loader2 className="w-4 h-4 animate-spin" />
              )}
              修改密码
            </button>
          </div>
        </div>
      </div>

      {/* CORS配置 */}
      <div className="bg-background rounded-lg p-4">
        <h4 className="font-medium text-text-primary mb-2">CORS配置</h4>
        <p className="text-sm text-text-secondary mb-3">允许的前端域名</p>
        <input
          type="text"
          defaultValue="http://localhost:3000"
          className="w-full px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
        />
      </div>
    </div>
  );
}
