/**
 * providerAdapters 桶导出（2026-07-21 拆分后重构）
 *
 * 拆分动机：原 providerAdapters.ts 585 行混合了：
 *   - URL 安全白名单 (P0-5)
 *   - 5 个 interface + 3 个 CONFIG
 *   - recordAgentExecution + updateAgentStats 统计
 *   - callLLMAPI 核心 dispatch
 *   - 3 个 convenience API (Doubao/OpenAI/LocalAI)
 *   - 模型池调度 buildProviderConfig/callModelWithConfig
 *   - Provider 推断 + 可用性检查
 *
 * 拆分后行为：
 *   - 7 个子文件按职责分离（见 providerAdapters/）
 *   - 保留 3 个 convenience API（callDoubaoAPI/callOpenAIAPI/callLocalAIAPI）
 *   - `from './providerAdapters'` 仍 100% 兼容（含内部 symbols）
 *   - 上层零改动（外部 consumer 全部桶兼容）
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import { callLLMAPI } from './providerAdapters/providerDispatch';
import { DOUBAO_CONFIG, OPENAI_CONFIG, LOCAL_AI_CONFIG } from './providerAdapters/providerConfigs';

// 重新导出所有 symbols（桶兼容）
export * from './providerAdapters/index';

/** 调用豆包 API 获取响应 */
export async function callDoubaoAPI(
  systemPrompt: string,
  userInput: string,
  agentName = 'Agent',
  temperature = 0.7,
  agentId = '',
  signal?: AbortSignal,
): Promise<string> {
  return callLLMAPI(DOUBAO_CONFIG, systemPrompt, userInput, agentName, temperature, agentId, signal);
}

/** 调用 OpenAI API 获取响应 */
export async function callOpenAIAPI(
  systemPrompt: string,
  userInput: string,
  agentName = 'Agent',
  temperature = 0.7,
  agentId = '',
  signal?: AbortSignal,
): Promise<string> {
  return callLLMAPI(OPENAI_CONFIG, systemPrompt, userInput, agentName, temperature, agentId, signal);
}

/** 调用本地 AI 大模型获取响应 */
export async function callLocalAIAPI(
  systemPrompt: string,
  userInput: string,
  agentName = 'Agent',
  temperature = 0.7,
  agentId = '',
  signal?: AbortSignal,
): Promise<string> {
  return callLLMAPI(LOCAL_AI_CONFIG, systemPrompt, userInput, agentName, temperature, agentId, signal);
}
