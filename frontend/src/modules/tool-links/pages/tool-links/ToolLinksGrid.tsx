/**
 * ToolLinks 类别 grid（2026-07-21 拆分）
 *
 * 从原 ToolLinks.tsx L371-443 抽出
 * 按分类渲染网格（card 列表，含 manage mode hover button）
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */
import { Edit, Trash2, Copy, ExternalLink } from 'lucide-react';
import { ToolIcon } from './ToolIcon';
import type { ToolLink } from '../../api';
import type { CategoryGroup } from './types';

export interface ToolLinksGridProps {
  visibleCategories: CategoryGroup[];
  getFilteredTools: (tools: ToolLink[]) => ToolLink[];
  showManageMode: boolean;
  handleOpen: (url: string) => void;
  handleEdit: (tool: ToolLink) => void;
  setDeleteConfirm: (t: ToolLink | null) => void;
  handleCopyUrl: (e: React.MouseEvent, url: string) => void;
}

export function ToolLinksGrid({
  visibleCategories,
  getFilteredTools,
  showManageMode,
  handleOpen,
  handleEdit,
  setDeleteConfirm,
  handleCopyUrl,
}: ToolLinksGridProps) {
  return (
    <div className="space-y-8">
      {visibleCategories.map((cat) => {
        const filtered = getFilteredTools(cat.tools);
        if (filtered.length === 0) return null;
        return (
          <div key={cat.category}>
            <h2 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-primary" />
              {cat.category}
              <span className="text-xs font-normal text-text-tertiary">
                {filtered.length} 个工具
              </span>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {filtered.map((tool) => (
                <div
                  key={tool.id}
                  className="group bg-surface border border-border/60 rounded-xl p-4 cursor-pointer transition-all hover:border-primary/40 hover:shadow-sm relative"
                  onClick={() => handleOpen(tool.url)}
                >
                  {showManageMode && (
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(tool);
                        }}
                        className="w-7 h-7 rounded-lg bg-bg-muted hover:bg-primary/10 text-text-tertiary hover:text-primary flex items-center justify-center transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm(tool);
                        }}
                        className="w-7 h-7 rounded-lg bg-bg-muted hover:bg-red-500/10 text-text-tertiary hover:text-red-500 flex items-center justify-center transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-3 text-primary group-hover:scale-105 transition-transform">
                    <ToolIcon iconName={tool.icon} className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-text-primary truncate mb-1">
                    {tool.name}
                  </h3>
                  <p className="text-xs text-text-tertiary line-clamp-2 h-8 mb-3">
                    {tool.description || tool.url}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-tertiary truncate flex-1 font-mono">
                      {tool.is_external === 1 && (
                        <ExternalLink className="w-3 h-3 inline mr-1 -mt-0.5" />
                      )}
                      {new URL(tool.url).hostname}
                    </span>
                    <button
                      onClick={(e) => handleCopyUrl(e, tool.url)}
                      className="ml-2 opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-primary transition-all"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
