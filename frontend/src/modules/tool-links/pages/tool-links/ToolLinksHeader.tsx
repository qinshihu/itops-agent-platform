/**
 * ToolLinks 顶部 Header + 搜索 + 类别过滤（2026-07-21 拆分）
 *
 * 从原 ToolLinks.tsx L270-347 抽出
 * 包含：标题 + 管理/添加按钮 + 搜索框 + 类别 chip 过滤
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 3 + lessons-learned §3.5
 */
import { Grid3X3, Settings, Plus, Search } from 'lucide-react';
import type { CategoryGroup } from './types';

export interface ToolLinksHeaderProps {
  totalCount: number;
  categoryList: CategoryGroup[];
  searchQuery: string;
  setSearchQuery: (s: string) => void;
  activeCategory: string;
  setActiveCategory: (s: string) => void;
  showManageMode: boolean;
  setShowManageMode: (b: boolean) => void;
  onAddTool: () => void;
}

export function ToolLinksHeader({
  totalCount,
  categoryList,
  searchQuery,
  setSearchQuery,
  activeCategory,
  setActiveCategory,
  showManageMode,
  setShowManageMode,
  onAddTool,
}: ToolLinksHeaderProps) {
  return (
    <>
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Grid3X3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-text-primary">工具箱</h1>
              <p className="text-sm text-text-secondary mt-0.5">
                共 {totalCount} 个工具 · {categoryList.length} 个分类
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowManageMode(!showManageMode)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              showManageMode
                ? 'bg-primary text-white'
                : 'bg-surface text-text-secondary hover:text-text-primary border border-border/60 hover:border-primary/40'
            }`}
          >
            <Settings className="w-4 h-4" />
            管理
          </button>
          {showManageMode && (
            <button
              onClick={onAddTool}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              添加工具
            </button>
          )}
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="搜索工具名称、链接、描述..."
          className="w-full pl-10 pr-4 py-2 bg-surface border border-border/60 rounded-xl focus:outline-none focus:border-primary text-text-primary text-sm placeholder:text-text-tertiary"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory('all')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            activeCategory === 'all'
              ? 'bg-primary text-white'
              : 'bg-surface text-text-secondary hover:text-text-primary border border-border/60 hover:border-primary/40'
          }`}
        >
          全部 <span className="ml-1 opacity-70">({totalCount})</span>
        </button>
        {categoryList.map((cat) => (
          <button
            key={cat.category}
            onClick={() => setActiveCategory(cat.category)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              activeCategory === cat.category
                ? 'bg-primary text-white'
                : 'bg-surface text-text-secondary hover:text-text-primary border border-border/60 hover:border-primary/40'
            }`}
          >
            {cat.category} <span className="ml-1 opacity-70">({cat.tools.length})</span>
          </button>
        ))}
      </div>
    </>
  );
}
