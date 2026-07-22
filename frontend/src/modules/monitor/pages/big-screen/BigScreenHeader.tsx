/**
 * BigScreenDashboard - 顶部 Header Panel（2026-07-21 拆分）
 *
 * 从原 BigScreenDashboard.tsx L131-285 抽出：
 * - 标题编辑（isEditingTitle / input + 保存/取消）
 * - 快捷入口（Globe / Terminal / FileCode / Shield）
 * - 资源统计条目（服务器 / Agent / 任务 / 告警）
 * - 当前时间 + 全屏 + 刷新
 *
 * 拆分原则遵循 architecture.md §3.4.1 + 第 3 条「向后兼容的 import 路径」
 */
import {
  Server,
  Bot,
  Play,
  Bell,
  Shield,
  Maximize2,
  Minimize2,
  RefreshCcw,
  Globe,
  Terminal,
  FileCode,
} from 'lucide-react';

export interface BigScreenHeaderProps {
  titleEditing: {
    isEditingTitle: boolean;
    titleInputValue: string;
    onTitleInputChange: (v: string) => void;
    onTitleEnter: () => void;
    onTitleEscape: () => void;
    onTitleEditClick: () => void;
    onTitleSave: () => void;
    onTitleCancel: () => void;
  };
  dashboardTitle: string;
  stats:
    | {
        servers: { enabled: number; total: number };
        agents: { enabled: number; total: number };
        tasks: { running: number };
        alerts: { active: number };
      }
    | null
    | undefined;
  currentTime: Date;
  isFullscreen: boolean;
  onNavigate: (path: string) => void;
  onToggleFullscreen: () => void;
  onRefresh: () => void;
}

const QUICK_ENTRIES = [
  { icon: Globe, label: '官网', color: 'text-blue-400', href: 'https://www.zjzwfw.cloud/' },
  { icon: Terminal, label: '终端', color: 'text-green-400', href: '/terminal' },
  { icon: FileCode, label: '脚本', color: 'text-purple-400', href: '/scripts' },
  { icon: Shield, label: '审计', color: 'text-yellow-400', href: '/audit' },
];

export default function BigScreenHeader({
  titleEditing,
  dashboardTitle,
  stats,
  currentTime,
  isFullscreen,
  onNavigate,
  onToggleFullscreen,
  onRefresh,
}: BigScreenHeaderProps) {
  const { isEditingTitle, titleInputValue } = titleEditing;

  const handleClickEntry = (href: string) => () => {
    if (href.startsWith('http')) {
      window.open(href, '_blank');
    } else {
      onNavigate(href);
    }
  };

  return (
    <header className="flex items-center justify-between mb-4 px-2">
      {/* 标题 / 编辑 */}
      <div className="flex items-center gap-3">
        {isEditingTitle ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={titleInputValue}
              onChange={(e) => titleEditing.onTitleInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') titleEditing.onTitleEnter();
                if (e.key === 'Escape') titleEditing.onTitleEscape();
              }}
              className="px-4 py-2 bg-slate-800/80 backdrop-blur-md border border-blue-500/50 rounded-lg text-white text-2xl font-bold focus:outline-none focus:border-blue-400 w-96"
              placeholder="请输入大屏标题"
              autoFocus
            />
            <button
              onClick={titleEditing.onTitleSave}
              className="px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg text-white transition-all"
            >
              保存
            </button>
            <button
              onClick={titleEditing.onTitleCancel}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-all"
            >
              取消
            </button>
          </div>
        ) : (
          <div
            className="flex items-center gap-3 cursor-pointer group"
            onClick={titleEditing.onTitleEditClick}
          >
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

      {/* 快捷入口 */}
      <div className="flex items-center gap-2">
        {QUICK_ENTRIES.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-800/40 border border-slate-700/30 hover:border-slate-600/50 transition-all cursor-pointer"
            onClick={handleClickEntry(item.href)}
          >
            <item.icon className={`w-4 h-4 ${item.color}`} />
            <span className="text-xs text-text-primary">{item.label}</span>
          </div>
        ))}
      </div>

      {/* 资源统计 + 时间 + 全屏 + 刷新 */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-4 text-sm">
          <div
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 backdrop-blur-sm rounded-lg border border-border cursor-pointer hover:border-blue-500/30 transition-all"
            onClick={() => onNavigate('/servers')}
          >
            <Server className="w-4 h-4 text-purple-400" />
            <span className="text-text-primary">服务器</span>
            <span className="text-text-primary font-bold">
              {stats?.servers.enabled ?? 0}/{stats?.servers.total ?? 0}
            </span>
          </div>
          <div
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 backdrop-blur-sm rounded-lg border border-border cursor-pointer hover:border-blue-500/30 transition-all"
            onClick={() => onNavigate('/agents')}
          >
            <Bot className="w-4 h-4 text-blue-400" />
            <span className="text-text-primary">Agent</span>
            <span className="text-text-primary font-bold">
              {stats?.agents.enabled ?? 0}/{stats?.agents.total ?? 0}
            </span>
          </div>
          <div
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 backdrop-blur-sm rounded-lg border border-border cursor-pointer hover:border-blue-500/30 transition-all"
            onClick={() => onNavigate('/tasks')}
          >
            <Play className="w-4 h-4 text-green-400" />
            <span className="text-text-primary">运行中</span>
            <span className="text-text-primary font-bold">{stats?.tasks.running ?? 0}</span>
          </div>
          <div
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 backdrop-blur-sm rounded-lg border border-border cursor-pointer hover:border-red-500/30 transition-all"
            onClick={() => onNavigate('/alerts')}
          >
            <Bell className="w-4 h-4 text-red-400" />
            <span className="text-text-primary">活跃告警</span>
            <span className="text-status-failed font-bold">{stats?.alerts.active ?? 0}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-text-primary font-mono">
            {currentTime.toLocaleTimeString('zh-CN', { hour12: false })}
          </div>
          <div className="text-sm text-text-secondary">
            {currentTime.toLocaleDateString('zh-CN', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              weekday: 'long',
            })}
          </div>
        </div>
        <button
          onClick={onToggleFullscreen}
          className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-border transition-all"
          title={isFullscreen ? '退出全屏 (Esc)' : '全屏模式 (F11)'}
        >
          {isFullscreen ? (
            <Minimize2 className="w-5 h-5 text-text-secondary" />
          ) : (
            <Maximize2 className="w-5 h-5 text-text-secondary" />
          )}
        </button>
        <button
          onClick={onRefresh}
          className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-border transition-all"
        >
          <RefreshCcw className="w-5 h-5 text-text-secondary" />
        </button>
      </div>
    </header>
  );
}
