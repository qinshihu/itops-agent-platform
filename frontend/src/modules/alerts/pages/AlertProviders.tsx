
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  RefreshCw, 
  Bell, 
  Search,
  Globe,
  Activity,
} from 'lucide-react';
import clsx from 'clsx';
import api from '../../../lib/api';

interface AlertProvider {
  id: string;
  name: string;
  type: string;
  configSchema: any;
}

export default function AlertProviders() {
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: providers, isLoading } = useQuery({
    queryKey: ['alert-providers', selectedType],
    queryFn: async () => {
      const params = selectedType ? { type: selectedType } : undefined;
      const res = await api.get('/api/alerts/providers/list', { params });
      return res.data.data as AlertProvider[];
    },
  });

  const types = Array.from(new Set((providers || []).map(p => p.type)));
  const filteredProviders = (providers || []).filter(p => 
    !searchQuery || 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'webhook': return Globe;
      case 'prometheus': return Activity;
      case 'zabbix': return Activity;
      default: return Bell;
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900 overflow-hidden">
      <div className="p-6 border-b border-slate-700 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 mb-2">告警 Provider 管理</h1>
          <p className="text-slate-400">管理和查看告警源 Provider</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['alert-providers'] })}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-100 rounded-lg hover:bg-slate-700 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            刷新
          </button>
        </div>
      </div>

      <div className="p-4 border-b border-slate-700 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索 Provider..."
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-slate-100 focus:outline-none focus:border-blue-500 w-64"
          />
        </div>

        <div className="flex gap-2 items-center">
          <span className="text-sm text-slate-400">类型:</span>
          <button
            onClick={() => setSelectedType(null)}
            className={clsx(
              "px-3 py-1.5 rounded-full text-sm font-medium transition-all",
              !selectedType
                ? "bg-blue-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            )}
          >
            全部
          </button>
          {types.map((type) => {
            const Icon = getTypeIcon(type);
            return (
              <button
                key={type}
                onClick={() => setSelectedType(selectedType === type ? null : type)}
                className={clsx(
                  "px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-1.5 transition-all",
                  selectedType === type
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {type}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProviders.map((provider) => {
            const Icon = getTypeIcon(provider.type);
            return (
              <div
                key={provider.id}
                className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-600 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/20">
                      <Icon className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-100">{provider.name}</h3>
                      <span className="text-xs text-slate-400">{provider.type}</span>
                    </div>
                  </div>
                </div>
                
                {provider.configSchema && (
                  <div className="mb-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                    <p className="text-xs text-slate-400 mb-1.5">配置 Schema:</p>
                    <pre className="text-xs text-slate-300 overflow-x-auto max-h-32">
                      {JSON.stringify(provider.configSchema.properties, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
