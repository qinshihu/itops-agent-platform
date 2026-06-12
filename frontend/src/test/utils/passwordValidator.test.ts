import { describe, it, expect } from 'vitest';

describe('Password Validator', () => {
  it('should validate minimum length', async () => {
    const { validatePassword } = await import('../../utils/passwordValidator');
    const result = validatePassword('Ab1!');
    expect(result.valid).toBe(false);
    expect(result.details.minLength).toBe(false);
  });

  it('should require uppercase letter', async () => {
    const { validatePassword } = await import('../../utils/passwordValidator');
    const result = validatePassword('abcdef1!@');
    expect(result.valid).toBe(false);
    expect(result.details.uppercase).toBe(false);
  });

  it('should require lowercase letter', async () => {
    const { validatePassword } = await import('../../utils/passwordValidator');
    const result = validatePassword('ABCDEF1!@');
    expect(result.valid).toBe(false);
    expect(result.details.lowercase).toBe(false);
  });

  it('should require a number', async () => {
    const { validatePassword } = await import('../../utils/passwordValidator');
    const result = validatePassword('Abcdefg!@');
    expect(result.valid).toBe(false);
    expect(result.details.number).toBe(false);
  });

  it('should require special character', async () => {
    const { validatePassword } = await import('../../utils/passwordValidator');
    const result = validatePassword('Abcdefg1');
    expect(result.valid).toBe(false);
    expect(result.details.special).toBe(false);
  });

  it('should accept a valid password', async () => {
    const { validatePassword } = await import('../../utils/passwordValidator');
    const result = validatePassword('Abcdefg1!@');
    expect(result.valid).toBe(true);
    expect(result.details.minLength).toBe(true);
    expect(result.details.uppercase).toBe(true);
    expect(result.details.lowercase).toBe(true);
    expect(result.details.number).toBe(true);
    expect(result.details.special).toBe(true);
  });

  it('should return correct password strength', async () => {
    const { getPasswordStrength } = await import('../../utils/passwordValidator');
    const weak = getPasswordStrength('12345678');
    expect(weak.score).toBeLessThan(3);

    const strong = getPasswordStrength('Abcdefg1!@#');
    expect(strong.score).toBeGreaterThanOrEqual(3);
    expect(strong.label).toBeTruthy();
  });
});
