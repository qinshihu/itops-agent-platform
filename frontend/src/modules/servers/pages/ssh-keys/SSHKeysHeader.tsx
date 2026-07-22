/**
 * SSHKeys 顶部 Header + 安全说明 + 搜索框（2026-07-21 拆分）
 *
 * 从原 SSHKeys.tsx L215-265 抽出
 * 包含：title + 添加按钮 + 安全说明面板 + 搜索框
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */
import { Plus, Shield, Key, Info, Search } from 'lucide-react';

export interface SSHKeysHeaderProps {
  onAddNew: () => void;
  searchQuery: string;
  setSearchQuery: (s: string) => void;
}

export function SSHKeysHeader({
  onAddNew,
  searchQuery,
  setSearchQuery,
}: SSHKeysHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">认证凭证管理</h1>
          <p className="text-text-secondary">
            统一管理服务器和网络设备的认证凭证（SSH 密钥 / 账号密码）
          </p>
        </div>
        <button
          onClick={onAddNew}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          添加认证凭证
        </button>
      </div>

      <div className="bg-surface border border-border rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-medium text-text-primary mb-1">安全说明</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-text-secondary">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 flex-shrink-0 text-status-success" />
                <span>
                  <strong>AES 加密存储</strong>：所有凭证在数据库中加密存储
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Key className="w-3.5 h-3.5 flex-shrink-0 text-status-warning" />
                <span>
                  <strong>双认证方式</strong>：支持 SSH 密钥和账号密码
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 flex-shrink-0 text-status-failed" />
                <span>
                  <strong>按需解密</strong>：连接设备时自动解密凭证
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索凭证名称、描述、指纹..."
          className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
        />
      </div>
    </>
  );
}
