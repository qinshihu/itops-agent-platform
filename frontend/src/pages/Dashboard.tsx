import { useQuery } from '@tanstack/react-query';
import { Bot, GitBranch, Play, Bell, TrendingUp, Clock, Server, BookOpen, Zap, Activity, Shield } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';

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
  const navigate = useNavigate();

  const quickActions = [
    {
      name: '系统巡检',
      description: '快速检查服务器状态',
      icon: Activity,
      color: 'text-blue-600',
      bg: 'bg-blue-600/10',
      action: () => navigate('/workflows'),
    },
    {
      name: '执行脚本',
      description: '运行常用运维脚本',
      icon: Zap,
      color: 'text-purple-600',
      bg: 'bg-purple-600/10',
      action: () => navigate('/scripts'),
    },
    {
      name: '安全检查',
      description: '执行安全合规检查',
      icon: Shield,
      color: 'text-green-600',
      bg: 'bg-green-600/10',
      action: () => navigate('/workflows'),
    },
    {
      name: '查看告警',
      description: '查看最新系统告警',
      icon: Bell,
      color: 'text-red-600',
      bg: 'bg-red-600/10',
      action: () => navigate('/alerts'),
    },
  ];

  const { data: agents } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const res = await api.get('/api/agents');
      return res.data.data as Agent[];
    },
  });

  const { data: servers } = useQuery({
    queryKey: ['servers'],
    queryFn: async () => {
      const res = await api.get('/api/servers');
      return res.data.data as Server[];
    },
  });

  const { data: workflows } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      const res = await api.get('/api/workflows');
      return res.data.data as Workflow[];
    },
  });

  const { data: knowledge } = useQuery({
    queryKey: ['knowledge'],
    queryFn: async () => {
      const res = await api.get('/api/knowledge');
      return res.data.data as Knowledge[];
    },
  });

  const { data: tasks } = useQuery({
    queryKey: ['tasks', { limit: 5 }],
    queryFn: async () => {
      const res = await api.get('/api/tasks', { params: { limit: 5 } });
      return res.data.data as Task[];
    },
  });

  const { data: alerts } = useQuery({
    queryKey: ['alerts', { limit: 5 }],
    queryFn: async () => {
      const res = await api.get('/api/alerts', { params: { limit: 5 } });
      return res.data.data as Alert[];
    },
  });

  const stats = [
    {
      name: '服务器',
      value: servers?.length || 0,
      icon: Server,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
    },
    {
      name: 'Agent总数',
      value: agents?.length || 0,
      icon: Bot,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      name: '工作流模板',
      value: workflows?.filter((w) => w.is_template === 1).length || 0,
      icon: GitBranch,
      color: 'text-green-500',
      bg: 'bg-green-500/10',
    },
    {
      name: '运行中任务',
      value: tasks?.filter((t) => t.status === 'running').length || 0,
      icon: Play,
      color: 'text-yellow-500',
      bg: 'bg-yellow-500/10',
    },
    {
      name: '活跃告警',
      value: alerts?.filter((a) => a.status === 'new').length || 0,
      icon: Bell,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
    },
    {
      name: '知识库',
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
            <h1 className="text-2xl font-bold text-text-primary mb-2">仪表盘</h1>
            <p className="text-text-secondary">IT运维多Agent自动化平台概览</p>
          </div>
          <a
            href="https://www.zjzwfw.cloud/"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors font-medium text-sm"
          >
            访问官网
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stats.map((stat) => (
            <div
              key={stat.name}
              className="bg-surface rounded-xl p-6 border border-border hover:border-primary/50 transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${stat.bg}`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
                <TrendingUp className="w-5 h-5 text-status-success" />
              </div>
              <h3 className="text-3xl font-bold text-text-primary mb-1">
                {stat.value}
              </h3>
              <p className="text-sm text-text-secondary">{stat.name}</p>
            </div>
          ))}
        </div>

        <div className="bg-surface rounded-xl p-6 border border-border">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              一键执行
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quickActions.map((action) => (
              <button
                key={action.name}
                onClick={action.action}
                className="p-4 rounded-xl bg-background hover:bg-background/80 border border-border hover:border-primary/50 transition-all text-left group"
              >
                <div className={`w-12 h-12 rounded-lg ${action.bg} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}>
                  <action.icon className={`w-6 h-6 ${action.color}`} />
                </div>
                <h3 className="font-semibold text-text-primary mb-1">{action.name}</h3>
                <p className="text-sm text-text-secondary">{action.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-surface rounded-xl p-6 border border-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Server className="w-5 h-5 text-purple-500" />
                服务器
              </h2>
              <a href="/servers" className="text-sm text-primary hover:underline">
                查看全部
              </a>
            </div>
            <div className="space-y-3">
              {(Array.isArray(servers) ? servers : []).slice(0, 5).map((server) => (
                <div
                  key={server.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-background hover:bg-background/80 transition-all"
                >
                  <div className={`p-2 rounded-lg ${server.enabled ? 'bg-purple-500/10' : 'bg-gray-500/10'}`}>
                    <Server className={`w-5 h-5 ${server.enabled ? 'text-purple-500' : 'text-gray-500'}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-medium text-text-primary">{server.name}</h3>
                    <p className="text-sm text-text-secondary">{server.hostname}</p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      server.enabled
                        ? 'bg-status-success/10 text-status-success'
                        : 'bg-status-failed/10 text-status-failed'
                    }`}
                  >
                    {server.enabled ? '启用' : '禁用'}
                  </span>
                </div>
              ))}
              {!servers || servers.length === 0 ? (
                <div className="text-center py-6 text-text-secondary">
                  暂无服务器，请先添加
                </div>
              ) : null}
            </div>
          </div>
          
          <div className="bg-surface rounded-xl p-6 border border-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                在线Agent
              </h2>
              <a href="/agents" className="text-sm text-primary hover:underline">
                查看全部
              </a>
            </div>
            <div className="space-y-3">
              {agents?.slice(0, 5).map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-background hover:bg-background/80 transition-all"
                >
                  <span className="text-2xl">{agent.avatar}</span>
                  <div className="flex-1">
                    <h3 className="font-medium text-text-primary">{agent.name}</h3>
                    <p className="text-sm text-text-secondary">{agent.role}</p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      agent.enabled
                        ? 'bg-status-success/10 text-status-success'
                        : 'bg-status-failed/10 text-status-failed'
                    }`}
                  >
                    {agent.enabled ? '在线' : '离线'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface rounded-xl p-6 border border-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-cyan-500" />
                知识库
              </h2>
              <a href="/knowledge" className="text-sm text-primary hover:underline">
                查看全部
              </a>
            </div>
            <div className="space-y-3">
              {knowledge?.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-background hover:bg-background/80 transition-all"
                >
                  <div className="p-2 rounded-lg bg-cyan-500/10">
                    <BookOpen className="w-4 h-4 text-cyan-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-text-primary truncate">{item.title}</h3>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-text-secondary">{item.category}</span>
                      <span className="text-xs text-status-success">
                        {item.usage_count || 0} 次使用
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {!knowledge || knowledge.length === 0 ? (
                <div className="text-center py-6 text-text-secondary">
                  暂无知识条目
                </div>
              ) : null}
            </div>
          </div>
          
          <div className="bg-surface rounded-xl p-6 border border-border">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Bell className="w-5 h-5 text-red-500" />
                最新告警
              </h2>
              <a href="/alerts" className="text-sm text-primary hover:underline">
                查看全部
              </a>
            </div>
            <div className="space-y-3">
              {alerts?.slice(0, 5).map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 rounded-lg bg-background hover:bg-background/80 transition-all"
                >
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-medium text-text-primary text-sm">{alert.title}</h3>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
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
                  <div className="flex items-center gap-2 text-xs text-text-secondary">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-surface rounded-xl p-6 border border-border lg:col-span-3">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                <Play className="w-5 h-5 text-green-500" />
                最近任务
              </h2>
              <a href="/tasks" className="text-sm text-primary hover:underline">
                查看全部
              </a>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-text-secondary border-b border-border">
                    <th className="pb-3 font-medium">任务名称</th>
                    <th className="pb-3 font-medium">状态</th>
                    <th className="pb-3 font-medium">执行时间</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks?.map((task) => (
                    <tr key={task.id} className="border-b border-border/50 hover:bg-background/50">
                      <td className="py-3 text-text-primary">{task.name}</td>
                      <td className="py-3">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
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
                      <td className="py-3 text-sm text-text-secondary">
                        {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
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
