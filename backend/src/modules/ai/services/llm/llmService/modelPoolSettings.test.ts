import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  getValue: vi.fn(),
  getCredential: vi.fn(),
}));

vi.mock('axios', () => ({ default: { post: mocks.post } }));
vi.mock('../../../../../repositories', () => ({
  settingsRepository: { getValue: mocks.getValue },
}));
vi.mock('../../../../../modules/auth/services/credentialService', () => ({
  credentialService: { getCredential: mocks.getCredential },
}));
vi.mock('../../../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('./providerAdapters/executionStats', () => ({ recordAgentExecution: vi.fn() }));
vi.mock('../../models/aiModelService', () => ({ getDefaultModel: vi.fn() }));

import type { AIModel } from '../../models/aiModelService';
import { circuitBreakers } from './circuitBreaker';
import { callModelWithConfig } from './providerAdapters/modelPool';
import { callModelWithConfigWithTools } from './toolCalling';

const localModel: AIModel = {
  id: 'local-model',
  name: 'Local model',
  provider_type: 'local',
  model_id: 'qwen2.5:7b',
  enabled: 1,
  sort_order: 0,
  is_default: 1,
  created_at: '',
  updated_at: '',
};
const settings = new Map<string, string>();
const adapters = [
  {
    name: 'plain text',
    invoke: (model: AIModel) => callModelWithConfig(model, 'system', 'input', 'Agent', 0.7, ''),
  },
  {
    name: 'tool calling',
    invoke: (model: AIModel) =>
      callModelWithConfigWithTools(model, 'system', 'input', 'Agent', 0.7, '', [
        { type: 'function', function: { name: 'status', description: 'Status', parameters: {} } },
      ]),
  },
];

beforeEach(() => {
  vi.resetAllMocks();
  settings.clear();
  circuitBreakers.clear();
  mocks.getValue.mockImplementation((key: string) => settings.get(key));
  mocks.post.mockResolvedValue({ data: { choices: [{ message: { content: 'ok' } }] } });
});

afterEach(() => circuitBreakers.clear());

describe.each(adapters)('$name model-pool settings', ({ invoke }) => {
  it('uses the configured local endpoint and encrypted local_ai credential', async () => {
    settings.set('LOCAL_AI_API_BASE', 'http://local-gateway.invalid:8000/v1/');
    mocks.getCredential.mockImplementation((provider: string) =>
      provider === 'local_ai' ? 'encrypted-local-key' : undefined,
    );

    await invoke(localModel);

    expect(mocks.post).toHaveBeenCalledWith(
      'http://local-gateway.invalid:8000/v1/chat/completions',
      expect.objectContaining({ model: 'qwen2.5:7b' }),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer encrypted-local-key' }),
      }),
    );
  });

  it('falls back to the local API key in settings when no encrypted credential exists', async () => {
    settings.set('LOCAL_AI_API_KEY', 'settings-local-key');
    await invoke(localModel);
    expect(mocks.post.mock.calls[0][2].headers.Authorization).toBe('Bearer settings-local-key');
  });

  it('keeps per-model endpoint and credential overrides ahead of global settings', async () => {
    settings.set('LOCAL_AI_API_BASE', 'http://global.invalid/v1');
    settings.set('LOCAL_AI_API_KEY', 'global-key');
    await invoke({
      ...localModel,
      api_base: 'http://override.invalid/v1',
      api_key: 'override-key',
    });
    expect(mocks.post.mock.calls[0][0]).toBe('http://override.invalid/v1/chat/completions');
    expect(mocks.post.mock.calls[0][2].headers.Authorization).toBe('Bearer override-key');
  });

  it('retains the default local endpoint when no base URL is configured', async () => {
    await invoke(localModel);
    expect(mocks.post.mock.calls[0][0]).toBe(
      'http://host.docker.internal:11434/v1/chat/completions',
    );
  });
});

it('still resolves remote provider settings and credentials', async () => {
  settings.set('OPENAI_API_BASE', 'https://openai-gateway.invalid/v1');
  mocks.getCredential.mockImplementation((provider: string) =>
    provider === 'openai' ? 'openai-key' : undefined,
  );
  await adapters[0].invoke({ ...localModel, provider_type: 'openai', model_id: 'gpt-4o' });
  expect(mocks.post.mock.calls[0][0]).toBe('https://openai-gateway.invalid/v1/chat/completions');
  expect(mocks.post.mock.calls[0][2].headers.Authorization).toBe('Bearer openai-key');
});
