import { useQuery } from '@tanstack/react-query';
import { Bot, GitBranch, Play, Bell, TrendingUp, TrendingDown, Minus, Clock, Server, BookOpen, Zap, Activity, Shield } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../../lib/api';
import { safeFormatDistance } from '../../../lib/date';

interface Agent {
  id: string;
  name: string;
  avatar: string;
  role: string;
  enabled: number;
}

interface Task {
  id: string;
  name: string;
  status: string;
  created_at: string;
}

interface Alert {
  id: string;
  title: string;
  severity: string;
  status: string;
  created_at: string;
}

interface Server {
  id: string;
  name: string;
  hostname: string;
  enabled: number;
  last_connected?: string;
}

interface Workflow {
  id: string;
  name: string;
  is_template: number;
}

interface Knowledge {
  id: string;
  title: string;
  category: string;
  usage_count: number;
}

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const quickActions = [
    {
      id: 'systemInspection',
      icon: Activity,
      color: 'text-blue-600',
      bg: 'bg-blue-600/10',
      action: () => navigate('/workflows'),
    },
    {
      id: 'executeScript',
      icon: Zap,
      color: 'text-purple-600',
      bg: 'bg-purple-600/10',
      action: () => navigate('/scripts'),
    },
    {
      id: 'securityCheck',
      icon: Shield,
      color: 'text-green-600',
      bg: 'bg-green-600/10',
      action: () => navigate('/workflows'),
    },
    {
      id: 'viewAlerts',
      icon: Bell,
      color: 'text-red-600',
      bg: 'bg-red-600/10',
      action: () => navigate('/alerts'),
    },
  ];

  const { data: agents, isLoading: agentsLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const res = await api.get('/api/agents');
      return res.data.data as Agent[];
    },
    staleTime: 60000,
  });

  const { data: servers, isLoading: serversLoading } = useQuery({
    queryKey: ['servers'],
    queryFn: async () => {
      const res = await api.get('/api/servers');
      return res.data.data as Server[];
    },
    staleTime: 60000,
  });

  const { data: workflows, isLoading: workflowsLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const res = await api.get('/api/workflows');
      return res.data.data as Workflow[];
    },
    staleTime: 120000,
  });

  const { data: knowledge, isLoading: knowledgeLoading } = useQuery({
    queryKey: ['knowledge'],
    queryFn: async () => {
      const res = await api.get('/api/knowledge');
      return res.data.data as Knowledge[];
    },
    staleTime: 120000,
  });

  const { data: tasks, isLoading: tasksLoading } = useQuery({
    queryKey: ['tasks', { limit: 5 }],
    queryFn: async () => {
      const res = await api.get('/api/tasks', { params: { limit: 5 } });
      return res.data.data as Task[];
    },
    staleTime: 30000,
  });

  const { data: alerts, isLoading: alertsLoading } = useQuery({
    queryKey: ['alerts', { limit: 5 }],
    queryFn: async () => {
      const res = await api.get('/api/alerts', { params: { limit: 5 } });
      return res.data.data as Alert[];
    },
    staleTime: 30000,
  });

  const isLoading = agentsLoading || serversLoading || workflowsLoading || knowledgeLoading || tasksLoading || alertsLoading;

  const stats = [
    {
      id: 'servers',
      value: servers?.length || 0,
      icon: Server,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
    {
      id: 'agents',
      value: agents?.length || 0,
      icon: Bot,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      id: 'workflowTemplates',
      value: workflows?.filter((w) => w.is_template === 1).length || 0,
      icon: GitBranch,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
    {
      id: 'runningTasks',
      value: tasks?.filter((t) => t.status === 'running').length || 0,
      icon: Play,
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
    },
    {
      id: 'activeAlerts',
      value: alerts?.filter((a) => a.status === 'new').length || 0,
      icon: Bell,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
    },
    {
      id: 'knowledge',
      value: knowledge?.length || 0,
      icon: BookOpen,
      color: 'text-cyan-500',
      bg: 'bg-cyan-500/10',
    },
  ];

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary mb-2">{t('dashboard.title')}</h1>
            <p className="text-text-secondary">{t('dashboard.subtitle')}</p>
          </div>
          <a
            href="https://www.zjzwfw.cloud/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors font-medium text-sm"
          >
            {t('dashboard.visitWebsite')}
          </a>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-surface rounded-xl p-6 border border-border animate-pulse">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-lg bg-border/50" />
                  <div className="w-8 h-8 rounded bg-border/50" />
                </div>
                <div className="h-8 w-16 bg-border/50 rounded mb-2" />
                <div className="h-4 w-24 bg-border/50 rounded" />
              </div>
            ))}
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
          {/* 左侧：6个统计卡片 */}
          <div className="lg:col-span-4 grid grid-cols-3 gap-3">
            {stats.map((stat) => (
              <div
                key={stat.id}
                className="bg-surface rounded-lg px-3 py-3 border border-border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
                onClick={() => {
                  if (stat.id === 'servers') navigate('/servers');
                  else if (stat.id === 'agents') navigate('/agents');
                  else if (stat.id === 'workflowTemplates') navigate('/workflows');
                  else if (stat.id === 'runningTasks') navigate('/tasks');
                  else if (stat.id === 'activeAlerts') navigate('/alerts');
                  else if (stat.id === 'knowledge') navigate('/knowledge');
                }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={`p-1.5 rounded-md ${stat.bg}`}>
                    <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
                  </div>
                  <span className="text-[11px] text-text-tertiary">{t(`dashboard.${stat.id}`)}</span>
                </div>
                <p className="text-xl font-bold text-text-primary">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* 右侧：最新告警 */}
          <div className="lg:col-span-3 bg-surface rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-red-500" />
                {t('dashboard.latestAlerts')}
              </h2>
              <Link to="/alerts" className="text-xs text-primary hover:underline">
                {t('dashboard.viewAll')} →
              </Link>
            </div>
            <div className="space-y-2">
              {alerts?.slice(0, 6).map((alert) => (
                <div
                  key={alert.id}
                  className="p-2.5 rounded-lg bg-background hover:bg-background/80 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-text-primary text-xs leading-tight truncate">{alert.title}</h3>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
                        alert.severity === 'critical'
                          ? 'bg-status-failed/10 text-status-failed'
                          : alert.severity === 'high'
                          ? 'bg-status-warning/10 text-status-warning'
                          : 'bg-status-pending/10 text-status-pending'
                      }`}
                    >
                      {alert.severity}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-text-secondary mt-1">
                    <Clock className="w-3 h-3" />
                    {safeFormatDistance(alert.created_at)}
                  </div>
                </div>
              ))}
              {!alerts || alerts.length === 0 ? (
                <div className="text-center py-6 text-text-secondary text-xs">{t('dashboard.noAlerts')}</div>
              ) : null}
            </div>
          </div>
        </div>
        )}

        <div className="bg-surface rounded-xl p-5 border border-border">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              {t('dashboard.quickActions')}
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            {quickActions.map((action) => (
              <button
                key={action.id}
                onClick={action.action}
                className="p-3 rounded-xl bg-background hover:bg-background/80 border border-border hover:border-primary/50 transition-all text-left group"
              >
                <div className={`w-10 h-10 rounded-lg ${action.bg} flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
                  <action.icon className={`w-5 h-5 ${action.color}`} />
                </div>
                <h3 className="font-semibold text-text-primary text-sm mb-0.5">{t(`dashboard.${action.id}`)}</h3>
                <p className="text-xs text-text-secondary">{t(`dashboard.${action.id}Desc`)}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-surface rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                <Server className="w-4 h-4 text-purple-500" />
                {t('dashboard.servers')}
              </h2>
              <Link to="/servers" className="text-xs text-primary hover:underline">{t('dashboard.viewAll')}</Link>
            </div>
            <div className="space-y-2">
              {(Array.isArray(servers) ? servers : []).slice(0, 5).map((server) => (
                <div
                  key={server.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-background hover:bg-background/80 transition-all"
                >
                  <div className={`p-1.5 rounded-md ${server.enabled ? 'bg-purple-500/10' : 'bg-status-failed/10'}`}>
                    <Server className={`w-4 h-4 ${server.enabled ? 'text-purple-500' : 'text-text-secondary'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-text-primary text-xs truncate">{server.name}</h3>
                    <p className="text-[10px] text-text-secondary truncate">{server.hostname}</p>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      server.enabled
                        ? 'bg-status-success/10 text-status-success'
                        : 'bg-status-failed/10 text-status-failed'
                    }`}
                  >
                    {server.enabled ? t('dashboard.enabled') : t('dashboard.disabled')}
                  </span>
                </div>
              ))}
              {!servers || servers.length === 0 ? (
                <div className="text-center py-6 text-text-secondary text-xs">{t('dashboard.noServers')}</div>
              ) : null}
            </div>
          </div>
          
          <div className="bg-surface rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                <Bot className="w-4 h-4 text-primary" />
                {t('dashboard.onlineAgents')}
              </h2>
              <Link to="/agents" className="text-xs text-primary hover:underline">{t('dashboard.viewAll')}</Link>
            </div>
            <div className="space-y-2">
              {agents?.slice(0, 5).map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-background hover:bg-background/80 transition-all"
                >
                  <span className="text-lg">{agent.avatar}</span>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-text-primary text-xs">{agent.name}</h3>
                    <p className="text-[10px] text-text-secondary">{agent.role}</p>
                  </div>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                      agent.enabled
                        ? 'bg-status-success/10 text-status-success'
                        : 'bg-status-failed/10 text-status-failed'
                    }`}
                  >
                    {agent.enabled ? t('dashboard.online') : t('dashboard.offline')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-cyan-500" />
                {t('dashboard.knowledge')}
              </h2>
              <Link to="/knowledge" className="text-xs text-primary hover:underline">{t('dashboard.viewAll')}</Link>
            </div>
            <div className="space-y-2">
              {knowledge?.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-2 p-2 rounded-lg bg-background hover:bg-background/80 transition-all"
                >
                  <div className="p-1.5 rounded-md bg-cyan-500/10">
                    <BookOpen className="w-3.5 h-3.5 text-cyan-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-text-primary text-xs truncate">{item.title}</h3>
                    <div className="flex items-center justify-between mt-0.5">
                      <span className="text-[10px] text-text-secondary">{item.category}</span>
                      <span className="text-[10px] text-status-success">{item.usage_count || 0}{t('dashboard.timesUsed')}</span>
                    </div>
                  </div>
                </div>
              ))}
              {!knowledge || knowledge.length === 0 ? (
                <div className="text-center py-6 text-text-secondary text-xs">{t('dashboard.noKnowledge')}</div>
              ) : null}
            </div>
          </div>

          <div className="bg-surface rounded-xl p-4 border border-border lg:col-span-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
                <Play className="w-4 h-4 text-green-500" />
                {t('dashboard.recentTasks')}
              </h2>
              <Link to="/tasks" className="text-xs text-primary hover:underline">{t('dashboard.viewAll')}</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-text-secondary border-b border-border">
                    <th className="pb-2 font-medium">{t('dashboard.taskName')}</th>
                    <th className="pb-2 font-medium">{t('dashboard.status')}</th>
                    <th className="pb-2 font-medium">{t('dashboard.executionTime')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks?.map((task) => (
                    <tr key={task.id} className="border-b border-border/50 hover:bg-background/50">
                      <td className="py-2 text-text-primary text-xs">{task.name}</td>
                      <td className="py-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            task.status === 'completed'
                              ? 'bg-status-success/10 text-status-success'
                              : task.status === 'running'
                              ? 'bg-status-running/10 text-status-running'
                              : task.status === 'failed'
                              ? 'bg-status-failed/10 text-status-failed'
                              : 'bg-status-pending/10 text-status-pending'
                          }`}
                        >
                          {task.status}
                        </span>
                      </td>
                      <td className="py-2 text-xs text-text-secondary">
                        {safeFormatDistance(task.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
