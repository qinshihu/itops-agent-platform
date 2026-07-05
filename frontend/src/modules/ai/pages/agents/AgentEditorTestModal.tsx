interface AgentEditorTestModalProps {
  testInput: string;
  setTestInput: (val: string) => void;
  testResult: string | null;
  testLoading: boolean;
  onTest: () => void;
  onClose: () => void;
}

export default function AgentEditorTestModal({
  testInput,
  setTestInput,
  testResult,
  testLoading,
  onTest,
  onClose,
}: AgentEditorTestModalProps) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-surface to-background backdrop-blur-xl rounded-2xl w-full max-w-3xl border border-border shadow-2xl shadow-blue-500/10 flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-border/30 flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
            🧪 测试 Agent
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700/50 rounded-xl text-text-secondary hover:text-text-primary transition-all"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              输入测试内容
            </label>
            <textarea
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-text-primary focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 transition-all h-32 resize-none"
              placeholder="输入您想让这个 Agent 处理的内容..."
            />
          </div>

          <button
            onClick={onTest}
            disabled={testLoading || !testInput.trim()}
            className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-500 hover:to-blue-600 hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 font-semibold"
          >
            {testLoading ? '测试中...' : '运行测试'}
          </button>

          {testResult && (
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                测试结果
              </label>
              <div className="p-4 bg-surface rounded-xl border border-border max-h-64 overflow-y-auto scrollbar-thin">
                <pre className="text-sm text-text-primary whitespace-pre-wrap">
                  {testResult}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border/30 flex-shrink-0">
          <button
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