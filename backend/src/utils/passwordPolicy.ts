export interface PasswordValidationResult {
  valid: boolean;
  message: string;
  details?: {
    minLength: boolean;
    uppercase: boolean;
    lowercase: boolean;
    number: boolean;
    special: boolean;
  };
}

export function validatePassword(password: string): PasswordValidationResult {
  const details = {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()\-_=+[\]{}|;:,.<>?]/.test(password)
  };

  const allValid = Object.values(details).every(Boolean);

  if (allValid) {
    return { valid: true, message: '密码符合要求', details };
  }

  const missing: string[] = [];
  if (!details.minLength) missing.push('至少8位');
  if (!details.uppercase) missing.push('大写字母');
  if (!details.lowercase) missing.push('小写字母');
  if (!details.number) missing.push('数字');
  if (!details.special) missing.push('特殊字符(!@#$%^&*...)');

  return {
    valid: false,
    message: `密码复杂度不足，需要包含：${missing.join('、')}`,
    details
  };
}
