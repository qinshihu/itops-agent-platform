import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileCode, Plus, Edit, Trash2, Play, Search, Tag, Code } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import api from '../../../lib/api';

interface ScriptParameter {
  name: string;
  description: string;
  required: boolean;
}

interface Script {
  id: string;
  name: string;
  description: string;
  type: string;
  content: string;
  parameters: ScriptParameter[];
  category: string;
  version: number;
  created_at: string;
  updated_at: string;
}

export default function Scripts() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [showExecuteModal, setShowExecuteModal] = useState(false);
  const [executingScript, setExecutingScript] = useState<Script | null>(null);
  const [executeParams, setExecuteParams] = useState<Record<string, string>>({});
  const [executeResult, setExecuteResult] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const { data: scripts } = useQuery({
    queryKey: ['scripts', search, selectedCategory],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (selectedCategory) params.category = selectedCategory;
      const res = await api.get('/api/scripts', { params });
      return res.data.data as Script[];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ['script-categories'],
    queryFn: async () => {
      const res = await api.get('/api/scripts/categories');
      return res.data.data as string[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/scripts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
    },
  });

  const handleNew = () => {
    setEditingScript(null);
    setShowModal(true);
  };

  const handleEdit = (script: Script) => {
    setEditingScript(script);
    setShowModal(true);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`确定要删除脚本 "${name}" 吗？`)) {
      deleteMutation.mutate(id);
    }
  };

  const handleExecute = (script: Script) => {
    setExecutingScript(script);
    setExecuteParams({});
    setExecuteResult(null);
    setShowExecuteModal(true);
  };

  const runScript = () => {
    if (!executingScript) return;
    setIsExecuting(true);
    setTimeout(() => {
      setExecuteResult(`脚本 "${executingScript.name}" 执行模拟成功！\n\n（实际使用时会连接到真实服务器执行）`);
      setIsExecuting(false);
    }, 1000);
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">脚本中心</h1>
            <p className="text-text-secondary">管理运维脚本，支持版本控制和参数化执行</p>
          </div>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all"
          >
            <Plus className="w-4 h-4" />
            新建脚本
          </button>
        </div>

        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-text-secondary" />
            <input
              type="text"
              placeholder="搜索脚本..."
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
          {categories?.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
              className={clsx(
                'px-4 py-2 rounded-lg text-sm font-medium transition-all',
                selectedCategory === category
                  ? 'bg-primary text-white'
                  : 'bg-surface text-text-secondary hover:bg-background'
              )}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {scripts?.map((script) => (
            <div
              key={script.id}
              className="bg-surface rounded-xl p-6 border border-border hover:border-primary/50 transition-all"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <FileCode className="w-6 h-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-text-primary">{script.name}</h3>
                  <p className="text-sm text-text-secondary">v{script.version} · {script.type}</p>
                </div>
              </div>

              <p className="text-sm text-text-secondary mb-4 line-clamp-2">
                {script.description}
              </p>

              <div className="flex items-center gap-2 mb-4">
                <span className="px-2 py-1 bg-background rounded text-xs text-text-secondary flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  {script.category}
                </span>
              </div>

              <div className="text-xs text-text-secondary mb-4">
                更新于 {formatDistanceToNow(new Date(script.updated_at), { addSuffix: true })}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExecute(script)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-500/10 text-green-600 rounded-lg hover:bg-green-500/20 transition-all"
                >
                  <Play className="w-4 h-4" />
                  执行
                </button>
                <button
                  onClick={() => handleEdit(script)}
                  className="p-2 hover:bg-background rounded-lg transition-all"
                  title="编辑"
                >
                  <Edit className="w-4 h-4 text-text-secondary" />
                </button>
                <button
                  onClick={() => handleDelete(script.id, script.name)}
                  className="p-2 hover:bg-status-failed/10 rounded-lg transition-all"
                  title="删除"
                >
                  <Trash2 className="w-4 h-4 text-status-failed" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {scripts?.length === 0 && (
          <div className="text-center py-12">
            <FileCode className="w-16 h-16 text-text-secondary mx-auto mb-4 opacity-50" />
            <p className="text-text-secondary">暂无脚本</p>
          </div>
        )}
      </div>

      {showModal && (
        <ScriptModal
          script={editingScript}
          categories={categories || []}
          onClose={() => setShowModal(false)}
        />
      )}

      {showExecuteModal && executingScript && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface rounded-xl p-6 w-full max-w-3xl mx-4 border border-border max-h-[90vh] overflow-auto">
            <h2 className="text-xl font-bold text-text-primary mb-6 flex items-center gap-2">
              <Code className="w-6 h-6 text-primary" />
              执行 {executingScript.name}
            </h2>

            <div className="mb-6">
              <h3 className="text-sm font-semibold text-text-secondary mb-2">脚本内容</h3>
              <pre className="bg-background rounded-lg p-4 text-sm font-mono text-text-primary overflow-auto max-h-60">
                {executingScript.content}
              </pre>
            </div>

            {executingScript.parameters.length > 0 && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-text-secondary mb-3">参数配置</h3>
                <div className="space-y-4">
                  {executingScript.parameters.map((param) => (
                    <div key={param.name}>
                      <label className="block text-sm text-text-secondary mb-1">
                        {param.description}
                        {param.required && <span className="text-status-failed ml-1">*</span>}
                      </label>
                      <input
                        type="text"
                        value={executeParams[param.name] || ''}
                        onChange={(e) => setExecuteParams({
                          ...executeParams,
                          [param.name]: e.target.value
                        })}
                        placeholder={`请输入 ${param.name}`}
                        className="w-full px-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                        required={param.required}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {executeResult && (
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-text-secondary mb-2">执行结果</h3>
                <pre className="bg-background rounded-lg p-4 text-sm font-mono text-text-primary whitespace-pre-wrap">
                  {executeResult}
                </pre>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={runScript}
                disabled={isExecuting}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {isExecuting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                {isExecuting ? '执行中...' : '执行脚本'}
              </button>
              <button
                type="button"
                onClick={() => setShowExecuteModal(false)}
                className="px-4 py-2 bg-background text-text-secondary rounded-lg hover:bg-background/80 transition-all"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScriptModal({ script, categories, onClose }: { script: Script | null, categories: string[], onClose: () => void }) {
  const queryClient = useQueryClient();
  const [paramsInput, setParamsInput] = useState(
    script?.parameters ? JSON.stringify(script.parameters, null, 2) : ''
  );
  const [formData, setFormData] = useState({
    name: script?.name || '',
    description: script?.description || '',
    type: script?.type || 'shell',
    content: script?.content || '',
    category: script?.category || '',
  });

  const mutation = useMutation({
    mutationFn: async (data: Pick<Script, 'name' | 'description' | 'type' | 'content' | 'category'>) => {
      let params;
      try {
        params = paramsInput ? JSON.parse(paramsInput) : [];
      } catch {
        params = [];
      }

      if (script) {
        await api.put(`/api/scripts/${script.id}`, { ...data, parameters: params });
      } else {
        await api.post('/api/scripts', { ...data, parameters: params });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scripts'] });
      queryClient.invalidateQueries({ queryKey: ['script-categories'] });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface rounded-xl p-6 w-full max-w-4xl mx-4 border border-border max-h-[90vh] overflow-auto">
        <h2 className="text-xl font-bold text-text-primary mb-6">
          {script ? '编辑脚本' : '新建脚本'}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                脚本名称
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                脚本类型
              </label>
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
              >
                <option value="shell">Shell</option>
                <option value="python">Python</option>
                <option value="powershell">PowerShell</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                分类
              </label>
              <input
                type="text"
                list="category-list"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="选择或输入分类"
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
              />
              <datalist id="category-list">
                {categories.map((cat) => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-1">
                描述
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              脚本内容
            </label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary font-mono text-sm h-64 resize-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              参数配置 (JSON格式，可选)
            </label>
            <textarea
              value={paramsInput}
              onChange={(e) => setParamsInput(e.target.value)}
              placeholder='[{"name":"param1","description":"参数描述","required":true}]'
              className="w-full px-4 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary font-mono text-sm h-24 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all"
            >
              {mutation.isPending ? '保存中...' : (script ? '保存' : '创建')}
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
