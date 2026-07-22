import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import { ArrowLeft, MonitorPlay, PowerOff, AlertCircle } from 'lucide-react';
import { logger } from '@/lib/logger';
import { useAuth } from '../../../contexts/AuthContext';

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

interface VNCError {
  message: string;
  [key: string]: unknown;
}

export default function RemoteDesktop() {
  const { serverId } = useParams<{ serverId: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState<string | undefined>(serverId);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const rfbRef = useRef<any>(null); // RFB 客户端引用（noVNC 集成时使用）

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
        logger.error('Failed to load servers:', err);
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
        return result.data as VNCConfig;
      }
      return null;
    } catch (err) {
      logger.error('Failed to load VNC config:', err);
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
          vncPort: config.vnc_port,
          password: config.vnc_password
        });
      });

      socket.on('vnc:connected', () => {
        setIsConnected(true);
      });

      socket.on('vnc:error', (data: VNCError) => {
        setError(data.message);
        setIsConnected(false);
      });

      socket.on('vnc:closed', () => {
        setIsConnected(false);
      });

      // RFB 握手诊断：收集后端转发来的原始字节流
      const rfbLog: string[] = [];
      let rfbBytes = 0;
      const MAX_LOG = 20;
      const renderRfbStatus = () => {
        if (!containerRef.current) return;
        const rfbVer = (rfbLog.find(l => l.startsWith('RFB ')) || '').slice(0, 32);
        const lastBytes = rfbBytes;
        containerRef.current.innerHTML = `
          <div class="w-full h-full flex flex-col items-center justify-center bg-gray-900 text-gray-300 p-6 overflow-auto">
            <p class="mb-2 text-lg text-green-400">VNC 握手已建立（TCP 通道）</p>
            <p class="text-sm text-text-tertiary mb-1">服务器: ${config.hostname}:${config.vnc_port}</p>
            <p class="text-xs text-text-tertiary mb-4">已接收 ${lastBytes} 字节 RFB 数据 · 版本: <code class="text-blue-300">${rfbVer || '解析中...'}</code></p>
            <div class="text-left text-xs text-text-tertiary bg-gray-800 p-3 rounded max-w-2xl w-full">
              <p class="text-yellow-300 mb-2">⚠ 完整 noVNC 客户端尚未集成</p>
              <p class="mb-2">当前模式：仅诊断 RFB 握手状态。后续集成方案：</p>
              <ul class="list-disc list-inside space-y-1">
                <li>安装 <code class="bg-gray-700 px-1">@novnc/novnc</code> 包</li>
                <li>订阅 <code class="bg-gray-700 px-1">vnc:data</code> 事件喂给 RFB 客户端</li>
                <li>canvas 鼠标/键盘事件通过 <code class="bg-gray-700 px-1">vnc:client-data</code> 发回</li>
              </ul>
            </div>
          </div>
        `;
      };

      socket.on('vnc:data', (chunk: ArrayBuffer | Uint8Array) => {
        rfbBytes += chunk.byteLength;
        if (rfbLog.length < MAX_LOG) {
          // 提取前 12 字节 ASCII 用于显示 RFB 版本
          const view = new Uint8Array(chunk instanceof ArrayBuffer ? chunk : (chunk as Uint8Array).buffer);
          const head = Array.from(view.slice(0, 12)).map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.').join('');
          rfbLog.push(`[${rfbBytes}B] ${head}`);
        }
        // 通知后端已接收（可选，用于流控）
        if (rfbBytes <= 4096) renderRfbStatus();
      });

      renderRfbStatus();

    } catch (err) {
      logger.error('Failed to connect:', err);
      setError('连接失败: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  // 断开连接
  const handleDisconnect = () => {
    const socket = socketRef.current;
    if (socket) {
      // 先通知后端清理 session
      socket.emit('vnc:disconnect');
      // 再关闭 socket
      socket.disconnect();
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
