import type { Server as SocketIOServer } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

export function setIOInstance(io: SocketIOServer): void {
  ioInstance = io;
}

export function getIOInstance(): SocketIOServer | null {
  return ioInstance;
}
