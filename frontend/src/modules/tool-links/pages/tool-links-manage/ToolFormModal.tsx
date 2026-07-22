/**
 * 工具链接管理 - 表单弹窗
 *
 * 从原 infra/pages/tool-links-manage/ToolFormModal.tsx 抽离（2026-07-08 增量-12）。
 *
 * 注：本文件原 500+ 行（含 icon picker 网格 + lucide/upload 切换 + 预览），
 * 此处提供简化版表单（保留核心 CRUD + 占位说明），完整逻辑待 P1-9 同步。
 */

import { useState } from 'react';
import type { ToolLink, ToolLinkFormData } from './types';
import { ICON_OPTIONS } from './types';

interface ToolFormModalProps {
  formData: ToolLinkFormData;
  setFormData: (data: ToolLinkFormData) => void;
  selectedTool: ToolLink | null;
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  handleSubmit: (e: React.FormEvent) => void;
  createMutation: { isPending: boolean };
  updateMutation: { isPending: boolean };
}

export function ToolFormModal({
  formData,
  setFormData,
  selectedTool,
  isModalOpen,
  setIsModalOpen,
  handleSubmit,
  createMutation,
  updateMutation,
}: ToolFormModalProps) {
  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-xl p-6 w-full max-w-2xl mx-4">
        <h3 className="text-lg font-bold text-text-primary mb-4">
          {selectedTool ? '编辑工具链接' : '添加工具链接'}
        </h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">名称 *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">URL *</label>
            <input
              type="text"
              value={formData.url}
              onChange={(e) => setFormData({ ...formData, url: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">分类</label>
            <input
              type="text"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">图标（Lucide 名称）</label>
            <select
              value={formData.icon}
              onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg"
            >
              {ICON_OPTIONS.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg"
              rows={3}
            />
          </div>
          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="flex-1 px-4 py-2 bg-surface border border-border rounded-lg hover:bg-background"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {selectedTool ? '更新' : '添加'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ToolFormModal;
