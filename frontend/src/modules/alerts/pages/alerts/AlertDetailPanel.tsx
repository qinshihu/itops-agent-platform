import { Play, X as XIcon, ExternalLink, CheckCircle2, AlertCircle as AlertCircle2, ListChecks, Terminal } from 'lucide-react';
import type { ProcessResult } from './types';

function hasProcessRecords(result: ProcessResult) {
  return result.matchedPolicies.length > 0 || (result.mappingTasks?.length || 0) > 0;
}

interface AlertDetailPanelProps {
  processResult: ProcessResult;
  onClose: () => void;
  navigate: (path: string) => void;
}

export default function AlertDetailPanel({
  processResult,
  onClose,
  navigate,
}: AlertDetailPanelProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl border border-border max-w-lg w-full shadow-2xl max-h-[80vh] flex flex-col">
        {/* 头部 */}
        <div className={`p-4 border-b border-border flex items-center justify-between rounded-t-xl ${
          processResult.error
            ? 'bg-gradient-to-r from-amber-500/10 to-red-500/10'
            : hasProcessRecords(processResult)
              ? 'bg-gradient-to-r from-green-500/10 to-blue-500/10'
              : 'bg-gradient-to-r from-blue-500/10 to-purple-500/10'
        }`}>
          <h3 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            {processResult.error ? (
              <AlertCircle2 className="w-5 h-5 text-red-500" />
            ) : hasProcessRecords(processResult) ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <Play className="w-5 h-5 text-blue-500" />
            )}
            告警处理结果
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-background transition-colors"
          >
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-auto flex-1">
          {/* 状态 */}
          <div className={`p-3 rounded-lg border ${
            processResult.error
              ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400'
              : hasProcessRecords(processResult)
                ? 'bg-green-500/10 border-green-500/20 text-green-600 dark:text-green-400'
                : 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
          }`}>
            <p className="text-sm font-medium">
              {processResult.error
                ? '⚠️ 执行遇到错误: ' + processResult.error
                : hasProcessRecords(processResult)
                  ? `触发 ${processResult.matchedPolicies.length} 条修复策略，${processResult.mappingTasks?.length || 0} 个告警映射任务，${processResult.executionIds.length} 条修复执行记录已创建`
                  : 'ℹ️ 未匹配到任何修复策略（告警级别/关键词不满足已有策略条件）'}
            </p>
          </div>

          {/* 策略列表 */}
          {processResult.matchedPolicies.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-1.5">
                <ListChecks className="w-4 h-4 text-primary" />
                匹配的策略
              </h4>
              <div className="space-y-2">
                {processResult.matchedPolicies.map((p, i) => (
                  <div key={p.id} className="flex items-center justify-between p-2.5 bg-background rounded-lg border border-border">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-bold">
                        {i + 1}
                      </span>
                      <span className="text-sm text-text-primary">{p.name}</span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      p.execution_mode === 'auto' ? 'bg-green-500/10 text-green-600 dark:text-green-400' :
                      p.execution_mode === 'approval' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                      'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                    }`}>
                      {p.execution_mode === 'auto' ? '自动' : p.execution_mode === 'approval' ? '需审批' : '仅建议'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 执行ID */}
          {!!processResult.mappingTasks?.length && (
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-2 flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-primary" />
                告警映射工作流任务
              </h4>
              <div className="space-y-2">
                {processResult.mappingTasks.map((task) => (
                  <div key={task.taskId} className="p-2.5 bg-background rounded-lg border border-border">
                    <div className="text-sm text-text-primary">{task.workflowName}</div>
                    <code className="block text-xs text-text-secondary truncate mt-1">{task.taskId}</code>
                  </div>
                ))}
              </div>
            </div>
          )}

          {processResult.executionIds.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-text-primary mb-2">执行记录 ID</h4>
              <div className="space-y-1">
                {processResult.executionIds.map(eid => (
                  <code key={eid} className="block text-xs bg-background px-2 py-1 rounded border border-border text-text-secondary truncate">
                    {eid}
                  </code>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 底部操作 */}
        <div className="p-4 border-t border-border flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-background border border-border rounded-lg text-text-primary hover:bg-surface transition-colors font-medium text-sm"
          >
            关闭
          </button>
          {processResult.executionIds.length > 0 && (
            <button
              onClick={() => {
                onClose();
                navigate('/remediation-executions');
              }}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              查看执行记录
            </button>
          )}
          {!!processResult.mappingTasks?.length && (
            <button
              onClick={() => {
                onClose();
                const taskId = processResult.mappingTasks?.[0]?.taskId;
                navigate(taskId ? `/tasks?taskId=${encodeURIComponent(taskId)}` : '/tasks');
              }}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              查看工作流任务
            </button>
          )}
        </div>
      </div>
    </div>
  );
}