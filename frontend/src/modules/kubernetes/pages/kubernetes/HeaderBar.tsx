/**
 * Kubernetes 页面标题栏
 *
 * 从原 Kubernetes.tsx 抽离（2026-07-08 增量-13）。
 * 含：图标 + 标题 + 刷新按钮。
 */

import { Container, RefreshCw } from 'lucide-react';

interface HeaderBarProps {
  onRefresh: () => void;
}

export function HeaderBar({ onRefresh }: HeaderBarProps) {
  return (
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div className="flex items-center gap-3">
        <Container size={26} className="text-primary" />
        <h1 className="text-xl font-bold text-text-primary">K8s 资源管理</h1>
      </div>
      <button
        onClick={onRefresh}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary bg-surface hover:bg-border/50 rounded-lg transition-colors border border-border"
      >
        <RefreshCw size={14} /> 刷新
      </button>
    </div>
  );
}

export default HeaderBar;
