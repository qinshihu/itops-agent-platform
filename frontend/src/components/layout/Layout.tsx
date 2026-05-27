import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../lib/api';
import {
  LayoutDashboard,
  Bot,
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
  Monitor,
  Wrench,
  ListChecks,
  BarChart3,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import ChatWidget from '../ChatWidget';

const navigation = [
  { name: '仪表盘', href: '/dashboard', icon: LayoutDashboard },
  { name: '监控大屏', href: '/big-screen', icon: Monitor },
  { name: '服务器管理', href: '/servers', icon: Server },
  { name: 'Web 终端', href: '/terminal', icon: Terminal },
  { name: 'Agent管理', href: '/agents', icon: Bot },
  { name: '工作流', href: '/workflows', icon: GitBranch },
  { name: '任务执行', href: '/tasks', icon: Play },
  { name: '告警中心', href: '/alerts', icon: Bell },
  { name: '告警自动处理', href: '/alert-mappings', icon: Link2 },
  { name: '告警降噪', href: '/alert-noise', icon: Shield },
  { name: '自动修复策略', href: '/remediation-policies', icon: Wrench },
  { name: '修复效果仪表盘', href: '/remediation-dashboard', icon: BarChart3 },
  { name: '修复执行记录', href: '/remediation-executions', icon: ListChecks },
  { name: '根因分析', href: '/root-cause-analysis', icon: Search },
  { name: '知识库', href: '/knowledge', icon: BookOpen },
  { name: '脚本中心', href: '/scripts', icon: FileCode },
  { name: '定时任务', href: '/scheduled-tasks', icon: Clock },
  { name: '审计日志', href: '/audit', icon: Shield },
  { name: '通知系统', href: '/notifications', icon: MessageSquare },
  { name: '报告系统', href: '/reports', icon: FileText },
  { name: '用户管理', href: '/users', icon: Users },
  { name: '设置', href: '/settings', icon: Settings },
];

export default function Layout() {
  const { user, logout } = useAuth();
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
    <div className="flex h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <aside className="w-56 bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 border-r border-slate-700/50 flex flex-col backdrop-blur-xl shadow-2xl">
        <div className="p-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg shadow-blue-500/30 flex-shrink-0">
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight">ITOps Agent</h1>
              <p className="text-[11px] text-slate-400">多Agent自动化平台</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto scrollbar-thin">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group',
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                )
              }
            >
              <item.icon className="w-4 h-4 group-hover:scale-110 transition-transform flex-shrink-0" />
              {item.name}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-700/50">
          {user && (
            <div className="p-3 border-b border-slate-700/30">
              <div className="flex items-center gap-2.5 p-2.5 bg-slate-800/50 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-blue-400/30 flex-shrink-0">
                  <UserIcon className="w-4 h-4 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {user.username}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">
                    {getRoleText(user.role)}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="p-3">
            <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-lg p-3 mb-2 border border-slate-700/50">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-2 h-2 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 animate-pulse shadow-lg shadow-green-500/30" />
                <span className="text-xs font-semibold text-white">系统正常</span>
              </div>
              <p className="text-[10px] text-slate-400">
                {agentCount ?? '...'}个Agent · {workflowCount ?? '...'}个工作流
              </p>
            </div>

            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium text-slate-400 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200 border border-transparent hover:border-red-500/30"
            >
              <LogOut className="w-3.5 h-3.5" />
              退出登录
            </button>
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
