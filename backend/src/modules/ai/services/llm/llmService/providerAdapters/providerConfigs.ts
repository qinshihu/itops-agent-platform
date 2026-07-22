/**
 * providerAdapters 三个内置 Provider 配置常量（2026-07-21 拆分）
 *
 * 把原 providerAdapters.ts L154-191 的 DOUBAO/OPENAI/LOCAL_AI_CONFIG 抽出
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import type { LLMProviderConfig } from './types';

/** 火山引擎豆包（doubao-4o / volcengine-ark） */
export const DOUBAO_CONFIG: LLMProviderConfig = {
  providerName: 'Doubao',
  apiKeySetting: 'DOUBAO_API_KEY',
  apiKeyEnv: 'DOUBAO_API_KEY',
  apiBaseSetting: 'DOUBAO_API_BASE',
  apiBaseEnv: 'DOUBAO_API_BASE',
  defaultApiBase: 'https://ark.cn-beijing.volces.com/api/v3',
  modelSetting: 'DOUBAO_MODEL',
  modelEnv: 'DOUBAO_MODEL',
  defaultModel: 'doubao-4o',
  placeholderKey: 'your-doubao-api-key-here',
};

/** OpenAI（gpt-4o / gpt-3.5-turbo 等） */
export const OPENAI_CONFIG: LLMProviderConfig = {
  providerName: 'OpenAI',
  apiKeySetting: 'OPENAI_API_KEY',
  apiKeyEnv: 'OPENAI_API_KEY',
  apiBaseSetting: 'OPENAI_API_BASE',
  apiBaseEnv: 'OPENAI_API_BASE',
  defaultApiBase: 'https://api.openai.com/v1',
  modelSetting: 'OPENAI_MODEL',
  modelEnv: 'OPENAI_MODEL',
  defaultModel: 'gpt-4o',
  placeholderKey: 'your-openai-api-key-here',
};

/** LocalAI（Ollama / LocalAI 等本地部署） */
export const LOCAL_AI_CONFIG: LLMProviderConfig = {
  providerName: 'LocalAI',
  apiKeySetting: 'LOCAL_AI_API_KEY',
  apiKeyEnv: 'LOCAL_AI_API_KEY',
  apiBaseSetting: 'LOCAL_AI_API_BASE',
  apiBaseEnv: 'LOCAL_AI_API_BASE',
  defaultApiBase: 'http://host.docker.internal:11434/v1', // Ollama 默认地址
  modelSetting: 'LOCAL_AI_MODEL',
  modelEnv: 'LOCAL_AI_MODEL',
  defaultModel: 'qwen2.5:7b', // Ollama 默认模型
  placeholderKey: '', // 本地模型通常不需要 API Key
};
