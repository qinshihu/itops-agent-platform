import { tokenBlacklist } from '../../modules/auth/services/tokenBlacklist';
import type { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { env } from '../../utils/env';
import { logger } from '../../utils/logger';
import { userRepository } from '../../repositories/userRepository';
import { terminalService } from '../../modules/scripts/services/terminalService';
import { terminalAiService } from '../../modules/scripts/services/terminalAiService';
import { containerMonitorService } from '../../modules/containers/services/containerMonitorService';
import { containerLogService } from '../../modules/containers/services/containerLogService';
import type { User } from '../../types';

/** WebSocket 消息负载类型 */
export type WSMessagePayload = Record<string, unknown>;

interface SocketWithUser extends Socket {
  user?: User;
  terminalSessionIds?: Set<string>;
}

const taskRooms = new Map<string, Set<string>>();

function authenticateSocket(socket: Socket, next: (err?: Error) => void) {
  const token = socket.handshake.auth?.token || 
                socket.handshake.headers?.authorization?.replace('Bearer ', '');

  if (!token) {
    logger.error('❌ WebSocket 认证失败: 未提供 token');
    return next(new Error('未提供认证token'));
  }

  try {
    if (tokenBlacklist.isBlacklisted(token)) {
      logger.error('❌ WebSocket 认证失败: token 已拉黑');
      return next(new Error('token已失效'));
    }

    const decoded = jwt.verify(token, env.JWT_SECRET) as { id: string };
    
    const user = userRepository.getForWebSocket(decoded.id) as User | undefined;
    
    if (!user?.enabled) {
      logger.error('❌ WebSocket 认证失败: 用户不存在或已禁用');
      return next(new Error('用户不存在或已禁用'));
    }

    (socket as SocketWithUser).user = user;
    logger.info(`✅ WebSocket 认证成功: ${user.username}`);
    next();
  } catch (error: unknown) {
    logger.error('❌ WebSocket 认证失败:', error);
    return next(new Error('无效的token'));
  }
}

export function setupWebSocket(io: SocketIOServer) {
  containerMonitorService.setIO(io);
  containerLogService.setIO(io);

  io.use(authenticateSocket);

  io.on('connection', (socket: Socket) => {
    const user = (socket as SocketWithUser).user;
    (socket as SocketWithUser).terminalSessionIds = new Set();
    logger.info(`🔌 Client connected: ${socket.id} (User: ${user?.username})`);

    socket.on('task:subscribe', (taskId: string) => {
      socket.join(`task:${taskId}`);
      if (!taskRooms.has(taskId)) {
        taskRooms.set(taskId, new Set());
      }
      taskRooms.get(taskId)!.add(socket.id);
      logger.info(`📡 Client ${socket.id} subscribed to task ${taskId}`);
    });

    socket.on('task:unsubscribe', (taskId: string) => {
      socket.leave(`task:${taskId}`);
      taskRooms.get(taskId)?.delete(socket.id);
      if (taskRooms.get(taskId)?.size === 0) {
        taskRooms.delete(taskId);
      }
      logger.info(`📤 Client ${socket.id} unsubscribed from task ${taskId}`);
    });

    socket.on('alert:subscribe', () => {
      socket.join('alerts');
      logger.info(`🔔 Client ${socket.id} subscribed to alerts`);
    });

    // 容器监控订阅
    socket.on('container:subscribe', (data: { containerId: string }) => {
      socket.join(`container:${data.containerId}`);
      containerMonitorService.startMonitoring(data.containerId);
      logger.info(`📊 Client ${socket.id} subscribed to container ${data.containerId}`);
    });

    // 容器监控取消订阅
    socket.on('container:unsubscribe', (data: { containerId: string }) => {
      socket.leave(`container:${data.containerId}`);
      logger.info(`📊 Client ${socket.id} unsubscribed from container ${data.containerId}`);
    });

    // 容器日志订阅
    socket.on('container:log:subscribe', (data: { containerId: string; tail?: number; timestamps?: boolean }, callback: (result: { roomId: string }) => void) => {
      const roomId = `log:${socket.id}:${data.containerId}:${Date.now()}`;
      socket.join(roomId);
      containerLogService.startLogStream(roomId, data.containerId, {
        tail: data.tail,
        timestamps: data.timestamps,
      }).catch((err: Error) => {
        logger.error(`Failed to start log stream for ${data.containerId}:`, err.message);
      });
      callback({ roomId });
      logger.info(`📜 Client ${socket.id} subscribed to logs of container ${data.containerId} (room: ${roomId})`);
    });

    // 容器日志取消订阅
    socket.on('container:log:unsubscribe', (data: { roomId: string }) => {
      socket.leave(data.roomId);
      containerLogService.stopLogStream(data.roomId);
      logger.info(`📜 Client ${socket.id} unsubscribed from log room ${data.roomId}`);
    });

    socket.on('terminal:open', async (data: { serverId: string; cols: number; rows: number }, callback: (result: { sessionId?: string; error?: string }) => void) => {
      try {
        const result = await terminalService.createTerminalSession(data.serverId, data.cols, data.rows);
        
        if (result.error) {
          callback({ error: result.error });
          return;
        }

        const sock = socket as SocketWithUser;
        sock.terminalSessionIds!.add(result.sessionId);
        socket.join(`terminal:${result.sessionId}`);

        const shellDataHandler = (shellData: Buffer) => {
          socket.emit('terminal:data', {
            sessionId: result.sessionId,
            data: shellData.toString('utf-8')
          });
        };

        result.shell.on('data', shellDataHandler);

        socket.on('terminal:disconnect', () => {
          result.shell.removeListener('data', shellDataHandler);
          terminalService.closeTerminalSession(result.sessionId);
        });

        socket.on(`terminal:close-session:${result.sessionId}`, () => {
          result.shell.removeListener('data', shellDataHandler);
        });

        callback({ sessionId: result.sessionId });
      } catch (err) {
        callback({ error: err instanceof Error ? err.message : 'Unknown error' });
      }
    });

    socket.on('terminal:data', (data: { sessionId: string; data: string }) => {
      terminalService.sendData(data.sessionId, data.data);
    });

    socket.on('terminal:resize', (data: { sessionId: string; cols: number; rows: number }) => {
      terminalService.resizeTerminal(data.sessionId, data.cols, data.rows);
    });

    socket.on('terminal:close', (data: { sessionId: string }) => {
      const sock = socket as SocketWithUser;
      sock.terminalSessionIds!.delete(data.sessionId);
      socket.leave(`terminal:${data.sessionId}`);
      socket.emit(`terminal:close-session:${data.sessionId}`);
      terminalService.closeTerminalSession(data.sessionId);
    });

    // AI 终端助手：分析终端内容
    socket.on('terminal:ai-analyze', async (data: {
      sessionId: string;
      rounds: Array<{ input: string; output: string }>;
      triggeredBy: 'auto' | 'manual';
      errorDetected: boolean;
    }, callback: (result: {
      suggestion: string;
      severity: 'info' | 'warning' | 'error';
      relatedCommands: string[];
    }) => void) => {
      try {
        const result = await terminalAiService.analyze({
          sessionId: data.sessionId,
          rounds: data.rounds,
          triggeredBy: data.triggeredBy,
          errorDetected: data.errorDetected,
        });
        callback(result);
      } catch (err) {
        logger.error('[TerminalAI] Analysis error:', err);
        callback({
          suggestion: 'AI 分析暂时不可用，请稍后重试。',
          severity: 'warning',
          relatedCommands: [],
        });
      }
    });

    // 数据中心 3D 监控订阅
    socket.on('dc:subscribe', () => {
      socket.join('dc-room');
      logger.info(`🏢 Client ${socket.id} subscribed to DC room`);
    });

    socket.on('dc:unsubscribe', () => {
      socket.leave('dc-room');
      logger.info(`🏢 Client ${socket.id} unsubscribed from DC room`);
    });

    // 断线重连后的数据追补
    socket.on('dc:catchup', (data: { since?: number }) => {
      logger.info(`🔄 Client ${socket.id} requested DC catch-up since ${data.since || 'never'}`);
      // 立即触发现已缓存的 dcStatusService 推一次全量数据
      socket.emit('dc:catchup:triggered', { ok: true });
    });

    socket.on('disconnect', () => {
      logger.info(`❌ Client disconnected: ${socket.id}`);
      taskRooms.forEach((sockets, taskId) => {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          taskRooms.delete(taskId);
        }
      });
      
      const sock = socket as SocketWithUser;
      const sessions = sock.terminalSessionIds;
      if (sessions) {
        sessions.forEach((sessionId) => {
          terminalService.closeTerminalSession(sessionId);
        });
        sock.terminalSessionIds = new Set();
      }
    });
  });

  // Graceful shutdown 由 app.ts 统一管理（调用 io.close() + shutdownAllServices）
}

export function emitToTask(io: SocketIOServer, taskId: string, event: string, data: WSMessagePayload) {
  io.to(`task:${taskId}`).emit(event, { taskId, ...data });
}

export function emitToAlerts(io: SocketIOServer, event: string, data: WSMessagePayload) {
  io.to('alerts').emit(event, data);
}

export function broadcast(io: SocketIOServer, event: string, data: WSMessagePayload) {
  io.emit(event, data);
}

export function emitToDC(io: SocketIOServer, event: string, data: WSMessagePayload) {
  io.to('dc-room').emit(event, data);
}
