/**
 * 工具链接管理 - 列表组件
 *
 * 从原 infra/pages/tool-links-manage/ToolList.tsx 抽离（2026-07-08 增量-12）。
 */

import { Globe, ExternalLink, Edit, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import type { ToolLink } from './types';

interface ToolListProps {
  tools: ToolLink[];
  isLoading: boolean;
  searchQuery: string;
  filteredTools: ToolLink[];
  moveOrder: (tool: ToolLink, direction: 'up' | 'down') => void;
  handleEdit: (tool: ToolLink) => void;
  setDeleteConfirm: (tool: ToolLink | null) => void;
}

export function ToolList({
  isLoading,
  searchQuery,
  filteredTools,
  moveOrder,
  handleEdit,
  setDeleteConfirm,
}: ToolListProps) {
  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">排序</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">名称</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">URL</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">分类</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">图标</th>
            <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">描述</th>
            <th className="text-right px-4 py-3 text-xs font-semibold text-text-tertiary uppercase tracking-wider">操作</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={7} className="text-center py-16 text-text-secondary">加载中...</td>
            </tr>
          ) : filteredTools.length === 0 ? (
            <tr>
              <td colSpan={7} className="text-center py-16 text-text-secondary">
                <div className="flex flex-col items-center gap-2">
                  <Globe className="w-10 h-10 opacity-40" />
                  <p>{searchQuery ? '未找到匹配的工具' : '暂无工具链接，点击"添加工具"开始配置'}</p>
                </div>
              </td>
            </tr>
          ) : (
            filteredTools.map((tool, index) => (
              <tr key={tool.id} className="border-b border-border/50 hover:bg-slate-800/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-text-tertiary w-5">{tool.sort_order}</span>
                    <button
                      onClick={() => moveOrder(tool, 'up')}
                      disabled={index === 0}
                      className="p-0.5 text-text-tertiary hover:text-text-primary disabled:opacity-30"
                      title="上移"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => moveOrder(tool, 'down')}
                      disabled={index === filteredTools.length - 1}
                      className="p-0.5 text-text-tertiary hover:text-text-primary disabled:opacity-30"
                      title="下移"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{tool.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-text-tertiary truncate max-w-[200px] block">{tool.url}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-text-primary">{tool.category}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {tool.image_icon ? (
                      <img src={tool.image_icon} alt="" className="w-6 h-6 object-contain rounded" />
                    ) : (
                      <span className="text-xs text-text-tertiary font-mono">{tool.icon}</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs text-text-tertiary truncate max-w-[150px] block">
                    {tool.description || '-'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <a
                      href={tool.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-text-tertiary hover:text-primary hover:bg-primary/10 transition-colors"
                      title="打开"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleEdit(tool)}
                      className="p-1.5 rounded-lg text-text-tertiary hover:text-blue-400 hover:bg-blue-500/10 transition-colors"
                      title="编辑"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(tool)}
                      className="p-1.5 rounded-lg text-text-tertiary hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export default ToolList;
