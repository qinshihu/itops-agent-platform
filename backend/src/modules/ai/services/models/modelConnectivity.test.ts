/** Connectivity tests must support local providers without authentication. */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getById: vi.fn(),
  updateTestStatus: vi.fn(),
  getApiKey: vi.fn(),
  post: vi.fn(),
}));
vi.mock('../../../../repositories', () => ({
  aiModelRepository: { getById: mocks.getById, updateTestStatus: mocks.updateTestStatus },
  settingsRepository: {},
  agentRepository: {},
}));
vi.mock('../../../../utils/logger', () => ({ logger: { info: vi.fn() } }));
vi.mock('../../../../utils/apiConfig', () => ({
  getApiKey: mocks.getApiKey,
  getApiBase: (_key: string, fallback: string) => fallback,
  buildApiEndpoint: (base: string, endpoint: string) => `${base}/${endpoint}`,
}));
vi.mock('axios', () => ({ default: { post: mocks.post } }));

import { testModelConnectivity } from './aiModelService';

const model = {
  id: 'model-id',
  name: 'Local model',
  provider_type: 'local',
  api_key: undefined,
  api_base: 'http://example.invalid/v1',
  model_id: 'qwen2.5:7b',
  enabled: 1,
  is_default: 1,
  sort_order: 0,
  tags: null,
  created_at: '',
  updated_at: '',
};

describe('testModelConnectivity authentication', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getById.mockReturnValue({ ...model });
    mocks.getApiKey.mockReturnValue(undefined);
    mocks.post.mockReset();
    mocks.post.mockResolvedValue({ data: {} });
  });

  it('sends a local no-key connectivity request without Authorization', async () => {
    expect((await testModelConnectivity(model.id)).success).toBe(true);
    expect(mocks.post).toHaveBeenCalledTimes(1);
    const [url, body, options] = mocks.post.mock.calls[0];
    expect(url).toBe('http://example.invalid/v1/chat/completions');
    expect(body.model).toBe(model.model_id);
    expect(options.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(mocks.updateTestStatus).toHaveBeenCalledWith(model.id, 'success');
  });

  it('preserves a local model explicit API key', async () => {
    mocks.getById.mockReturnValue({ ...model, api_key: 'local-test-key' });
    expect((await testModelConnectivity(model.id)).success).toBe(true);
    expect(mocks.post.mock.calls[0][2].headers.Authorization).toBe('Bearer local-test-key');
  });

  it('preserves a local provider global API key', async () => {
    mocks.getApiKey.mockReturnValue('local-global-test-key');
    expect((await testModelConnectivity(model.id)).success).toBe(true);
    expect(mocks.getApiKey).toHaveBeenCalledWith('LOCAL_AI_API_KEY');
    expect(mocks.post.mock.calls[0][2].headers.Authorization).toBe('Bearer local-global-test-key');
  });

  it('rejects a remote model without a key before sending HTTP', async () => {
    mocks.getById.mockReturnValue({ ...model, provider_type: 'deepseek' });
    const result = await testModelConnectivity(model.id);
    expect(result.success).toBe(false);
    expect(result.message).toContain('API Key');
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('preserves a remote model explicit API key', async () => {
    mocks.getById.mockReturnValue({
      ...model,
      provider_type: 'deepseek',
      api_key: 'remote-test-key',
    });
    expect((await testModelConnectivity(model.id)).success).toBe(true);
    expect(mocks.post.mock.calls[0][2].headers.Authorization).toBe('Bearer remote-test-key');
  });

  it('preserves a remote provider global API key', async () => {
    mocks.getById.mockReturnValue({ ...model, provider_type: 'deepseek' });
    mocks.getApiKey.mockReturnValue('remote-global-test-key');
    expect((await testModelConnectivity(model.id)).success).toBe(true);
    expect(mocks.getApiKey).toHaveBeenCalledWith('DEEPSEEK_API_KEY');
    expect(mocks.post.mock.calls[0][2].headers.Authorization).toBe('Bearer remote-global-test-key');
  });

  it('records an actual no-key local connection failure', async () => {
    mocks.post.mockRejectedValue(new Error('connection refused'));
    const result = await testModelConnectivity(model.id);
    expect(result.success).toBe(false);
    expect(result.message).toContain('connection refused');
    expect(mocks.updateTestStatus).toHaveBeenCalledWith(model.id, 'failed');
  });

  it('rejects an unknown model', async () => {
    mocks.getById.mockReturnValue(undefined);
    await expect(testModelConnectivity('missing')).rejects.toThrow('Model not found');
    expect(mocks.post).not.toHaveBeenCalled();
  });
});
