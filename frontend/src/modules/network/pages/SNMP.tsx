import { useState } from 'react';
import clsx from 'clsx';
import { Radio, Key, Search, Activity, Terminal } from 'lucide-react';
import { SnmpCredentialsTab } from './snmp/SnmpCredentialsTab';
import { SnmpQueryTab } from './snmp/SnmpQueryTab';
import { SnmpTrapsTab } from './snmp/SnmpTrapsTab';

const TABS = [
  { id: 'credentials', label: '凭证管理', icon: Key },
  { id: 'query', label: 'SNMP 查询', icon: Search },
  { id: 'traps', label: 'Trap 接收', icon: Activity },
];

const API_ENDPOINTS = [
  'GET /api/snmp/credentials',
  'POST /api/snmp/credentials',
  'DELETE /api/snmp/credentials/:id',
  'POST /api/snmp/test',
  'POST /api/snmp/system-info',
  'POST /api/snmp/interfaces',
  'POST /api/snmp/walk',
  'POST /api/snmp/get',
  'POST /api/snmp/discover',
  'GET /api/snmp/health/:deviceId',
  'POST /api/snmp/health-batch',
  'GET /api/snmp/traps',
  'POST /api/snmp/trap/start',
  'POST /api/snmp/trap/stop',
  'POST /api/snmp/poll-interfaces',
  'GET /api/snmp/device/:deviceId/system-info',
  'GET /api/snmp/device/:deviceId/interfaces',
];

export default function SNMP() {
  const [activeTab, setActiveTab] = useState('credentials');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="h-full overflow-auto p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary mb-2 flex items-center gap-3">
              <Radio className="w-7 h-7 text-emerald-400" />
              SNMP 管理
            </h1>
            <p className="text-text-secondary">SNMP 凭证管理、设备发现与网络监控</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-background rounded-lg p-1 border border-border">
          {TABS.map(tab => (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all',
                activeTab === tab.id ? 'bg-primary text-white shadow-sm' : 'text-text-secondary hover:text-text-primary'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ======================== Tab 1: 凭证管理 ======================== */}
        {activeTab === 'credentials' && (
          <SnmpCredentialsTab searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
        )}

        {/* ======================== Tab 2: SNMP 查询 ======================== */}
        {activeTab === 'query' && <SnmpQueryTab />}

        {/* ======================== Tab 3: Trap 接收 ======================== */}
        {activeTab === 'traps' && <SnmpTrapsTab />}

        {/* API 速查 */}
        <details className="bg-background rounded-xl border border-border p-4">
          <summary className="flex items-center gap-2 cursor-pointer text-sm text-text-secondary hover:text-text-primary">
            <Terminal className="w-4 h-4" />
            SNMP API 端点速查
          </summary>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {API_ENDPOINTS.map(endpoint => (
              <code key={endpoint} className="block px-2 py-1.5 bg-surface rounded font-mono text-text-secondary">
                {endpoint}
              </code>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
