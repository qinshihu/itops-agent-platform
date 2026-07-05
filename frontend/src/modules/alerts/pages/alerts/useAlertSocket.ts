import { useEffect, useState, useRef, useCallback } from 'react';
import type { Socket } from 'socket.io-client';
import { io } from 'socket.io-client';
import { WS_URL, WS_RECONNECT_INTERVALS } from './types';

export function useAlertSocket(token: string | null, refetch: () => void) {
  const [wsConnected, setWsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connectWebSocketRef = useRef<ReturnType<typeof connectWebSocketInner> | null>(null);
  const scheduleReconnectRef = useRef<(() => void) | null>(null);

  const connectWebSocketInner = useCallback(() => {
    if (!token) return;

    const socket: Socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
      auth: { token },
      reconnection: false,
    });

    socket.on('connect', () => {
      setWsConnected(true);
      reconnectAttemptRef.current = 0;
      socket.emit('alert:subscribe');
    });

    socket.on('disconnect', () => {
      setWsConnected(false);
      scheduleReconnectRef.current?.();
    });

    socket.on('connect_error', () => {
      setWsConnected(false);
      scheduleReconnectRef.current?.();
    });

    socket.on('alert:new', () => {
      refetch();
    });

    socket.on('alert:updated', () => {
      refetch();
    });

    socketRef.current = socket;

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('alert:new');
      socket.off('alert:updated');
      socket.emit('alert:unsubscribe');
      socket.disconnect();
    };
  }, [token, refetch]);

  const scheduleReconnect = useCallback(() => {
    if (reconnectAttemptRef.current >= WS_RECONNECT_INTERVALS.length) return;
    const delay = WS_RECONNECT_INTERVALS[reconnectAttemptRef.current];
    reconnectTimerRef.current = setTimeout(() => {
      reconnectAttemptRef.current++;
      connectWebSocketRef.current?.();
    }, delay);
  }, []);

  useEffect(() => {
    connectWebSocketRef.current = connectWebSocketInner;
    scheduleReconnectRef.current = scheduleReconnect;
    const cleanup = connectWebSocketInner();
    return () => {
      cleanup?.();
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [connectWebSocketInner, scheduleReconnect]);

  return { wsConnected };
}