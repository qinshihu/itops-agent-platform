/**
 * 工具链接管理 - 主页面
 *
 * 从原 infra/pages/tool-links-manage/index.tsx 抽离（2026-07-08 增量-12）。
 *
 * 注：原 index.tsx 调用 ToolFormModal 传 11 个 props（含 icon picker 状态），
 * 本简化版只传 6 个核心 props；后续 P1-9 可同步完整逻辑。
 */

import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Search } from 'lucide-react';
import { ToolList } from './ToolList';
import { ToolFormModal } from './ToolFormModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { useToolLinksManage } from './useToolLinksManage';

export default function ToolLinksManagePage() {
  const navigate = useNavigate();
  const {
    searchQuery,
    setSearchQuery,
    isModalOpen,
    setIsModalOpen,
    selectedTool,
    deleteConfirm,
    setDeleteConfirm,
    formData,
    setFormData,
    tools,
    isLoading,
    createMutation,
    updateMutation,
    deleteMutation,
    closeModal,
    openAddModal,
    handleEdit,
    handleSubmit,
    moveOrder,
    filteredTools,
  } = useToolLinksManage();

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">工具链接配置</h1>
            <p className="text-text-secondary text-sm">管理运维工具导航链接，支持自定义名称、链接、图标和分类</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/tool-links')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-text-tertiary hover:text-text-primary hover:bg-slate-700/30 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              返回
            </button>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加工具
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索工具名称、分类、描述..."
            className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
          />
        </div>

        <ToolList
          tools={(tools || []) as never}
          isLoading={isLoading}
          searchQuery={searchQuery}
          filteredTools={filteredTools as never}
          moveOrder={moveOrder as never}
          handleEdit={handleEdit as never}
          setDeleteConfirm={setDeleteConfirm as never}
        />

        {!isLoading && Array.isArray(tools) && (
          <div className="text-xs text-text-tertiary">
            共 {tools.length} 个工具链接，{new Set(tools.map((t) => t.category)).size} 个分类
          </div>
        )}
      </div>

      {isModalOpen && (
        <ToolFormModal
          formData={formData}
          setFormData={setFormData}
          selectedTool={selectedTool}
          isModalOpen={isModalOpen}
          setIsModalOpen={setIsModalOpen}
          handleSubmit={handleSubmit}
          createMutation={createMutation}
          updateMutation={updateMutation}
        />
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <DeleteConfirmModal
            tool={deleteConfirm}
            setDeleteConfirm={setDeleteConfirm}
            deleteMutation={deleteMutation}
          />
        </div>
      )}
    </div>
  );
}
