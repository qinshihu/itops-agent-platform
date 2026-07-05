import type { ReactNode } from 'react';
import { Box, Image, HardDrive, Globe, Server, Monitor } from 'lucide-react';
import type { Tab } from '../types';
import { ImageSection } from '../ImageSection';
import { VolumeSection } from '../VolumeSection';
import { ContainerDetail } from '../ContainerDetail';
import { useContainers } from './useContainers';
import { ContainersTab } from './ContainersTab';
import { NetworksTab } from './NetworksTab';
import { EndpointsTab } from './EndpointsTab';

export default function ContainersPage() {
  const ctx = useContainers();
  const {
    activeTab, setActiveTab,
    endpointId, setEndpointId,
    hosts,
    showLogsDrawer, setShowLogsDrawer,
    showStatsDrawer, setShowStatsDrawer,
    showDetailDrawer, setShowDetailDrawer,
    selectedContainerId,
    selectedContainerName,
    setPage, setSearch, setStatusFilter,
  } = ctx;

  const tabs: { key: Tab; label: string; icon: ReactNode }[] = [
    { key: 'containers', label: '容器', icon: <Box className="w-4 h-4" /> },
    { key: 'images', label: '镜像', icon: <Image className="w-4 h-4" /> },
    { key: 'volumes', label: '数据卷', icon: <HardDrive className="w-4 h-4" /> },
    { key: 'networks', label: '网络', icon: <Globe className="w-4 h-4" /> },
    { key: 'endpoints', label: '端点', icon: <Server className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-4">
      {/* ── Endpoint Selector ── */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-text-secondary" />
          <span className="text-sm text-text-secondary">Docker 主机:</span>
        </div>
        <select
          value={endpointId}
          onChange={(e) => {
            setEndpointId(e.target.value);
            setPage(1);
            setSearch('');
            setStatusFilter('');
          }}
          className="px-3 py-1.5 bg-surface border border-border rounded-lg text-sm text-text-primary focus:outline-none focus:border-blue-500 min-w-[200px]"
        >
          {hosts.map((h) => (
            <option key={h.id} value={h.id}>
              {h.name} ({h.host}{h.id !== 'local' && h.port ? `:${h.port}` : ''}) — {h.status === 'active' ? '可用' : '不可用'}
            </option>
          ))}
        </select>
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════ */}
      {/* CONTAINERS TAB */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeTab === 'containers' && <ContainersTab ctx={ctx} />}

      {/* ═══════════════════════════════════════════════════ */}
      {/* IMAGES TAB */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeTab === 'images' && <ImageSection endpointId={endpointId} />}

      {/* ═══════════════════════════════════════════════════ */}
      {/* VOLUMES TAB */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeTab === 'volumes' && <VolumeSection endpointId={endpointId} />}

      {/* ═══════════════════════════════════════════════════ */}
      {/* NETWORKS TAB */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeTab === 'networks' && <NetworksTab ctx={ctx} />}

      {/* ═══════════════════════════════════════════════════ */}
      {/* ENDPOINTS TAB */}
      {/* ═══════════════════════════════════════════════════ */}
      {activeTab === 'endpoints' && <EndpointsTab ctx={ctx} />}

      {/* ── Container Detail Drawers (Logs / Stats / Detail) ── */}
      <ContainerDetail
        endpointId={endpointId}
        selectedContainerId={selectedContainerId}
        selectedContainerName={selectedContainerName}
        showLogsDrawer={showLogsDrawer}
        showStatsDrawer={showStatsDrawer}
        showDetailDrawer={showDetailDrawer}
        onCloseLogs={() => setShowLogsDrawer(false)}
        onCloseStats={() => setShowStatsDrawer(false)}
        onCloseDetail={() => setShowDetailDrawer(false)}
      />
    </div>
  );
}