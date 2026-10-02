/** Verify provider adapters consume one half-open slot per HTTP attempt. */
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
const response = { data: { choices: [{ message: { content: 'ok' } }] } };
const adapters = [
  { name: 'plain text', invoke: () => callLLMAPI(config, 'system', 'input', 'Agent', 0.7, '') },
  {
    name: 'tool calling',
    invoke: () => callLLMAPIWithTools(config, 'system', 'input', 'Agent', 0.7, ''),
  },
];

describe.each(adapters)('$name provider admission', ({ invoke }) => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    vi.clearAllMocks();
    mocks.post.mockReset();
    mocks.post.mockResolvedValue(response);
    circuitBreakers.clear();
  });

  afterEach(() => {
    circuitBreakers.clear();
    vi.useRealTimers();
  });

  function openBreaker() {
    const breaker = getCircuitBreaker(config.providerName);
    for (let i = 0; i < 5; i++) breaker.recordFailure();
    return breaker;
  }

  it('admits three concurrent recovery probes and rejects the fourth before HTTP', async () => {
    openBreaker();
    vi.advanceTimersByTime(60001);
    let release!: (value: typeof response) => void;
    // Use one shared deferred response so all three probes remain in flight.
    const pending = new Promise<typeof response>((resolve) => {
      release = resolve;
    });
    mocks.post.mockReturnValue(pending);
    const completions = Promise.allSettled([invoke(), invoke(), invoke()]);
    await expect(invoke()).rejects.toThrow(/Circuit breaker is OPEN/);
    release(response);
    const results = await completions;
    expect(mocks.post).toHaveBeenCalledTimes(3);
    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
  });

  it('rejects an OPEN breaker without sending HTTP', async () => {
    openBreaker();
    await expect(invoke()).rejects.toThrow(/Circuit breaker is OPEN/);
    expect(mocks.post).not.toHaveBeenCalled();
  });

  it('does not postpone recovery when rejecting a request on an OPEN breaker', async () => {
    openBreaker();
    vi.advanceTimersByTime(30000);
    await expect(invoke()).rejects.toThrow(/Circuit breaker is OPEN/);
    vi.advanceTimersByTime(30001);
    await invoke();
    expect(mocks.post).toHaveBeenCalledTimes(1);
  });

  it('closes the breaker after a successful recovery probe', async () => {
    const breaker = openBreaker();
    vi.advanceTimersByTime(60001);
    await invoke();
    expect(breaker.canCall()).toBe(true);
    await invoke();
    expect(mocks.post).toHaveBeenCalledTimes(2);
  });

  it('permits three recovery attempts before reopening on provider failure', async () => {
    const breaker = openBreaker();
    vi.advanceTimersByTime(60001);
    mocks.post.mockRejectedValue(new Error('provider offline'));
    const outcome = invoke().catch((error: unknown) => error);
    await vi.runAllTimersAsync();
    expect(await outcome).toBeInstanceOf(Error);
    expect(((await outcome) as Error).message).toMatch(/provider offline/);
    expect(mocks.post).toHaveBeenCalledTimes(3);
    expect(breaker.canCall()).toBe(false);
  });
});
