/**
 * SSH/SNMP Tab 切换栏 widget（2026-07-21 拆分）
 *
 * 从原 AddDeviceModal.tsx L326-343 抽出
 *
 * 拆分原则遵循 ADR-031 §二.3 模式 5 + lessons-learned §3.5
 */
import { TAB_ICONS, tabs } from './constants';
import type { TabKey } from './types';

export interface DeviceTabBarProps {
  activeTab: TabKey;
  onChange: (k: TabKey) => void;
  onAfterChange?: () => void;
}

export function DeviceTabBar({ activeTab, onChange, onAfterChange }: DeviceTabBarProps) {
  return (
    <div className="flex gap-1 bg-background rounded-lg p-1 border border-border">
      {tabs.map((tab) => {
        const Icon = TAB_ICONS[tab.key];
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              onChange(tab.key);
              onAfterChange?.();
            }}
            className={`flex flex-1 items-center justify-center gap-2 px-4 py-2 text-sm rounded-md font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-surface text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {Icon && <Icon className="w-4 h-4" />}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
