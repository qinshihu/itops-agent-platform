import { userRepository } from '../../../repositories';
import { logger } from '../../../utils/logger';
import { invalidateUserCache } from '../../../middleware/auth';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

export interface LoginAttemptResult {
  locked: boolean;
  lockoutUntil?: Date;
  remainingAttempts?: number;
}

export function checkLoginLockout(username: string): LoginAttemptResult {
  const user = userRepository.getLockoutStatus(username);

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
    userRepository.clearLockout(user.id);
  }

  const remainingAttempts = MAX_FAILED_ATTEMPTS - user.failed_login_attempts;
  return {
    locked: false,
    remainingAttempts: remainingAttempts > 0 ? remainingAttempts : 0
  };
}

export function recordFailedLogin(username: string): LoginAttemptResult {
  const user = userRepository.getFailedAttempts(username);

  if (!user) {
    return { locked: false };
  }

  const newAttempts = user.failed_login_attempts + 1;
  const now = new Date();

  if (newAttempts >= MAX_FAILED_ATTEMPTS) {
    const lockoutUntil = new Date(now.getTime() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
    userRepository.recordFailedLoginWithLock(user.id, newAttempts, lockoutUntil.toISOString(), now.toISOString());

    logger.warn(`User ${username} has been locked out due to too many failed login attempts`);

    invalidateUserCache(user.id);

    return {
      locked: true,
      lockoutUntil,
      remainingAttempts: 0
    };
  }

  userRepository.recordFailedLogin(user.id, newAttempts, now.toISOString());

  return {
    locked: false,
    remainingAttempts: MAX_FAILED_ATTEMPTS - newAttempts
  };
}

export function resetFailedLoginAttempts(userId: string): void {
  userRepository.unlock(userId);

  invalidateUserCache(userId);
}
