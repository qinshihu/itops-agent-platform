import { useEffect, useRef, useState } from 'react';
import { Terminal, IDisposable } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { io, Socket } from 'socket.io-client';
import 'xterm/css/xterm.css';

interface TerminalProps {
  serverId: string;
  serverName: string;
  token: string;
  onClose: () => void;
}

export default function WebTerminal({ serverId, serverName, token, onClose }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const onDataDisposeRef = useRef<IDisposable | null>(null);
  const onResizeDisposeRef = useRef<IDisposable | null>(null);
  const terminalDataHandlerRef = useRef<((data: { sessionId: string; data: string }) => void) | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectCountRef = useRef(0);
  const maxReconnectAttempts = 3;
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'error' | 'disconnected'>('connecting');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!terminalRef.current) return;

    mountedRef.current = true;

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#d4d4d4',
        selectionBackground: '#264f78',
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#e5e5e5'
      },
      allowProposedApi: true,
      scrollback: 5000
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    term.open(terminalRef.current);
    fitAddon.fit();

    const socket = io(window.location.origin, {
      path: '/socket.io/',
      auth: { token },
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    const terminalDataHandler = (data: { sessionId: string; data: string }) => {
      if (data.sessionId === sessionIdRef.current && xtermRef.current) {
        xtermRef.current.write(data.data);
      }
    };
    terminalDataHandlerRef.current = terminalDataHandler;
    socket.on('terminal:data', terminalDataHandler);

    socket.on('connect', () => {
      const t = xtermRef.current;
      if (!t) return;
      reconnectCountRef.current = 0;
      socket.emit('terminal:open', { serverId, cols: t.cols, rows: t.rows }, (result: { sessionId?: string; error?: string }) => {
        if (result.error) {
          setStatus('error');
          setError(result.error || 'Failed to open terminal');
          return;
        }
        sessionIdRef.current = result.sessionId || null;
        setStatus('connected');
      });
    });

    socket.on('connect_error', () => {
      setStatus('error');
      setError('WebSocket connection failed');
    });

    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        socket.disconnect();
        setStatus('disconnected');
        return;
      }
      if (reconnectCountRef.current < maxReconnectAttempts) {
        setStatus('connecting');
        reconnectCountRef.current++;
        reconnectTimerRef.current = setTimeout(() => {
          socket.connect();
        }, Math.min(1000 * Math.pow(2, reconnectCountRef.current), 5000));
      } else {
        setStatus('disconnected');
        setError('Terminal connection lost');
      }
    });

    const onDataDispose = term.onData((data) => {
      if (!mountedRef.current || !socketRef.current?.connected || !sessionIdRef.current) return;
      socketRef.current.emit('terminal:data', { sessionId: sessionIdRef.current, data });
    });
    onDataDisposeRef.current = onDataDispose;

    const onResizeDispose = term.onResize(({ cols, rows }) => {
      if (!mountedRef.current || !socketRef.current?.connected || !sessionIdRef.current) return;
      socketRef.current.emit('terminal:resize', { sessionId: sessionIdRef.current, cols, rows });
    });
    onResizeDisposeRef.current = onResizeDispose;

    const handleResize = () => {
      fitAddon.fit();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      mountedRef.current = false;

      window.removeEventListener('resize', handleResize);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      reconnectCountRef.current = 0;

      onDataDisposeRef.current?.dispose();
      onDataDisposeRef.current = null;
      onResizeDisposeRef.current?.dispose();
      onResizeDisposeRef.current = null;

      const handler = terminalDataHandlerRef.current;
      if (handler && socketRef.current) {
        socketRef.current.off('terminal:data', handler);
        terminalDataHandlerRef.current = null;
      }

      if (socketRef.current && sessionIdRef.current) {
        socketRef.current.emit('terminal:close', { sessionId: sessionIdRef.current });
      }

      sessionIdRef.current = null;

      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      if (xtermRef.current) {
        xtermRef.current.dispose();
        xtermRef.current = null;
      }
    };
  }, [serverId, token]);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            status === 'connected' ? 'bg-green-500' :
            status === 'connecting' ? 'bg-yellow-500 animate-pulse' :
            status === 'error' ? 'bg-red-500' :
            'bg-gray-500'
          }`} />
          <span className="text-sm text-gray-300 font-medium">{serverName}</span>
          <span className="text-xs text-gray-500">({status})</span>
        </div>
        <button
          onClick={() => {
            if (socketRef.current && sessionIdRef.current) {
              socketRef.current.emit('terminal:close', { sessionId: sessionIdRef.current });
              socketRef.current.disconnect();
              socketRef.current = null;
            }
            onDataDisposeRef.current?.dispose();
            onResizeDisposeRef.current?.dispose();
            if (xtermRef.current) {
              xtermRef.current.dispose();
              xtermRef.current = null;
            }
            onClose();
          }}
          className="px-3 py-1 text-xs text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded transition-colors"
        >
          关闭终端
        </button>
      </div>

      <div className="flex-1 overflow-hidden p-2">
        {status === 'error' && (
          <div className="flex flex-col items-center justify-center h-full text-red-400">
            <svg className="w-12 h-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-lg font-medium mb-2">连接失败</p>
            <p className="text-sm text-gray-500 mb-4">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
            >
              返回
            </button>
          </div>
        )}
        {status !== 'error' && (
          <div ref={terminalRef} className="w-full h-full" />
        )}
      </div>
    </div>
  );
}
