import { Play } from 'lucide-react';
import { useTasks } from './useTasks';
import { TaskList } from './TaskList';
import { TaskDetail } from './TaskDetail';
import { RetryConfirmModal } from './RetryConfirmModal';
import { ReportDetailModal } from '../ReportDetailModal';

/**
 * Tasks 任务执行页面（2026-07-21 拆分）
 * 把原 653 行的 Tasks.tsx 拆为 7 文件：
 * - useTasks.ts            (hook: 全部 data/state/mutations)
 * - TaskList.tsx           (左侧 sidebar 列表)
 * - TaskDetail.tsx         (右侧详情 + tabs + node flow)
 * - TaskLogs.tsx           (日志 tab)
 * - TaskNodes.tsx          (节点结果 tab)
 * - TaskReports.tsx        (相关报告 tab)
 * - RetryConfirmModal.tsx  (失败重投 modal)
 *
 * 拆分原则遵循 architecture.md §3.3.3 单文件 → 子目录拆分 + frontend.md §一
 *
 * 拆分同时修复原 Tasks.tsx 的一个反模式：原代码把 `selectedTask` 复用为 report 显示容器
 * （L606-610 用 Report 强转 Task 类型），现在改为独立的 showReport state
 */
export default function Tasks() {
  const {
    tasks,
    reports,
    selectedTask,
    showReport,
    setShowReport,
    executingNodeId,
    taskLogs,
    retryConfirmTask,
    setRetryConfirmTask,
    handleSelectTask,
    getTaskWorkflow,
    handleDownloadReport,
    pauseMutation,
    resumeMutation,
    cancelMutation,
    retryMutation,
  } = useTasks();

  return (
    <div className="h-full overflow-hidden">
      <div className="p-6 h-full flex gap-6">
        {/* ── Task List Sidebar ── */}
        <TaskList
          tasks={tasks}
          selectedTaskId={selectedTask?.id}
          onSelectTask={handleSelectTask}
        />

        {/* ── Task Detail Panel ── */}
        <div className="flex-1 h-full flex flex-col bg-surface rounded-xl border border-border">
          {selectedTask ? (
            <TaskDetail
              task={selectedTask}
              taskLogs={taskLogs}
              workflow={getTaskWorkflow(selectedTask.workflow_id)}
              executingNodeId={executingNodeId}
              reports={reports}
              pauseMutation={pauseMutation}
              resumeMutation={resumeMutation}
              cancelMutation={cancelMutation}
              retryMutation={retryMutation}
              onShowReport={setShowReport}
              onDownloadReport={handleDownloadReport}
              onRetryClick={setRetryConfirmTask}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Play className="w-16 h-16 text-text-secondary mx-auto mb-4 opacity-50" />
                <p className="text-text-secondary">选择一个任务查看执行详情</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Report Detail Modal — 独立 showReport state（修复原 selectedTask 复用 bug） */}
      {showReport && (
        <ReportDetailModal
          report={showReport}
          onClose={() => setShowReport(null)}
          onDownload={handleDownloadReport}
        />
      )}

      {/* Retry Confirmation Modal */}
      <RetryConfirmModal
        task={retryConfirmTask}
        workflow={retryConfirmTask ? getTaskWorkflow(retryConfirmTask.workflow_id) : undefined}
        isPending={retryMutation.isPending}
        onCancel={() => setRetryConfirmTask(null)}
        onConfirm={() => retryConfirmTask && retryMutation.mutate(retryConfirmTask.id)}
      />
    </div>
  );
}