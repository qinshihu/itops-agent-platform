import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getAgent: vi.fn(),
  complete: vi.fn(),
  getTool: vi.fn(),
  executeLegacy: vi.fn(),
  executeMcp: vi.fn(),
}));

vi.mock('../../../../repositories', () => ({
  agentRepository: { getNamePrompt: mocks.getAgent },
}));
vi.mock('../../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../llm/llmService', () => ({
  generateCompletionWithTools: mocks.complete,
  executeAgentWithLLM: vi.fn(),
}));
vi.mock('./agentToolRegistry', () => ({
  agentToolRegistry: { getTool: mocks.getTool },
}));
vi.mock('./agentMcpAdapter', () => ({
  agentMcpAdapter: {
    toOpenAITools: () =>
      ['ssh-exec', 'alert.list'].map((name) => ({
        type: 'function',
        function: { name, description: name, parameters: {} },
      })),
    executeTool: mocks.executeMcp,
  },
}));
vi.mock('./serverCommandAgent', () => ({ executeServerCommandAgent: vi.fn() }));
vi.mock('./inspectionAgent', () => ({ executeAutoInspectionAgent: vi.fn() }));
vi.mock('./databaseAdminAgent', () => ({ executeDatabaseAdminAgent: vi.fn() }));

import { executeAgentNode, extractToolCallFromResponse } from './agentCore';

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('tool call name parsing', () => {
  it.each(['ssh-exec', 'alert.list', 'server.list', 'get_status'])(
    'preserves the complete tool name %s',
    (toolId) => {
      expect(extractToolCallFromResponse(`[TOOL_CALL] ${toolId}: {"limit":5}`)).toEqual({
        hasToolCall: true,
        toolId,
        args: { limit: 5 },
      });
    },
  );

  it('accepts whitespace and nested arguments around a dotted tool name', () => {
    expect(
      extractToolCallFromResponse(
        '[TOOL_CALL]\n  alert.list :\n {"filter":{"severity":"critical"}}',
      ),
    ).toEqual({
      hasToolCall: true,
      toolId: 'alert.list',
      args: { filter: { severity: 'critical' } },
    });
  });

  it('does not execute a call with malformed JSON', () => {
    expect(extractToolCallFromResponse('[TOOL_CALL] alert.list: {"limit":}')).toEqual({
      hasToolCall: false,
    });
  });

  it('leaves an ordinary response without the tool-call marker alone', () => {
    expect(extractToolCallFromResponse('alert.list returned five alerts.')).toEqual({
      hasToolCall: false,
    });
  });
});

describe('Agent tool execution loop', () => {
  it.each([
    { toolId: 'ssh-exec', legacy: true },
    { toolId: 'alert.list', legacy: false },
  ])('executes $toolId from a native tool call before continuing', async ({ toolId, legacy }) => {
    mocks.getAgent.mockReturnValue({ id: 'agent', name: 'Test Agent', system_prompt: 'Diagnose' });
    mocks.getTool.mockReturnValue(legacy ? { execute: mocks.executeLegacy } : undefined);
    mocks.executeLegacy.mockResolvedValue('tool output');
    mocks.executeMcp.mockResolvedValue({ success: true, toolId, result: 'tool output' });
    mocks.complete
      .mockResolvedValueOnce({
        content: '',
        toolCalls: [
          { id: 'call_1', type: 'function', function: { name: toolId, arguments: '{"limit":5}' } },
        ],
      })
      .mockResolvedValueOnce({ content: 'Diagnosis complete' });

    await expect(executeAgentNode('agent', 'Diagnose this incident')).resolves.toBe(
      'Diagnosis complete',
    );
    expect(mocks.complete).toHaveBeenCalledTimes(2);
    expect(mocks.complete.mock.calls[1][1]).toContain('tool output');
    if (legacy) {
      expect(mocks.getTool).toHaveBeenCalledWith('ssh-exec');
      expect(mocks.executeLegacy).toHaveBeenCalledWith({ limit: 5 });
      expect(mocks.executeMcp).not.toHaveBeenCalled();
    } else {
      expect(mocks.executeMcp).toHaveBeenCalledWith('alert.list', { limit: 5 });
      expect(mocks.executeLegacy).not.toHaveBeenCalled();
    }
  });
});
