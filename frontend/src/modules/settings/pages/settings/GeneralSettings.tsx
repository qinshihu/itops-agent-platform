/**
 * 通用设置（语言 + 主题）
 *
 * 从原 infra/pages/settings/GeneralSettings.tsx 抽离（2026-07-08 增量-12）。
 */

import { Sun, Moon, Languages as _Languages } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

export default function GeneralSettings() {
  const { t, i18n } = useTranslation();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 bg-background rounded-lg">
        <div>
          <h4 className="font-medium text-text-primary">{t('settings.language')}</h4>
          <p className="text-sm text-text-secondary">
            {t('settings.languageDesc')}
          </p>
        </div>
        <select
          value={i18n.language}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          className="px-4 py-2 bg-surface border border-border rounded-lg text-text-primary focus:outline-none focus:border-primary text-sm"
        >
          <option value="zh-CN">中文</option>
          <option value="en">English</option>
        </select>
      </div>

      <div className="flex items-center justify-between p-4 bg-background rounded-lg">
        <div>
          <h4 className="font-medium text-text-primary">{t('settings.theme')}</h4>
          <p className="text-sm text-text-secondary">
            {t('settings.themeDesc')}
          </p>
        </div>
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg hover:bg-surface/80 transition-colors"
        >
          {theme === 'dark' ? (
            <Moon className="w-5 h-5" />
          ) : (
            <Sun className="w-5 h-5" />
          )}
          <span className="text-sm text-text-primary">
            {theme === 'dark' ? '深色主题' : '浅色主题'}
          </span>
        </button>
      </div>
    </div>
  );
}
