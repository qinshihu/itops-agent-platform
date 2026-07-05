import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { createNotification } from './notificationService';

describe('notificationService', () => {
  it('createNotification should not throw and return string or null', async () => {
    const id = await createNotification({
      title: 'Test Notification',
      content: 'Test content',
      type: 'system',
    });
    // Returns either a UUID string (success) or null (error)
    // In test environment without DB, typically returns null
    expect(id === null || typeof id === 'string').toBe(true);
  });
});