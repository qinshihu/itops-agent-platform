import type { Client } from 'ssh2';
import { serversRepo } from '../../../../repositories/serverRepository';
import { withRetry, isRetryableError } from '../../../../utils/retry';
import { logger } from '../../../../utils/logger';
import { sshPool } from './sshConnectionPool';
import { logCommandHistory, updateLastConnected } from './sshHistoryRepository';
import { type CommandResult, type ServerInfo, DEFAULT_COMMAND_TIMEOUT } from './sshTypes';

export async function executeCommand(
  serverId: string,
  command: string,
  options: {
    timeout?: number;
    logHistory?: boolean;
    executedBy?: string;
  } = {}
): Promise<CommandResult> {
  const startTime = Date.now();
  const timeout = options.timeout || DEFAULT_COMMAND_TIMEOUT;
  const logHistory = options.logHistory !== false;
  let conn: Client | null = null;
  let connAcquired = false;

  const server = serversRepo.getById(serverId) as ServerInfo | undefined;
  if (!server) {
    const result: CommandResult = {
      success: false,
      stdout: '',
      stderr: 'Server not found',
      command,
      duration: Date.now() - startTime
    };
    if (logHistory) {
      logCommandHistory(serverId, command, result, options.executedBy || 'system');
    }
    return result;
  }

  try {
    conn = await sshPool.acquire(serverId);
    connAcquired = true;

    const result = await new Promise<CommandResult>((resolve, reject) => {
      let commandTimeout: NodeJS.Timeout | null = null;
      let isResolved = false;

      const safeResolve = (res: CommandResult) => {
        if (!isResolved) {
          isResolved = true;
          if (commandTimeout) clearTimeout(commandTimeout);
          resolve(res);
        }
      };

      try {
        conn!.exec(command, (err, stream) => {
          if (err) {
            safeResolve({
              success: false,
              stdout: '',
              stderr: err.message,
              command,
              duration: Date.now() - startTime
            });
            return;
          }

          const MAX_BUFFER_SIZE = 100 * 1024;
          const TRUNCATION_MARKER = '[Output truncated: exceeded 100KB limit]';
          let stdout = '';
          let stderr = '';
          let stdoutTruncated = false;
          let stderrTruncated = false;

          commandTimeout = setTimeout(() => {
            try { stream.destroy(); } catch { /* ignore */ }
            safeResolve({
              success: false,
              stdout: '',
              stderr: 'Command timeout',
              command,
              duration: Date.now() - startTime
            });
          }, timeout);

          stream.on('close', (code: number | null) => {
            safeResolve({
              success: code === 0,
              stdout,
              stderr,
              command,
              duration: Date.now() - startTime
            });
          }).on('data', (data: Buffer) => {
            if (!stdoutTruncated) {
              stdout += data.toString();
              if (stdout.length > MAX_BUFFER_SIZE) {
                stdout = stdout.substring(0, MAX_BUFFER_SIZE) + '\n' + TRUNCATION_MARKER;
                stdoutTruncated = true;
              }
            }
          }).stderr.on('data', (data: Buffer) => {
            if (!stderrTruncated) {
              stderr += data.toString();
              if (stderr.length > MAX_BUFFER_SIZE) {
                stderr = stderr.substring(0, MAX_BUFFER_SIZE) + '\n' + TRUNCATION_MARKER;
                stderrTruncated = true;
              }
            }
          }).on('error', (err) => {
            stderr += `Stream error: ${err.message}\n`;
          });
        });
      } catch (execError) {
        reject(execError);
      }
    });

    if (logHistory) {
      logCommandHistory(serverId, command, result, options.executedBy || 'system');
    }

    if (result.success) {
      updateLastConnected(serverId);
    }

    return result;
  } catch (error) {
    const result: CommandResult = {
      success: false,
      stdout: '',
      stderr: error instanceof Error ? error.message : 'Unknown error',
      command,
      duration: Date.now() - startTime
    };

    if (logHistory) {
      logCommandHistory(serverId, command, result, options.executedBy || 'system');
    }

    return result;
  } finally {
    if (connAcquired && conn) {
      sshPool.release(conn);
    }
  }
}

export async function testConnection(serverId: string): Promise<{ success: boolean; message: string }> {
  const result = await executeCommand(serverId, 'echo "Connection test successful"', { logHistory: false });
  return {
    success: result.success,
    message: result.success ? 'Connection successful' : result.stderr
  };
}

export async function executeCommandWithRetry(
  serverId: string,
  command: string,
  options: {
    timeout?: number;
    logHistory?: boolean;
    executedBy?: string;
    maxRetries?: number;
    initialDelayMs?: number;
  } = {}
): Promise<CommandResult> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 1000;

  return withRetry(
    () => executeCommand(serverId, command, options),
    {
      maxRetries,
      initialDelayMs,
      shouldRetry: (error: unknown) => {
        if (error instanceof Error && error.message.includes('No authentication method')) {
          return false;
        }
        return isRetryableError(error);
      },
      onRetry: (attempt: number, error: unknown, delayMs: number) => {
        logger.warn(
          `🔄 SSH command retry ${attempt}/${maxRetries} for server ${serverId}: ` +
          `${error instanceof Error ? error.message : String(error)}. ` +
          `Next attempt in ${delayMs}ms`
        );
      }
    }
  );
}

export async function testConnectionWithRetry(
  serverId: string,
  maxRetries = 2
): Promise<{ success: boolean; message: string }> {
  try {
    const result = await executeCommandWithRetry(
      serverId,
      'echo "Connection test successful"',
      {
        logHistory: false,
        maxRetries,
        initialDelayMs: 500
      }
    );
    return {
      success: result.success,
      message: result.success ? 'Connection successful' : result.stderr
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}