import { Play, Server, Database, Sparkles } from 'lucide-react';
import { message } from 'antd';
import MarkdownOutput from '../../../../shared/components/MarkdownOutput';
import api from '@/lib/api';
import type { Agent, Server as ServerType, DbConnection } from './types';

interface AgentTestPanelProps {
  editingAgent: Agent;
  testInput: string;
  setTestInput: (val: string) => void;
  testResult: { output: string; time: number } | null;
  isTesting: boolean;
  selectedServerIds: string[];
  setSelectedServerIds: (ids: string[]) => void;
  selectedDatabaseId: string;
  setSelectedDatabaseId: (id: string) => void;
  servers: ServerType[] | undefined;
  dbConnections: DbConnection[] | undefined;
  runTest: () => void;
  onClose: () => void;
}

export default function AgentTestPanel({
  editingAgent,
  testInput,
  setTestInput,
  testResult,
  isTesting,
  selectedServerIds,
  setSelectedServerIds,
  selectedDatabaseId,
  setSelectedDatabaseId,
  servers,
  dbConnections,
  runTest,
  onClose,
}: AgentTestPanelProps) {
  const isDbAgent = editingAgent.name.includes('数据库运维');

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-surface to-background backdrop-blur-xl rounded-2xl w-full max-w-3xl border border-border shadow-2xl shadow-blue-500/10 flex flex-col max-h-[90vh]">
        {/* 头部 */}
        <div className="p-6 border-b border-border/30 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-400/30 text-2xl">
              {editingAgent.avatar}
            </div>
            <div>
              <h2 className="text-xl font-bold text-text-primary">测试 {editingAgent.name}</h2>
              <p className="text-sm text-text-secondary">{editingAgent.role}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700/50 rounded-xl text-text-secondary hover:text-text-primary transition-all"
          >
            ✕
          </button>
        </div>

        {/* 内容区域 - 可滚动 */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* 数据库/服务器选择 */}
          <div className="pt-3 border-t border-border/30">
            {isDbAgent ? (
              <>
                <label className="block text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  选择数据库
                </label>
                {dbConnections && dbConnections.length > 0 ? (
                  <div className="space-y-2">
                    {dbConnections
                      .filter((d) => d.enabled)
                      .map((conn) => (
                        <label
                          key={conn.id}
                          className="flex items-center gap-3 p-3 bg-surface border border-border rounded-xl hover:bg-slate-800/50 transition-all cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="databaseId"
                            checked={selectedDatabaseId === conn.id}
                            onChange={() => setSelectedDatabaseId(conn.id)}
                            className="w-4 h-4 rounded-full border-slate-600 text-blue-500 focus:ring-blue-500/50"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-text-primary">{conn.name}</div>
                            <div className="text-xs text-text-tertiary">
                              {conn.db_type}://{conn.host}:{conn.port}/{conn.database}
                            </div>
                          </div>
                        </label>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">
                    暂无数据库连接。请先在数据库连接管理中添加。
                  </p>
                )}
                {selectedDatabaseId && dbConnections && (
                  <p className="mt-2 text-xs text-text-tertiary">
                    已选择: {dbConnections.find((d) => d.id === selectedDatabaseId)?.name}
                  </p>
                )}
              </>
            ) : (
              <>
                <label className="block text-sm font-medium text-text-primary mb-2 flex items-center gap-2">
                  <Server className="w-4 h-4" />
                  选择服务器
                </label>
                {servers && servers.length > 0 ? (
                  <div className="space-y-2">
                    {servers
                      .filter((s) => s.enabled)
                      .map((server) => (
                        <label
                          key={server.id}
                          className="flex items-center gap-3 p-3 bg-surface border border-border rounded-xl hover:bg-slate-800/50 transition-all cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedServerIds.includes(server.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedServerIds([...selectedServerIds, server.id]);
                              } else {
                                setSelectedServerIds(
                                  selectedServerIds.filter((id) => id !== server.id),
                                );
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-600 text-blue-500 focus:ring-blue-500/50"
                          />
                          <div className="flex-1">
                            <div className="text-sm font-medium text-text-primary">
                              {server.name}
                            </div>
                            <div className="text-xs text-text-tertiary">
                              {server.hostname}:{server.port}
                            </div>
                          </div>
                        </label>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-text-secondary">暂无可用的服务器</p>
                )}
                {selectedServerIds.length > 0 && servers && (
                  <p className="mt-2 text-xs text-text-tertiary">
                    已选择 {selectedServerIds.length} 台服务器:{' '}
                    {selectedServerIds
                      .map((id) => servers.find((s) => s.id === id)?.name)
                      .join(', ')}
                  </p>
                )}
              </>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-text-primary">输入内容</label>
              <button
                onClick={async () => {
                  try {
                    const { data } = await api.get(`/agents/${editingAgent.id}/test-input`);
                    if (data?.data?.testInput) {
                      setTestInput(data.data.testInput);
                      message.success('已填充推荐测试输入');
                    }
                  } catch {
                    message.error('获取推荐输入失败');
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg transition-all"
              >
                <Sparkles className="w-3.5 h-3.5" />
                填充推荐输入
              </button>
            </div>
            <textarea
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              placeholder="请输入要发送给Agent的内容..."
              className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all h-32 resize-none"
            />
          </div>

          <button
            onClick={runTest}
            disabled={!testInput || isTesting || (isDbAgent && !selectedDatabaseId)}
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-500 hover:to-blue-600 hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 font-semibold"
          >
            {isTesting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                执行中...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                运行测试
              </>
            )}
          </button>

          {testResult && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-text-primary">输出结果</span>
                <span className="text-xs text-text-tertiary">耗时: {testResult.time}ms</span>
              </div>
              <div className="bg-surface rounded-xl p-4 border border-border max-h-64 overflow-y-auto scrollbar-thin">
                <MarkdownOutput content={testResult.output} />
              </div>
            </div>
          )}
        </div>

        {/* 底部 - 固定 */}
        <div className="p-6 border-t border-border/30 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full px-6 py-3 bg-slate-700/50 text-text-primary rounded-xl hover:bg-slate-700/70 transition-all duration-300 font-semibold border border-slate-600/30"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
