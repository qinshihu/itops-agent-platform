import { useEffect, useState, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Play, Pause, XCircle, Clock, CheckCircle, XCircle as XIcon, FileText, Activity, List, FileCheck } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import clsx from 'clsx';
import api from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';
import { logger } from '@/lib/logger';
import MarkdownOutput from '../../../shared/components/MarkdownOutput';
import { useTaskWebSocket } from './useTaskWebSocket';
import { ReportDetailModal } from './ReportDetailModal';
import { parseTaskData, parseTaskLogs } from './types';
import type { TaskDisplay, TaskLogEntry, WorkflowDisplay, Report } from './types';

// ── Component ──────────────────────────────────────────

export default function Tasks() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const taskIdFromQuery = searchParams.get('taskId');
  const [selectedTask, setSelectedTask] = useState<TaskDisplay | null>(null);
  const [executingNodeId, setExecutingNodeId] = useState<string | null>(null);
  const [taskLogs, setTaskLogs] = useState<TaskLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'logs' | 'nodes' | 'related_reports'>('logs');
  const [showReportDetail, setShowReportDetail] = useState<Report | null>(null);

  // ── Data Queries ────────────────────────────────────

  const { data: tasks, refetch: refetchTasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const res = await api.get('/tasks');
      const taskData = res.data.data as TaskDisplay[];
      return taskData.map(task => {
        const parsed = parseTaskData(task as unknown as Record<string, unknown>);
        const parsedTask = { ...task, ...parsed } as TaskDisplay;
        if (task.logs) {
          parsedTask.logs = parseTaskLogs(task as unknown as Record<string, unknown>);
        }
        return parsedTask;
      });
    },
  });

  const { data: reports } = useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      const res = await api.get('/reports');
      return (res.data.data || []) as Report[];
    },
  });

  const { data: workflows } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const res = await api.get('/workflows');
      return (res.data.data || []) as WorkflowDisplay[];
    },
  });

  // ── WebSocket ───────────────────────────────────────

  const onNodeStarted = useCallback((nodeId: string) => {
    setExecutingNodeId(nodeId);
  }, []);

  const onTaskLog = useCallback((entry: TaskLogEntry) => {
    setTaskLogs(prev => [...prev, entry]);
  }, []);

  const onNodeCompleted = useCallback((taskId: string, status: string) => {
    setExecutingNodeId(null);
    refetchTasks();
    setTaskLogs(prev => [
      ...prev,
      { type: 'success', content: `节点执行完成: ${status}`, timestamp: new Date() },
    ]);
  }, [refetchTasks]);

  useTaskWebSocket({
    token,
    selectedTask,
    onRefetchTasks: refetchTasks,
    onNodeStarted,
    onTaskLog,
    onNodeCompleted,
  });

  // ── Task sync from polling ──────────────────────────

  useEffect(() => {
    if (!selectedTask || !tasks) return;
    const updatedTask = tasks.find(t => t.id === selectedTask.id);
    if (!updatedTask) return;

    const hasChanged =
      updatedTask.status !== selectedTask.status ||
      JSON.stringify(updatedTask.node_results) !== JSON.stringify(selectedTask.node_results);

    if (hasChanged) {
      const parsed = parseTaskData(updatedTask as unknown as Record<string, unknown>);
      const parsedTask = { ...updatedTask, ...parsed } as TaskDisplay;
      if (updatedTask.logs) {
        parsedTask.logs = parseTaskLogs(updatedTask as unknown as Record<string, unknown>);
      }
      setSelectedTask(parsedTask);
      if (updatedTask.status === 'completed' || updatedTask.status === 'failed') {
        setTaskLogs(parsedTask.logs);
      }
    }
  }, [tasks, selectedTask]);

  // ── Task selection ──────────────────────────────────

  const handleSelectTask = (task: TaskDisplay) => {
    const parsed = parseTaskData(task as unknown as Record<string, unknown>);
    const parsedTask = { ...task, ...parsed } as TaskDisplay;
    parsedTask.logs = parseTaskLogs(task as unknown as Record<string, unknown>);
    setSelectedTask(parsedTask);
    setTaskLogs(parsedTask.logs);
  };

  useEffect(() => {
    if (!taskIdFromQuery || !tasks || selectedTask?.id === taskIdFromQuery) return;
    const task = tasks.find(item => item.id === taskIdFromQuery);
    if (task) handleSelectTask(task);
  }, [taskIdFromQuery, selectedTask?.id, tasks]);

  // ── Mutations ───────────────────────────────────────

  const pauseMutation = useMutation({
    mutationFn: (taskId: string) => api.put(`/tasks/${taskId}/pause`),
    onSuccess: () => refetchTasks(),
  });

  const resumeMutation = useMutation({
    mutationFn: (taskId: string) => api.put(`/tasks/${taskId}/resume`),
    onSuccess: () => refetchTasks(),
  });

  const cancelMutation = useMutation({
    mutationFn: (taskId: string) => api.put(`/tasks/${taskId}/cancel`),
    onSuccess: () => refetchTasks(),
  });

  // ── Helpers ─────────────────────────────────────────

  const getTaskWorkflow = (workflowId: string) => {
    return workflows?.find(w => w.id === workflowId);
  };

  const handleDownloadReport = async (reportId: string, format: 'markdown' = 'markdown') => {
    try {
      const response = await api.get(`/reports/${reportId}/export?format=${format}`, { responseType: 'blob' });
      const blob = response.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${reportId}.${format === 'markdown' ? 'md' : 'pdf'}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      logger.error('Download failed:', error);
    }
  };

  // ── Render ──────────────────────────────────────────

  return (
    <div className="h-full overflow-hidden">
      <div className="p-6 h-full flex gap-6">
        {/* ── Task List Sidebar ── */}
        <div className="w-1/3 h-full flex flex-col">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-text-primary mb-2">任务执行</h1>
            <p className="text-text-secondary">查看和管理任务执行进度</p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 scrollbar-thin">
            {tasks?.map(task => (
              <div
                key={task.id}
                onClick={() => handleSelectTask(task)}
                className={clsx(
                  'p-4 rounded-lg border cursor-pointer transition-all',
                  selectedTask?.id === task.id
                    ? 'bg-primary/10 border-primary'
                    : 'bg-surface border-border hover:border-primary/50'
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-text-primary">{task.name}</h3>
                  <span
                    className={clsx(
                      'px-2 py-1 rounded text-xs font-medium',
                      task.status === 'completed' && 'bg-status-success/10 text-status-success',
                      task.status === 'running' && 'bg-status-running/10 text-status-running',
                      task.status === 'failed' && 'bg-status-failed/10 text-status-failed',
                      task.status === 'paused' && 'bg-status-paused/10 text-status-paused',
                      task.status === 'pending' && 'bg-status-pending/10 text-status-pending',
                      task.status === 'cancelled' && 'bg-status-pending/10 text-status-pending'
                    )}
                  >
                    {task.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-text-secondary">
                  <Clock className="w-3 h-3" />
                  {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Task Detail Panel ── */}
        <div className="flex-1 h-full flex flex-col bg-surface rounded-xl border border-border">
          {selectedTask ? (
            <>
              {/* Header */}
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-text-primary">{selectedTask.name}</h2>
                    <p className="text-sm text-text-secondary">
                      工作流: {getTaskWorkflow(selectedTask.workflow_id)?.name || '未知'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {selectedTask.status === 'running' && (
                      <button
                        onClick={() => pauseMutation.mutate(selectedTask.id)}
                        className="p-2 bg-status-warning/10 text-status-warning rounded-lg hover:bg-status-warning/20"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    )}
                    {selectedTask.status === 'paused' && (
                      <button
                        onClick={() => resumeMutation.mutate(selectedTask.id)}
                        className="p-2 bg-status-success/10 text-status-success rounded-lg hover:bg-status-success/20"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    {(selectedTask.status === 'running' || selectedTask.status === 'paused') && (
                      <button
                        onClick={() => cancelMutation.mutate(selectedTask.id)}
                        className="p-2 bg-status-failed/10 text-status-failed rounded-lg hover:bg-status-failed/20"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Node Flow */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {(() => {
                    const workflow = getTaskWorkflow(selectedTask.workflow_id);
                    const nodes = workflow?.nodes || [];
                    const nodeMap = new Map(nodes.map(node => [String(node.id), node]));
                    const executionOrder = selectedTask.execution_order;

                    let orderedNodes;
                    if (executionOrder && executionOrder.length > 0) {
                      orderedNodes = executionOrder
                        .map(id => nodeMap.get(id))
                        .filter(node => node !== undefined);
                    } else {
                      orderedNodes = nodes;
                    }

                    return orderedNodes.map((node, index) => {
                      const result = selectedTask.node_results?.[node.id as string];
                      const isRunning = executingNodeId === node.id;
                      const status = (result as Record<string, unknown>)?.status || (isRunning ? 'running' : 'pending');

                      return (
                        <div key={String(node.id)} className="flex items-center gap-2">
                          <div
                            className={clsx(
                              'px-4 py-2 rounded-lg border-2 transition-all flex items-center gap-2',
                              status === 'completed' && 'border-status-success bg-status-success/10',
                              status === 'running' && 'border-status-running bg-status-running/10 animate-pulse',
                              status === 'failed' && 'border-status-failed bg-status-failed/10',
                              status === 'pending' && 'border-status-pending'
                            )}
                          >
                            <span className="text-lg">{((node as Record<string, unknown>).data as Record<string, unknown>)?.avatar as string || '🤖'}</span>
                            <span className="text-sm font-medium text-text-primary whitespace-nowrap">
                              {((node as Record<string, unknown>).data as Record<string, unknown>)?.label as string}
                            </span>
                            {status === 'completed' && <CheckCircle className="w-4 h-4 text-status-success" />}
                            {status === 'failed' && <XIcon className="w-4 h-4 text-status-failed" />}
                            {status === 'running' && (
                              <div className="w-4 h-4 border-2 border-status-running border-t-transparent rounded-full animate-spin" />
                            )}
                          </div>
                          {index < orderedNodes.length - 1 && <span className="text-text-secondary">→</span>}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex border-b border-border px-6 pt-4">
                  {([
                    ['logs', List, '执行日志'],
                    ['nodes', FileText, '节点结果'],
                    ['related_reports', FileCheck, '相关报告'],
                  ] as const).map(([tab, Icon, label]) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={clsx(
                        'px-4 py-2 text-sm font-medium border-b-2 transition-all',
                        activeTab === tab
                          ? 'border-primary text-primary'
                          : 'border-transparent text-text-secondary hover:text-text-primary'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {label}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {/* Logs Tab */}
                  {activeTab === 'logs' && (
                    <div className="space-y-2">
                      {taskLogs.length === 0 ? (
                        <div className="text-center py-12 text-text-secondary">
                          <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                          <p>暂无执行日志</p>
                        </div>
                      ) : (
                        taskLogs.map((log, index) => (
                          <div
                            key={index}
                            className={clsx(
                              'p-3 rounded-lg text-sm',
                              log.type === 'thinking' && 'bg-blue-500/5 border-l-4 border-blue-500',
                              log.type === 'output' && 'bg-green-500/5 border-l-4 border-green-500',
                              log.type === 'success' && 'bg-green-500/10 border-l-4 border-green-500',
                              log.type === 'error' && 'bg-red-500/10 border-l-4 border-red-500',
                              log.type === 'info' && 'bg-surface border-l-4 border-primary'
                            )}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-text-secondary">
                                {format(new Date(log.timestamp), 'HH:mm:ss')}
                              </span>
                              {log.type === 'thinking' && <span className="text-xs text-blue-500">分析中</span>}
                              {log.type === 'output' && <span className="text-xs text-green-500">输出</span>}
                            </div>
                            {log.type === 'output' ? (
                              <div className="text-text-primary">
                                <MarkdownOutput content={log.content} />
                              </div>
                            ) : (
                              <p className="text-text-primary whitespace-pre-wrap">{log.content}</p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}

                  {/* Nodes Tab */}
                  {activeTab === 'nodes' && (
                    <div className="space-y-4">
                      {(() => {
                        const workflow = getTaskWorkflow(selectedTask.workflow_id);
                        const nodes = workflow?.nodes || [];
                        const nodeMap = new Map(nodes.map(node => [String(node.id), node]));
                        const executionOrder = selectedTask.execution_order;

                        let orderedNodes;
                        if (executionOrder && executionOrder.length > 0) {
                          orderedNodes = executionOrder
                            .map(id => nodeMap.get(id))
                            .filter(node => node !== undefined);
                        } else {
                          orderedNodes = nodes;
                        }

                        if (orderedNodes.length === 0) {
                          return (
                            <div className="text-center py-12 text-text-secondary">
                              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
                              <p>暂无节点执行结果</p>
                            </div>
                          );
                        }

                        return orderedNodes.map((node, index) => {
                          const result = selectedTask.node_results?.[node.id as string];
                          const isRunning = executingNodeId === node.id;
                          const status = (result as Record<string, unknown>)?.status || (isRunning ? 'running' : 'pending');

                          return (
                            <div
                              key={String(node.id)}
                              className={clsx(
                                'rounded-xl border-2 overflow-hidden transition-all',
                                status === 'completed' && 'border-status-success/30 bg-status-success/5',
                                status === 'running' && 'border-status-running/30 bg-status-running/5 animate-pulse',
                                status === 'failed' && 'border-status-failed/30 bg-status-failed/5',
                                status === 'pending' && 'border-border bg-background/50'
                              )}
                            >
                              <div className="flex items-center justify-between p-4 border-b border-border">
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-surface">
                                    <span className="text-xl">{((node as Record<string, unknown>).data as Record<string, unknown>)?.avatar as string || '🤖'}</span>
                                  </div>
                                  <div>
                                    <h4 className="font-medium text-text-primary flex items-center gap-2">
                                      {((node as Record<string, unknown>).data as Record<string, unknown>)?.label as string || '未知节点'}
                                      {status === 'completed' && <CheckCircle className="w-4 h-4 text-status-success" />}
                                      {status === 'failed' && <XIcon className="w-4 h-4 text-status-failed" />}
                                      {status === 'running' && (
                                        <div className="w-4 h-4 border-2 border-status-running border-t-transparent rounded-full animate-spin" />
                                      )}
                                    </h4>
                                    <p className="text-sm text-text-secondary">
                                      步骤 {index + 1} / {orderedNodes.length}
                                    </p>
                                  </div>
                                </div>
                                <span
                                  className={clsx(
                                    'px-3 py-1 rounded-full text-xs font-medium',
                                    status === 'completed' && 'bg-status-success/10 text-status-success',
                                    status === 'running' && 'bg-status-running/10 text-status-running',
                                    status === 'failed' && 'bg-status-failed/10 text-status-failed',
                                    status === 'pending' && 'bg-status-pending/10 text-status-pending'
                                  )}
                                >
                                  {status === 'completed' && '已完成'}
                                  {status === 'running' && '执行中'}
                                  {status === 'failed' && '失败'}
                                  {status === 'pending' && '等待执行'}
                                </span>
                              </div>

                              {result && (
                                <div className="p-4">
                                  {(result as Record<string, unknown>).output !== null && (
                                    <div className="mb-3">
                                      <h5 className="text-sm font-medium text-text-secondary mb-2">输出结果</h5>
                                      <div className="bg-surface rounded-lg p-3 border border-border">
                                        <MarkdownOutput content={(result as Record<string, unknown>).output as string} />
                                      </div>
                                    </div>
                                  )}
                                  {(result as Record<string, unknown>).error !== null && (
                                    <div>
                                      <h5 className="text-sm font-medium text-status-failed mb-2">错误信息</h5>
                                      <div className="bg-status-failed/5 rounded-lg p-3 border border-status-failed/20">
                                        <p className="text-sm text-status-failed">{(result as Record<string, unknown>).error as string}</p>
                                      </div>
                                    </div>
                                  )}
                                  {(result as Record<string, unknown>).metadata !== null && (
                                    <div className="mt-3 pt-3 border-t border-border">
                                      <p className="text-xs text-text-secondary">
                                        执行时间: {new Date(((result as Record<string, unknown>).metadata as Record<string, unknown>).executionTime as string).toLocaleString()}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}

                  {/* Reports Tab */}
                  {activeTab === 'related_reports' && (
                    <div className="space-y-4">
                      {(() => {
                        let relatedReports: Report[] = [];

                        if (selectedTask.report_id) {
                          const exactReport = reports?.find(report => report.id === selectedTask.report_id);
                          if (exactReport) relatedReports = [exactReport];
                        }

                        if (relatedReports.length === 0) {
                          relatedReports = reports?.filter(report =>
                            report.name?.includes(selectedTask.name) ||
                            report.content?.includes(selectedTask.id) ||
                            report.task_id === selectedTask.id
                          ) || [];
                        }

                        if (relatedReports.length === 0) {
                          return (
                            <div className="text-center py-12 text-text-secondary">
                              <FileCheck className="w-12 h-12 mx-auto mb-3 opacity-50" />
                              <p className="mb-4">暂无相关报告</p>
                            </div>
                          );
                        }

                        return relatedReports.map(report => (
                          <div
                            key={report.id}
                            className="bg-surface border border-border rounded-lg p-4 hover:border-primary/50 transition-all cursor-pointer"
                            onClick={() => setShowReportDetail(report)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <FileCheck className="w-4 h-4 text-primary" />
                                  <h4 className="font-medium text-text-primary">{report.name}</h4>
                                </div>
                                <p className="text-sm text-text-secondary">
                                  创建时间: {new Date(report.created_at).toLocaleString()}
                                </p>
                                <p className="text-xs text-text-secondary mt-1">
                                  {report.format?.toUpperCase() || 'MARKDOWN'} 格式
                                </p>
                              </div>
                              <button
                                onClick={e => { e.stopPropagation(); handleDownloadReport(report.id, 'markdown'); }}
                                className="text-primary hover:text-primary/80 p-2"
                              >
                                <FileText className="w-5 h-5" />
                              </button>
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </>
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

      {/* Report Detail Modal */}
      {showReportDetail && (
        <ReportDetailModal
          report={showReportDetail}
          onClose={() => setShowReportDetail(null)}
          onDownload={handleDownloadReport}
        />
      )}
    </div>
  );
}
