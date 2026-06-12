import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validatePassword } from './passwordPolicy';

describe('passwordPolicy', () => {
  describe('validatePassword', () => {
    it('should accept a valid password', () => {
      const result = validatePassword('TestPass123!');
      expect(result.valid).toBe(true);
    });

    it('should reject password shorter than 8 chars', () => {
      const result = validatePassword('Ab1!');
      expect(result.valid).toBe(false);
    });
  });
});
