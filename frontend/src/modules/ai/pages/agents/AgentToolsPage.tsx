/**
 * Agent 工具管理页（/agents/tools）
 *
 * v2.1（2026-07-21）P2 拆分：
 * - <500 行（之前 735 行）
 * - 把 SchemaTable / ToolTestPanel / ToolHistoryPanel 抽到 ./tool/ 子目录
 * - P2-9: testArgs 类型 Record<string, string> → Record<string, unknown>，
 *         子组件动态返回真实类型，无需 JSON.parse
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Search, Wrench, Copy, Check, ChevronRight, ShieldAlert } from 'lucide-react';
import api from '../../../../lib/api';
import { SchemaTable } from './tool/SchemaTable';
import { ToolTestPanel } from './tool/ToolTestPanel';
import { ToolHistoryPanel } from './tool/ToolHistoryPanel';
import {
  type AgentTool,
  type CategoryKey,
  type ToolHistoryItem,
  type ToolTestResult,
  getCategoryConfig,
  RISK_CONFIG,
  buildToolArgs,
} from './tool/types';

const HISTORY_MAX = 20;

export default function AgentToolsPage() {
  // ── UI state ─────────────────────────────────────────────
  const [selectedToolId, setSelectedToolId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryKey | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  // P2-9：类型从 Record<string, string> 改为 Record<string, unknown>，
  //       子组件动态返回真实类型（boolean/number/object/string）
  const [testArgs, setTestArgs] = useState<Record<string, unknown>>({});
  const [testResults, setTestResults] = useState<Record<string, ToolTestResult>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [history, setHistory] = useState<ToolHistoryItem[]>([]);

  // ── 数据获取 ─────────────────────────────────────────────
  const { data: tools, isLoading } = useQuery<AgentTool[]>({
    queryKey: ['agent-tools'],
    queryFn: async () => {
      const { data } = await api.get('/agents/tools/list');
      return Array.isArray(data) ? data : data?.items || [];
    },
  });

  // ── 工具执行 mutation ─────────────────────────────────────
  const testMutation = useMutation({
    mutationFn: async ({ toolId, args }: { toolId: string; args: Record<string, unknown> }) => {
      const { data } = await api.post('/agents/tools/test', { toolId, args });
      return data;
    },
    onSuccess: (data, variables) => {
      const resultStr = data?.data?.result || JSON.stringify(data, null, 2);
      setTestResults((prev) => ({
        ...prev,
        [variables.toolId]: { success: data?.success ?? true, result: resultStr },
      }));
      const toolMeta = tools?.find((t) => t.id === variables.toolId);
      setHistory((prev) =>
        [
          {
            id: `${variables.toolId}-${Date.now()}`,
            toolId: variables.toolId,
            toolName: toolMeta?.name ?? variables.toolId,
            args: variables.args,
            success: data?.success ?? true,
            resultPreview: String(resultStr).slice(0, 200),
            timestamp: Date.now(),
          },
          ...prev,
        ].slice(0, HISTORY_MAX),
      );
    },
    onError: (error, variables) => {
      const errMsg = (error as Error).message || '工具执行失败';
      setTestResults((prev) => ({
        ...prev,
        [variables.toolId]: { success: false, error: errMsg },
      }));
      const toolMeta = tools?.find((t) => t.id === variables.toolId);
      setHistory((prev) =>
        [
          {
            id: `${variables.toolId}-${Date.now()}`,
            toolId: variables.toolId,
            toolName: toolMeta?.name ?? variables.toolId,
            args: variables.args,
            success: false,
            resultPreview: errMsg,
            timestamp: Date.now(),
          },
          ...prev,
        ].slice(0, HISTORY_MAX),
      );
    },
  });

  // ── 派生数据 ─────────────────────────────────────────────
  const filteredTools = useMemo(() => {
    if (!tools) return [];
    return tools.filter((tool) => {
      const matchCategory = activeCategory === 'all' || tool.category === activeCategory;
      const matchSearch =
        !searchQuery ||
        tool.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tool.description.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCategory && matchSearch;
    });
  }, [tools, activeCategory, searchQuery]);

  const selectedTool = useMemo(() => {
    if (!selectedToolId || !tools) return null;
    return tools.find((t) => t.id === selectedToolId) || null;
  }, [selectedToolId, tools]);

  const categoryCounts = useMemo(() => {
    if (!tools) return {} as Record<string, number>;
    return tools.reduce(
      (acc, tool) => {
        acc[tool.category] = (acc[tool.category] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );
  }, [tools]);

  // ── 事件处理 ─────────────────────────────────────────────
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleTest = () => {
    if (!selectedTool) return;
    const args = buildToolArgs(selectedTool.schema, testArgs);
    testMutation.mutate({ toolId: selectedTool.id, args });
  };

  const handleClientError = (msg: string) => {
    if (!selectedTool) return;
    setTestResults((prev) => ({
      ...prev,
      [selectedTool.id]: { success: false, error: msg },
    }));
  };

  const handleClearResult = () => {
    if (!selectedTool) return;
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[selectedTool.id];
      return next;
    });
  };

  // ── 渲染 ─────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-background">
      {/* 顶部标题栏 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/40 bg-surface/50 backdrop-blur-sm">
        <div>
          <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Wrench className="w-5 h-5 text-primary" />
            Agent 工具管理
          </h1>
          <p className="text-sm text-text-secondary mt-0.5">
            共 {tools?.length ?? 0} 个工具 · 支持 schema 查看与执行测试
          </p>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 左：搜索 + 分类 + 工具列表 */}
        <div className="w-[380px] flex flex-col border-r border-border/40 bg-background/60">
          <div className="p-4 space-y-3 border-b border-border/40">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                placeholder="搜索工具名称或描述..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeCategory === 'all'
                    ? 'bg-primary text-white shadow-md shadow-primary/25'
                    : 'bg-surface text-text-secondary hover:text-text-primary hover:bg-surface/80 border border-border/60'
                }`}
              >
                全部
              </button>
              {(Object.keys(categoryCounts) as string[]).map((key) => {
                const count = categoryCounts[key] || 0;
                if (count === 0) return null;
                const cfg = getCategoryConfig(key);
                const Icon = cfg.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveCategory(key as CategoryKey)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${
                      activeCategory === key
                        ? `${cfg.bg} ${cfg.color} border ${cfg.border}`
                        : 'bg-surface text-text-secondary hover:text-text-primary hover:bg-surface/80 border border-border/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {cfg.label}
                    <span className="opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {isLoading ? (
              <div className="text-center py-12 text-text-tertiary text-sm">加载中...</div>
            ) : filteredTools.length === 0 ? (
              <div className="text-center py-12">
                <Search className="w-10 h-10 text-text-tertiary/40 mx-auto mb-3" />
                <p className="text-text-tertiary text-sm">未找到匹配的工具</p>
              </div>
            ) : (
              filteredTools.map((tool) => {
                const cfg = getCategoryConfig(tool.category);
                const Icon = cfg.icon;
                const isSelected = selectedToolId === tool.id;
                const riskCfg = tool.riskLevel ? RISK_CONFIG[tool.riskLevel] : null;
                return (
                  <button
                    key={tool.id}
                    onClick={() => {
                      setSelectedToolId(tool.id);
                      setTestArgs({});
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all group ${
                      isSelected
                        ? `bg-surface border-primary/50 shadow-lg shadow-primary/10`
                        : `bg-surface/50 border-border/60 hover:border-border hover:bg-surface`
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg ${cfg.bg} ${cfg.color} flex items-center justify-center flex-shrink-0`}
                      >
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono font-medium text-text-primary truncate">
                            {tool.id}
                          </code>
                          {isSelected && (
                            <ChevronRight className="w-4 h-4 text-primary flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                          {tool.description}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color} font-medium`}
                          >
                            {cfg.label}
                          </span>
                          {riskCfg && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded ${riskCfg.bg} ${riskCfg.color} font-medium flex items-center gap-1`}
                              title={`风险等级: ${riskCfg.label}`}
                            >
                              {(tool.riskLevel === 'high' ||
                                tool.riskLevel === 'destructive') && (
                                <ShieldAlert className="w-2.5 h-2.5" />
                              )}
                              {riskCfg.label}
                            </span>
                          )}
                          <span className="text-[10px] text-text-tertiary">
                            {Object.keys(tool.schema.properties || {}).length} 参数
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* 右：详情面板 */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          {!selectedTool ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
              <div className="w-20 h-20 rounded-2xl bg-surface flex items-center justify-center mb-4">
                <Wrench className="w-10 h-10 text-text-tertiary/40" />
              </div>
              <h3 className="text-lg font-semibold text-text-secondary mb-2">选择一个工具</h3>
              <p className="text-sm text-text-tertiary max-w-sm">
                从左侧列表中选择一个工具，查看详细的参数 schema 并进行执行测试
              </p>
            </div>
          ) : (
            <>
              {/* 工具头部 */}
              <div className="px-6 py-4 border-b border-border/40 bg-surface/30">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      {(() => {
                        const cfg = getCategoryConfig(selectedTool.category);
                        const Icon = cfg.icon;
                        return (
                          <div
                            className={`w-11 h-11 rounded-xl ${cfg.bg} ${cfg.color} flex items-center justify-center`}
                          >
                            <Icon className="w-5 h-5" />
                          </div>
                        );
                      })()}
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold text-text-primary font-mono">
                            {selectedTool.id}
                          </h2>
                          <button
                            onClick={() => handleCopy(selectedTool.id, 'tool-id')}
                            className="p-1 rounded text-text-tertiary hover:text-text-secondary hover:bg-surface transition-colors"
                            title="复制工具 ID"
                          >
                            {copiedId === 'tool-id' ? (
                              <Check className="w-4 h-4 text-status-success" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        <p className="text-sm text-text-secondary mt-1">
                          {selectedTool.name}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-text-secondary mt-3 pl-14">
                      {selectedTool.description}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {(() => {
                      const cfg = getCategoryConfig(selectedTool.category);
                      return (
                        <span
                          className={`text-xs px-2.5 py-1 rounded-lg font-medium ${cfg.bg} ${cfg.color}`}
                        >
                          {cfg.label}
                        </span>
                      );
                    })()}
                    {selectedTool.riskLevel && (() => {
                      const riskCfg = RISK_CONFIG[selectedTool.riskLevel];
                      const isHigh =
                        selectedTool.riskLevel === 'high' ||
                        selectedTool.riskLevel === 'destructive';
                      return (
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-md font-medium ${riskCfg.bg} ${riskCfg.color} flex items-center gap-1`}
                          title={`风险等级: ${riskCfg.label}，执行后写入审计日志`}
                        >
                          {isHigh && <ShieldAlert className="w-3 h-3" />}
                          {riskCfg.label}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              </div>

              {/* 可滚动主体 */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <SchemaTable tool={selectedTool} />
                <ToolTestPanel
                  tool={selectedTool}
                  testArgs={testArgs}
                  setTestArgs={setTestArgs}
                  testResult={testResults[selectedTool.id]}
                  isPending={
                    testMutation.isPending &&
                    testMutation.variables?.toolId === selectedTool.id
                  }
                  onTest={handleTest}
                  onClearResult={handleClearResult}
                  onError={handleClientError}
                />
                <ToolHistoryPanel history={history} onClear={() => setHistory([])} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}