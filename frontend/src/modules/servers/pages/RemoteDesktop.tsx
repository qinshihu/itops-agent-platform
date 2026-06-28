import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import { ArrowLeft, MonitorPlay, PowerOff, AlertCircle } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { clsx } from 'clsx';

interface Server {
  id: string;
  name: string;
  hostname: string;
  vnc_port?: number;
  os_type?: string;
}

interface VNCConfig {
  hostname: string;
  vnc_port: number;
  vnc_password?: string;
}

export default function RemoteDesktop() {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<string | undefined>(serverId);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [vncConfig, setVncConfig] = useState<VNCConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // 加载服务器列表
  useEffect(() => {
    const loadServers = async () => {
      try {
        const res = await fetch('/api/servers', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const result = await res.json();
        if (result.success) {
          const vncServers = result.data.filter((s: Server) => 
            s.os_type === 'windows' || s.vnc_port
          );
          setServers(vncServers);
          
          if (serverId && vncServers.some((s: Server) => s.id === serverId)) {
            setSelectedServer(serverId);
          }
        }
      } catch (err) {
        console.error('Failed to load servers:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadServers();
  }, [token, serverId]);

  // 加载服务器 VNC 配置
  const loadVncConfig = async (id: string) => {
    try {
      const res = await fetch(`/api/vnc/config/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const result = await res.json();
      if (result.success) {
        setVncConfig(result.data);
        return result.data;
      }
      return null;
    } catch (err) {
      console.error('Failed to load VNC config:', err);
      return null;
    }
  };

  // 连接 VNC
  const connectToVNC = async (id: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const config = await loadVncConfig(id);
      if (!config) {
        setError('无法加载 VNC 配置');
        return;
      }

      if (socketRef.current) {
        socketRef.current.disconnect();
      }

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const socket = io(`${wsProtocol}//${window.location.host}/vnc`);
      socketRef.current = socket;

      socket.on('connect', () => {
        socket.emit('vnc:connect', {
          serverId: id,
          vncHost: config.hostname,
          vncPort: config.vnc_port
        });
      });

      socket.on('vnc:connected', () => {
        setIsConnected(true);
      });

      socket.on('vnc:error', (data: any) => {
        setError(data.message);
        setIsConnected(false);
      });

      socket.on('vnc:closed', () => {
        setIsConnected(false);
      });

      if (containerRef.current) {
        containerRef.current.innerHTML = `
          <div class="w-full h-full flex items-center justify-center bg-gray-900 text-gray-300">
            <div class="text-center">
              <p class="mb-2 text-lg">VNC 连接已建立</p>
              <p class="text-sm text-text-tertiary mb-4">服务器: ${config.hostname}:${config.vnc_port}</p>
              <p class="text-xs text-text-tertiary">完整 noVNC 集成需要安装 @novnc/novnc 包</p>
            </div>
          </div>
        `;
      }

    } catch (err) {
      console.error('Failed to connect:', err);
      setError('连接失败: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  // 断开连接
  const handleDisconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    setIsConnected(false);
  };

  // 当选择服务器变化时
  useEffect(() => {
    if (selectedServer && servers.length > 0) {
      connectToVNC(selectedServer);
    }
  }, [selectedServer]);

  // 清理
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  if (isLoading && servers.length === 0) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[500px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/servers')}
            className="flex items-center gap-2 px-4 py-2 bg-background border border-border rounded-lg hover:bg-background-hover transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>返回</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2 text-text-primary">
              <MonitorPlay className="w-6 h-6" />
              远程桌面
            </h1>
            <p className="text-text-secondary mt-1">
              通过 VNC 连接远程服务器桌面
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {/* 控制面板 */}
        <div className="bg-card border border-border rounded-lg p-4">
          <div className="flex flex-wrap gap-4 items-center">
            <select
              value={selectedServer || ''}
              onChange={(e) => setSelectedServer(e.target.value || undefined)}
              className="px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:border-primary text-text-primary"
              style={{ minWidth: '300px' }}
            >
              <option value="">选择服务器</option>
              {servers.map(server => (
                <option key={server.id} value={server.id}>
                  {server.name} ({server.hostname})
                </option>
              ))}
            </select>

            {isConnected && (
              <button
                onClick={handleDisconnect}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
              >
                <PowerOff className="w-4 h-4" />
                <span>断开连接</span>
              </button>
            )}
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <div className="flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-red-400">连接错误</h3>
                <p className="text-sm text-red-300 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* 提示信息 */}
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-blue-400">提示</h3>
              <p className="text-sm text-blue-300 mt-1">
                Windows 服务器需要先安装并启动 VNC 服务器（推荐 TightVNC 或 RealVNC）。
              </p>
              <p className="text-sm text-blue-300 mt-2">
                如需完整的 noVNC 集成，请运行 <code className="bg-blue-500/20 px-2 py-0.5 rounded text-blue-300">npm install @novnc/novnc</code>
              </p>
            </div>
          </div>
        </div>

        {/* VNC 显示区域 */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div
            ref={containerRef}
            className="w-full h-[600px] bg-gray-900 flex items-center justify-center"
          >
            {!isConnected && !isLoading && (
              <div className="text-center text-gray-400">
                <MonitorPlay className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>选择服务器开始连接</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
