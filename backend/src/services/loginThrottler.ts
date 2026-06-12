import { db } from '../models/database';
import { logger } from '../utils/logger';
import { invalidateUserCache } from '../middleware/auth';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

export interface LoginAttemptResult {
  locked: boolean;
  lockoutUntil?: Date;
  remainingAttempts?: number;
}

export function checkLoginLockout(username: string): LoginAttemptResult {
  const user = db
    .prepare('SELECT id, failed_login_attempts, locked_until FROM users WHERE username = ?')
    .get(username) as { id: string; failed_login_attempts: number; locked_until: string | null } | undefined;

  if (!user) {
    return { locked: false };
  }

  if (user.locked_until) {
    const lockoutUntil = new Date(user.locked_until);
    if (lockoutUntil > new Date()) {
      return {
        locked: true,
        lockoutUntil,
        remainingAttempts: 0
      };
    }
    db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
  }

  const remainingAttempts = MAX_FAILED_ATTEMPTS - user.failed_login_attempts;
  return {
    locked: false,
    remainingAttempts: remainingAttempts > 0 ? remainingAttempts : 0
  };
}

export function recordFailedLogin(username: string): LoginAttemptResult {
  const user = db
    .prepare('SELECT id, failed_login_attempts FROM users WHERE username = ?')
    .get(username) as { id: string; failed_login_attempts: number } | undefined;

  if (!user) {
    return { locked: false };
  }

  const newAttempts = user.failed_login_attempts + 1;
  const now = new Date();

  if (newAttempts >= MAX_FAILED_ATTEMPTS) {
    const lockoutUntil = new Date(now.getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
    db.prepare(`
      UPDATE users 
      SET failed_login_attempts = ?, locked_until = ?, last_failed_login = ?, updated_at = datetime('now','localtime') 
      WHERE id = ?
    `).run(newAttempts, lockoutUntil.toISOString(), now.toISOString(), user.id);

    logger.warn(`User ${username} has been locked out due to too many failed login attempts`);

    invalidateUserCache(user.id);

    return {
      locked: true,
      lockoutUntil,
      remainingAttempts: 0
    };
  }

  db.prepare(`
    UPDATE users 
    SET failed_login_attempts = ?, last_failed_login = ?, updated_at = datetime('now','localtime') 
    WHERE id = ?
  `).run(newAttempts, now.toISOString(), user.id);

  return {
    locked: false,
    remainingAttempts: MAX_FAILED_ATTEMPTS - newAttempts
  };
}

export function resetFailedLoginAttempts(userId: string): void {
  db.prepare(`
    UPDATE users 
    SET failed_login_attempts = 0, locked_until = NULL, updated_at = datetime('now','localtime') 
    WHERE id = ?
  `).run(userId);

  invalidateUserCache(userId);
}
