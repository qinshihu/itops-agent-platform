import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Server, Terminal, Search, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import WebTerminal from '../components/WebTerminal';

interface ServerItem {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  use_ssh_key: number;
  description?: string;
  tags?: string[];
  enabled: number;
  last_connected?: string;
  created_at: string;
}

export default function TerminalPage() {
  const { token } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedServer, setSelectedServer] = useState<ServerItem | null>(null);

  const handleServerClick = useCallback((server: ServerItem) => {
    setSelectedServer(server);
  }, []);

  const handleCloseTerminal = useCallback(() => {
    setSelectedServer(null);
  }, []);

  const { data: serversData, isLoading } = useQuery<{ success: boolean; data: ServerItem[] }>({
    queryKey: ['servers'],
    queryFn: () => api.get('/api/servers').then((r) => r.data),
  });

  const servers = useMemo(() => {
    const all = serversData?.data || [];
    if (!searchTerm) return all;
    const term = searchTerm.toLowerCase();
    return all.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        s.hostname.toLowerCase().includes(term) ||
        s.username.toLowerCase().includes(term) ||
        (s.tags || []).some((t) => t.toLowerCase().includes(term))
    );
  }, [serversData, searchTerm]);

  if (selectedServer && token) {
    return (
      <div className="h-full">
        <WebTerminal
          serverId={selectedServer.id}
          serverName={`${selectedServer.name} (${selectedServer.hostname})`}
          token={token}
          onClose={handleCloseTerminal}
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Terminal className="w-6 h-6" />
          Web 终端
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          选择服务器打开交互式 SSH 终端
        </p>
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="搜索服务器名称、IP、用户名或标签..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : servers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Server className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg">
            {searchTerm ? '未找到匹配的服务器' : '暂无可用服务器'}
          </p>
          <p className="text-sm mt-1">
            {searchTerm ? '请尝试其他搜索关键词' : '请先在服务器管理页面添加服务器'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {servers.map((server) => (
            <button
              key={server.id}
              onClick={() => handleServerClick(server)}
              className="group flex flex-col items-start p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-md transition-all text-left"
            >
              <div className="flex items-start justify-between w-full mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
                    <Terminal className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {server.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{server.hostname}</p>
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full ${server.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                  {server.username}@{server.port}
                </span>
                {server.use_ssh_key ? (
                  <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded">
                    密钥
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-xs bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 rounded">
                    密码
                  </span>
                )}
              </div>
              {server.tags && server.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {server.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-1 mt-2 text-xs text-gray-400 group-hover:text-blue-500 transition-colors">
                <Terminal className="w-3 h-3" />
                <span>点击打开终端</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
