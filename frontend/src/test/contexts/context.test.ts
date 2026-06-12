import { describe, it, expect } from 'vitest';

describe('Auth Context', () => {
  it('should export AuthProvider', async () => {
    const mod = await import('../../contexts/AuthContext');
    expect(mod.AuthProvider).toBeDefined();
    expect(mod.useAuth).toBeDefined();
  });
});

describe('Theme Context', () => {
  it('should export ThemeProvider', async () => {
    const mod = await import('../../contexts/ThemeContext');
    expect(mod.ThemeProvider).toBeDefined();
  });
});

describe('Toast Context', () => {
  it('should export ToastProvider', async () => {
    const mod = await import('../../contexts/ToastContext');
    expect(mod.ToastProvider).toBeDefined();
    expect(mod.useToast).toBeDefined();
  });
});

describe('XSS Utilities', () => {
  it('should sanitize plain text correctly', async () => {
    const { sanitizeText } = await import('../../lib/xss');
    const result = sanitizeText('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
  });

  it('should sanitize HTML correctly', async () => {
    const { sanitizeHTML } = await import('../../lib/xss');
    const result = sanitizeHTML('<p><strong>bold</strong> <em>italic</em></p>');
    expect(result).toContain('bold');
    expect(result).toContain('italic');
  });

  it('should strip dangerous attributes', async () => {
    const { sanitizeHTML } = await import('../../lib/xss');
    const result = sanitizeHTML('<img src="x" onerror="alert(1)">');
    expect(result).not.toContain('onerror');
  });
});
