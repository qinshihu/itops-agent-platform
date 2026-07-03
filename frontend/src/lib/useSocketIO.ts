import { useEffect, useRef, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';

let globalSocket: Socket | null = null;
let dcSubscribeCount = 0;
/** 上次收到数据的时间戳，用于断线重连后数据追补 */
let lastPayloadTimestamp = 0;

/** 获取/创建全局 socket 实例 */
function getSocket(): Socket {
  if (!globalSocket) {
    const token = localStorage.getItem('token');
    globalSocket = io('', {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    globalSocket.on('connect', () => console.debug('[WS] 数据中心已连接'));
    globalSocket.on('disconnect', (reason) => console.debug('[WS] 数据中心断开:', reason));
    /* 断线重连后，如果超过 10s 无数据，发出重连信号让组件主动 pull */
    globalSocket.on('reconnect', () => {
      const gap = Date.now() - lastPayloadTimestamp;
      if (gap > 10000 && lastPayloadTimestamp > 0) {
        console.debug(`[WS] Reconnected after ${gap}ms gap, requesting data catch-up`);
        globalSocket?.emit('dc:catchup', { since: lastPayloadTimestamp });
      }
    });
  }
  return globalSocket;
}

/**
 * Socket.IO 钩子 — 自动订阅 dc-room
 * 多个组件可安全同时使用（引用计数避免取消订阅冲突）
 */
export function useSocketIO() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const s = getSocket();
    socketRef.current = s;
    dcSubscribeCount++;
    if (dcSubscribeCount === 1) {
      s.emit('dc:subscribe');
    }
    return () => {
      dcSubscribeCount--;
      if (dcSubscribeCount <= 0) {
        dcSubscribeCount = 0;
        s.emit('dc:unsubscribe');
      }
    };
  }, []);

  /** 监听事件 — 返回清除函数，并自动记录时间戳用于重连追补 */
  const on = useCallback(<T = any>(event: string, handler: (data: T) => void) => {
    const wrappedHandler = (data: any) => {
      // 记录 payload 时间戳供重连判断
      if (data?.timestamp) lastPayloadTimestamp = data.timestamp;
      handler(data);
    };
    socketRef.current?.on(event, wrappedHandler);
    return () => { socketRef.current?.off(event, wrappedHandler); };
  }, []);

  return { socket: socketRef, on };
}

/** 后端推过来的 DC 实时状态结构 */
export type DCStatusPayload = {
  timestamp: number;
  summary: {
    totalRacks: number;
    totalSlots: number;
    totalDevices: number;
    onlineDevices: number;
    alertDevices: number;
  };
  rackUtil: Array<{
    id: string; name: string; used_u: number; total_u: number; device_count: number;
  }>;
  roomEnv: Array<{
    id: string; name: string; label: string;
    current_temperature: number | null; current_humidity: number | null;
  }>;
};
