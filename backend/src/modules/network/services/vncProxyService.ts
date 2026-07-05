import type { Server, Socket } from 'socket.io';
import net from 'net';
import { logger } from '../../../utils/logger';
import { verifyToken, type AuthUser } from '../../../middleware/auth';
import { networkDeviceRepository } from '../../../repositories/networkDeviceRepository';
import { serversRepo } from '../../../repositories/serverRepository';

interface VNCSession {
  id: string;
  serverId: string;
  vncHost: string;
  vncPort: number;
  vncSocket: net.Socket | null;
  clientSocketId: string;
  createdAt: number;
}

// VNC 标准端口范围
const VNC_PORT_MIN = 5900;
const VNC_PORT_MAX = 5999;

const BLOCKED_CIDRS: Array<{ start: number; end: number; label: string }> = [
  { start: ipv4ToInt('127.0.0.0'), end: ipv4ToInt('127.255.255.255'), label: '127.0.0.0/8 loopback' },
  { start: ipv4ToInt('0.0.0.0'), end: ipv4ToInt('0.255.255.255'), label: '0.0.0.0/8 unspecified' },
  { start: ipv4ToInt('169.254.0.0'), end: ipv4ToInt('169.254.255.255'), label: '169.254.0.0/16 link-local (含云元数据 169.254.169.254)' },
  { start: ipv4ToInt('10.0.0.0'), end: ipv4ToInt('10.255.255.255'), label: '10.0.0.0/8 private network' },
  { start: ipv4ToInt('172.16.0.0'), end: ipv4ToInt('172.31.255.255'), label: '172.16.0.0/12 private network' },
  { start: ipv4ToInt('192.168.0.0'), end: ipv4ToInt('192.168.255.255'), label: '192.168.0.0/16 private network' },
];

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => Number.isNaN(p) || p < 0 || p > 255)) return -1;
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function isBlockedIp(ip: string): boolean {
  const ipInt = ipv4ToInt(ip);
  if (ipInt < 0) return true;
  return BLOCKED_CIDRS.some(cidr => ipInt >= cidr.start && ipInt <= cidr.end);
}

function isAllowedVncTarget(host: string): boolean {
  if (isBlockedIp(host)) return false;
  const device = networkDeviceRepository.getIdByIp(host);
  return !!device;
}

class VNCProxyService {
  private sessions: Map<string, VNCSession> = new Map();

  initialize(io: Server) {
    const vncNamespace = io.of('/vnc');

    vncNamespace.use((socket: Socket, next) => {
      const token =
        (socket.handshake.auth as { token?: string } | undefined)?.token ||
        socket.handshake.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return next(new Error('UNAUTHORIZED: token required'));
      }
      const user = verifyToken(token);
      if (!user) {
        return next(new Error('UNAUTHORIZED: invalid token'));
      }
      const role = (user as AuthUser).role;
      if (role !== 'admin' && role !== 'operator') {
        return next(new Error('FORBIDDEN: insufficient role'));
      }
      (socket.data as { user: AuthUser }).user = user as AuthUser;
      next();
    });

    vncNamespace.on('connection', (socket: Socket) => {
      logger.info(`VNC client connected: ${socket.id} (user=${(socket.data as { user: AuthUser }).user.username})`);

      socket.on('vnc:connect', async (data: { serverId: string; vncHost: string; vncPort: number; password?: string }) => {
        try {
          if (!isAllowedVncTarget(data.vncHost)) {
            const reason = isBlockedIp(data.vncHost) ? 'blocked reserved IP' : 'not a registered network device';
            logger.warn(`VNC connect rejected for ${socket.id}: ${data.vncHost} (${reason})`);
            socket.emit('vnc:error', { message: `VNC target not allowed: ${data.vncHost}` });
            return;
          }

          // 限制 VNC 端口范围为 5900-5999（防止通用 TCP 隧道）
          if (!Number.isInteger(data.vncPort) || data.vncPort < VNC_PORT_MIN || data.vncPort > VNC_PORT_MAX) {
            socket.emit('vnc:error', { message: `VNC port must be in range ${VNC_PORT_MIN}-${VNC_PORT_MAX}` });
            return;
          }

          // 校验 serverId 与 vncHost 的关联性
          if (data.serverId) {
            const server = serversRepo.getById(data.serverId);
            if (server && server.ip_address !== data.vncHost) {
              // serverId 对应的 IP 与 vncHost 不匹配，检查是否为注册的网络设备
              const device = networkDeviceRepository.getIdByIp(data.vncHost);
              if (!device) {
                logger.warn(`VNC connect rejected: serverId=${data.serverId} IP mismatch with vncHost=${data.vncHost}`);
                socket.emit('vnc:error', { message: 'VNC host does not match the specified server or any registered device' });
                return;
              }
            }
          }

          const sessionId = `${data.serverId}-${Date.now()}`;
          const session: VNCSession = {
            id: sessionId,
            serverId: data.serverId,
            vncHost: data.vncHost,
            vncPort: data.vncPort,
            vncSocket: null,
            clientSocketId: socket.id,
            createdAt: Date.now()
          };

          const vncSocket = net.connect({
            host: data.vncHost,
            port: data.vncPort
          });

          session.vncSocket = vncSocket;
          this.sessions.set(sessionId, session);

          vncSocket.on('connect', () => {
            logger.info(`Connected to VNC server ${data.vncHost}:${data.vncPort}`);
            socket.emit('vnc:connected', { sessionId });
          });

          vncSocket.on('data', (chunk) => {
            socket.emit('vnc:data', chunk);
          });

          vncSocket.on('error', (err) => {
            logger.error(`VNC connection error: ${err.message}`);
            socket.emit('vnc:error', { message: err.message });
          });

          vncSocket.on('close', () => {
            logger.info('VNC connection closed');
            socket.emit('vnc:closed');
            this.sessions.delete(sessionId);
          });

          socket.on('vnc:client-data', (chunk) => {
            if (vncSocket && !vncSocket.destroyed) {
              vncSocket.write(chunk);
            }
          });

          socket.on('vnc:disconnect', () => {
            if (vncSocket) {
              vncSocket.destroy();
            }
            this.sessions.delete(sessionId);
          });
        } catch (error) {
          logger.error('Failed to establish VNC connection:', error);
          socket.emit('vnc:error', { message: error instanceof Error ? error.message : 'Unknown error' });
        }
      });

      socket.on('disconnect', () => {
        logger.info(`VNC client disconnected: ${socket.id}`);
        for (const [id, session] of this.sessions) {
          if (session.clientSocketId === socket.id && session.vncSocket) {
            session.vncSocket.destroy();
            this.sessions.delete(id);
          }
        }
      });
    });
  }

  getSessionCount() {
    return this.sessions.size;
  }
}

export const vncProxyService = new VNCProxyService();
