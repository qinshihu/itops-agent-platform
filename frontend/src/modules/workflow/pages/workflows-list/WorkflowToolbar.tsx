import { Search, Filter, Plus } from 'lucide-react';

interface WorkflowToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  filterTemplate: 'all' | 'template' | 'custom';
  onFilterChange: (value: 'all' | 'template' | 'custom') => void;
  onCreateNew: () => void;
}

export default function WorkflowToolbar({
  searchQuery,
  onSearchChange,
  filterTemplate,
  onFilterChange,
  onCreateNew,
}: WorkflowToolbarProps) {
  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">工作流管理</h1>
          <p className="text-text-secondary">管理和执行运维自动化工作流</p>
        </div>
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建工作流
        </button>
      </div>

      <div className="bg-surface rounded-xl p-4 border border-border">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input
                type="text"
                placeholder="搜索工作流..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-secondary" />
            <select
              value={filterTemplate}
              onChange={(e) => onFilterChange(e.target.value as 'all' | 'template' | 'custom')}
              className="px-3 py-2 rounded-lg bg-background border border-border focus:border-primary focus:outline-none"
            >
              <option value="all">全部</option>
              <option value="template">仅模板</option>
              <option value="custom">仅自定义</option>
            </select>
          </div>
        </div>
      </div>
    </>
  );
}