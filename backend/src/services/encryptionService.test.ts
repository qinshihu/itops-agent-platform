import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from './encryptionService';
describe('encryptionService', () => {
  it('should export encrypt and decrypt functions', () => {
    expect(typeof encrypt).toBe('function');
    expect(typeof decrypt).toBe('function');
  });
});
