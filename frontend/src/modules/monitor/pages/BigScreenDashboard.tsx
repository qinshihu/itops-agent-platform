import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { ComponentType, SVGProps } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Server, Bot, Play, Bell,
  Shield, Network, Cpu, MemoryStick, HardDrive,
  CheckCircle, RefreshCcw, Globe, Terminal, FileCode,
  Maximize2, Minimize2, AlertCircle, ChevronRight,
  Clock, TrendingUp, Target,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../../../lib/api';
import ParticleBackground from '../../../modules/monitor/components/ParticleBackground';
import AnimatedLineChart from '../../../modules/monitor/components/AnimatedLineChart';
import AnimatedBarChart from '../../../modules/monitor/components/AnimatedBarChart';
import CircularProgress from '../../../modules/monitor/components/CircularProgress';

const RETRY_CONFIG = { retry: 3, retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 5000) };

interface Task {
  id: string;
  name: string;
  status: string;
  created_at: string;
  workflow_id?: string;
  execution_order?: string;
  node_results?: string;
  current_node_id?: string;
}

interface TaskWithProgress extends Task {
  progress: number;
  completedNodes: number;
  totalNodes: number;
  executingNode: string;
}

interface Alert {
  id: string;
  title: string;
  severity: string;
  status: string;
  created_at: string;
}

interface ServerType {
  id: string;
  name: string;
  hostname: string;
  enabled: number;
  last_connected?: string;
}

interface DashboardStats {
  servers: { total: number; enabled: number };
  agents: { total: number; enabled: number };
  tasks: {
    total: number;
    running: number;
    completed: number;
    failed: number;
    pending: number;
    successRate: number;
  };
  alerts: {
    total: number;
    active: number;
    critical: number;
    high: number;
  };
  workflows: { total: number; templates: number };
  knowledge: { total: number };
}

interface DataPoint {
  timestamp: number;
  value: number;
}

interface AlertTrendPoint {
  time_bucket: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface TaskTrendPoint {
  time_bucket: string;
  total: number;
  completed: number;
  failed: number;
  running: number;
}

interface AgentStat {
  id: string;
  name: string;
  avatar: string;
  role: string;
  enabled: number;
  usage_count: number;
  total_executions: number;
  success_count: number;
  error_count: number;
  successRate: number | null;
}

function generateFallbackChartData(points: number, baseValue: number, variance: number): DataPoint[] {
  const data: DataPoint[] = [];
  const now = Date.now();
  for (let i = points - 1; i >= 0; i--) {
    data.push({
      timestamp: now - i * 60000,
      value: baseValue + (Math.random() - 0.5) * variance,
    });
  }
  return data;
}

interface StatCardProps {
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
  onClick?: () => void;
}

const StatCard = ({
  icon: Icon,
  label,
  value,
  subValue,
  color,
  onClick,
}: StatCardProps) => (
  <div
    className={`bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 border border-border cursor-pointer transition-all hover:border-slate-600/50 hover:bg-slate-800/60 ${onClick ? '' : ''}`}
    onClick={onClick}
  >
    <div className="flex items-center justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      {onClick && <ChevronRight className="w-4 h-4 text-slate-500" />}
    </div>
    <div className="text-2xl font-bold text-text-primary">{value}</div>
    <div className="text-xs text-text-secondary mt-1">{label}</div>
    {subValue && <div className="text-xs text-slate-500 mt-0.5">{subValue}</div>}
  </div>
);

const SERVER_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444'];
const SERVER_METRICS_RANDOM_VALUES = Array.from({ length: 6 }, () => 30 + Math.random() * 50);

interface SlaStats {
  mttr_minutes: number;
  uptime_percentage: number;
  avg_response_seconds: number;
  alert_resolution_rate: number;
  total_alerts_today: number;
  resolved_today: number;
}

interface ServerMetricsData {
  servers: Array<{
    server_id: string;
    server_name: string;
    cpu_usage: number | null;
    memory_usage: number | null;
    disk_usage: number | null;
    network_in_mbps: number | null;
    network_out_mbps: number | null;
    load_1min: number | null;
    collected_at: string | null;
  }>;
  has_real_data: boolean;
  cpu_history: Array<{ server_id: string; value: number; timestamp: string }>;
  memory_history: Array<{ server_id: string; value: number; timestamp: string }>;
  network_history: Array<{ server_id: string; value: number; timestamp: string }>;
  disk_history: Array<{ server_id: string; value: number; timestamp: string }>;
}

interface RemediationStats {
  total_policies: number;
  enabled_policies: number;
  today: {
    total: number;
    success: number;
    failed: number;
    rolled_back: number;
    success_rate: number;
    avg_duration_ms: number;
  };
  waiting_approval: number;
  recent_executions: Array<{
    id: string;
    status: string;
    status_reason?: string;
    created_at: string;
    policy_name: string;
    execution_mode: string;
    alert_title?: string;
    alert_severity?: string;
  }>;
}

export default function BigScreenDashboard() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [refreshKey, setRefreshKey] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dashboardTitle, setDashboardTitle] = useState(() => {
    const saved = localStorage.getItem('dashboardTitle');
    return saved || 'ITOps 运维监控大屏';
  });
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInputValue, setTitleInputValue] = useState(dashboardTitle);
  
  const prevCriticalCountRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const criticalAlertSoundPlayedRef = useRef(false);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (dashboardTitle !== 'ITOps 运维监控大屏') {
      localStorage.setItem('dashboardTitle', dashboardTitle);
    }
  }, [dashboardTitle]);

  const handleSaveTitle = () => {
    if (titleInputValue.trim()) {
      setDashboardTitle(titleInputValue.trim());
      setIsEditingTitle(false);
    }
  };

  const handleCancelEditTitle = () => {
    setTitleInputValue(dashboardTitle);
    setIsEditingTitle(false);
  };

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [isFullscreen, toggleFullscreen]);

  const refreshData = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const { data: fullDashboard, isError: isStatsError } = useQuery({
    queryKey: ['dashboard-full', refreshKey],
    queryFn: async () => {
      const res = await api.get('/api/dashboard/full');
      return res.data.data as {
        stats: DashboardStats;
        recentTasks: Task[];
        recentAlerts: Alert[];
        servers: ServerType[];
      };
    },
    refetchInterval: 30000,
    ...RETRY_CONFIG,
  });

  const stats = fullDashboard?.stats;
  const servers = fullDashboard?.servers;
  const alerts = fullDashboard?.recentAlerts;

  const criticalAlertCount = useMemo(() => stats?.alerts.critical || 0, [stats?.alerts.critical]);

  const { data: rawTasks } = useQuery({
    queryKey: ['tasks', { limit: 10 }, refreshKey],
    queryFn: async () => {
      const res = await api.get('/api/tasks', { params: { limit: 10 } });
      return res.data.data as Task[];
    },
    refetchInterval: 15000,
    ...RETRY_CONFIG,
  });

  const tasks: TaskWithProgress[] = useMemo(() => {
    if (!rawTasks) return [];
    return rawTasks.map(task => {
      let progress = 0;
      let completedNodes = 0;
      let totalNodes = 0;
      let executingNode = '';

      if (task.status === 'completed') {
        progress = 100;
      } else if (task.status === 'failed') {
        try {
          const results = task.node_results ? JSON.parse(task.node_results) as Record<string, { status: string }> : {};
          const completedCount = Object.values(results).filter(r => r.status === 'completed').length;
          totalNodes = Object.keys(results).length;
          completedNodes = completedCount;
          progress = totalNodes > 0 ? Math.round((completedCount / totalNodes) * 100) : 0;
        } catch {
          progress = 0;
        }
      } else if (task.status === 'running') {
        try {
          const execOrder = task.execution_order ? JSON.parse(task.execution_order) as string[] : [];
          const results = task.node_results ? JSON.parse(task.node_results) as Record<string, { status: string }> : {};
          totalNodes = execOrder.length;
          completedNodes = Object.values(results).filter(r => r.status === 'completed').length;
          executingNode = task.current_node_id || '';
          progress = totalNodes > 0 ? Math.round((completedNodes / totalNodes) * 100) : 0;
        } catch {
          progress = 0;
        }
      }

      return { ...task, progress, completedNodes, totalNodes, executingNode };
    });
  }, [rawTasks]);

  const { data: alertTrends } = useQuery({
    queryKey: ['alert-trends', refreshKey],
    queryFn: async () => {
      const res = await api.get('/api/dashboard/alert-trends');
      return res.data.data as AlertTrendPoint[];
    },
    refetchInterval: 60000,
    ...RETRY_CONFIG,
  });

  const { data: taskTrends } = useQuery({
    queryKey: ['task-trends', refreshKey],
    queryFn: async () => {
      const res = await api.get('/api/dashboard/task-trends');
      return res.data.data as TaskTrendPoint[];
    },
    refetchInterval: 60000,
    ...RETRY_CONFIG,
  });

  const { data: agentStats } = useQuery({
    queryKey: ['agent-stats', refreshKey],
    queryFn: async () => {
      const res = await api.get('/api/dashboard/agent-stats');
      return res.data.data as {
        agents: AgentStat[];
        overall: {
          totalExecutions: number;
          totalSuccess: number;
          overallSuccessRate: number;
          todayExecutions: number;
        };
      };
    },
    refetchInterval: 60000,
    ...RETRY_CONFIG,
  });

  const { data: taskDistribution } = useQuery({
    queryKey: ['task-distribution', refreshKey],
    queryFn: async () => {
      const res = await api.get('/api/dashboard/task-distribution');
      return res.data.data as {
        byStatus: Array<{ status: string; count: number }>;
        byWorkflow: Array<{ name: string; count: number }>;
      };
    },
    refetchInterval: 60000,
    ...RETRY_CONFIG,
  });

  const { data: remediationStats } = useQuery<RemediationStats>({
    queryKey: ['remediation-stats', refreshKey],
    queryFn: async () => {
      const res = await api.get('/api/dashboard/remediation-stats');
      return res.data.data;
    },
    refetchInterval: 30000,
    ...RETRY_CONFIG,
  });

  const { data: serverMetricsData } = useQuery<ServerMetricsData>({
    queryKey: ['server-metrics', refreshKey],
    queryFn: async () => {
      const res = await api.get('/api/dashboard/server-metrics');
      return res.data.data;
    },
    refetchInterval: 30000,
    ...RETRY_CONFIG,
  });

  const { data: slaStats } = useQuery<SlaStats>({
    queryKey: ['sla-stats', refreshKey],
    queryFn: async () => {
      const res = await api.get('/api/dashboard/sla-stats');
      return res.data.data;
    },
    refetchInterval: 60000,
    ...RETRY_CONFIG,
  });

  const playCriticalAlertSound = useCallback(() => {
    try {
      const audioContext = audioContextRef.current || new AudioContext();
      audioContextRef.current = audioContext;

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(660, audioContext.currentTime + 0.15);
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.3);

      gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.error('Failed to play critical alert sound:', error);
    }
  }, []);

  useEffect(() => {
    const newCriticalCount = stats?.alerts.critical || 0;

    if (newCriticalCount > prevCriticalCountRef.current && newCriticalCount > 0 && !criticalAlertSoundPlayedRef.current) {
      playCriticalAlertSound();
      criticalAlertSoundPlayedRef.current = true;
      setTimeout(() => { criticalAlertSoundPlayedRef.current = false; }, 30000);
    }

    prevCriticalCountRef.current = newCriticalCount;
  }, [stats?.alerts.critical, playCriticalAlertSound]);

  const hasCriticalAlerts = (stats?.alerts.critical || 0) > 0;
  const hasHighAlerts = (stats?.alerts.high || 0) > 0;
  const systemHealthStatus = hasCriticalAlerts ? 'critical' : hasHighAlerts ? 'warning' : 'healthy';

  const getStatusFooterText = () => {
    if (systemHealthStatus === 'critical') return '严重告警中';
    if (systemHealthStatus === 'warning') return '存在高等级告警';
    if ((remediationStats?.waiting_approval || 0) > 0) return '有待审批修复';
    return '系统运行正常';
  };

  const getStatusFooterColor = () => {
    if (systemHealthStatus === 'critical') return 'text-red-400';
    if (systemHealthStatus === 'warning') return 'text-yellow-400';
    return 'text-status-success';
  };

  const getSystemStatusIcon = () => {
    if (systemHealthStatus === 'critical') return <AlertCircle className="w-3 h-3 text-status-failed" />;
    if (systemHealthStatus === 'warning') return <AlertCircle className="w-3 h-3 text-status-warning" />;
    return <CheckCircle className="w-3 h-3 text-status-success" />;
  };

  const [cpuData, setCpuData] = useState<DataPoint[]>(() => generateFallbackChartData(30, 45, 30));
  const [memoryData, setMemoryData] = useState<DataPoint[]>(() => generateFallbackChartData(30, 65, 20));
  const [networkData, setNetworkData] = useState<DataPoint[]>(() => generateFallbackChartData(30, 100, 80));
  const [diskIOData, setDiskIOData] = useState<DataPoint[]>(() => generateFallbackChartData(30, 50, 40));

  useEffect(() => {
    if (serverMetricsData?.has_real_data && serverMetricsData.cpu_history.length > 0) {
      const aggregateMetric = (history: Array<{ server_id: string; value: number; timestamp: string }>) => {
        const timeMap = new Map<string, number[]>();
        history.forEach(h => {
          if (!timeMap.has(h.timestamp)) timeMap.set(h.timestamp, []);
          timeMap.get(h.timestamp)!.push(h.value);
        });
        const points: DataPoint[] = [];
        timeMap.forEach((values, ts) => {
          points.push({
            timestamp: new Date(ts).getTime(),
            value: values.reduce((a, b) => a + b, 0) / values.length,
          });
        });
        return points.sort((a, b) => a.timestamp - b.timestamp).slice(-30);
      };

      setCpuData(aggregateMetric(serverMetricsData.cpu_history));
      setMemoryData(aggregateMetric(serverMetricsData.memory_history));
      setNetworkData(aggregateMetric(serverMetricsData.network_history));
      setDiskIOData(aggregateMetric(serverMetricsData.disk_history));
    } else {
      const interval = setInterval(() => {
        const now = Date.now();
        setCpuData(prev => [...prev.slice(-29), { timestamp: now, value: 40 + Math.random() * 35 }]);
        setMemoryData(prev => [...prev.slice(-29), { timestamp: now, value: 60 + Math.random() * 25 }]);
        setNetworkData(prev => [...prev.slice(-29), { timestamp: now, value: 80 + Math.random() * 100 }]);
        setDiskIOData(prev => [...prev.slice(-29), { timestamp: now, value: 40 + Math.random() * 50 }]);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [serverMetricsData]);

  const alertTrendData = (alertTrends || []).map(t => ({
    timestamp: new Date(t.time_bucket).getTime(),
    value: t.total,
  }));

  const taskTrendData = (taskTrends || []).map(t => ({
    timestamp: new Date(t.time_bucket).getTime(),
    value: t.total,
  }));

  const serverMetrics = useMemo(() => {
    if (serverMetricsData?.has_real_data && serverMetricsData.servers.length > 0) {
      return serverMetricsData.servers.slice(0, 6).map((s, i) => ({
        label: s.server_name.substring(0, 8),
        value: s.cpu_usage ?? 0,
        color: SERVER_COLORS[i],
      }));
    }
    if ((servers || []).some(s => s.enabled === 1)) {
      return (servers || [])
        .filter(s => s.enabled === 1)
        .slice(0, 6)
        .map((s, i) => ({
          label: s.name.substring(0, 8),
          value: SERVER_METRICS_RANDOM_VALUES[i],
          color: SERVER_COLORS[i],
        }));
    }
    return [];
  }, [serverMetricsData, servers]);

  const aggregatedMetrics = useMemo(() => {
    if (serverMetricsData?.has_real_data && serverMetricsData.servers.length > 0) {
      const validCpu = serverMetricsData.servers.filter(s => s.cpu_usage !== null);
      const validMem = serverMetricsData.servers.filter(s => s.memory_usage !== null);
      const validNetIn = serverMetricsData.servers.filter(s => s.network_in_mbps !== null);
      const validNetOut = serverMetricsData.servers.filter(s => s.network_out_mbps !== null);
      const validDisk = serverMetricsData.servers.filter(s => s.disk_usage !== null);

      return {
        cpu: validCpu.length > 0 ? validCpu.reduce((sum, s) => sum + (s.cpu_usage ?? 0), 0) / validCpu.length : null,
        memory: validMem.length > 0 ? validMem.reduce((sum, s) => sum + (s.memory_usage ?? 0), 0) / validMem.length : null,
        networkIn: validNetIn.length > 0 ? validNetIn.reduce((sum, s) => sum + (s.network_in_mbps ?? 0), 0) / validNetIn.length : null,
        networkOut: validNetOut.length > 0 ? validNetOut.reduce((sum, s) => sum + (s.network_out_mbps ?? 0), 0) / validNetOut.length : null,
        disk: validDisk.length > 0 ? validDisk.reduce((sum, s) => sum + (s.disk_usage ?? 0), 0) / validDisk.length : null,
      };
    }
    return {
      cpu: cpuData[cpuData.length - 1]?.value ?? 45,
      memory: memoryData[memoryData.length - 1]?.value ?? 65,
      networkIn: (networkData[networkData.length - 1]?.value ?? 100) / 2,
      networkOut: (networkData[networkData.length - 1]?.value ?? 100) / 2,
      disk: diskIOData[diskIOData.length - 1]?.value ?? 50,
    };
  }, [serverMetricsData, cpuData, memoryData, networkData, diskIOData]);

  const taskDistData = (taskDistribution?.byStatus || []).map(s => {
    const colors: Record<string, string> = {
      completed: '#22c55e',
      running: '#3b82f6',
      failed: '#ef4444',
      pending: '#64748b',
    };
    return {
      label: s.status,
      value: s.count,
      color: colors[s.status] || '#64748b',
    };
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-status-success';
      case 'running': return 'text-status-running';
      case 'failed': return 'text-status-failed';
      case 'pending': return 'text-status-pending';
      default: return 'text-text-secondary';
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-status-failed/20 text-status-failed border border-status-failed/30';
      case 'high':
        return 'bg-status-warning/20 text-status-warning border border-status-warning/30';
      default:
        return 'bg-status-pending/20 text-status-pending border border-status-pending/30';
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-950' : 'h-screen'} overflow-y-auto bg-gradient-to-br from-slate-950 via-blue-950/20 to-slate-950 ${criticalAlertCount > 0 ? 'before:content-[""] before:absolute before:inset-0 before:z-5 before:pointer-events-none before:border-4 before:border-red-500/40 before:rounded-lg before:animate-pulse' : ''}`}
    >
      <ParticleBackground />

      <div className="relative z-10 flex flex-col p-4 min-h-screen">
        {criticalAlertCount > 0 && (
          <div className="mb-3 px-4 py-3 bg-gradient-to-r from-red-900/60 via-red-800/60 to-red-900/60 border border-red-500/60 rounded-xl backdrop-blur-md flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6 text-red-300" />
              <div>
                <span className="text-red-100 font-bold text-lg">严重告警</span>
                <span className="text-red-200 ml-2">当前有 <span className="text-red-100 font-bold text-xl">{criticalAlertCount}</span> 个严重级别告警需要处理</span>
              </div>
            </div>
            <button
              onClick={() => navigate('/alerts')}
              className="px-4 py-2 bg-red-500/30 hover:bg-red-500/50 border border-red-400/50 rounded-lg text-red-100 font-medium text-sm flex items-center gap-2 transition-all"
            >
              立即查看 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {isStatsError && (
          <div className="mb-3 px-4 py-3 bg-red-900/40 border border-red-500/50 rounded-xl backdrop-blur-md flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 animate-pulse" />
              <span className="text-red-200 font-medium">后端服务连接异常</span>
              <span className="text-red-300 text-sm">数据可能不是最新的</span>
            </div>
            <button
              onClick={refreshData}
              className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-200 text-sm flex items-center gap-1 transition-all"
            >
              <RefreshCcw className="w-3 h-3" />
              重试
            </button>
          </div>
        )}
        <header className="flex items-center justify-between mb-4 px-2">
          {/* 左上角可编辑大标题 */}
          <div className="flex items-center gap-3">
            {isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={titleInputValue}
                  onChange={(e) => setTitleInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveTitle();
                    if (e.key === 'Escape') handleCancelEditTitle();
                  }}
                  className="px-4 py-2 bg-slate-800/80 backdrop-blur-md border border-blue-500/50 rounded-lg text-white text-2xl font-bold focus:outline-none focus:border-blue-400 w-96"
                  placeholder="请输入大屏标题"
                  autoFocus
                />
                <button
                  onClick={handleSaveTitle}
                  className="px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white transition-all"
                >
                  保存
                </button>
                <button
                  onClick={handleCancelEditTitle}
                  className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-all"
                >
                  取消
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 cursor-pointer group" onClick={() => setIsEditingTitle(true)}>
                <h1 className="text-2xl font-bold text-text-primary tracking-tight group-hover:text-blue-300 transition-colors">
                  {dashboardTitle}
                </h1>
                <svg
                  className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-all"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
            )}
          </div>

          {/* 顶部中间快捷入口 */}
          <div className="flex items-center gap-2">
            {[
              { icon: Globe, label: '官网', color: 'text-blue-400', href: 'https://www.zjzwfw.cloud/' },
              { icon: Terminal, label: '终端', color: 'text-green-400', href: '/terminal' },
              { icon: FileCode, label: '脚本', color: 'text-purple-400', href: '/scripts' },
              { icon: Shield, label: '审计', color: 'text-yellow-400', href: '/audit' },
            ].map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700/30 hover:border-slate-600/50 transition-all cursor-pointer"
                onClick={() => {
                  if (item.href.startsWith('http')) {
                    window.open(item.href, '_blank');
                  } else {
                    navigate(item.href);
                  }
                }}
              >
                <item.icon className={`w-4 h-4 ${item.color}`} />
                <span className="text-xs text-text-primary">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 text-sm">
              <div
                className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 backdrop-blur-sm rounded-lg border border-border cursor-pointer hover:border-blue-500/30 transition-all"
                onClick={() => navigate('/servers')}
              >
                <Server className="w-4 h-4 text-purple-400" />
                <span className="text-text-primary">服务器</span>
                <span className="text-text-primary font-bold">{stats?.servers.enabled || 0}/{stats?.servers.total || 0}</span>
              </div>
              <div
                className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 backdrop-blur-sm rounded-lg border border-border cursor-pointer hover:border-blue-500/30 transition-all"
                onClick={() => navigate('/agents')}
              >
                <Bot className="w-4 h-4 text-blue-400" />
                <span className="text-text-primary">Agent</span>
                <span className="text-text-primary font-bold">{stats?.agents.enabled || 0}/{stats?.agents.total || 0}</span>
              </div>
              <div
                className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 backdrop-blur-sm rounded-lg border border-border cursor-pointer hover:border-blue-500/30 transition-all"
                onClick={() => navigate('/tasks')}
              >
                <Play className="w-4 h-4 text-green-400" />
                <span className="text-text-primary">运行中</span>
                <span className="text-text-primary font-bold">{stats?.tasks.running || 0}</span>
              </div>
              <div
                className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 backdrop-blur-sm rounded-lg border border-border cursor-pointer hover:border-red-500/30 transition-all"
                onClick={() => navigate('/alerts')}
              >
                <Bell className="w-4 h-4 text-red-400" />
                <span className="text-text-primary">活跃告警</span>
                <span className="text-status-failed font-bold">{stats?.alerts.active || 0}</span>
              </div>
            </div>

            <div className="text-right">
              <div className="text-3xl font-bold text-text-primary font-mono">
                {currentTime.toLocaleTimeString('zh-CN', { hour12: false })}
              </div>
              <div className="text-sm text-text-secondary">
                {currentTime.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' })}
              </div>
            </div>

            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-border transition-all"
              title={isFullscreen ? '退出全屏 (Esc)' : '全屏模式 (F11)'}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5 text-text-secondary" /> : <Maximize2 className="w-5 h-5 text-text-secondary" />}
            </button>

            <button
              onClick={refreshData}
              className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-border transition-all"
            >
              <RefreshCcw className="w-5 h-5 text-text-secondary" />
            </button>
          </div>
        </header>

        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-3 flex flex-col gap-4">
            <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-border">
              <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  系统资源监控
                </div>
                {serverMetricsData?.has_real_data ? (
                  <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">实时数据</span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-700/50 text-text-secondary border border-slate-600/30">演示模式</span>
                )}
              </h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <CircularProgress value={aggregatedMetrics.cpu != null && Number.isFinite(aggregatedMetrics.cpu) ? aggregatedMetrics.cpu : 0} color="#3b82f6" size={80} strokeWidth={8} label="CPU" />
                <CircularProgress value={aggregatedMetrics.memory != null && Number.isFinite(aggregatedMetrics.memory) ? aggregatedMetrics.memory : 0} color="#8b5cf6" size={80} strokeWidth={8} label="内存" />
                <CircularProgress value={(aggregatedMetrics.networkIn ?? 0) + (aggregatedMetrics.networkOut ?? 0)} color="#06b6d4" size={80} strokeWidth={8} label="网络" />
                <CircularProgress value={aggregatedMetrics.disk != null && Number.isFinite(aggregatedMetrics.disk) ? aggregatedMetrics.disk : 0} color="#f59e0b" size={80} strokeWidth={8} label="磁盘" />
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">CPU使用率</span>
                    <span className="text-text-primary font-mono">{aggregatedMetrics.cpu?.toFixed(1) ?? '--'}%</span>
                  </div>
                  <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-300"
                      style={{ width: `${aggregatedMetrics.cpu ?? 0}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">内存使用率</span>
                    <span className="text-text-primary font-mono">{aggregatedMetrics.memory?.toFixed(1) ?? '--'}%</span>
                  </div>
                  <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full transition-all duration-300"
                      style={{ width: `${aggregatedMetrics.memory ?? 0}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-text-secondary">磁盘使用率</span>
                    <span className="text-text-primary font-mono">{aggregatedMetrics.disk?.toFixed(1) ?? '--'}%</span>
                  </div>
                  <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-600 to-amber-400 rounded-full transition-all duration-300"
                      style={{ width: `${aggregatedMetrics.disk ?? 0}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-border flex-1">
              <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                服务器负载
              </h2>
              {serverMetrics.length > 0 ? (
                <AnimatedBarChart data={serverMetrics} height={180} />
              ) : (
                <div className="flex items-center justify-center h-[180px] text-slate-500 text-sm">
                  暂无已启用的服务器
                </div>
              )}
            </div>
          </div>

          <div className="col-span-6 flex flex-col gap-4">
            <div className="grid grid-cols-4 gap-4">
              <StatCard
                icon={Server}
                label="服务器"
                value={`${stats?.servers.enabled || 0}/${stats?.servers.total || 0}`}
                subValue="已启用 / 总计"
                color="from-purple-600 to-purple-800"
                onClick={() => navigate('/servers')}
              />
              <StatCard
                icon={Bot}
                label="Agent"
                value={`${stats?.agents.enabled || 0}/${stats?.agents.total || 0}`}
                subValue="在线 / 总计"
                color="from-blue-600 to-blue-800"
                onClick={() => navigate('/agents')}
              />
              <StatCard
                icon={Play}
                label="任务成功率"
                value={`${stats?.tasks.successRate || 0}%`}
                subValue={`成功 ${stats?.tasks.completed || 0} / 总计 ${stats?.tasks.total || 0}`}
                color="from-green-600 to-green-800"
                onClick={() => navigate('/tasks')}
              />
              <StatCard
                icon={Bell}
                label="活跃告警"
                value={stats?.alerts.active || 0}
                subValue={`严重 ${stats?.alerts.critical || 0} / 高 ${stats?.alerts.high || 0}`}
                color="from-red-600 to-red-800"
                onClick={() => navigate('/alerts')}
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs text-text-secondary">MTTR (平均修复时间)</span>
                </div>
                <div className="text-xl font-bold text-text-primary">
                  {slaStats?.mttr_minutes ? `${slaStats.mttr_minutes} min` : '--'}
                </div>
              </div>
              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-text-secondary">系统可用性</span>
                </div>
                <div className="text-xl font-bold text-text-primary">
                  {slaStats?.uptime_percentage ? `${slaStats.uptime_percentage}%` : '--'}
                </div>
              </div>
              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-amber-400" />
                  <span className="text-xs text-text-secondary">告警响应时间</span>
                </div>
                <div className="text-xl font-bold text-text-primary">
                  {slaStats?.avg_response_seconds ? `${slaStats.avg_response_seconds} s` : '--'}
                </div>
              </div>
              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 border border-border">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-text-secondary">今日告警解决率</span>
                </div>
                <div className="text-xl font-bold text-text-primary">
                  {slaStats?.alert_resolution_rate ? `${slaStats.alert_resolution_rate}%` : '--'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50">
                <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-blue-400" />
                  CPU趋势
                </h3>
                <AnimatedLineChart data={cpuData} color="#3b82f6" height={120} />
              </div>
              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50">
                <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                  <MemoryStick className="w-4 h-4 text-purple-400" />
                  内存趋势
                </h3>
                <AnimatedLineChart data={memoryData} color="#8b5cf6" height={120} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50">
                <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                  <Network className="w-4 h-4 text-cyan-400" />
                  网络流量 (Mbps)
                </h3>
                <AnimatedLineChart data={networkData} color="#06b6d4" height={120} />
              </div>
              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50">
                <h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2">
                  <HardDrive className="w-4 h-4 text-yellow-400" />
                  磁盘I/O (MB/s)
                </h3>
                <AnimatedLineChart data={diskIOData} color="#f59e0b" height={120} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 flex flex-col">
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                  告警趋势 (24h)
                </h2>
                <div className="flex-1 min-h-0">
                  {alertTrendData.length > 0 ? (
                    <AnimatedLineChart data={alertTrendData} color="#ef4444" height={160} />
                  ) : (
                    <div className="flex items-center justify-center h-[160px] text-slate-500 text-sm">暂无告警数据</div>
                  )}
                </div>
              </div>

              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 flex flex-col">
                <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                  <Play className="w-5 h-5 text-green-400" />
                  任务趋势 (24h)
                </h2>
                <div className="flex-1 min-h-0">
                  {taskTrendData.length > 0 ? (
                    <AnimatedLineChart data={taskTrendData} color="#22c55e" height={160} />
                  ) : (
                    <div className="flex items-center justify-center h-[160px] text-slate-500 text-sm">暂无任务数据</div>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  最近任务执行
                </h2>
                <span
                  className="text-xs text-slate-400 bg-slate-700/50 px-3 py-1 rounded-full cursor-pointer hover:bg-slate-600/50"
                  onClick={() => navigate('/tasks')}
                >
                  {tasks?.length || 0} 条记录 →
                </span>
              </div>
              <div className="space-y-2 max-h-[180px] overflow-y-auto scrollbar-thin">
                {tasks?.slice(0, 6).map((task) => (
                  <div
                    key={task.id}
                    className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/30 hover:border-blue-500/30 transition-all cursor-pointer"
                    onClick={() => navigate('/tasks')}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          task.status === 'running' ? 'bg-status-running animate-pulse' :
                          task.status === 'completed' ? 'bg-status-success' :
                          task.status === 'failed' ? 'bg-status-failed' : 'bg-status-pending'
                        }`} />
                        <span className="text-sm text-white truncate max-w-[200px]">{task.name}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getStatusColor(task.status)} bg-slate-700/50`}>
                        {task.status}
                      </span>
                    </div>

                    {task.status === 'running' && task.totalNodes > 0 && (
                      <div className="ml-5">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-slate-400">{task.completedNodes}/{task.totalNodes} 节点完成</span>
                          <span className="text-blue-400 font-mono">{task.progress}%</span>
                        </div>
                        <div className="h-1 bg-slate-700/50 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-500"
                            style={{ width: `${task.progress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-end mt-1">
                      <span className="text-xs text-slate-400">
                        {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-3 flex flex-col gap-4">
            <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  实时告警
                </h2>
                <span
                  className="text-xs text-slate-400 bg-slate-700/50 px-2 py-1 rounded-full cursor-pointer hover:bg-slate-600/50"
                  onClick={() => navigate('/alerts')}
                >
                  全部 →
                </span>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-thin">
                {stats ? (
                  alerts?.slice(0, 6).map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-3 bg-slate-900/50 rounded-lg border transition-all cursor-pointer ${
                        alert.severity === 'critical' && hasCriticalAlerts
                          ? 'border-red-500/60 animate-pulse bg-red-900/20'
                          : 'border-slate-700/30 hover:border-red-500/30'
                      }`}
                      onClick={() => navigate('/alerts')}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-sm text-white flex-1 truncate">{alert.title}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ml-2 ${getSeverityBadge(alert.severity)}`}>
                          {alert.severity}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className={`px-2 py-0.5 rounded ${
                          alert.status === 'new' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700/50'
                        }`}>
                          {alert.status}
                        </span>
                        <span>{formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/30 animate-pulse">
                      <div className="flex items-center justify-between mb-2">
                        <div className="h-4 bg-slate-700 rounded w-3/4" />
                        <div className="h-4 bg-slate-700 rounded w-12" />
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="h-3 bg-slate-700 rounded w-16" />
                        <div className="h-3 bg-slate-700 rounded w-20" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  Agent调用统计
                </h2>
                <span
                  className="text-xs text-slate-400 bg-slate-700/50 px-2 py-1 rounded-full cursor-pointer hover:bg-slate-600/50"
                  onClick={() => navigate('/agents')}
                >
                  详情 →
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 rounded-xl p-3 border border-blue-500/30">
                  <div className="text-2xl font-bold text-white">{agentStats?.overall.totalExecutions || 0}</div>
                  <div className="text-xs text-blue-300">总调用次数</div>
                </div>
                <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 rounded-xl p-3 border border-green-500/30">
                  <div className="text-2xl font-bold text-white">{agentStats?.overall.overallSuccessRate || 0}%</div>
                  <div className="text-xs text-green-300">总体成功率</div>
                </div>
                <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 rounded-xl p-3 border border-purple-500/30">
                  <div className="text-2xl font-bold text-white">{agentStats?.overall.todayExecutions || 0}</div>
                  <div className="text-xs text-purple-300">今日调用</div>
                </div>
                <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 rounded-xl p-3 border border-red-500/30">
                  <div className="text-2xl font-bold text-white">{(agentStats?.overall.totalExecutions || 0) - (agentStats?.overall.totalSuccess || 0)}</div>
                  <div className="text-xs text-red-300">失败次数</div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0 space-y-2">
                {agentStats?.agents.slice(0, 6).map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center gap-3 p-2 bg-slate-900/50 rounded-lg border border-slate-700/30"
                  >
                    <span className="text-xl">{agent.avatar}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white truncate">{agent.name}</div>
                      <div className="text-xs text-slate-400">
                        {agent.total_executions}次调用 · 成功率{agent.successRate ?? 'N/A'}%
                      </div>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${agent.enabled ? 'bg-status-success' : 'bg-slate-500'}`} />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50">
              <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                任务状态分布
              </h2>
              {taskDistData.length > 0 ? (
                <AnimatedBarChart data={taskDistData} height={140} />
              ) : (
                <div className="flex items-center justify-center h-[140px] text-slate-500 text-sm">暂无任务数据</div>
              )}
            </div>

            <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  自动修复统计
                </h2>
                <span
                  className="text-xs text-slate-400 bg-slate-700/50 px-2 py-1 rounded-full cursor-pointer hover:bg-slate-600/50"
                  onClick={() => navigate('/remediation-executions')}
                >
                  详情 →
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-800/20 rounded-xl p-3 border border-emerald-500/30">
                  <div className="text-2xl font-bold text-white">{remediationStats?.today.total || 0}</div>
                  <div className="text-xs text-emerald-300">今日执行</div>
                </div>
                <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 rounded-xl p-3 border border-blue-500/30">
                  <div className="text-2xl font-bold text-white">{remediationStats?.today.success_rate || 0}%</div>
                  <div className="text-xs text-blue-300">成功率</div>
                </div>
                <div className="bg-gradient-to-br from-amber-600/20 to-amber-800/20 rounded-xl p-3 border border-amber-500/30">
                  <div className="text-2xl font-bold text-white">{remediationStats?.waiting_approval || 0}</div>
                  <div className="text-xs text-amber-300">待审批</div>
                </div>
                <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 rounded-xl p-3 border border-red-500/30">
                  <div className="text-2xl font-bold text-white">{remediationStats?.today.failed || 0}</div>
                  <div className="text-xs text-red-300">失败/回滚</div>
                </div>
              </div>

              <div className="space-y-2 max-h-[140px] overflow-y-auto scrollbar-thin">
                {remediationStats?.recent_executions?.slice(0, 5).map((exec) => {
                  const statusColorMap: Record<string, string> = {
                    success: 'bg-status-success',
                    failed: 'bg-status-failed',
                    rolled_back: 'bg-yellow-500',
                    waiting_approval: 'bg-blue-500',
                    running: 'bg-status-running',
                  };
                  const statusTextMap: Record<string, string> = {
                    success: '成功',
                    failed: '失败',
                    rolled_back: '回滚',
                    waiting_approval: '待审批',
                    running: '执行中',
                    pending: '待处理',
                    skipped: '已跳过',
                  };
                  return (
                    <div
                      key={exec.id}
                      className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg border border-slate-700/30"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className={`w-2 h-2 rounded-full ${statusColorMap[exec.status] || 'bg-slate-500'} ${exec.status === 'running' ? 'animate-pulse' : ''}`} />
                        <span className="text-xs text-white truncate">{exec.policy_name}</span>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          exec.status === 'success' ? 'bg-green-500/20 text-green-400' :
                          exec.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                          exec.status === 'rolled_back' ? 'bg-yellow-500/20 text-yellow-400' :
                          exec.status === 'waiting_approval' ? 'bg-blue-500/20 text-blue-400' :
                          'bg-slate-700/50 text-slate-400'
                        }`}>
                          {statusTextMap[exec.status] || exec.status}
                        </span>
                        <span className="text-xs text-slate-500">
                          {formatDistanceToNow(new Date(exec.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {(!remediationStats?.recent_executions || remediationStats.recent_executions.length === 0) && (
                  <div className="flex items-center justify-center h-[140px] text-slate-500 text-sm">暂无修复记录</div>
                )}
              </div>
            </div>
          </div>
        </div>

        <footer className="mt-4 px-2 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className={`flex items-center gap-1 ${getStatusFooterColor()}`}>
              {getSystemStatusIcon()}
              {getStatusFooterText()}
            </span>
            <span>数据刷新: 30秒</span>
            <span className={`flex items-center gap-1 ${isStatsError ? 'text-red-400' : 'text-green-400'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isStatsError ? 'bg-red-400' : 'bg-green-400'}`} />
              {isStatsError ? '连接断开' : '连接正常'}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span>ITOps Agent Platform v3.0.1</span>
            <span>© 2026</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
