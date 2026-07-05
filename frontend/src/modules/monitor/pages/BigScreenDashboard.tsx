/* eslint-disable @typescript-eslint/no-unused-vars */
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
import {
  generateFallbackChartData,
  SERVER_COLORS,
  SERVER_METRICS_RANDOM_VALUES,
} from './big-screen/types';
import type {
  DataPoint,
  DashboardStats,
  Task,
  TaskWithProgress,
  Alert,
  AlertTrendPoint,
  TaskTrendPoint,
  AgentStat,
  SlaStats,
  ServerMetricsData,
  RemediationStats,
  ServerType,
  StatCardProps,
} from './big-screen/types';
import { useBigScreenData } from './big-screen/useBigScreenData';
/* eslint-enable @typescript-eslint/no-unused-vars */

const _RETRY_CONFIG = { retry: 3, retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 5000) };

const StatCard = ({ icon: Icon, label, value, subValue, color, onClick }: StatCardProps) => (
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

function getStatusColor(status: string) {
  switch (status) {
    case 'completed': return 'text-status-success';
    case 'running': return 'text-status-running';
    case 'failed': return 'text-status-failed';
    case 'pending': return 'text-status-pending';
    default: return 'text-text-secondary';
  }
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case 'critical':
      return 'bg-status-failed/20 text-status-failed border border-status-failed/30';
    case 'high':
      return 'bg-status-warning/20 text-status-warning border border-status-warning/30';
    default:
      return 'bg-status-pending/20 text-status-pending border border-status-pending/30';
  }
}

export default function BigScreenDashboard() {
  const data = useBigScreenData();
  const { navigate } = data;

  const getStatusFooterText = () => {
    if (data.systemHealthStatus === 'critical') return '严重告警中';
    if (data.systemHealthStatus === 'warning') return '存在高等级告警';
    if ((data.remediationStats?.waiting_approval || 0) > 0) return '有待审批修复';
    return '系统运行正常';
  };

  const getStatusFooterColor = () => {
    if (data.systemHealthStatus === 'critical') return 'text-red-400';
    if (data.systemHealthStatus === 'warning') return 'text-yellow-400';
    return 'text-status-success';
  };

  const getSystemStatusIcon = () => {
    if (data.systemHealthStatus === 'critical') return <AlertCircle className="w-3 h-3 text-status-failed" />;
    if (data.systemHealthStatus === 'warning') return <AlertCircle className="w-3 h-3 text-status-warning" />;
    return <CheckCircle className="w-3 h-3 text-status-success" />;
  };

  return (
    <div
      ref={data.containerRef}
      className={`relative ${data.isFullscreen ? 'fixed inset-0 z-50 bg-slate-950' : 'h-screen'} overflow-y-auto bg-gradient-to-br from-slate-950 via-blue-950/20 to-slate-950 ${data.criticalAlertCount > 0 ? 'before:content-[""] before:absolute before:inset-0 before:z-5 before:pointer-events-none before:border-4 before:border-red-500/40 before:rounded-lg before:animate-pulse' : ''}`}
    >
      <ParticleBackground />

      <div className="relative z-10 flex flex-col p-4 min-h-screen">
        {/* Critical Alert Banner */}
        {data.criticalAlertCount > 0 && (
          <div className="mb-3 px-4 py-3 bg-gradient-to-r from-red-900/60 via-red-800/60 to-red-900/60 border border-red-500/60 rounded-xl backdrop-blur-md flex items-center justify-between animate-pulse">
            <div className="flex items-center gap-3">
              <Bell className="w-6 h-6 text-red-300" />
              <div>
                <span className="text-red-100 font-bold text-lg">严重告警</span>
                <span className="text-red-200 ml-2">当前有 <span className="text-red-100 font-bold text-xl">{data.criticalAlertCount}</span> 个严重级别告警需要处理</span>
              </div>
            </div>
            <button onClick={() => navigate('/alerts')} className="px-4 py-2 bg-red-500/30 hover:bg-red-500/50 border border-red-400/50 rounded-lg text-red-100 font-medium text-sm flex items-center gap-2 transition-all">
              立即查看 <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Error Banner */}
        {data.isStatsError && (
          <div className="mb-3 px-4 py-3 bg-red-900/40 border border-red-500/50 rounded-xl backdrop-blur-md flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 animate-pulse" />
              <span className="text-red-200 font-medium">后端服务连接异常</span>
              <span className="text-red-300 text-sm">数据可能不是最新的</span>
            </div>
            <button onClick={data.refreshData} className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-200 text-sm flex items-center gap-1 transition-all">
              <RefreshCcw className="w-3 h-3" /> 重试
            </button>
          </div>
        )}

        {/* Header */}
        <header className="flex items-center justify-between mb-4 px-2">
          <div className="flex items-center gap-3">
            {data.isEditingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  type="text" value={data.titleInputValue}
                  onChange={(e) => data.setTitleInputValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') data.handleSaveTitle(); if (e.key === 'Escape') data.handleCancelEditTitle(); }}
                  className="px-4 py-2 bg-slate-800/80 backdrop-blur-md border border-blue-500/50 rounded-lg text-white text-2xl font-bold focus:outline-none focus:border-blue-400 w-96"
                  placeholder="请输入大屏标题" autoFocus
                />
                <button onClick={data.handleSaveTitle} className="px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white transition-all">保存</button>
                <button onClick={data.handleCancelEditTitle} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-all">取消</button>
              </div>
            ) : (
              <div className="flex items-center gap-3 cursor-pointer group" onClick={() => data.setIsEditingTitle(true)}>
                <h1 className="text-2xl font-bold text-text-primary tracking-tight group-hover:text-blue-300 transition-colors">{data.dashboardTitle}</h1>
                <svg className="w-4 h-4 text-slate-500 opacity-0 group-hover:opacity-100 transition-all" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {[
              { icon: Globe, label: '官网', color: 'text-blue-400', href: 'https://www.zjzwfw.cloud/' },
              { icon: Terminal, label: '终端', color: 'text-green-400', href: '/terminal' },
              { icon: FileCode, label: '脚本', color: 'text-purple-400', href: '/scripts' },
              { icon: Shield, label: '审计', color: 'text-yellow-400', href: '/audit' },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700/30 hover:border-slate-600/50 transition-all cursor-pointer"
                onClick={() => { if (item.href.startsWith('http')) { window.open(item.href, '_blank'); } else { navigate(item.href); } }}>
                <item.icon className={`w-4 h-4 ${item.color}`} />
                <span className="text-xs text-text-primary">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 backdrop-blur-sm rounded-lg border border-border cursor-pointer hover:border-blue-500/30 transition-all" onClick={() => navigate('/servers')}>
                <Server className="w-4 h-4 text-purple-400" /><span className="text-text-primary">服务器</span><span className="text-text-primary font-bold">{data.stats?.servers.enabled || 0}/{data.stats?.servers.total || 0}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 backdrop-blur-sm rounded-lg border border-border cursor-pointer hover:border-blue-500/30 transition-all" onClick={() => navigate('/agents')}>
                <Bot className="w-4 h-4 text-blue-400" /><span className="text-text-primary">Agent</span><span className="text-text-primary font-bold">{data.stats?.agents.enabled || 0}/{data.stats?.agents.total || 0}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 backdrop-blur-sm rounded-lg border border-border cursor-pointer hover:border-blue-500/30 transition-all" onClick={() => navigate('/tasks')}>
                <Play className="w-4 h-4 text-green-400" /><span className="text-text-primary">运行中</span><span className="text-text-primary font-bold">{data.stats?.tasks.running || 0}</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 backdrop-blur-sm rounded-lg border border-border cursor-pointer hover:border-red-500/30 transition-all" onClick={() => navigate('/alerts')}>
                <Bell className="w-4 h-4 text-red-400" /><span className="text-text-primary">活跃告警</span><span className="text-status-failed font-bold">{data.stats?.alerts.active || 0}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-text-primary font-mono">{data.currentTime.toLocaleTimeString('zh-CN', { hour12: false })}</div>
              <div className="text-sm text-text-secondary">{data.currentTime.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' })}</div>
            </div>
            <button onClick={data.toggleFullscreen} className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-border transition-all" title={data.isFullscreen ? '退出全屏 (Esc)' : '全屏模式 (F11)'}>
              {data.isFullscreen ? <Minimize2 className="w-5 h-5 text-text-secondary" /> : <Maximize2 className="w-5 h-5 text-text-secondary" />}
            </button>
            <button onClick={data.refreshData} className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-border transition-all">
              <RefreshCcw className="w-5 h-5 text-text-secondary" />
            </button>
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid grid-cols-12 gap-4">
          {/* Left Column */}
          <div className="col-span-3 flex flex-col gap-4">
            <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-border">
              <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />系统资源监控</div>
                {data.serverMetricsData?.has_real_data ? <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">实时数据</span> : <span className="text-xs px-2 py-0.5 rounded bg-slate-700/50 text-text-secondary border border-slate-600/30">演示模式</span>}
              </h2>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <CircularProgress value={data.aggregatedMetrics.cpu !== null && data.aggregatedMetrics.cpu !== undefined && Number.isFinite(data.aggregatedMetrics.cpu) ? data.aggregatedMetrics.cpu : 0} color="#3b82f6" size={80} strokeWidth={8} label="CPU" />
                <CircularProgress value={data.aggregatedMetrics.memory !== null && data.aggregatedMetrics.memory !== undefined && Number.isFinite(data.aggregatedMetrics.memory) ? data.aggregatedMetrics.memory : 0} color="#8b5cf6" size={80} strokeWidth={8} label="内存" />
                <CircularProgress value={(data.aggregatedMetrics.networkIn ?? 0) + (data.aggregatedMetrics.networkOut ?? 0)} color="#06b6d4" size={80} strokeWidth={8} label="网络" />
                <CircularProgress value={data.aggregatedMetrics.disk !== null && data.aggregatedMetrics.disk !== undefined && Number.isFinite(data.aggregatedMetrics.disk) ? data.aggregatedMetrics.disk : 0} color="#f59e0b" size={80} strokeWidth={8} label="磁盘" />
              </div>
              <div className="space-y-3">
                {[
                  { label: 'CPU使用率', value: data.aggregatedMetrics.cpu, color: 'from-blue-600 to-blue-400' },
                  { label: '内存使用率', value: data.aggregatedMetrics.memory, color: 'from-purple-600 to-purple-400' },
                  { label: '磁盘使用率', value: data.aggregatedMetrics.disk, color: 'from-amber-600 to-amber-400' },
                ].map((m) => (
                  <div className="space-y-2" key={m.label}>
                    <div className="flex items-center justify-between text-sm"><span className="text-text-secondary">{m.label}</span><span className="text-text-primary font-mono">{m.value?.toFixed(1) ?? '--'}%</span></div>
                    <div className="h-3 bg-slate-700/50 rounded-full overflow-hidden"><div className={`h-full bg-gradient-to-r ${m.color} rounded-full transition-all duration-300`} style={{ width: `${m.value ?? 0}%` }} /></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-border flex-1">
              <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />服务器负载</h2>
              {data.serverMetrics.length > 0 ? <AnimatedBarChart data={data.serverMetrics} height={180} /> : <div className="flex items-center justify-center h-[180px] text-slate-500 text-sm">暂无已启用的服务器</div>}
            </div>
          </div>

          {/* Center Column */}
          <div className="col-span-6 flex flex-col gap-4">
            <div className="grid grid-cols-4 gap-4">
              <StatCard icon={Server} label="服务器" value={`${data.stats?.servers.enabled || 0}/${data.stats?.servers.total || 0}`} subValue="已启用 / 总计" color="from-purple-600 to-purple-800" onClick={() => navigate('/servers')} />
              <StatCard icon={Bot} label="Agent" value={`${data.stats?.agents.enabled || 0}/${data.stats?.agents.total || 0}`} subValue="在线 / 总计" color="from-blue-600 to-blue-800" onClick={() => navigate('/agents')} />
              <StatCard icon={Play} label="任务成功率" value={`${data.stats?.tasks.successRate || 0}%`} subValue={`成功 ${data.stats?.tasks.completed || 0} / 总计 ${data.stats?.tasks.total || 0}`} color="from-green-600 to-green-800" onClick={() => navigate('/tasks')} />
              <StatCard icon={Bell} label="活跃告警" value={data.stats?.alerts.active || 0} subValue={`严重 ${data.stats?.alerts.critical || 0} / 高 ${data.stats?.alerts.high || 0}`} color="from-red-600 to-red-800" onClick={() => navigate('/alerts')} />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 border border-border"><div className="flex items-center gap-2 mb-2"><Clock className="w-4 h-4 text-cyan-400" /><span className="text-xs text-text-secondary">MTTR (平均修复时间)</span></div><div className="text-xl font-bold text-text-primary">{data.slaStats?.mttr_minutes ? `${data.slaStats.mttr_minutes} min` : '--'}</div></div>
              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 border border-border"><div className="flex items-center gap-2 mb-2"><TrendingUp className="w-4 h-4 text-green-400" /><span className="text-xs text-text-secondary">系统可用性</span></div><div className="text-xl font-bold text-text-primary">{data.slaStats?.uptime_percentage ? `${data.slaStats.uptime_percentage}%` : '--'}</div></div>
              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 border border-border"><div className="flex items-center gap-2 mb-2"><Target className="w-4 h-4 text-amber-400" /><span className="text-xs text-text-secondary">告警响应时间</span></div><div className="text-xl font-bold text-text-primary">{data.slaStats?.avg_response_seconds ? `${data.slaStats.avg_response_seconds} s` : '--'}</div></div>
              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-4 border border-border"><div className="flex items-center gap-2 mb-2"><CheckCircle className="w-4 h-4 text-emerald-400" /><span className="text-xs text-text-secondary">今日告警解决率</span></div><div className="text-xl font-bold text-text-primary">{data.slaStats?.alert_resolution_rate ? `${data.slaStats.alert_resolution_rate}%` : '--'}</div></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50"><h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2"><Cpu className="w-4 h-4 text-blue-400" />CPU趋势</h3><AnimatedLineChart data={data.cpuData} color="#3b82f6" height={120} /></div>
              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50"><h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2"><MemoryStick className="w-4 h-4 text-purple-400" />内存趋势</h3><AnimatedLineChart data={data.memoryData} color="#8b5cf6" height={120} /></div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50"><h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2"><Network className="w-4 h-4 text-cyan-400" />网络流量 (Mbps)</h3><AnimatedLineChart data={data.networkData} color="#06b6d4" height={120} /></div>
              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50"><h3 className="text-sm font-semibold text-slate-400 mb-3 flex items-center gap-2"><HardDrive className="w-4 h-4 text-yellow-400" />磁盘I/O (MB/s)</h3><AnimatedLineChart data={data.diskIOData} color="#f59e0b" height={120} /></div>
            </div>

            <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 flex flex-col"><h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2"><AlertCircle className="w-5 h-5 text-red-400" />告警趋势 (24h)</h2><div className="flex-1 min-h-0">{data.alertTrendData.length > 0 ? <AnimatedLineChart data={data.alertTrendData} color="#ef4444" height={160} /> : <div className="flex items-center justify-center h-[160px] text-slate-500 text-sm">暂无告警数据</div>}</div></div>
              <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 flex flex-col"><h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2"><Play className="w-5 h-5 text-green-400" />任务趋势 (24h)</h2><div className="flex-1 min-h-0">{data.taskTrendData.length > 0 ? <AnimatedLineChart data={data.taskTrendData} color="#22c55e" height={160} /> : <div className="flex items-center justify-center h-[160px] text-slate-500 text-sm">暂无任务数据</div>}</div></div>
            </div>

            <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50">
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-semibold text-white flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />最近任务执行</h2><span className="text-xs text-slate-400 bg-slate-700/50 px-3 py-1 rounded-full cursor-pointer hover:bg-slate-600/50" onClick={() => navigate('/tasks')}>{data.tasks?.length || 0} 条记录 →</span></div>
              <div className="space-y-2 max-h-[180px] overflow-y-auto scrollbar-thin">
                {data.tasks?.slice(0, 6).map((task) => (
                  <div key={task.id} className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/30 hover:border-blue-500/30 transition-all cursor-pointer" onClick={() => navigate('/tasks')}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${task.status === 'running' ? 'bg-status-running animate-pulse' : task.status === 'completed' ? 'bg-status-success' : task.status === 'failed' ? 'bg-status-failed' : 'bg-status-pending'}`} />
                        <span className="text-sm text-white truncate max-w-[200px]">{task.name}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getStatusColor(task.status)} bg-slate-700/50`}>{task.status}</span>
                    </div>
                    {task.status === 'running' && task.totalNodes > 0 && (
                      <div className="ml-5"><div className="flex items-center justify-between text-xs mb-1"><span className="text-slate-400">{task.completedNodes}/{task.totalNodes} 节点完成</span><span className="text-blue-400 font-mono">{task.progress}%</span></div><div className="h-1 bg-slate-700/50 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-500" style={{ width: `${task.progress}%` }} /></div></div>
                    )}
                    <div className="flex items-center justify-end mt-1"><span className="text-xs text-slate-400">{formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}</span></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="col-span-3 flex flex-col gap-4">
            <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50">
              <div className="flex items-center justify-between mb-3"><h2 className="text-lg font-semibold text-white flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />实时告警</h2><span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-1 rounded-full cursor-pointer hover:bg-slate-600/50" onClick={() => navigate('/alerts')}>全部 →</span></div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto scrollbar-thin">
                {data.stats ? data.alerts?.slice(0, 6).map((alert) => (
                  <div key={alert.id} className={`p-3 bg-slate-900/50 rounded-lg border transition-all cursor-pointer ${alert.severity === 'critical' && data.hasCriticalAlerts ? 'border-red-500/60 animate-pulse bg-red-900/20' : 'border-slate-700/30 hover:border-red-500/30'}`} onClick={() => navigate('/alerts')}>
                    <div className="flex items-start justify-between mb-2"><span className="text-sm text-white flex-1 truncate">{alert.title}</span><span className={`px-2 py-0.5 rounded text-xs font-medium ml-2 ${getSeverityBadge(alert.severity)}`}>{alert.severity}</span></div>
                    <div className="flex items-center justify-between text-xs text-slate-400"><span className={`px-2 py-0.5 rounded ${alert.status === 'new' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700/50'}`}>{alert.status}</span><span>{formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}</span></div>
                  </div>
                )) : Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-3 bg-slate-900/50 rounded-lg border border-slate-700/30 animate-pulse"><div className="flex items-center justify-between mb-2"><div className="h-4 bg-slate-700 rounded w-3/4" /><div className="h-4 bg-slate-700 rounded w-12" /></div><div className="flex items-center justify-between"><div className="h-3 bg-slate-700 rounded w-16" /><div className="h-3 bg-slate-700 rounded w-20" /></div></div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50 flex flex-col">
              <div className="flex items-center justify-between mb-3"><h2 className="text-lg font-semibold text-white flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />Agent调用统计</h2><span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-1 rounded-full cursor-pointer hover:bg-slate-600/50" onClick={() => navigate('/agents')}>详情 →</span></div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 rounded-xl p-3 border border-blue-500/30"><div className="text-2xl font-bold text-white">{data.agentStats?.overall.totalExecutions || 0}</div><div className="text-xs text-blue-300">总调用次数</div></div>
                <div className="bg-gradient-to-br from-green-600/20 to-green-800/20 rounded-xl p-3 border border-green-500/30"><div className="text-2xl font-bold text-white">{data.agentStats?.overall.overallSuccessRate || 0}%</div><div className="text-xs text-green-300">总体成功率</div></div>
                <div className="bg-gradient-to-br from-purple-600/20 to-purple-800/20 rounded-xl p-3 border border-purple-500/30"><div className="text-2xl font-bold text-white">{data.agentStats?.overall.todayExecutions || 0}</div><div className="text-xs text-purple-300">今日调用</div></div>
                <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 rounded-xl p-3 border border-red-500/30"><div className="text-2xl font-bold text-white">{(data.agentStats?.overall.totalExecutions || 0) - (data.agentStats?.overall.totalSuccess || 0)}</div><div className="text-xs text-red-300">失败次数</div></div>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin min-h-0 space-y-2">
                {data.agentStats?.agents.slice(0, 6).map((agent) => (
                  <div key={agent.id} className="flex items-center gap-3 p-2 bg-slate-900/50 rounded-lg border border-slate-700/30"><span className="text-xl">{agent.avatar}</span><div className="flex-1 min-w-0"><div className="text-sm text-white truncate">{agent.name}</div><div className="text-xs text-slate-400">{agent.total_executions}次调用 · 成功率{agent.successRate ?? 'N/A'}%</div></div><div className={`w-2 h-2 rounded-full ${agent.enabled ? 'bg-status-success' : 'bg-slate-500'}`} /></div>
                ))}
              </div>
            </div>

            <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50"><h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />任务状态分布</h2>{data.taskDistData.length > 0 ? <AnimatedBarChart data={data.taskDistData} height={140} /> : <div className="flex items-center justify-center h-[140px] text-slate-500 text-sm">暂无任务数据</div>}</div>

            <div className="bg-slate-800/40 backdrop-blur-md rounded-2xl p-5 border border-slate-700/50">
              <div className="flex items-center justify-between mb-3"><h2 className="text-lg font-semibold text-white flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />自动修复统计</h2><span className="text-xs text-slate-400 bg-slate-700/50 px-2 py-1 rounded-full cursor-pointer hover:bg-slate-600/50" onClick={() => navigate('/remediation-executions')}>详情 →</span></div>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-gradient-to-br from-emerald-600/20 to-emerald-800/20 rounded-xl p-3 border border-emerald-500/30"><div className="text-2xl font-bold text-white">{data.remediationStats?.today.total || 0}</div><div className="text-xs text-emerald-300">今日执行</div></div>
                <div className="bg-gradient-to-br from-blue-600/20 to-blue-800/20 rounded-xl p-3 border border-blue-500/30"><div className="text-2xl font-bold text-white">{data.remediationStats?.today.success_rate || 0}%</div><div className="text-xs text-blue-300">成功率</div></div>
                <div className="bg-gradient-to-br from-amber-600/20 to-amber-800/20 rounded-xl p-3 border border-amber-500/30"><div className="text-2xl font-bold text-white">{data.remediationStats?.waiting_approval || 0}</div><div className="text-xs text-amber-300">待审批</div></div>
                <div className="bg-gradient-to-br from-red-600/20 to-red-800/20 rounded-xl p-3 border border-red-500/30"><div className="text-2xl font-bold text-white">{data.remediationStats?.today.failed || 0}</div><div className="text-xs text-red-300">失败/回滚</div></div>
              </div>
              <div className="space-y-2 max-h-[140px] overflow-y-auto scrollbar-thin">
                {data.remediationStats?.recent_executions?.slice(0, 5).map((exec) => {
                  const statusColorMap: Record<string, string> = { success: 'bg-status-success', failed: 'bg-status-failed', rolled_back: 'bg-yellow-500', waiting_approval: 'bg-blue-500', running: 'bg-status-running' };
                  const statusTextMap: Record<string, string> = { success: '成功', failed: '失败', rolled_back: '回滚', waiting_approval: '待审批', running: '执行中', pending: '待处理', skipped: '已跳过' };
                  return (
                    <div key={exec.id} className="flex items-center justify-between p-2 bg-slate-900/50 rounded-lg border border-slate-700/30">
                      <div className="flex items-center gap-2 min-w-0 flex-1"><div className={`w-2 h-2 rounded-full ${statusColorMap[exec.status] || 'bg-slate-500'} ${exec.status === 'running' ? 'animate-pulse' : ''}`} /><span className="text-xs text-white truncate">{exec.policy_name}</span></div>
                      <div className="flex items-center gap-2 ml-2"><span className={`text-xs px-1.5 py-0.5 rounded ${exec.status === 'success' ? 'bg-green-500/20 text-green-400' : exec.status === 'failed' ? 'bg-red-500/20 text-red-400' : exec.status === 'rolled_back' ? 'bg-yellow-500/20 text-yellow-400' : exec.status === 'waiting_approval' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-700/50 text-slate-400'}`}>{statusTextMap[exec.status] || exec.status}</span><span className="text-xs text-slate-500">{formatDistanceToNow(new Date(exec.created_at), { addSuffix: true })}</span></div>
                    </div>
                  );
                })}
                {(!data.remediationStats?.recent_executions || data.remediationStats.recent_executions.length === 0) && <div className="flex items-center justify-center h-[140px] text-slate-500 text-sm">暂无修复记录</div>}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-4 px-2 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <span className={`flex items-center gap-1 ${getStatusFooterColor()}`}>{getSystemStatusIcon()}{getStatusFooterText()}</span>
            <span>数据刷新: 30秒</span>
            <span className={`flex items-center gap-1 ${data.isStatsError ? 'text-red-400' : 'text-green-400'}`}><span className={`w-1.5 h-1.5 rounded-full ${data.isStatsError ? 'bg-red-400' : 'bg-green-400'}`} />{data.isStatsError ? '连接断开' : '连接正常'}</span>
          </div>
          <div className="flex items-center gap-4"><span>ITOps Agent Platform v3.0.1</span><span>© 2026</span></div>
        </footer>
      </div>
    </div>
  );
}