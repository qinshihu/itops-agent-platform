import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import {
  LayoutDashboard,
  Bot,
  Brain,
  GitBranch,
  Play,
  Bell,
  BookOpen,
  FileCode,
  Settings,
  Server,
  Shield,
  FileText,
  MessageSquare,
  Clock,
  Link2,
  Users,
  Search,
  LogOut,
  User as UserIcon,
  Terminal,
  Globe,
  Layers,
  Monitor,
  MonitorPlay,
  Wrench,
  ListChecks,
  BarChart3,
  Network,
  Sun,
  Moon,
  Key,
  Lightbulb,
  Workflow,
  ChevronDown,
  ChevronRight,
  Home,
  ServerCog,
  Zap,
  AlertTriangle,
  Activity,
  ShieldCheck,
  BookMarked,
  Cog,
  FlaskConical,
  Radio,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import ChatWidget from '../ChatWidget';

const navigationGroups = [
  {
    name: '首页',
    icon: Home,
    items: [
      { name: '仪表盘', href: '/dashboard', icon: LayoutDashboard },
      { name: '监控大屏', href: '/big-screen', icon: Monitor },
    ]
  },
  {
    name: '服务器管理',
    icon: ServerCog,
    items: [
      { name: '服务器管理', href: '/servers', icon: Server },
      { name: '网络设备', href: '/network-devices', icon: Network },
      { name: 'SNMP 管理', href: '/snmp', icon: Radio },
      { name: '网络设备发现', href: '/network-discovery', icon: Globe },
      { name: '认证凭证', href: '/ssh-keys', icon: Key },
      { name: 'Web 终端', href: '/terminal', icon: Terminal },
      { name: '远程桌面', href: '/remote-desktop', icon: MonitorPlay },
    ]
  },
  {
    name: '自动化执行',
    icon: Zap,
    items: [
      { name: 'Agent管理', href: '/agents', icon: Bot },
      { name: '工作流', href: '/workflows', icon: GitBranch },
      { name: '任务执行', href: '/tasks', icon: Play },
      { name: '脚本中心', href: '/scripts', icon: FileCode },
      { name: '定时任务', href: '/scheduled-tasks', icon: Clock },
    ]
  },
  {
    name: '告警与AI分析',
    icon: AlertTriangle,
    items: [
      { name: '告警中心', href: '/alerts', icon: Bell },
      { name: '告警自动处理', href: '/alert-mappings', icon: Link2 },
      { name: '告警降噪', href: '/alert-noise', icon: Shield },
      { name: '告警关联', href: '/alert-correlation-groups', icon: Layers },
      { name: '根因分析', href: '/root-cause-analysis', icon: Search },
      { name: 'AI 根因报告', href: '/ai-root-cause', icon: Brain },
      { name: '服务拓扑', href: '/topology', icon: Network },
      { name: 'AI 洞察', href: '/ai-insights', icon: Lightbulb },
      { name: 'AI 自动分析', href: '/alert-auto-analysis', icon: Zap },
      { name: '巡检中心', href: '/inspection-center', icon: Activity },
    ]
  },
  {
    name: '自动修复/自愈',
    icon: ShieldCheck,
    items: [
      { name: '自动修复策略', href: '/remediation-policies', icon: Wrench },
      { name: '修复效果仪表盘', href: '/remediation-dashboard', icon: BarChart3 },
      { name: '修复执行记录', href: '/remediation-executions', icon: ListChecks },
      { name: '自愈工作台', href: '/remediation-workbench', icon: Workflow },
    ]
  },
  {
    name: '知识库与报告',
    icon: BookMarked,
    items: [
      { name: '知识库', href: '/knowledge', icon: BookOpen },
      { name: '审计日志', href: '/audit', icon: Shield },
      { name: '通知系统', href: '/notifications', icon: MessageSquare },
      { name: '报告系统', href: '/reports', icon: FileText },
    ]
  },
  {
    name: '系统与用户',
    icon: Cog,
    items: [
      { name: '用户管理', href: '/users', icon: Users },
      { name: '前端测试中心', href: '/frontend-tests', icon: FlaskConical },
      { name: '设置', href: '/settings', icon: Settings },
    ]
  },
];

export default function Layout() {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set(['首页', '服务器管理', '自动化执行', '告警与AI分析', '自动修复/自愈', '知识库与报告', '系统与用户', '开发与测试'])
  );

  const toggleGroup = (groupName: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupName)) {
      newExpanded.delete(groupName);
    } else {
      newExpanded.add(groupName);
    }
    setExpandedGroups(newExpanded);
  };

  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  // 使用 staleTime 优化查询，5分钟内使用缓存数据，避免频繁重新请求
  const { data: agentCount } = useQuery({
    queryKey: ['agents-count'],
    queryFn: async () => {
      const res = await api.get('/api/agents');
      return (res.data.data as Array<{ enabled: number }>).filter((a) => a.enabled === 1).length;
    },
    refetchInterval: 60000,
    staleTime: 5 * 60 * 1000,
  });

  const { data: workflowCount } = useQuery({
    queryKey: ['workflows-count'],
    queryFn: async () => {
      const res = await api.get('/api/workflows');
      return (res.data.data as Array<{ is_template: number }>).filter((w) => w.is_template === 1).length;
    },
    refetchInterval: 60000,
    staleTime: 5 * 60 * 1000,
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getRoleText = (role: string) => {
    const roleMap: Record<string, string> = {
      'admin': '管理员',
      'operator': '运维员',
      'viewer': '只读用户'
    };
    return roleMap[role] || role;
  };

  return (
    <div className={clsx('flex h-screen', theme === 'dark' ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950' : 'bg-gray-50')}>
      <aside className={clsx('w-56 flex flex-col backdrop-blur-xl shadow-2xl border-r',
        theme === 'dark'
          ? 'bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 border-slate-700/50'
          : 'bg-white/95 border-gray-200'
      )}>
        <div className={clsx('p-4 border-b',
          theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200'
        )}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg shadow-blue-500/30 flex-shrink-0">
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }} />
            </div>
            <div>
              <h1 className={clsx('text-base font-bold tracking-tight',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>ITOps Agent</h1>
              <p className={clsx('text-[11px]',
                theme === 'dark' ? 'text-slate-400' : 'text-gray-500'
              )}>多Agent自动化平台</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-2 overflow-y-auto scrollbar-thin">
          {navigationGroups.map((group) => (
            <div key={group.name} className="space-y-0.5">
              <button
                onClick={() => toggleGroup(group.name)}
                className={clsx(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-200 group',
                  theme === 'dark'
                    ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100/50'
                )}
              >
                <group.icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1 text-left">{group.name}</span>
                {expandedGroups.has(group.name) ? (
                  <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
                )}
              </button>
              
              {expandedGroups.has(group.name) && (
                <div className="pl-2 space-y-0.5">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group',
                          isActive
                            ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25'
                            : theme === 'dark'
                              ? 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                        )
                      }
                    >
                      <item.icon className="w-4 h-4 group-hover:scale-110 transition-transform flex-shrink-0" />
                      {item.name}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className={clsx('border-t',
          theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200'
        )}>
          <div className="p-3">
            {user && (
              <div className="flex items-center gap-2 mb-3">
                <div className={clsx('flex items-center gap-2 p-2 rounded-lg flex-1 min-w-0',
                  theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100'
                )}>
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-blue-400/30 flex-shrink-0">
                    <UserIcon className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={clsx('text-xs font-semibold truncate leading-tight',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {user.username}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate leading-tight">
                      {getRoleText(user.role)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 flex-shrink-0"
                  title="退出登录"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <div className={clsx('flex items-center justify-between rounded-lg px-3 py-2.5',
              theme === 'dark'
                ? 'bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50'
                : 'bg-gray-50 border border-gray-200'
            )}>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 animate-pulse shadow shadow-green-500/30" />
                <div>
                  <span className={clsx('text-xs font-semibold leading-tight',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>系统正常</span>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    {agentCount ?? '...'}个Agent · {workflowCount ?? '...'}个工作流
                  </p>
                </div>
              </div>
              <button
                onClick={toggleTheme}
                className={clsx('p-1.5 rounded-lg transition-all duration-200 flex-shrink-0',
                  theme === 'dark'
                    ? 'text-slate-400 hover:text-amber-300 hover:bg-slate-700/60'
                    : 'text-gray-400 hover:text-purple-600 hover:bg-gray-200'
                )}
                title={theme === 'dark' ? '切换浅色模式' : '切换深色模式'}
              >
                {theme === 'dark' ? (
                  <Sun className="w-3.5 h-3.5" />
                ) : (
                  <Moon className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      <ChatWidget />
    </div>
  );
}
