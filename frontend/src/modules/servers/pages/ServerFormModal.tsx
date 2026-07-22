import { useRef } from 'react';
import { CheckCircle2, X } from 'lucide-react';
import type { Server } from './types';
import { SshKeySection } from './SshKeySection';

interface FormData {
  name: string;
  hostname: string;
  port: number;
  username: string;
  password: string;
  private_key: string;
  use_ssh_key: boolean;
  description: string;
  tags: string;
  os_type: 'linux' | 'windows';
  vnc_port: number;
  vnc_password: string;
}

interface ServerFormModalProps {
  isOpen: boolean;
  selectedServer: Server | null;
  formData: FormData;
  onFormDataChange: (data: FormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  resetForm: () => void;
  // Tag props
  parseCurrentTags: () => string[];
  getLastTagFragment: () => string;
  addTagToInput: (tag: string) => void;
  removeTag: (tag: string) => void;
  tagDropdownOpen: boolean;
  setTagDropdownOpen: (v: boolean) => void;
  tagInputRef: React.RefObject<HTMLInputElement>;
  tagDropdownRef: React.RefObject<HTMLDivElement>;
  filteredTagSuggestions: () => string[];
  allTags: string[];
  // SSH key props
  sshKeys: Array<{ id: string; name: string; key_type: string; fingerprint: string | null; usage_count: number }> | undefined;
  sshKeySearchQuery: string;
  onSshKeySearchQueryChange: (v: string) => void;
  showSshKeyDropdown: boolean;
  onShowSshKeyDropdownChange: (v: boolean) => void;
  selectedSshKeyId: string;
  onSelectedSshKeyIdChange: (v: string) => void;
  navigate: (path: string) => void;
}

export function ServerFormModal({
  isOpen,
  selectedServer,
  formData,
  onFormDataChange,
  onSubmit,
  onClose,
  resetForm,
  parseCurrentTags,
  addTagToInput,
  removeTag,
  tagDropdownOpen,
  setTagDropdownOpen,
  tagInputRef,
  tagDropdownRef,
  filteredTagSuggestions,
  allTags,
  sshKeys,
  sshKeySearchQuery,
  onSshKeySearchQueryChange,
  showSshKeyDropdown,
  onShowSshKeyDropdownChange,
  selectedSshKeyId,
  onSelectedSshKeyIdChange,
  navigate,
}: ServerFormModalProps) {
  if (!isOpen) return null;

  const updateField = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    onFormDataChange({ ...formData, [key]: value });
  };

  const suggestions = filteredTagSuggestions();
  const currentTags = parseCurrentTags();

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-surface rounded-xl p-6 w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold text-text-primary mb-6">
          {selectedServer ? '编辑服务器' : '添加服务器'}
        </h3>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">名称 *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="例如: 生产服务器"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">主机名/IP *</label>
              <input
                type="text"
                value={formData.hostname}
                onChange={(e) => updateField('hostname', e.target.value)}
                placeholder="例如: 192.168.1.100"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">端口</label>
              <input
                type="number"
                value={formData.port}
                onChange={(e) => updateField('port', parseInt(e.target.value) || 22)}
                placeholder="22"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">操作系统类型</label>
              <select
                value={formData.os_type}
                onChange={(e) => updateField('os_type', e.target.value as 'linux' | 'windows')}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
              >
                <option value="linux">Linux</option>
                <option value="windows">Windows</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">用户名 *</label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => updateField('username', e.target.value)}
                placeholder="例如: root"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="use_ssh_key"
              checked={formData.use_ssh_key}
              onChange={(e) => updateField('use_ssh_key', e.target.checked)}
              className="rounded border-border"
            />
            <label htmlFor="use_ssh_key" className="text-sm text-text-secondary">使用认证凭证</label>
          </div>

          {!formData.use_ssh_key ? (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">密码</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => updateField('password', e.target.value)}
                placeholder={selectedServer ? '留空以保持不变' : '输入密码'}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">SSH 私钥</label>
              <SshKeySection
                sshKeys={sshKeys}
                sshKeySearchQuery={sshKeySearchQuery}
                onSshKeySearchQueryChange={onSshKeySearchQueryChange}
                showSshKeyDropdown={showSshKeyDropdown}
                onShowSshKeyDropdownChange={onShowSshKeyDropdownChange}
                selectedSshKeyId={selectedSshKeyId}
                onSelectedSshKeyIdChange={onSelectedSshKeyIdChange}
                privateKey={formData.private_key}
                onPrivateKeyChange={(v) => updateField('private_key', v)}
                isEditing={!!selectedServer}
                navigate={navigate}
                resetForm={resetForm}
                closeModal={onClose}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="服务器描述..."
              rows={3}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
            />
          </div>

          <div className="relative">
            <label className="block text-sm font-medium text-text-secondary mb-2">标签</label>
            {/* 已选标签展示 */}
            {currentTags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {currentTags.map((tag: string, idx: number) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-xs rounded-full"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            {/* 标签输入框 + 下拉建议 */}
            <div className="relative">
              <input
                ref={tagInputRef}
                type="text"
                value={formData.tags}
                onChange={(e) => updateField('tags', e.target.value)}
                onFocus={() => setTagDropdownOpen(true)}
                onBlur={() => {
                  setTimeout(() => setTagDropdownOpen(false), 200);
                }}
                placeholder="输入标签名称，从下方选择或手动输入（逗号分隔）"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
              />
              {/* 下拉建议框 */}
              {tagDropdownOpen && suggestions.length > 0 && (
                <div
                  ref={tagDropdownRef}
                  className="absolute z-10 mt-1 w-full bg-surface border border-border rounded-lg shadow-xl max-h-48 overflow-y-auto animate-fade-in"
                >
                  <div className="px-3 py-2 text-xs text-text-tertiary border-b border-border">选择已有标签</div>
                  {suggestions.map((tag: string) => (
                    <button
                      key={tag}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        addTagToInput(tag);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-text-primary hover:bg-primary/10 transition-colors flex items-center gap-2"
                    >
                      <span className="w-2 h-2 rounded-full bg-primary/50 flex-shrink-0" />
                      {tag}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {allTags.length === 0 && (
              <p className="mt-1 text-xs text-text-tertiary">添加服务器后，标签将在此处显示为可选项</p>
            )}
          </div>

          {formData.os_type === 'windows' && (
            <div className="pt-2 border-t border-border">
              <h4 className="text-sm font-medium text-text-primary mb-3">VNC 配置（远程桌面）</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">VNC 端口</label>
                  <input
                    type="number"
                    value={formData.vnc_port}
                    onChange={(e) => updateField('vnc_port', parseInt(e.target.value) || 5900)}
                    placeholder="5900"
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">VNC 密码</label>
                  <input
                    type="password"
                    value={formData.vnc_password}
                    onChange={(e) => updateField('vnc_password', e.target.value)}
                    placeholder={selectedServer ? '留空以保持不变' : 'VNC 密码'}
                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
                  />
                </div>
              </div>
            </div>
          )}

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
              {selectedServer ? '保存更改' : '添加服务器'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
