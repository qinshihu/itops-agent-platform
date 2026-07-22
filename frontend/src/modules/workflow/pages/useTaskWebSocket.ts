import { useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import type { TaskDisplay, TaskLogEntry } from './types';

const wsUrl = window.location.origin;

interface UseTaskWebSocketOptions {
  token: string | null;
  selectedTask: TaskDisplay | null;
  onRefetchTasks: () => void;
  onNodeStarted: (nodeId: string) => void;
  onTaskLog: (entry: TaskLogEntry) => void;
  onNodeCompleted: (taskId: string, status: string) => void;
}

export function useTaskWebSocket({
  token,
  selectedTask,
  onRefetchTasks,
  onNodeStarted,
  onTaskLog,
  onNodeCompleted,
}: UseTaskWebSocketOptions) {
  const selectedTaskRef = useRef(selectedTask);

  useEffect(() => {
    selectedTaskRef.current = selectedTask;
  }, [selectedTask]);

  useEffect(() => {
    if (!token) return;

    const socket: Socket = io(wsUrl, {
      transports: ['websocket', 'polling'],
      auth: { token },
    });

    const handleTaskStarted = () => {
      onRefetchTasks();
    };

    const handleNodeStarted = (data: unknown) => {
      const nodeData = data as { nodeId: string };
      onNodeStarted(nodeData.nodeId);
    };

    const handleNodeThinking = (data: unknown) => {
      const eventData = data as { taskId: string; content: string };
      if (selectedTaskRef.current?.id === eventData.taskId) {
        onTaskLog({ type: 'thinking', content: eventData.content, timestamp: new Date() });
      }
    };

    const handleNodeOutput = (data: unknown) => {
      const eventData = data as { taskId: string; output: string };
      if (selectedTaskRef.current?.id === eventData.taskId) {
        onTaskLog({ type: 'output', content: eventData.output, timestamp: new Date() });
      }
    };

    const handleNodeCompleted = (data: unknown) => {
      const taskData = data as { taskId: string; status: string };
      onNodeCompleted(taskData.taskId, taskData.status);
    };

    const handleTaskCompleted = () => {
      onRefetchTasks();
    };

    const handleTaskFailed = () => {
      onRefetchTasks();
    };

    socket.on('connect', () => {});
    socket.on('disconnect', () => {});
    socket.on('connect_error', () => {});
    socket.on('task:started', handleTaskStarted);
    socket.on('task:node:started', handleNodeStarted);
    socket.on('task:node:thinking', handleNodeThinking);
    socket.on('task:node:output', handleNodeOutput);
    socket.on('task:node:completed', handleNodeCompleted);
    socket.on('task:completed', handleTaskCompleted);
    socket.on('task:failed', handleTaskFailed);

    if (selectedTask) {
      socket.emit('task:subscribe', selectedTask.id);
    }

    return () => {
      if (selectedTask) {
        socket.emit('task:unsubscribe', selectedTask.id);
      }
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('task:started', handleTaskStarted);
      socket.off('task:node:started', handleNodeStarted);
      socket.off('task:node:thinking', handleNodeThinking);
      socket.off('task:node:output', handleNodeOutput);
      socket.off('task:node:completed', handleNodeCompleted);
      socket.off('task:completed', handleTaskCompleted);
      socket.off('task:failed', handleTaskFailed);
      socket.disconnect();
    };
  }, [selectedTask, token, onRefetchTasks, onNodeStarted, onTaskLog, onNodeCompleted]);
}
