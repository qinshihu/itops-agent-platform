import { useState, useEffect, useRef, useCallback } from 'react';
import { Select, Button, Switch, Input, Space, message, Tooltip, InputNumber } from 'antd';
import { Play, Square, Search, Download, Trash2, ArrowDown } from 'lucide-react';
import api from '../../../lib/api';
import io, { Socket } from 'socket.io-client';

interface Container {
  id: string;
  name: string;
  status: string;
}

interface LogEntry {
  containerId: string;
  data: string;
  timestamp: string;
}

export default function ContainerLogs() {
  const [containers, setContainers] = useState<Container[]>([]);
  const [selectedContainer, setSelectedContainer] = useState<string>('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showTimestamp, setShowTimestamp] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [tailLines, setTailLines] = useState(500);
  const [loadingContainers, setLoadingContainers] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const roomIdRef = useRef<string>('');

  // Initialize Socket.io
  useEffect(() => {
    const token = localStorage.getItem('token');
    const socket = io('/', { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('container:log:entry', (entry: LogEntry) => {
      setLogs(prev => {
        const updated = [...prev, entry];
        if (updated.length > tailLines) {
          return updated.slice(updated.length - tailLines);
        }
        return updated;
      });
    });

    return () => { socket.disconnect(); };
  }, [tailLines]);

  // Fetch containers list
  const fetchContainers = useCallback(async () => {
    setLoadingContainers(true);
    try {
      const res = await api.get('/api/containers');
      setContainers(res.data.data || []);
    } catch {
      message.error('加载容器列表失败');
    } finally {
      setLoadingContainers(false);
    }
  }, []);

  useEffect(() => { fetchContainers(); }, [fetchContainers]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Start streaming logs
  const startStreaming = () => {
    if (!selectedContainer) {
      message.warning('请先选择容器');
      return;
    }
    const roomId = `container-logs-${selectedContainer}-${Date.now()}`;
    roomIdRef.current = roomId;
    socketRef.current?.emit('container:log:subscribe', {
      containerId: selectedContainer,
      tail: tailLines,
      roomId,
    });
    setIsStreaming(true);
    setLogs([]);
  };

  // Stop streaming logs
  const stopStreaming = () => {
    socketRef.current?.emit('container:log:unsubscribe', {
      roomId: roomIdRef.current,
    });
    setIsStreaming(false);
  };

  // Clear logs
  const clearLogs = () => {
    setLogs([]);
  };

  // Export logs
  const exportLogs = () => {
    if (logs.length === 0) {
      message.warning('没有日志可导出');
      return;
    }
    const content = logs
      .map(entry => {
        if (showTimestamp) {
          return `[${entry.timestamp}] ${entry.data}`;
        }
        return entry.data;
      })
      .join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `container-logs-${selectedContainer}-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    message.success('日志已导出');
  };

  // Filter logs by search term
  const filteredLogs = searchTerm
    ? logs.filter(entry => entry.data.toLowerCase().includes(searchTerm.toLowerCase()))
    : logs;

  // Highlight search matches
  const highlightText = (text: string, term: string) => {
    if (!term) return text;
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-400/60 text-white px-0.5 rounded">{part}</mark>
      ) : (
        part
      )
    );
  };

  const containerOptions = containers
    .filter(c => c.status === 'running')
    .map(c => ({ label: c.name, value: c.id }));

  return (
    <div className="p-6 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">容器日志查看器</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">实时查看容器终端输出日志，支持搜索、过滤与导出</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <Select
          showSearch
          placeholder="选择容器"
          value={selectedContainer || undefined}
          onChange={(val) => setSelectedContainer(val)}
          options={containerOptions}
          loading={loadingContainers}
          style={{ minWidth: 250 }}
          filterOption={(input, option) =>
            (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
          }
          notFoundContent="无运行中的容器"
        />

        <Space.Compact>
          {isStreaming ? (
            <Button danger icon={<Square className="w-3.5 h-3.5" />} onClick={stopStreaming}>
              停止
            </Button>
          ) : (
            <Button type="primary" icon={<Play className="w-3.5 h-3.5" />} onClick={startStreaming}>
              开始
            </Button>
          )}
          <Button icon={<Trash2 className="w-3.5 h-3.5" />} onClick={clearLogs} disabled={logs.length === 0}>
            清除
          </Button>
          <Button icon={<Download className="w-3.5 h-3.5" />} onClick={exportLogs} disabled={logs.length === 0}>
            导出
          </Button>
        </Space.Compact>

        <Input
          placeholder="搜索日志..."
          prefix={<Search className="w-3.5 h-3.5 text-gray-400" />}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ width: 200 }}
          allowClear
        />

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 dark:text-gray-400">时间戳</span>
          <Switch size="small" checked={showTimestamp} onChange={setShowTimestamp} />
        </div>

        <Tooltip title="自动滚动到底部">
          <div className="flex items-center gap-1.5">
            <ArrowDown className="w-3.5 h-3.5 text-gray-400" />
            <Switch size="small" checked={autoScroll} onChange={setAutoScroll} />
          </div>
        </Tooltip>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500 dark:text-gray-400">行数</span>
          <InputNumber
            size="small"
            min={100}
            max={5000}
            step={100}
            value={tailLines}
            onChange={(val) => val && setTailLines(val)}
            style={{ width: 80 }}
          />
        </div>

        <span className="text-xs text-gray-400 ml-auto">
          {filteredLogs.length} 行 {searchTerm ? `(筛选自 ${logs.length} 行)` : ''}
        </span>
      </div>

      {/* Log Panel */}
      <div
        ref={logContainerRef}
        className="flex-1 bg-gray-950 text-green-400 font-mono text-xs p-4 rounded-lg overflow-y-auto border border-gray-700 shadow-inner min-h-0"
        style={{ fontFamily: 'Consolas, "Courier New", monospace', lineHeight: '1.6' }}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500">
            <div className="text-center">
              <p className="text-sm mb-1">{isStreaming ? '等待日志...' : '选择容器并点击"开始"查看日志'}</p>
              <p className="text-xs text-gray-600">容器日志将实时显示在此处</p>
            </div>
          </div>
        ) : (
          filteredLogs.map((entry, idx) => (
            <div key={idx} className="hover:bg-gray-800/50 whitespace-pre-wrap break-all">
              {showTimestamp && (
                <span className="text-cyan-400 mr-2 select-none">[{entry.timestamp}]</span>
              )}
              <span>{highlightText(entry.data, searchTerm)}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
