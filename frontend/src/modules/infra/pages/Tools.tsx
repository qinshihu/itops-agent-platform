
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Plus, 
  Play, 
  RefreshCw, 
  Wrench, 
  Cpu, 
  Box, 
  Code, 
  Activity, 
  Search,
  Terminal,
  Network,
  Database,
  Monitor,
} from 'lucide-react';
import clsx from 'clsx';
import api from '../../../lib/api';
import MarkdownOutput from '../../../shared/components/MarkdownOutput';

interface AgentTool {
  id: string;
  name: string;
  description: string;
  category: string;
  schema: any;
}

export default function Tools() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTestModal, setShowTestModal] = useState<{ tool: AgentTool | null }>({ tool: null });
  const [testArgs, setTestArgs] = useState('{}');
  const [testResult, setTestResult] = useState<{ output: string | null }>({ output: null });
  const [isTesting, setIsTesting] = useState(false);

  const { data: tools, isLoading } = useQuery({
    queryKey: ['tools', selectedCategory],
    queryFn: async () => {
      const params = selectedCategory ? { category: selectedCategory } : undefined;
      const res = await api.get('/api/agents/tools/list', { params });
      return res.data.data as AgentTool[];
    },
  });

  const testMutation = useMutation({
    mutationFn: async ({ toolId, args }: { toolId: string; args: any }) => {
      const res = await api.post('/api/agents/tools/test', { toolId, args });
      return res.data.data;
    },
  });

  const categories = Array.from(new Set((tools || []).map(t => t.category)));

  const filteredTools = (tools || []).filter(t => 
    !searchQuery || 
    t.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleTest = async (tool: AgentTool) => {
    setShowTestModal({ tool });
    setTestArgs('{}');
    setTestResult({ output: null });
  };

  const runTest = async () => {
    if (!showTestModal.tool) return;
    setIsTesting(true);
    try {
      let args = {};
      try {
        args = JSON.parse(testArgs);
      } catch {
        args = {};
      }
      const result = await testMutation.mutateAsync({
        toolId: showTestModal.tool.id,
        args,
      });
      setTestResult({ output: typeof result === 'string' ? result : JSON.stringify(result) });
    } catch (error) {
      setTestResult({ output: `测试失败: ${error}` });
    } finally {
      setIsTesting(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'ssh': return Terminal;
      case 'docker': return Box;
      case 'kubernetes': return Activity;
      case 'system': return Cpu;
      case 'network': return Network;
      case 'database': return Database;
      default: return Wrench;
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900 overflow-hidden">
      <div className="p-6 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">工具管理</h1>
          <p className="text-slate-400">管理和测试 Agent 工具</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['tools'] })}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-100 rounded-lg hover:bg-slate-700 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>
      </div>

      <div className="p-4 border-b border-slate-700 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索工具..."
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500 w-64"
          />
        </div>

        <div className="flex gap-2 items-center">
          <span className="text-sm text-slate-400">分类:</span>
          <button
            onClick={() => setSelectedCategory(null)}
            className={clsx(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
              !selectedCategory
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            )}
          >
            全部
          </button>
          {categories.map((cat) => {
            const Icon = getCategoryIcon(cat);
            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                className={clsx(
                  "px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition-all",
                  selectedCategory === cat
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTools.map((tool) => {
            const Icon = getCategoryIcon(tool.category);
            return (
              <div
                key={tool.id}
                className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/20">
                      <Icon className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-100">{tool.name}</h3>
                      <span className="text-xs text-slate-400">{tool.category}</span>
                    </div>
                  </div>
                </div>
                
                <p className="text-sm text-slate-300 mb-5 line-clamp-3">{tool.description}</p>

                {tool.schema && (
                  <div className="mb-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                    <p className="text-xs text-slate-400 mb-1.5">参数:</p>
                    <pre className="text-xs text-slate-300 overflow-x-auto max-h-24">
                      {JSON.stringify(tool.schema.properties, null, 2)}
                    </pre>
                  </div>
                )}

                <button
                  onClick={() => handleTest(tool)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-500 hover:to-blue-600 transition-all font-medium"
                >
                  <Play className="w-4 h-4" />
                  测试工具
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {showTestModal.tool && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-3xl flex flex-col max-h-[80vh]">
            <div className="p-6 border-b border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/20">
                  <Wrench className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-100">测试工具: {showTestModal.tool.name}</h2>
                  <p className="text-sm text-slate-400">{showTestModal.tool.description}</p>
                </div>
              </div>
              <button
                onClick={() => setShowTestModal({ tool: null })}
                className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-700 rounded-lg transition-all"
              >
                ✕
              </button>
            </div>
            
            <div className="p-6 overflow-auto flex-1 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  参数 (JSON)
                </label>
                <textarea
                  value={testArgs}
                  onChange={(e) => setTestArgs(e.target.value)}
                  placeholder='{"host": "192.168.1.100", "command": "uptime"}'
                  className="w-full h-32 px-4 py-3 bg-slate-900 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <button
                onClick={runTest}
                disabled={isTesting}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-500 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium"
              >
                {isTesting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    执行中...
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    执行测试
                  </>
                )}
              </button>

              {testResult.output && (
                <div className="mt-4 p-4 bg-slate-900 border border-slate-700 rounded-lg max-h-64 overflow-auto">
                  <MarkdownOutput content={testResult.output} />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
