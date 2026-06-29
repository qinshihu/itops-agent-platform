import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock("../../../shared/utils/logger.ts", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }));
import { MultiAgentOrchestrator } from './multiAgentCollaboration.ts';

describe('multiAgentCollaboration', () => {
  it("should have MultiAgentOrchestrator class", () => {
    expect(MultiAgentOrchestrator).toBeDefined();
  });
  it("should instantiate with defaults", () => {
    const instance = new MultiAgentOrchestrator({ provider: 'doubao', model: 'doubao-1.5-pro' });
    expect(instance).toBeDefined();
  });
});
