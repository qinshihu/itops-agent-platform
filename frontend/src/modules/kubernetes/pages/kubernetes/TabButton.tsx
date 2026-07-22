/**
 * Kubernetes Tab 按钮组件
 *
 * 从原 Kubernetes.tsx 内联 TabButton 抽离（2026-07-08 增量-13 P1-9 拆分）。
 */

import clsx from 'clsx';

export type K8sTab = 'pods' | 'deployments' | 'services' | 'nodes';

interface TabButtonProps {
  tab: K8sTab;
  label: string;
  active: K8sTab;
  onClick: (t: K8sTab) => void;
}

export function TabButton({ tab, label, active, onClick }: TabButtonProps) {
  return (
    <button
      onClick={() => onClick(tab)}
      className={clsx(
        'px-4 py-2.5 text-sm font-medium rounded-lg transition-all',
        active === tab
          ? 'bg-primary text-white shadow-lg shadow-primary/20'
          : 'text-text-secondary hover:text-text-primary hover:bg-surface',
      )}
    >
      {label}
    </button>
  );
}

export default TabButton;
