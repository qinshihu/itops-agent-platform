import { logger } from '../../../utils/logger';
import { getDefaultModel } from '../../ai/services/models/aiModelService';
import { callLLMAPI, buildProviderConfig } from '../../ai/services/llm/llmService/providerAdapters';

// ── 类型定义 ──

export interface TerminalRound {
  input: string;
  output: string;
}

export interface AIAnalysisRequest {
  sessionId: string;
  rounds: TerminalRound[];
  triggeredBy: 'auto' | 'manual';
  errorDetected: boolean;
}

export interface AIAnalysisResult {
  suggestion: string;
  severity: 'info' | 'warning' | 'error';
  relatedCommands: string[];
}

// ── System Prompt ──

const SYSTEM_PROMPT = `你是一名资深 Linux 运维专家和 SRE 工程师。
用户在 Web 终端中执行命令，你的任务是分析终端输出并提供帮助。

规则：
1. 如果输出包含错误，解释错误原因并给出修复命令
2. 如果输出正常但可以优化，给出优化建议
3. 如果输出为空，建议下一步可能的操作
4. 每个建议附带 1-3 条可执行的命令
5. 回复格式必须为严格 JSON，不要有任何额外文字：
   {"suggestion":"...","severity":"info|warning|error","relatedCommands":["cmd1","cmd2"]}
6. 简洁直接，每条建议不超过 3 句话，不要用 markdown 格式
7. 用中文回复`;

// ── 错误检测正则（前端检测用，后端也保留一份以应对手动触发） ──

const ERROR_PATTERNS = [
  /error:/i,
  /EACCES/i,
  /ENOENT/i,
  /permission denied/i,
  /command not found/i,
  /connection refused/i,
  /no such file/i,
  /timeout/i,
  /timed out/i,
  /ETIMEDOUT/i,
  /killed/i,
  /out of memory/i,
  /segmentation fault/i,
  /fatal:/i,
  /cannot/i,
  /failed/i,
  /denied/i,
];

// ── 服务类 ──

export class TerminalAiService {
  private static readonly AI_TIMEOUT_MS = 15000;

  /**
   * 检测终端输出是否包含错误/异常
   */
  detectError(output: string): boolean {
    return ERROR_PATTERNS.some((pattern) => pattern.test(output));
  }

  /**
   * 构建 User Prompt
   */
  private buildPrompt(request: AIAnalysisRequest): string {
    const parts: string[] = [];

    if (request.rounds.length > 0) {
      parts.push('以下是最近几轮终端交互记录：');
      parts.push('---');

      for (let i = 0; i < request.rounds.length; i++) {
        const round = request.rounds[i];
        const isLast = i === request.rounds.length - 1;
        parts.push(`\n[第 ${i + 1} 轮]`);
        parts.push(`输入: ${round.input}`);
        parts.push(`输出: ${round.output || '(无输出)'}`);
        if (isLast && request.errorDetected) {
          parts.push('⚠️ 上一轮输出检测到错误/异常，请重点分析。');
        }
      }
      parts.push('---');
    }

    if (request.triggeredBy === 'manual') {
      parts.push('\n用户手动请求分析当前终端内容。');
    }

    parts.push('\n请根据以上终端交互记录，给出你的分析和建议。');

    return parts.join('\n');
  }

  /**
   * 兜底建议（AI 不可用时返回）
   */
  private fallbackSuggestion(request: AIAnalysisRequest): AIAnalysisResult {
    if (request.errorDetected) {
      return {
        suggestion: '检测到命令执行异常，建议检查命令语法、文件权限或网络连接。可以尝试查看详细日志定位问题。',
        severity: 'warning',
        relatedCommands: ['history | tail -20', 'echo $?', 'journalctl -xe --no-pager | tail -30'],
      };
    }
    return {
      suggestion: '当前终端运行正常。如需帮助，可以手动触发分析或输入具体命令。',
      severity: 'info',
      relatedCommands: ['df -h', 'free -h', 'top -bn1 | head -20'],
    };
  }

  /**
   * 分析终端内容并返回 AI 建议
   */
  async analyze(request: AIAnalysisRequest): Promise<AIAnalysisResult> {
    // 1. 获取默认模型
    const model = getDefaultModel();
    if (!model || !model.enabled) {
      logger.warn('[TerminalAI] No default AI model configured');
      return {
        suggestion: '请先在系统设置 → AI 模型中配置并启用一个默认 AI 模型。',
        severity: 'warning',
        relatedCommands: [],
      };
    }

    // 2. 构建 prompt
    const userPrompt = this.buildPrompt(request);

    logger.info(`[TerminalAI] Analyzing session ${request.sessionId}, rounds=${request.rounds.length}, trigger=${request.triggeredBy}`);

    try {
      // 3. 调用 AI（带超时）
      const config = buildProviderConfig(model);
      const aiResponse = await Promise.race([
        callLLMAPI(config, SYSTEM_PROMPT, userPrompt, 'TerminalAI', 0.3, 'terminal-ai-assistant'),
        new Promise<string>((_, reject) =>
          setTimeout(() => reject(new Error('AI 调用超时')), TerminalAiService.AI_TIMEOUT_MS)
        ),
      ]);

      // 4. 解析 JSON 响应
      return this.parseResponse(aiResponse, request);
    } catch (error) {
      logger.error('[TerminalAI] AI call failed:', error);
      return this.fallbackSuggestion(request);
    }
  }

  /**
   * 解析 AI 返回的 JSON
   */
  private parseResponse(raw: string, request: AIAnalysisRequest): AIAnalysisResult {
    try {
      // 尝试从响应中提取 JSON（AI 可能在 JSON 前后加文字）
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('[TerminalAI] No JSON found in response, using raw text');
        return {
          suggestion: raw.trim().substring(0, 500),
          severity: request.errorDetected ? 'warning' : 'info',
          relatedCommands: [],
        };
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        suggestion: String(parsed.suggestion || ''),
        severity: ['info', 'warning', 'error'].includes(parsed.severity)
          ? (parsed.severity as AIAnalysisResult['severity'])
          : 'info',
        relatedCommands: Array.isArray(parsed.relatedCommands)
          ? parsed.relatedCommands.slice(0, 3)
          : [],
      };
    } catch {
      logger.warn('[TerminalAI] Failed to parse AI response as JSON');
      return {
        suggestion: raw.trim().substring(0, 500),
        severity: request.errorDetected ? 'warning' : 'info',
        relatedCommands: [],
      };
    }
  }
}

export const terminalAiService = new TerminalAiService();
