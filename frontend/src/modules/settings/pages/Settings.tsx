/**
 * 系统设置页面（聚合 tab 页）
 *
 * 从原 infra/pages/Settings.tsx 抽离（2026-07-08 增量-12 P1-6 frontend 同步）。
 * 包含 5 个子 tab：models / qanything / notifications / database / security
 */

import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, Database, Shield, Brain, BookOpen } from 'lucide-react';
import clsx from 'clsx';
import ModelSettings from './settings/ModelSettings';
import NotificationSettings from '../../notification/pages/NotificationSettings';
import BackupSettings from '../../backup/pages/BackupSettings';
import SecuritySettings from './settings/SecuritySettings';
import GeneralSettings from './settings/GeneralSettings';
import QAnythingSettings from './settings/QAnythingSettings';

interface TabDef {
  id: string;
  name: string;
  icon: typeof Brain;
}

export default function Settings() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('models');

  // 如果是强制修改密码，自动切换到安全设置标签
  useEffect(() => {
    if (searchParams.get('changePassword') === 'true') {
      setActiveTab('security');
    }
  }, [searchParams]);

  const tabs: TabDef[] = [
    { id: 'models', name: t('settings.models'), icon: Brain },
    { id: 'qanything', name: t('dashboard.knowledge'), icon: BookOpen },
    { id: 'notifications', name: t('settings.monitoring'), icon: Bell },
    { id: 'database', name: t('settings.backup'), icon: Database },
    { id: 'security', name: t('settings.security'), icon: Shield },
  ];

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">{t('settings.title')}</h1>
          <p className="text-text-secondary">{t('settings.languageDesc')}</p>
        </div>

        <div className="bg-surface rounded-xl border border-border overflow-hidden">
          <div className="flex">
            {/* 左侧导航 */}
            <div className="w-64 border-r border-border p-4">
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={clsx(
                        'w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all',
                        activeTab === tab.id
                          ? 'bg-primary text-white'
                          : 'text-text-secondary hover:bg-background'
                      )}
                    >
                      <Icon className="w-5 h-5" />
                      {tab.name}
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* 右侧内容 */}
            <div className="flex-1 p-6">
              {activeTab === 'models' && <ModelSettings />}
              {activeTab === 'qanything' && <QAnythingSettings />}
              {activeTab === 'notifications' && <NotificationSettings />}
              {activeTab === 'database' && <BackupSettings />}
              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                      <Shield className="w-5 h-5" />
                      安全设置
                    </h3>
                    <p className="text-sm text-text-secondary mb-6">配置安全策略和访问控制</p>
                  </div>
                  <SecuritySettings />
                  <GeneralSettings />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 社区 & 微信群 */}
        <CommunitySection />
      </div>
    </div>
  );
}

/** 社区 & 微信群信息区块 */
function CommunitySection() {
  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <div className="relative p-6">
        {/* 微信名片 — 右上角 */}
        <div className="absolute top-10 right-5 flex flex-col items-center z-10">
          <img
            src="/wechaterweima.png"
            alt="微信公众号名片"
            className="rounded-md"
            style={{ width: '560px', height: 'auto', objectFit: 'contain' }}
          />
          <span className="text-sm text-text-muted mt-4 text-center leading-tight">
            扫码关注公众号，加入项目交流群
          </span>
        </div>

        {/* 标题 + 简介 — 避开右侧名片 */}
        <h3 className="text-lg font-semibold text-text-primary mb-1 pr-[600px]">加入社区</h3>
        <p className="text-sm text-text-secondary mb-4 pr-[600px]">
          因兴趣和热爱相聚，一起打造好用的开源 AI 运维平台
        </p>

        {/* 上方简短信息 — 避开右侧名片 */}
        <div className="text-sm text-text-secondary leading-relaxed space-y-2 mb-4 pr-[600px]">
          <p>
            👋 欢迎加入 <span className="text-text-primary font-medium">AIOps Agent Platform</span> 项目群，最新代码在{' '}
            <code className="bg-bg-muted px-1.5 py-0.5 rounded text-xs font-mono">dev</code> 分支。
          </p>
          <div className="space-y-1">
            <p>
              ✨ 在线演示：
              <a href="https://agentdemo-0mwug01t6.maozi.io/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                agentdemo-0mwug01t6.maozi.io
              </a>
            </p>
            <p>
              📚 文档手册：
              <a href="https://aiopsdoc-0mwug01t6.maozi.io/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                aiopsdoc-0mwug01t6.maozi.io
              </a>
            </p>
          </div>
        </div>

        {/* 下方长内容 — 避开右侧名片 */}
        <div className="text-sm text-text-secondary leading-relaxed space-y-3 pr-[600px]">
          <div>
            <p className="text-text-primary font-medium mb-1">💡 开发初心</p>
            <p>
              开发这个项目的初心不是为了利益，是为了解放运维。趁着 AI
              的东风，真正把 AI
              和运维的场景落地，帮大家从繁琐、重复、无意义的工作里解放出来。做一个真正好用、能解决实际问题的免费开源平台，让大家可以多陪陪家人，多做点自己真正喜欢的事。
            </p>
            <p className="mt-2 text-orange-600 dark:text-orange-400 font-medium">
              ⚠️ 注意：不允许闭源二次开发、打包销售、SaaS 化运营等商业用途，承诺永久开源！
            </p>
          </div>

          <div className="space-y-1">
            <p>💡 所有想法、建议、需求、Bug，统一到这里提：</p>
            <p>
              <a href="https://github.com/qinshihu/itops-agent-platform/issues" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                github.com/qinshihu/itops-agent-platform/issues
              </a>
            </p>
          </div>

          <div className="space-y-1 text-text-muted">
            <p>
              • 所有二开请基于最新 <code className="bg-bg-muted px-1 py-0.5 rounded text-xs font-mono">dev</code> 分支开发，统一接口与界面风格
            </p>
            <p>• 所有需求、bug、建议统一提在 GitHub Issues，群内只做讨论</p>
            <p>• 提交代码：Fork 仓库 → 开发 → 提 PR</p>
          </div>

          <p className="text-text-muted italic">
            每行代码、每个反馈、每条建议，都在让这个项目变得更好。我们素未谋面，却能凭着兴趣热爱共同的想法一起创造有价值有意义的东西。学习成长，做好一件事，期待每一位同行的参与！
          </p>
        </div>
      </div>
    </div>
  );
}
