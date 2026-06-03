import { Client, ClientChannel } from 'ssh2';
import db from '../models/database';
import { decrypt } from './encryptionService';
import { logger } from '../utils/logger';
import { checkCommandSafety } from '../middleware/commandFilter';

export interface TerminalSession {
  id: string;
  serverId: string;
  conn: Client;
  shell: ClientChannel;
  createdAt: Date;
}

const activeSessions = new Map<string, TerminalSession>();
const SESSION_TTL_MS = 30 * 60 * 1000;
const SESSION_MAX_COUNT = 100;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  let cleaned = 0;
  
  if (activeSessions.size > SESSION_MAX_COUNT) {
    const entries = Array.from(activeSessions.entries())
      .sort((a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime());
    
    const toRemove = entries.slice(0, activeSessions.size - SESSION_MAX_COUNT);
    for (const [id, session] of toRemove) {
      try { session.shell.end(); } catch { /* ignore */ }
      try { session.conn.end(); } catch { /* ignore */ }
      activeSessions.delete(id);
      cleaned++;
    }
  }
  
  for (const [id, session] of activeSessions.entries()) {
    if (now - session.createdAt.getTime() > SESSION_TTL_MS) {
      try { session.shell.end(); } catch { /* ignore */ }
      try { session.conn.end(); } catch { /* ignore */ }
      activeSessions.delete(id);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    logger.info(`Cleaned up ${cleaned} expired/orphan terminal sessions, ${activeSessions.size} remaining`);
  }
}, CLEANUP_INTERVAL_MS);
cleanupTimer.unref();

interface ServerInfo {
  id: string;
  name: string;
  hostname: string;
  port: number;
  username: string;
  password: string | null;
  private_key: string | null;
  ssh_key_id: string | null;
  use_ssh_key: number;
  enabled?: number;
}

export class TerminalService {
  private static readonly CONNECT_TIMEOUT = 15000;
  private static readonly KEEPALIVE_INTERVAL = 10000;
  private static readonly KEEPALIVE_MAX = 3;

  async createTerminalSession(
    serverId: string,
    cols: number,
    rows: number
  ): Promise<{ sessionId: string; shell: ClientChannel; error?: string }> {
    const server = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId) as ServerInfo | undefined;

    if (!server) {
      return { sessionId: '', shell: null as unknown as ClientChannel, error: 'Server not found' };
    }

    if (!server.enabled) {
      return { sessionId: '', shell: null as unknown as ClientChannel, error: 'Server is disabled' };
    }

    let decryptedPassword = server.password ? decrypt(server.password) : undefined;
    let decryptedPrivateKey = server.private_key ? decrypt(server.private_key) : undefined;
    let decryptedPassphrase: string | undefined;

    // 优先使用 ssh_key_id 从认证凭证表获取认证信息
    if (server.ssh_key_id) {
      const sshKey = db.prepare('SELECT auth_type, private_key, passphrase, username, password FROM ssh_keys WHERE id = ?').get(server.ssh_key_id) as { auth_type: string; private_key: string; passphrase?: string; username?: string; password?: string } | undefined;
      if (sshKey) {
        try {
          if (sshKey.auth_type === 'password') {
            // 密码类型：使用凭证表中的用户名和密码
            if (sshKey.password) {
              decryptedPassword = decrypt(sshKey.password);
            }
            if (sshKey.username) {
              server.username = sshKey.username;
            }
          } else {
            // SSH 密钥类型
            decryptedPrivateKey = decrypt(sshKey.private_key);
            if (sshKey.passphrase) {
              decryptedPassphrase = decrypt(sshKey.passphrase);
            }
          }
        } catch (error) {
          return { sessionId: '', shell: null as unknown as ClientChannel, error: `Failed to decrypt SSH credential: ${(error as Error).message}` };
        }
      }
    }

    return new Promise((resolve) => {
      const conn = new Client();
      let isResolved = false;

      const safeResolve = (result: { sessionId: string; shell: ClientChannel; error?: string }) => {
        if (!isResolved) {
          isResolved = true;
          resolve(result);
        }
      };

      conn.on('ready', () => {
        conn.shell(
          { term: 'xterm-256color', cols, rows },
          (err, stream) => {
            if (err) {
              try {
                conn.end();
              } catch {
                /* ignore */
              }
              safeResolve({ sessionId: '', shell: null as unknown as ClientChannel, error: `Failed to open shell: ${err.message}` });
              return;
            }

            const sessionId = `${serverId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

            stream.on('close', () => {
              activeSessions.delete(sessionId);
              try {
                conn.end();
              } catch {
                /* ignore */
              }
              logger.info(`Terminal session ${sessionId} closed for server ${server.name}`);
            });

            stream.on('error', (streamErr: Error) => {
              logger.error(`Terminal stream error for session ${sessionId}:`, streamErr);
              activeSessions.delete(sessionId);
              try {
                conn.end();
              } catch {
                /* ignore */
              }
            });

            activeSessions.set(sessionId, {
              id: sessionId,
              serverId,
              conn,
              shell: stream,
              createdAt: new Date()
            });

            logger.info(`Terminal session ${sessionId} created for server ${server.name}`);
            safeResolve({ sessionId, shell: stream });
          }
        );
      });

      conn.on('error', (err) => {
        try {
          conn.end();
        } catch {
          /* ignore */
        }
        safeResolve({ sessionId: '', shell: null as unknown as ClientChannel, error: `SSH connection error: ${err.message}` });
      });

      conn.on('timeout', () => {
        try {
          conn.end();
        } catch {
          /* ignore */
        }
        safeResolve({ sessionId: '', shell: null as unknown as ClientChannel, error: 'SSH connection timeout' });
      });

      const connectConfig: Record<string, unknown> = {
        host: server.hostname,
        port: server.port || 22,
        username: server.username,
        readyTimeout: TerminalService.CONNECT_TIMEOUT,
        keepaliveInterval: TerminalService.KEEPALIVE_INTERVAL,
        keepaliveCountMax: TerminalService.KEEPALIVE_MAX,
        maxTries: 1
      };

      if (server.use_ssh_key && decryptedPrivateKey) {
        connectConfig.privateKey = decryptedPrivateKey;
        if (decryptedPassphrase) {
          connectConfig.passphrase = decryptedPassphrase;
        }
      } else if (decryptedPassword) {
        connectConfig.password = decryptedPassword;
      } else {
        safeResolve({ sessionId: '', shell: null as unknown as ClientChannel, error: 'No authentication method configured' });
        return;
      }

      conn.connect(connectConfig);
    });
  }

  getShell(sessionId: string): ClientChannel | undefined {
    const session = activeSessions.get(sessionId);
    return session?.shell;
  }

  closeTerminalSession(sessionId: string): boolean {
    const session = activeSessions.get(sessionId);
    if (!session) {
      return false;
    }

    try {
      session.shell.end();
    } catch {
      /* ignore */
    }

    try {
      session.conn.end();
    } catch {
      /* ignore */
    }

    activeSessions.delete(sessionId);
    logger.info(`Terminal session ${sessionId} manually closed`);
    return true;
  }

  resizeTerminal(sessionId: string, cols: number, rows: number): boolean {
    const session = activeSessions.get(sessionId);
    if (!session) {
      return false;
    }

    try {
      session.shell.setWindow(rows, cols, 0, 0);
      return true;
    } catch {
      return false;
    }
  }

  sendData(sessionId: string, data: string, userRole?: string): { success: boolean; reason?: string } {
    const session = activeSessions.get(sessionId);
    if (!session) {
      return { success: false, reason: 'Session not found' };
    }

    if (userRole) {
      const safetyCheck = checkCommandSafety(data, userRole);
      if (!safetyCheck.allowed) {
        logger.warn(`Terminal command blocked for user role ${userRole}: ${data.substring(0, 100)}`);
        session.shell.write(`\r\n\x1b[31m[安全拦截] ${safetyCheck.reason}\x1b[0m\r\n`);
        return { success: false, reason: safetyCheck.reason };
      }
      if (safetyCheck.severity === 'warning') {
        logger.info(`Terminal command warning for user role ${userRole}: ${data.substring(0, 100)}`);
        session.shell.write(`\r\n\x1b[33m[安全警告] ${safetyCheck.reason}\x1b[0m\r\n`);
      }
    }

    try {
      session.shell.write(data);
      return { success: true };
    } catch {
      return { success: false, reason: 'Failed to send data' };
    }
  }

  getActiveSessionCount(): number {
    return activeSessions.size;
  }
}

export const terminalService = new TerminalService();
