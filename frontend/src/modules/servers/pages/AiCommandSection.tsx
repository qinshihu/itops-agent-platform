import {
  Bot, Server, AlertCircle, Sparkles, RefreshCw, Terminal, X,
} from 'lucide-react';
import clsx from 'clsx';
import type { Server as ServerType } from './types';

interface AiCommandSectionProps {
  isOpen: boolean;
  aiCommandServer: ServerType | null;
  aiPrompt: string;
  onAiPromptChange: (v: string) => void;
  aiGeneratedCommand: string;
  onAiGeneratedCommandChange: (v: string) => void;
  aiCommandExplanation: string;
  aiGenerationError: string;
  isAiGenerating: boolean;
  selectedAiAgent: { id: string; name: string } | null;
  showAiCommandConfirm: boolean;
  onClose: () => void;
  onGenerate: () => void;
  onExecute: () => void;
  onConfirmExecute: () => void;
  onCancelConfirm: () => void;
}

export function AiCommandSection({
  isOpen,
  aiCommandServer,
  aiPrompt,
  onAiPromptChange,
  aiGeneratedCommand,
  onAiGeneratedCommandChange,
  aiCommandExplanation,
  aiGenerationError,
  isAiGenerating,
  selectedAiAgent,
  showAiCommandConfirm,
  onClose,
  onGenerate,
  onExecute,
  onConfirmExecute,
  onCancelConfirm,
}: AiCommandSectionProps) {
  if (!isOpen || !aiCommandServer) return null;

  return (
    <>
      {/* AI 命令生成模态框 */}
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-surface rounded-xl p-8 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-surface border border-border flex items-center justify-center">
                <Bot className="w-5 h-5 text-text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-text-primary">AI 智能命令生成</h3>
                <p className="text-sm text-text-secondary mt-1.5">
                  {aiCommandServer.name} ({aiCommandServer.hostname})
                  {selectedAiAgent && (
                    <span className="ml-2 text-text-tertiary">
                      · 默认调用{' '}
                      <span className="font-medium text-text-secondary">{selectedAiAgent.name} Agent</span>
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-background rounded-lg transition-colors">
              <X className="w-5 h-5 text-text-secondary" />
            </button>
          </div>

          {/* 无 Agent 提示 */}
          {!selectedAiAgent && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-300 font-medium">
                没有可用的 AI Agent。请先前往「Agent 管理」页面创建并启用一个 Agent。
              </p>
            </div>
          )}

          {/* 生成错误提示 */}
          {aiGenerationError && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-300 font-medium">{aiGenerationError}</p>
            </div>
          )}

          {/* 操作系统信息展示 */}
          <div className="mb-6 p-3 bg-background border border-border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Server className="w-4 h-4 text-text-secondary" />
                <span className="text-text-secondary">目标操作系统：</span>
                <span className="text-text-primary font-medium">
                  {aiCommandServer?.os || aiCommandServer?.os_type || 'linux (默认，未采集信息)'}
                </span>
              </div>
              {!aiCommandServer?.os && (
                <span className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  建议先采集服务器信息，以便生成更准确的命令
                </span>
              )}
            </div>
          </div>

          {/* 输入提示 */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-text-secondary mb-2">请描述您要执行的操作</label>
            <div className="relative">
              <textarea
                value={aiPrompt}
                onChange={(e) => onAiPromptChange(e.target.value)}
                placeholder="例如：查看磁盘使用情况 / 查看内存占用前 10 的进程 / 检查 Nginx 是否运行..."
                rows={3}
                className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:outline-none focus:border-purple-500 text-text-primary resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    onGenerate();
                  }
                }}
              />
              <button
                onClick={onGenerate}
                disabled={isAiGenerating || !aiPrompt.trim()}
                className="absolute right-3 bottom-3 px-4 py-1.5 bg-text-primary text-surface rounded-lg text-sm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {isAiGenerating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    生成命令
                  </>
                )}
              </button>
            </div>
            {/* 快捷提示 */}
            <div className="mt-3 flex flex-wrap gap-2">
              {(aiCommandServer?.os_type === 'windows'
                ? [
                    '查看磁盘使用情况',
                    '检查内存占用前10的进程',
                    '查看端口监听情况',
                    '检查IIS服务状态',
                    '查看系统负载情况',
                    '查看系统事件日志',
                    '查看当前登录用户',
                    '清理临时文件',
                    '检查Windows服务状态',
                  ]
                : [
                    '查看磁盘使用率',
                    '检查内存占用前10的进程',
                    '查看端口监听情况',
                    '检查Nginx服务状态',
                    '查看系统负载情况',
                    '查看系统日志最后20行',
                    '查看当前登录用户',
                    '清理临时文件',
                    '检查Docker容器状态',
                  ]
              ).map((tip) => (
                <button
                  key={tip}
                  onClick={() => onAiPromptChange(tip)}
                  className="px-4 py-1.5 bg-surface/80 border border-border/50 text-text-primary rounded-full text-sm hover:bg-surface hover:border-purple-500/40 transition-colors"
                >
                  {tip}
                </button>
              ))}
            </div>
          </div>

          {/* 生成的命令 */}
          {aiGeneratedCommand && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-text-secondary">AI 生成的命令（可编辑）</label>
                <button
                  onClick={() => navigator.clipboard.writeText(aiGeneratedCommand)}
                  className="text-xs text-text-tertiary hover:text-text-secondary"
                >
                  复制命令
                </button>
              </div>
              <textarea
                value={aiGeneratedCommand}
                onChange={(e) => onAiGeneratedCommandChange(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-black/80 border border-border rounded-lg font-mono text-sm text-green-400 focus:outline-none focus:border-purple-500 resize-y"
              />
              {aiCommandExplanation && (
                <div className="mt-3 p-3 bg-yellow-500/20 border border-yellow-500/40 rounded-lg">
                  <p className="text-sm text-yellow-300 dark:text-yellow-200 font-medium">
                    <strong>💡 说明：</strong>
                    {aiCommandExplanation}
                  </p>
                </div>
              )}
              <div className="mt-3 p-3 bg-red-500/20 border border-red-500/40 rounded-lg">
                <p className="text-sm text-red-300 dark:text-red-200 font-medium">
                  <strong>⚠️ 警告：</strong>
                  请仔细确认命令的安全性和正确性，再执行！错误的命令可能导致数据丢失或系统故障。
                </p>
              </div>
            </div>
          )}

          {/* 按钮组 */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors"
            >
              取消
            </button>
            {aiGeneratedCommand && (
              <>
                <button
                  onClick={() => {
                    onAiGeneratedCommandChange('');
                    onGenerate();
                  }}
                  disabled={isAiGenerating}
                  className="flex-1 px-4 py-2 bg-surface border border-border text-text-secondary rounded-lg hover:bg-background transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <RefreshCw className={clsx('w-4 h-4', isAiGenerating && 'animate-spin')} />
                  重新生成
                </button>
                <button
                  onClick={onExecute}
                  className="flex-1 px-4 py-2 bg-text-primary text-surface rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Terminal className="w-4 h-4" />
                  确认并执行
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* AI 命令执行确认弹窗 */}
      {showAiCommandConfirm && aiCommandServer && aiGeneratedCommand && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-surface rounded-xl p-6 w-full max-w-lg mx-4">
            <h3 className="text-lg font-bold text-text-primary mb-4">确认执行命令</h3>
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 text-sm">
                <Server className="w-4 h-4 text-text-secondary" />
                <span className="text-text-secondary">目标服务器：</span>
                <span className="text-text-primary font-medium">
                  {aiCommandServer.name} ({aiCommandServer.hostname})
                </span>
              </div>
              <div>
                <span className="text-sm text-text-secondary">执行命令：</span>
                <div className="mt-1 bg-black/80 rounded-lg p-3">
                  <code className="text-green-400 font-mono text-sm break-all">{aiGeneratedCommand}</code>
                </div>
              </div>
              {aiCommandExplanation && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-sm text-yellow-300">
                    <strong>💡 说明：</strong>
                    {aiCommandExplanation}
                  </p>
                </div>
              )}
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-300 font-medium">
                  ⚠️ 此操作将在目标服务器上执行命令，请确认命令的安全性！
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onCancelConfirm}
                className="flex-1 px-4 py-2 bg-surface border border-border text-text-primary rounded-lg hover:bg-background transition-colors"
              >
                取消
              </button>
              <button
                onClick={onConfirmExecute}
                className="flex-1 px-4 py-2 bg-text-primary text-surface rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
              >
                <Terminal className="w-4 h-4" />
                确认执行
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
