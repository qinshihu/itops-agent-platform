import { CheckCircle2 } from 'lucide-react';
import type { ServerGroup } from '../types';

interface ServerGroupModalProps {
  isOpen: boolean;
  editingGroup: ServerGroup | null;
  groupFormData: { name: string; description: string; parent_id: string };
  onGroupFormDataChange: (data: { name: string; description: string; parent_id: string }) => void;
  groupsData: ServerGroup[] | undefined;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function ServerGroupModal({
  isOpen,
  editingGroup,
  groupFormData,
  onGroupFormDataChange,
  groupsData,
  onClose,
  onSubmit,
}: ServerGroupModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-xl p-6 w-full max-w-md mx-4">
        <h3 className="text-xl font-bold text-text-primary mb-6">
          {editingGroup ? '编辑分组' : '新建分组'}
        </h3>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              分组名称 *
            </label>
            <input
              type="text"
              value={groupFormData.name}
              onChange={(e) =>
                onGroupFormDataChange({ ...groupFormData, name: e.target.value })
              }
              placeholder="例如: 生产环境"
              className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">父分组</label>
            <select
              value={groupFormData.parent_id}
              onChange={(e) =>
                onGroupFormDataChange({ ...groupFormData, parent_id: e.target.value })
              }
              className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
            >
              <option value="">无 (根分组)</option>
              {(groupsData || []).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">描述</label>
            <textarea
              value={groupFormData.description}
              onChange={(e) =>
                onGroupFormDataChange({ ...groupFormData, description: e.target.value })
              }
              placeholder="分组描述..."
              rows={3}
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
              {editingGroup ? '保存更改' : '创建分组'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}