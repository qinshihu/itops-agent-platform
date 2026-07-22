/**
 * SSHKeys 主入口（2026-07-21 拆分后精简版）
 *
 * 拆分动机：原 SSHKeys.tsx 613 行（workspace 略小于 git HEAD 625）包含：
 *   - 7 useState + 2 useQuery + 3 useMutation + 6 handlers
 *   - 1 large setForm + form helpers
 *   - 1 main page（含 header + 安全面板 + 搜索 + card grid + 2 modals）
 *
 * 拆分后行为：7 个子模块按职责分离 + 主入口仅编排 ~80 行
 *   - types.ts                 — UsageServer + AuthType + SSHKeyFormData (40)
 *   - constants.ts             — KEY_TYPE_TEXT + KEY_TYPE_COLOR + getter (40)
 *   - useSSHKeysData.ts        — 全部 hooks + handlers (260)
 *   - SSHKeysHeader.tsx        — header + 安全面板 + 搜索 (75)
 *   - SSHKeyCard.tsx           — 凭证卡（含 fingerprint + private key + usage 展开）(170)
 *   - SSHKeyFormModal.tsx      — 新增/编辑表单 (180)
 *   - DeleteSSHKeyModal.tsx    — 删除确认 (50)
 *   - index.ts                 — barrel (15)
 *
 * 桶兼容：原 `import SSHKeys from '.../pages/SSHKeys'` 仍可用
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */

import { Key, Plus } from 'lucide-react';
import { useSSHKeysData } from './ssh-keys/useSSHKeysData';
import { SSHKeysHeader } from './ssh-keys/SSHKeysHeader';
import { SSHKeyCard } from './ssh-keys/SSHKeyCard';
import { SSHKeyFormModal } from './ssh-keys/SSHKeyFormModal';
import { DeleteSSHKeyModal } from './ssh-keys/DeleteSSHKeyModal';

export default function SSHKeys() {
  const data = useSSHKeysData();

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        <SSHKeysHeader
          onAddNew={data.handleAddNew}
          searchQuery={data.searchQuery}
          setSearchQuery={data.setSearchQuery}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-surface border border-border rounded-xl p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-border" />
                  <div className="flex-1">
                    <div className="h-4 bg-border rounded w-1/3 mb-2" />
                    <div className="h-3 bg-border rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))
          ) : data.filteredKeys.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-text-secondary">
              <Key className="w-14 h-14 mb-4 opacity-40" />
              <p className="text-lg mb-1">
                {data.searchQuery ? '未找到匹配的认证凭证' : '暂无认证凭证'}
              </p>
              <p className="text-sm mb-4">
                {data.searchQuery
                  ? '请调整搜索关键词'
                  : '添加您的第一个认证凭证（SSH 密钥或账号密码），后续添加服务器/网络设备时可直接选择使用'}
              </p>
              {!data.searchQuery && (
                <button
                  onClick={data.handleAddNew}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  添加第一个认证凭证
                </button>
              )}
            </div>
          ) : (
            data.filteredKeys.map((keyData) => (
              <SSHKeyCard
                key={keyData.id}
                keyData={keyData}
                expandedKey={data.expandedKey}
                setExpandedKey={data.setExpandedKey}
                fullKeyData={data.fullKeyData}
                usageServers={data.usageServers}
                usageLoading={data.usageLoading}
                setUsageServers={() => data.setUsageServers(null)}
                handleViewUsage={data.handleViewUsage}
                handleCopyFingerprint={data.handleCopyFingerprint}
                handleCopyKey={data.handleCopyKey}
                handleEdit={data.handleEdit}
                setDeleteConfirmKey={data.setDeleteConfirmKey}
              />
            ))
          )}
        </div>

        <SSHKeyFormModal
          isOpen={data.isModalOpen}
          selectedKeyId={data.selectedKey?.id ?? null}
          formData={data.formData}
          setFormData={data.setFormData}
          onClose={() => data.setIsModalOpen(false)}
          onSubmit={data.handleSubmit}
        />

        <DeleteSSHKeyModal
          keyData={data.deleteConfirmKey}
          onClose={() => data.setDeleteConfirmKey(null)}
          onConfirm={data.handleDeleteConfirmed}
        />
      </div>
    </div>
  );
}
