import Docker from 'dockerode';
import { logger } from '../../../utils/logger';
import type { Server as SocketIOServer } from 'socket.io';

interface LogStream {
  stream: NodeJS.ReadableStream;
  containerId: string;
}

class ContainerLogService {
  private streams: Map<string, LogStream> = new Map();
  private io: SocketIOServer | null = null;
  private docker: Docker;

  constructor() {
    this.docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });
  }

  setIO(io: SocketIOServer) {
    this.io = io;
  }

  /**
   * 开始流式传输容器日志到 WebSocket
   */
  async startLogStream(roomId: string, containerId: string, options: {
    tail?: number;
    follow?: boolean;
    timestamps?: boolean;
  } = {}): Promise<void> {
    if (this.streams.has(roomId)) {
      return; // 已在流式传输
    }
    
    try {
      const container = this.docker.getContainer(containerId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const logOptions: any = {
        stdout: true,
        stderr: true,
        tail: options.tail || 500,
        follow: options.follow !== false, // 默认跟随
        timestamps: options.timestamps !== false,
      };
      
      const stream = await container.logs(logOptions);
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.streams.set(roomId, { stream: stream as any, containerId });
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (stream as any).on('data', (chunk: Buffer) => {
        if (this.io) {
          // Docker 日志前 8 字节是 header，需要去掉
          const output = chunk.slice(8).toString('utf-8');
          this.io.to(roomId).emit('container:log', {
            containerId,
            data: output,
            timestamp: new Date().toISOString(),
          });
        }
      });
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (stream as any).on('error', (err: Error) => {
        logger.error(`Log stream error for ${containerId}:`, err.message);
        this.stopLogStream(roomId);
      });
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (stream as any).on('end', () => {
        logger.info(`Log stream ended for ${containerId}`);
        this.stopLogStream(roomId);
      });
      
      logger.info(`📜 Log stream started for container ${containerId} (room: ${roomId})`);
    } catch (err) {
      logger.error(`Failed to start log stream for ${containerId}:`, err);
      throw err;
    }
  }

  /**
   * 停止日志流
   */
  stopLogStream(roomId: string): void {
    const entry = this.streams.get(roomId);
    if (entry) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (entry.stream as any).destroy();
      } catch { /* ignore */ }
      this.streams.delete(roomId);
      logger.info(`📜 Log stream stopped for room: ${roomId}`);
    }
  }

  /**
   * 停止所有日志流
   */
  stopAll(): void {
    this.streams.forEach((entry) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      try { (entry.stream as any).destroy(); } catch { /* ignore */ }
    });
    this.streams.clear();
  }

  /**
   * 获取活跃的日志流数量
   */
  getActiveStreamCount(): number {
    return this.streams.size;
  }
}

export const containerLogService = new ContainerLogService();
