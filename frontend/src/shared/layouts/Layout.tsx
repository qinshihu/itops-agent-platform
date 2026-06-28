import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
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
  Database,
  Box,
  HardDrive,
  Cpu,
  Building2,
  Image as ImageIcon,
  Container,
  DollarSign,
  TrendingUp,
  LayoutGrid,
  Router,
  Camera,
  Package,
} from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import ChatWidget from '../../modules/ai/components/ChatWidget';
import { navigationGroups } from '../../config/navigation';

export default function Layout() {
  const { t } = useTranslation();
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
    new Set([])
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

  const toggleAllGroups = () => {
    const allNames = navigationGroups.map(g => g.name);
    const allExpanded = allNames.every(n => expandedGroups.has(n));
    if (allExpanded) {
      setExpandedGroups(new Set());
    } else {
      setExpandedGroups(new Set(allNames));
    }
  };

  const allExpanded = navigationGroups.every(g => expandedGroups.has(g.name));

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
      'admin': t('user.admin'),
      'operator': t('user.operator'),
      'viewer': t('user.viewer')
    };
    return roleMap[role] || role;
  };

  return (
    <div className={clsx('flex h-screen', theme === 'dark' ? 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950' : 'bg-gray-50')}>
      <aside className={clsx('w-52 flex flex-col backdrop-blur-xl shadow-2xl border-r',
        theme === 'dark'
          ? 'bg-gradient-to-b from-slate-900/95 via-slate-900/90 to-slate-950/95 border-slate-700/50'
          : 'bg-white/95 border-gray-200'
      )}>
        <div className={clsx('px-3 py-3 border-b',
          theme === 'dark' ? 'border-slate-700/50' : 'border-gray-200'
        )}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-600 shadow-lg shadow-blue-500/30 flex-shrink-0">
              <img src="/logo.jpg" alt="Logo" className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }} />
            </div>
            <div className="min-w-0">
              <h1 className={clsx('text-sm font-bold tracking-tight truncate',
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              )}>ITOps Agent</h1>
              <p className={clsx('text-[10px]',
                theme === 'dark' ? 'text-slate-400' : 'text-text-tertiary'
              )}>{t('app.subtitle')}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto scrollbar-thin">
          {/* 一键折叠/展开 */}
          <button
            onClick={toggleAllGroups}
            className={clsx(
              'w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all duration-200',
              theme === 'dark'
                ? 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                : 'text-text-tertiary hover:text-gray-700 hover:bg-gray-100/50'
            )}
            title={allExpanded ? t('app.collapseAll') : t('app.expandAll')}
          >
            {allExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            {allExpanded ? t('app.collapseAll') : t('app.expandAll')}
          </button>
          {navigationGroups.map((group) => (
            <div key={group.name} className="space-y-0.5">
              <button
                onClick={() => toggleGroup(group.name)}
                className={clsx(
                  'w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] font-semibold transition-all duration-200 group',
                  theme === 'dark'
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    : 'text-text-tertiary hover:text-gray-700 hover:bg-gray-100/50'
                )}
              >
                <group.icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1 text-left">{t(group.name)}</span>
                {expandedGroups.has(group.name) ? (
                  <ChevronDown className="w-3 h-3 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-3 h-3 flex-shrink-0" />
                )}
              </button>
              
              {expandedGroups.has(group.name) && (
                <div className="pl-1 space-y-0.5">
                  {group.items.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-200 group',
                          isActive
                            ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25'
                            : theme === 'dark'
                              ? 'text-slate-400 hover:bg-slate-800/80 hover:text-white'
                              : 'text-text-secondary hover:bg-gray-100 hover:text-gray-900'
                        )
                      }
                    >
                      <item.icon className="w-3.5 h-3.5 group-hover:scale-110 transition-transform flex-shrink-0" />
                      {t(item.name)}
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
          <div className="px-2 py-2">
            {user && (
              <div className="flex items-center gap-1.5 mb-2">
                <div className={clsx('flex items-center gap-1.5 px-2 py-1.5 rounded-lg flex-1 min-w-0',
                  theme === 'dark' ? 'bg-slate-800/50' : 'bg-gray-100'
                )}>
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center border border-blue-400/30 flex-shrink-0">
                    <UserIcon className="w-3 h-3 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={clsx('text-[11px] font-semibold truncate leading-tight',
                      theme === 'dark' ? 'text-white' : 'text-gray-900'
                    )}>
                      {user.username}
                    </p>
                    <p className="text-[9px] text-slate-400 truncate leading-tight">
                      {getRoleText(user.role)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 flex-shrink-0"
                  title={t('app.logout')}
                >
                  <LogOut className="w-3 h-3" />
                </button>
              </div>
            )}

            <div className={clsx('flex items-center justify-between rounded-lg px-2 py-2',
              theme === 'dark'
                ? 'bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50'
                : 'bg-gray-50 border border-gray-200'
            )}>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 animate-pulse shadow shadow-green-500/30" />
                <div>
                  <span className={clsx('text-[11px] font-semibold leading-tight',
                    theme === 'dark' ? 'text-white' : 'text-gray-900'
                  )}>{t('app.systemNormal')}</span>
                  <p className="text-[9px] text-slate-400 leading-tight">
                    {agentCount ?? '...'} Agent · {workflowCount ?? '...'} Workflow
                  </p>
                </div>
              </div>
              <button
                onClick={toggleTheme}
                className={clsx('p-1 rounded-lg transition-all duration-200 flex-shrink-0',
                  theme === 'dark'
                    ? 'text-slate-400 hover:text-amber-300 hover:bg-slate-700/60'
                    : 'text-gray-400 hover:text-purple-600 hover:bg-gray-200'
                )}
                title={theme === 'dark' ? t('app.lightMode') : t('app.darkMode')}
              >
                {theme === 'dark' ? (
                  <Sun className="w-3 h-3" />
                ) : (
                  <Moon className="w-3 h-3" />
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
