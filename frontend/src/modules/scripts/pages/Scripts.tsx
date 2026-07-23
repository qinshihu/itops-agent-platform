/**
 * 脚本管理页面
 *
 * 从原 infra/pages/Scripts.tsx 抽离（2026-07-08 增量-12 P1-6 frontend 同步）。
 * 改为通过 scriptsApi 调用。
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FileCode, Plus, Edit, Trash2, Play, Search, Tag, Code } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import clsx from 'clsx';
import { scriptsApi, type Script } from '../api';

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
    queryFn: () =>
      scriptsApi.listScripts({
        ...(search && { search }),
        ...(selectedCategory && { category: selectedCategory }),
      }),
  });

  const { data: categories } = useQuery({
    queryKey: ['script-categories'],
    queryFn: () => scriptsApi.listScriptCategories(),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await scriptsApi.deleteScript(id);
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

  const runScript = async () => {
    if (!executingScript) return;
    setIsExecuting(true);
    try {
      // 调用后端 execute 端点（2026-07-23 补：之前是前端 setTimeout mock）
      const { data } = await api.post(`/scripts/${executingScript.id}/execute`, {
        params: executeParams,
      });
      setExecuteResult(data?.output ?? `脚本 "${executingScript.name}" 已提交执行`);
    } catch (err) {
      message.error(getAxiosErrorMessage(err, '执行失败'));
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary">脚本管理</h1>
            <p className="text-text-secondary">管理系统维护脚本和工具</p>
          </div>
          <button
            onClick={handleNew}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            新建脚本
          </button>
        </div>

        {/* 搜索和分类筛选 */}
        <div className="bg-surface rounded-xl border border-border p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 flex items-center gap-2">
              <Search className="w-5 h-5 text-text-secondary" />
              <input
                type="text"
                placeholder="搜索脚本..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory(null)}
                className={clsx(
                  'px-3 py-1 rounded-lg text-sm transition-colors flex items-center gap-1',
                  selectedCategory === null
                    ? 'bg-primary text-white'
                    : 'bg-background border border-border text-text-secondary hover:border-primary'
                )}
              >
                <Tag className="w-3 h-3" />
                全部分类
              </button>
              {categories?.map((category) => (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={clsx(
                    'px-3 py-1 rounded-lg text-sm transition-colors flex items-center gap-1',
                    selectedCategory === category
                      ? 'bg-primary text-white'
                      : 'bg-background border border-border text-text-secondary hover:border-primary'
                  )}
                >
                  <Tag className="w-3 h-3" />
                  {category}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 脚本列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scripts?.map((script) => (
            <div
              key={script.id}
              className="bg-surface border border-border rounded-xl p-4 hover:border-primary transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-primary" />
                  <h3 className="font-semibold text-text-primary">{script.name}</h3>
                </div>
                <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded">
                  {script.type}
                </span>
              </div>
              <p className="text-sm text-text-secondary mb-3 line-clamp-2">
                {script.description || '无描述'}
              </p>
              <div className="flex items-center gap-2 mb-3 text-xs text-text-secondary">
                <span className="flex items-center gap-1">
                  <Code className="w-3 h-3" />
                  {script.category}
                </span>
                <span>·</span>
                <span>v{script.version}</span>
                <span>·</span>
                <span>{formatDistanceToNow(new Date(script.updated_at), { addSuffix: true })}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExecute(script)}
                  className="flex-1 px-3 py-1.5 bg-green-500/10 text-green-500 rounded-lg hover:bg-green-500/20 transition-colors flex items-center justify-center gap-1 text-sm"
                >
                  <Play className="w-3 h-3" />
                  执行
                </button>
                <button
                  onClick={() => handleEdit(script)}
                  className="flex-1 px-3 py-1.5 bg-blue-500/10 text-blue-500 rounded-lg hover:bg-blue-500/20 transition-colors flex items-center justify-center gap-1 text-sm"
                >
                  <Edit className="w-3 h-3" />
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(script.id, script.name)}
                  className="px-3 py-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors flex items-center justify-center"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {scripts?.length === 0 && (
          <div className="text-center py-12 text-text-secondary">
            暂无脚本，点击右上角"新建脚本"开始
          </div>
        )}
      </div>

      {/* 编辑/新建模态框 */}
      {showModal && (
        <ScriptFormModal
          script={editingScript}
          categories={categories || []}
          onClose={() => setShowModal(false)}
          onSaved={() => {
            setShowModal(false);
            queryClient.invalidateQueries({ queryKey: ['scripts'] });
          }}
        />
      )}

      {/* 执行模态框 */}
      {showExecuteModal && executingScript && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface border border-border rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-text-primary">执行脚本: {executingScript.name}</h2>
                <button
                  onClick={() => setShowExecuteModal(false)}
                  className="text-text-secondary hover:text-text-primary"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-4">
                {executingScript.parameters.length > 0 ? (
                  <div className="space-y-3">
                    {executingScript.parameters.map((param) => (
                      <div key={param.name}>
                        <label className="block text-sm text-text-secondary mb-1">
                          {param.name} {param.required && <span className="text-red-500">*</span>}
                        </label>
                        <input
                          type="text"
                          value={executeParams[param.name] || ''}
                          onChange={(e) =>
                            setExecuteParams((prev) => ({ ...prev, [param.name]: e.target.value }))
                          }
                          placeholder={param.description}
                          className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                        />
                        <p className="text-xs text-text-secondary mt-1">{param.description}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-text-secondary">此脚本无需参数</p>
                )}

                {executeResult && (
                  <div>
                    <label className="block text-sm text-text-secondary mb-1">执行结果</label>
                    <pre className="bg-background p-3 rounded text-sm text-text-primary overflow-x-auto whitespace-pre-wrap">
                      {executeResult}
                    </pre>
                  </div>
                )}

                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => setShowExecuteModal(false)}
                    className="px-4 py-2 bg-background border border-border text-text-primary rounded-lg hover:border-primary transition-colors"
                  >
                    关闭
                  </button>
                  <button
                    onClick={runScript}
                    disabled={isExecuting}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {isExecuting ? '执行中...' : '执行'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ScriptFormModalProps {
  script: Script | null;
  categories: string[];
  onClose: () => void;
  onSaved: () => void;
}

function ScriptFormModal({ script, categories, onClose, onSaved }: ScriptFormModalProps) {
  const [name, setName] = useState(script?.name || '');
  const [description, setDescription] = useState(script?.description || '');
  const [type, setType] = useState(script?.type || 'shell');
  const [content, setContent] = useState(script?.content || '');
  const [category, setCategory] = useState(script?.category || categories[0] || '');
  const [parameters, setParameters] = useState(script?.parameters || []);

  const handleSave = async () => {
    try {
      const data = {
        name,
        description,
        type,
        content,
        category,
      };
      const params = parameters.map((p) => ({
        ...p,
        required: Boolean(p.required),
      }));

      if (script) {
        await scriptsApi.updateScript(script.id, { ...data, parameters: params });
      } else {
        await scriptsApi.createScript({ ...data, parameters: params });
      }
      onSaved();
    } catch (error) {
      console.error('保存失败', error);
      alert('保存失败，请重试');
    }
  };

  const addParameter = () => {
    setParameters((prev) => [...prev, { name: '', description: '', required: false }]);
  };

  const removeParameter = (index: number) => {
    setParameters((prev) => prev.filter((_, i) => i !== index));
  };

  const updateParameter = (index: number, field: string, value: string | boolean) => {
    setParameters((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-text-primary">
              {script ? '编辑脚本' : '新建脚本'}
            </h2>
            <button onClick={onClose} className="text-text-secondary hover:text-text-primary">
              ✕
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">脚本名称 *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">描述</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1">类型</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value="shell">Shell</option>
                  <option value="python">Python</option>
                  <option value="javascript">JavaScript</option>
                  <option value="sql">SQL</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">分类</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">脚本内容 *</label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={8}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary font-mono text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm text-text-secondary">参数</label>
                <button
                  onClick={addParameter}
                  className="text-sm text-primary hover:underline"
                >
                  + 添加参数
                </button>
              </div>
              {parameters.map((param, index) => (
                <div key={index} className="flex items-center gap-2 mb-2">
                  <input
                    type="text"
                    placeholder="参数名"
                    value={param.name}
                    onChange={(e) => updateParameter(index, 'name', e.target.value)}
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-text-primary text-sm"
                  />
                  <input
                    type="text"
                    placeholder="描述"
                    value={param.description}
                    onChange={(e) => updateParameter(index, 'description', e.target.value)}
                    className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-text-primary text-sm"
                  />
                  <label className="flex items-center gap-1 text-sm text-text-secondary">
                    <input
                      type="checkbox"
                      checked={param.required}
                      onChange={(e) => updateParameter(index, 'required', e.target.checked)}
                    />
                    必填
                  </label>
                  <button
                    onClick={() => removeParameter(index)}
                    className="text-red-500 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 justify-end pt-4 border-t border-border">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-background border border-border text-text-primary rounded-lg hover:border-primary transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!name || !content}
                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
