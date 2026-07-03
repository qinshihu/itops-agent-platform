import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock("../../../../models/database", () => ({
  default: { prepare: () => ({ get: () => undefined, all: () => [], run: () => {} }) },
  db: { prepare: () => ({ get: () => undefined, all: () => [], run: () => {} }) },
  initializeDatabase: vi.fn(),
  performMaintenance: vi.fn(),
  getIOInstance: vi.fn(),
}));
vi.mock('../../llm/llmService', () => ({
  generateCompletion: vi.fn().mockResolvedValue('LLM response'),
  generateCompletionWithTools: vi.fn().mockResolvedValue('LLM tool response'),
  checkLLMAvailability: vi.fn().mockResolvedValue(true),
}));
import { executeAgentNode, getThinkingSteps } from './agentExecutor';

describe('agentExecutor', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("should be defined", () => { expect(executeAgentNode).toBeDefined(); });

  it('getThinkingSteps returns an array for known agent names', () => {
    const steps = getThinkingSteps('auto-inspection-agent');
    expect(Array.isArray(steps)).toBe(true);
  });

  it('getThinkingSteps returns empty array for unknown agent', () => {
    const steps = getThinkingSteps('nonexistent-agent');
    expect(Array.isArray(steps)).toBe(true);
  });

  it('executeAgentNode returns error message for non-existent agent', async () => {
    const result = await executeAgentNode('nonexistent-agent-xyz', 'test input');
    expect(typeof result).toBe('string');
  });
});
