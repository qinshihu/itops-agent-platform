/**
 * ToolLinks 主入口（2026-07-21 拆分后精简版）
 *
 * 拆分动机：原 ToolLinks.tsx 616 行（workspace untracked 全新文件）包含：
 *   - 41 个 lucide icon imports + ICON_OPTIONS 65 行
 *   - iconMap + ToolIcon helper
 *   - 5 useState + 2 useQuery + 3 useMutation + 7 handlers
 *   - 主 page：header + grid + form modal + delete modal
 *
 * 拆分后行为：7 个子模块按职责分离 + 主入口仅编排 ~80 行
 *   - types.ts              — FormData + FormMode + CategoryGroup 类型 (30)
 *   - constants.ts          — ICON_OPTIONS + ICON_MAP + DEFAULT_ICON (110)
 *   - ToolIcon.tsx          — icon name → JSX element lookup (20)
 *   - useToolLinksData.ts   — 全部 hooks + handlers (230)
 *   - ToolLinksHeader.tsx   — header + 搜索 + 类别过滤 (130)
 *   - ToolLinksGrid.tsx     — 类别 grid + manage mode (110)
 *   - ToolFormModal.tsx     — 新增/编辑表单 (180)
 *   - DeleteToolModal.tsx   — 删除确认 (60)
 *   - index.ts              — barrel (15)
 *
 * 桶兼容：原 `import ToolLinks from '.../pages/ToolLinks'` 仍可用
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */

import { Grid3X3 } from 'lucide-react';
import { useToolLinksData } from './tool-links/useToolLinksData';
import { ToolLinksHeader } from './tool-links/ToolLinksHeader';
import { ToolLinksGrid } from './tool-links/ToolLinksGrid';
import { ToolFormModal } from './tool-links/ToolFormModal';
import { DeleteToolModal } from './tool-links/DeleteToolModal';

export default function ToolLinks() {
  const data = useToolLinksData();

  const handleAddTool = () => {
    data.setSelectedTool(null);
    data.closeModal();
    data.setIsModalOpen(true);
  };

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <ToolLinksHeader
          totalCount={data.totalCount}
          categoryList={data.categoryList}
          searchQuery={data.searchQuery}
          setSearchQuery={data.setSearchQuery}
          activeCategory={data.activeCategory}
          setActiveCategory={data.setActiveCategory}
          showManageMode={data.showManageMode}
          setShowManageMode={data.setShowManageMode}
          onAddTool={handleAddTool}
        />

        {data.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-text-tertiary text-sm">加载中...</div>
          </div>
        ) : data.totalCount === 0 ? (
          <div className="bg-surface border border-border/60 rounded-2xl p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-bg-muted flex items-center justify-center mx-auto mb-4">
              <Grid3X3 className="w-8 h-8 text-text-tertiary/40" />
            </div>
            <h3 className="text-lg font-semibold text-text-primary mb-2">暂无工具</h3>
            <p className="text-text-secondary text-sm mb-4">
              {data.searchQuery.trim() ? '没有匹配的搜索结果' : '点击上方"管理"按钮开始添加工具'}
            </p>
          </div>
        ) : (
          <ToolLinksGrid
            visibleCategories={data.visibleCategories}
            getFilteredTools={data.getFilteredTools}
            showManageMode={data.showManageMode}
            handleOpen={data.handleOpen}
            handleEdit={data.handleEdit}
            setDeleteConfirm={data.setDeleteConfirm}
            handleCopyUrl={data.handleCopyUrl}
          />
        )}

        <ToolFormModal
          isOpen={data.isModalOpen}
          selectedToolId={data.selectedTool?.id ?? null}
          formData={data.formData}
          setFormData={data.setFormData}
          showIconPicker={data.showIconPicker}
          setShowIconPicker={data.setShowIconPicker}
          createPending={data.createMutation.isPending}
          updatePending={data.updateMutation.isPending}
          onClose={data.closeModal}
          onSubmit={data.handleSubmit}
        />

        <DeleteToolModal
          tool={data.deleteConfirm}
          onClose={() => data.setDeleteConfirm(null)}
          onConfirm={(id) => data.deleteMutation.mutate(id)}
          deletePending={data.deleteMutation.isPending}
        />
      </div>
    </div>
  );
}
