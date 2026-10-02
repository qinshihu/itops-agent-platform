/** Caller cancellation must not count as a provider outage. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ post: vi.fn(), recordAgentExecution: vi.fn() }));
vi.mock('axios', () => ({ default: { post: mocks.post } }));
vi.mock('../../../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../../../../utils/apiConfig', () => ({
  getApiKey: vi.fn(),
  getApiBase: (_key: string, fallback: string) => fallback,
  getModelId: (_key: string, fallback: string) => fallback,
  buildApiEndpoint: (base: string, endpoint: string) => `${base}/${endpoint}`,
}));
vi.mock('./providerAdapters/executionStats', () => ({
  recordAgentExecution: mocks.recordAgentExecution,
}));
vi.mock('./providerAdapters', () => ({
  DOUBAO_CONFIG: {},
  OPENAI_CONFIG: {},
  recordAgentExecution: mocks.recordAgentExecution,
  buildProviderConfig: vi.fn(),
}));
vi.mock('../../models/aiModelService', () => ({ getDefaultModel: vi.fn() }));

import { circuitBreakers, getCircuitBreaker } from './circuitBreaker';
import { callLLMAPI } from './providerAdapters/providerDispatch';
import type { LLMProviderConfig } from './providerAdapters/types';
import { callLLMAPIWithTools } from './toolCalling';

const config: LLMProviderConfig = {
  providerName: 'OpenAI',
  apiKeySetting: 'OPENAI_API_KEY',
  apiKeyEnv: 'OPENAI_API_KEY',
  apiBaseSetting: 'OPENAI_API_BASE',
  apiBaseEnv: 'OPENAI_API_BASE',
  defaultApiBase: 'https://example.invalid/v1',
  modelSetting: 'OPENAI_MODEL',
  modelEnv: 'OPENAI_MODEL',
  defaultModel: 'test-model',
  placeholderKey: 'placeholder',
  overrideApiKey: 'test-key',
};
const adapters = [
  {
    name: 'plain text',
    invoke: (signal?: AbortSignal) =>
      callLLMAPI(config, 'system', 'input', 'Agent', 0.7, '', signal),
  },
  {
    name: 'tool calling',
    invoke: (signal?: AbortSignal) =>
      callLLMAPIWithTools(config, 'system', 'input', 'Agent', 0.7, '', undefined, signal),
  },
];
function axiosCancellation() {
  const error = new Error('request canceled');
  error.name = 'CanceledError';
  return error;
}

describe.each(adapters)('$name cancellation accounting', ({ invoke }) => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mocks.post.mockReset();
    circuitBreakers.clear();
  });
  afterEach(() => {
    circuitBreakers.clear();
    vi.useRealTimers();
  });

  it('does not open the breaker after five pre-aborted calls without HTTP', async () => {
    const controller = new AbortController();
    controller.abort();
    for (let i = 0; i < 5; i++) {
      await expect(invoke(controller.signal)).rejects.toThrow(/cancelled by deadline signal/);
    }
    expect(mocks.post).not.toHaveBeenCalled();
    expect(getCircuitBreaker(config.providerName).canCall()).toBe(true);
  });

  it('does not retry or count in-flight signal cancellation as provider failure', async () => {
    for (let i = 0; i < 5; i++) {
      const controller = new AbortController();
      mocks.post.mockImplementation(async () => {
        controller.abort();
        throw axiosCancellation();
      });
      await expect(invoke(controller.signal)).rejects.toThrow(/cancelled by deadline signal/);
    }
    expect(mocks.post).toHaveBeenCalledTimes(5);
    expect(getCircuitBreaker(config.providerName).canCall()).toBe(true);
  });

  it('does not count Axios cancellation without an external signal', async () => {
    mocks.post.mockRejectedValue(axiosCancellation());
    for (let i = 0; i < 5; i++) {
      await expect(invoke()).rejects.toThrow(/cancelled by deadline signal/);
    }
    expect(mocks.post).toHaveBeenCalledTimes(5);
    expect(getCircuitBreaker(config.providerName).canCall()).toBe(true);
  });

  it('still opens the breaker after five actual provider failures', async () => {
    mocks.post.mockRejectedValue(new Error('provider offline'));
    for (let i = 0; i < 5; i++) {
      const outcome = invoke().catch((error: unknown) => error);
      await vi.runAllTimersAsync();
      expect(((await outcome) as Error).message).toMatch(/provider offline/);
    }
    expect(mocks.post).toHaveBeenCalledTimes(15);
    expect(getCircuitBreaker(config.providerName).canCall()).toBe(false);
  });

  it('preserves prior provider failures while ignoring a cancellation', async () => {
    const breaker = getCircuitBreaker(config.providerName);
    for (let i = 0; i < 4; i++) breaker.recordFailure();
    const controller = new AbortController();
    controller.abort();
    await expect(invoke(controller.signal)).rejects.toThrow(/cancelled by deadline signal/);
    expect(breaker.canCall()).toBe(true);
    mocks.post.mockRejectedValue(new Error('provider offline'));
    const outcome = invoke().catch((error: unknown) => error);
    await vi.runAllTimersAsync();
    expect(((await outcome) as Error).message).toMatch(/provider offline/);
    expect(breaker.canCall()).toBe(false);
  });
});
