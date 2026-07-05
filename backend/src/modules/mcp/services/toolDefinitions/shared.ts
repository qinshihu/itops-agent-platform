import {
  RiskLevel,
  type ToolCallResult,
  type ToolOutput,
} from '../types';

export function textResult(text: string, isError = false): ToolCallResult {
  return {
    content: [{ type: 'text', text }],
    isError,
  };
}

export function jsonResult(data: unknown, summary?: string): ToolCallResult {
  return {
    content: [
      {
        type: 'text',
        text: summary
          ? `${summary}\n\n\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``
          : `\`\`\`json\n${JSON.stringify(data, null, 2)}\n\`\`\``,
      },
    ],
    structuredContent: data as ToolOutput,
    isError: false,
  };
}

export const READONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  riskLevel: RiskLevel.READONLY,
  requiresApproval: false,
} as const;

export const LOW_RISK = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: true,
  riskLevel: RiskLevel.LOW,
  requiresApproval: false,
} as const;

export const REQUIRES_APPROVAL = {
  readOnlyHint: false,
  destructiveHint: true,
  idempotentHint: false,
  riskLevel: RiskLevel.MEDIUM,
  requiresApproval: true,
} as const;
