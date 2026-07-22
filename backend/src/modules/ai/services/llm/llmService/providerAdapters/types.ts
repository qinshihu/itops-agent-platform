/**
 * providerAdapters 类型定义（2026-07-21 拆分）
 *
 * 把原 providerAdapters.ts L93-150 的 5 个 interface + 2 个 local type 抽出
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

/** OpenAI function calling 的 parameters schema */
export type OpenAIFunctionParameters = Record<string, unknown>;

/** Agent 执行元数据 */
export type AgentExecutionMetadata = Record<string, unknown>;

/** 单条 chat 消息 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

/** OpenAI function calling 工具定义 */
export interface LLMTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: OpenAIFunctionParameters;
  };
}

/** LLM 返回的工具调用 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string; // JSON string
  };
}

/** LLM 响应（含工具调用） */
export interface LLMResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
}

/** 通用 Provider 配置接口 */
export interface LLMProviderConfig {
  providerName: string;
  apiKeySetting: string;
  apiKeyEnv: string;
  apiBaseSetting: string;
  apiBaseEnv: string;
  defaultApiBase: string;
  modelSetting: string;
  modelEnv: string;
  defaultModel: string;
  placeholderKey: string;
  /** 可选：直接提供的 API Key（来自 AIModel.api_key）— 优先于 settings/env */
  overrideApiKey?: string;
  /** 可选：直接提供的 API Base URL（来自 AIModel.api_base）— 优先于 settings/env */
  overrideApiBase?: string;
  /** 可选：直接提供的 Model ID（来自 AIModel.model_id）— 优先于 settings/env */
  overrideModel?: string;
}
