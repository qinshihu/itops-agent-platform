import { useCallback, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { message } from 'antd';
import api from '../../../../lib/api';
import { useAuth } from '../../../../contexts/AuthContext';
import { getAxiosErrorMessage } from '@/lib/errorHandler';
import { logger } from '@/lib/logger';
import { useTaskWebSocket } from '../useTaskWebSocket';
import { parseTaskData, parseTaskLogs } from '../types';
import type {
  TaskDisplay,
  TaskLogEntry,
  WorkflowDisplay,
  Report,
  RetryTaskResult,
} from '../types';

interface UseTasksResult {
  tasks: TaskDisplay[] | undefined;
  reports: Report[] | undefined;
  workflows: WorkflowDisplay[] | undefined;
  selectedTask: TaskDisplay | null;
  setSelectedTask: (task: TaskDisplay | null) => void;
  showReport: Report | null;
  setShowReport: (report: Report | null) => void;
  executingNodeId: string | null;
  taskLogs: TaskLogEntry[];
  retryConfirmTask: TaskDisplay | null;
  setRetryConfirmTask: (task: TaskDisplay | null) => void;
  handleSelectTask: (task: TaskDisplay) => void;
  getTaskWorkflow: (workflowId: string) => WorkflowDisplay | undefined;
  handleDownloadReport: (reportId: string, format?: 'markdown') => Promise<void>;
  pauseMutation: ReturnType<typeof useMutation<void, unknown, string>>;
  resumeMutation: ReturnType<typeof useMutation<void, unknown, string>>;
  cancelMutation: ReturnType<typeof useMutation<void, unknown, string>>;
  retryMutation: ReturnType<typeof useMutation<RetryTaskResult, unknown, string>>;
  refetchTasks: () => void;
}

/**
 * Tasks 页面的数据/状态 Hook（2026-07-21 拆分）
 * 把 653 行的 Tasks.tsx 中的 data fetch / websocket / mutations 全部下沉到这里
 */
export function useTasks(): UseTasksResult {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const taskIdFromQuery = searchParams.get('taskId');

  const [selectedTask, setSelectedTask] = useState<TaskDisplay | null>(null);
  const [showReport, setShowReport] = useState<Report | null>(null);
  const [executingNodeId, setExecutingNodeId] = useState<string | null>(null);
  const [taskLogs, setTaskLogs] = useState<TaskLogEntry[]>([]);
  const [retryConfirmTask, setRetryConfirmTask] = useState<TaskDisplay | null>(null);

  // ── Data Queries ────────────────────────────────────
  const { data: tasks, refetch: refetchTasks } = useQuery({
    queryKey: ['tasks'],
    queryFn: async () => {
      const { data } = await api.get('/tasks');
      const taskData = data as TaskDisplay[];
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
      const { data } = await api.get('/reports');
      return (data || []) as Report[];
    },
  });

  const { data: workflows } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const { data } = await api.get('/workflows');
      return (data || []) as WorkflowDisplay[];
    },
  });

  // ── WebSocket callbacks ─────────────────────────────
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
  const handleSelectTask = useCallback((task: TaskDisplay) => {
    const parsed = parseTaskData(task as unknown as Record<string, unknown>);
    const parsedTask = { ...task, ...parsed } as TaskDisplay;
    parsedTask.logs = parseTaskLogs(task as unknown as Record<string, unknown>);
    setSelectedTask(parsedTask);
    setTaskLogs(parsedTask.logs);
  }, []);

  useEffect(() => {
    if (!taskIdFromQuery || !tasks || selectedTask?.id === taskIdFromQuery) return;
    const task = tasks.find(item => item.id === taskIdFromQuery);
    if (task) handleSelectTask(task);
  }, [taskIdFromQuery, selectedTask?.id, tasks, handleSelectTask]);

  // ── Mutations ───────────────────────────────────────
  const pauseMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await api.put(`/tasks/${taskId}/pause`);
    },
    onSuccess: () => refetchTasks(),
  });

  const resumeMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await api.put(`/tasks/${taskId}/resume`);
    },
    onSuccess: () => refetchTasks(),
  });

  const cancelMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await api.put(`/tasks/${taskId}/cancel`);
    },
    onSuccess: () => refetchTasks(),
  });

  const retryMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { data } = await api.post(`/tasks/${taskId}/retry`);
      return data.data as RetryTaskResult;
    },
    onSuccess: (newTask) => {
      message.success(`重投成功，新任务 ${newTask.taskId.slice(0, 8)} 已开始执行`);
      setRetryConfirmTask(null);
      setSearchParams({ taskId: newTask.taskId });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err: unknown) => {
      message.error(getAxiosErrorMessage(err, '重投失败'));
    },
  });

  // ── Helpers ─────────────────────────────────────────
  const getTaskWorkflow = useCallback(
    (workflowId: string) => workflows?.find(w => w.id === workflowId),
    [workflows],
  );

  const handleDownloadReport = useCallback(async (reportId: string, format: 'markdown' = 'markdown') => {
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
  }, []);

  return {
    tasks,
    reports,
    workflows,
    selectedTask,
    setSelectedTask,
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
    refetchTasks,
  };
}