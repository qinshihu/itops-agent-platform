import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Search, Tag, Plus, Edit, Trash2, Eye, X } from 'lucide-react';
import clsx from 'clsx';
import api from '../lib/api';
import MarkdownOutput from '../components/MarkdownOutput';

interface Knowledge {
  id: string;
  title: string;
  category: string;
  tags: string[];
  content: string;
  solutions: string[];
  usage_count: number;
  created_at: string;
}

const categories = ['故障案例', '最佳实践', '操作手册', '安全合规', '性能优化'];

export default function Knowledge() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<Knowledge | null>(null);
  const [showDetail, setShowDetail] = useState<Knowledge | null>(null);

  const { data: knowledge, isLoading } = useQuery({
    queryKey: ['knowledge', search, selectedCategory],
    queryFn: async () => {
      const params: any = {};
      if (search) params.search = search;
      if (selectedCategory) params.category = selectedCategory;
      const res = await api.get('/api/knowledge', { params });
      return res.data.data as Knowledge[];
    },
    staleTime: 60000,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/knowledge/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
    },
  });

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">知识库</h1>
            <p className="text-text-secondary">运维知识管理和问题解决方案</p>
          </div>
          <button
            onClick={() => {
              setEditingEntry(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all"
          >
            <Plus className="w-4 h-4" />
            添加知识
          </button>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-secondary" />
            <input
              type="text"
              placeholder="搜索知识库..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-surface border border-border rounded-lg text-text-primary placeholder-text-secondary focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => setSelectedCategory(null)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all',
              !selectedCategory
                ? 'bg-primary text-white'
                : 'bg-surface text-text-secondary hover:bg-background'
            )}
          >
            全部
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                selectedCategory === cat
                  ? 'bg-primary text-white'
                  : 'bg-surface text-text-secondary hover:bg-background'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="bg-surface rounded-xl p-6 border border-border animate-pulse"
              >
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-border/50" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-32 bg-border/50 rounded" />
                    <div className="h-3 w-16 bg-border/50 rounded" />
                  </div>
                </div>
                <div className="space-y-2 mb-4">
                  <div className="h-4 bg-border/50 rounded" />
                  <div className="h-4 w-3/4 bg-border/50 rounded" />
                  <div className="h-4 w-1/2 bg-border/50 rounded" />
                </div>
                <div className="flex justify-between items-center pt-4 border-t border-border">
                  <div className="h-4 w-20 bg-border/50 rounded" />
                  <div className="flex gap-1">
                    <div className="w-8 h-8 rounded-lg bg-border/50" />
                    <div className="w-8 h-8 rounded-lg bg-border/50" />
                    <div className="w-8 h-8 rounded-lg bg-border/50" />
                  </div>
                </div>
              </div>
            ))
          ) : knowledge?.map((entry) => (
            <div
              key={entry.id}
              className="bg-surface rounded-xl p-6 border border-border hover:border-primary/50 hover:bg-background/30 transition-all"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-text-primary truncate">{entry.title}</h3>
                  <span className="text-xs text-text-secondary">{entry.category}</span>
                </div>
              </div>

              <p className="text-sm text-text-secondary mb-4 line-clamp-3">
                {entry.content}
              </p>

              {entry.tags && entry.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {entry.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-background rounded text-xs text-text-secondary flex items-center gap-1"
                    >
                      <Tag className="w-3 h-3" />
                      {tag}
                    </span>
                  ))}
                  {entry.tags.length > 3 && (
                    <span className="text-xs text-text-secondary">+{entry.tags.length - 3}</span>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-4 border-t border-border">
                <span className="text-xs text-text-secondary flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  使用 {entry.usage_count} 次
                </span>
                <div className="flex gap-1">
                  <button
                    onClick={() => setShowDetail(entry)}
                    className="p-2 hover:bg-background rounded-lg transition-all"
                    title="查看详情"
                  >
                    <Eye className="w-4 h-4 text-text-secondary" />
                  </button>
                  <button
                    onClick={() => {
                      setEditingEntry(entry);
                      setShowModal(true);
                    }}
                    className="p-2 hover:bg-background rounded-lg transition-all"
                    title="编辑"
                  >
                    <Edit className="w-4 h-4 text-text-secondary" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('确定要删除这个知识条目吗？')) {
                        deleteMutation.mutate(entry.id);
                      }
                    }}
                    className="p-2 hover:bg-status-failed/10 rounded-lg transition-all"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4 text-status-failed" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {(!knowledge || knowledge.length === 0) && (
          <div className="bg-surface rounded-xl p-12 border border-border text-center">
            <div className="p-4 rounded-xl bg-surface border border-border w-fit mx-auto mb-4">
              <BookOpen className="w-8 h-8 text-text-secondary opacity-50" />
            </div>
            <h3 className="text-lg font-medium text-text-primary mb-2">暂无知识条目</h3>
            <p className="text-text-secondary mb-4">添加运维知识管理和问题解决方案</p>
            <button
              onClick={() => {
                setEditingEntry(null);
                setShowModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all"
            >
              <Plus className="w-4 h-4" />
              添加知识
            </button>
          </div>
        )}
      </div>

      {showModal && (
        <KnowledgeModal
          entry={editingEntry}
          onClose={() => setShowModal(false)}
        />
      )}

      {showDetail && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-auto border border-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-text-primary">{showDetail.title}</h2>
              <button
                onClick={() => setShowDetail(null)}
                className="p-2 hover:bg-background rounded-lg transition-all"
              >
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            <div className="flex items-center gap-3 mb-6">
              <span className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full">
                {showDetail.category}
              </span>
              <span className="text-sm text-text-secondary">
                使用 {showDetail.usage_count} 次
              </span>
            </div>

            {showDetail.tags && showDetail.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {showDetail.tags.map((tag, i) => (
                  <span
                    key={i}
                    className="px-2 py-1 bg-background rounded text-xs text-text-secondary flex items-center gap-1"
                  >
                    <Tag className="w-3 h-3" />
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-text-secondary mb-2">描述</h3>
                <div className="bg-background rounded-lg p-4">
                  <MarkdownOutput content={showDetail.content} />
                </div>
              </div>

              {showDetail.solutions && showDetail.solutions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-text-secondary mb-2">解决方案</h3>
                  <ul className="space-y-2">
                    {showDetail.solutions.map((solution, i) => (
                      <li key={i} className="bg-background rounded-lg p-4">
                        <MarkdownOutput content={solution} />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-6 mt-6 border-t border-border">
              <button
                onClick={() => setShowDetail(null)}
                className="px-4 py-2 bg-background text-text-secondary rounded-lg hover:bg-background/80 transition-all"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KnowledgeModal({ entry, onClose }: { entry: Knowledge | null; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    title: entry?.title || '',
    category: entry?.category || '故障案例',
    tags: entry?.tags?.join(', ') || '',
    content: entry?.content || '',
    solutions: entry?.solutions?.join('\n') || '',
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const tagsArray = data.tags.split(',').map((t: string) => t.trim()).filter(Boolean);
      const solutionsArray = data.solutions.split('\n').map((s: string) => s.trim()).filter(Boolean);

      if (entry) {
        await api.put(`/api/knowledge/${entry.id}`, {
          ...data,
          tags: tagsArray,
          solutions: solutionsArray,
        });
      } else {
        await api.post('/api/knowledge', {
          ...data,
          tags: tagsArray,
          solutions: solutionsArray,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['knowledge'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-auto border border-border">
        <h2 className="text-xl font-bold text-text-primary mb-6">
          {entry ? '编辑知识' : '添加知识'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              标题
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              分类
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              标签 (逗号分隔)
            </label>
            <input
              type="text"
              value={formData.tags}
              onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
              placeholder="例如: cpu, 性能, 故障排查"
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              描述
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary h-32 resize-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              解决方案 (每行一个)
            </label>
            <textarea
              value={formData.solutions}
              onChange={(e) => setFormData({ ...formData, solutions: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary h-32 resize-none"
              placeholder="每行一个解决方案"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {mutation.isPending ? '保存中...' : (entry ? '保存' : '创建')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-background text-text-secondary rounded-lg hover:bg-background/80 transition-all"
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
