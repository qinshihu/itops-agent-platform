import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock axios
const mockAxiosInstance = {
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  defaults: {},
} as any;

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockAxiosInstance),
  },
}));

describe('API Module', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should create an axios instance', async () => {
    const axios = await import('axios');
    await import('../../lib/api');

    expect(axios.default.create).toHaveBeenCalled();
  });

  it('should have timeout set to 120000', async () => {
    const axios = await import('axios');
    await import('../../lib/api');

    const call = (axios.default.create as any).mock.calls[0][0];
    expect(call.timeout).toBe(120000);
  });

  it('should set Content-Type header', async () => {
    const axios = await import('axios');
    await import('../../lib/api');

    const call = (axios.default.create as any).mock.calls[0][0];
    expect(call.headers['Content-Type']).toBe('application/json');
  });
});
