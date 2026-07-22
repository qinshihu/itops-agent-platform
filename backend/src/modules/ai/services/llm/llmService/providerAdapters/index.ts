/**
 * providerAdapters 子模块 barrel export（2026-07-21 拆分）
 *
 * 上层调用：`from './providerAdapters'` 仍兼容（providerAdapters.ts 是 re-export）
 * 拆分后行为：
 * - 6 个子模块按职责分离（types/providerConfigs/executionStats/
 *   providerDispatch/modelPool/availability/providerInfer）
 * - 上层 import 路径不变
 */

// Types
export type {
  OpenAIFunctionParameters,
  AgentExecutionMetadata,
  ChatMessage,
  LLMTool,
  ToolCall,
  LLMResponse,
  LLMProviderConfig,
} from './types';

// Provider 配置常量
export { DOUBAO_CONFIG, OPENAI_CONFIG, LOCAL_AI_CONFIG } from './providerConfigs';

// 统计
export { recordAgentExecution, updateAgentStats } from './executionStats';

// 核心 dispatch
export { callLLMAPI } from './providerDispatch';

// 模型池
export { buildProviderConfig, callModelWithConfig } from './modelPool';

// 可用性 + Provider 推断
export { checkLLMAvailability } from './availability';
export type { ProviderName, AvailabilityResult } from './availability';
export { getProviderForModel } from './providerInfer';
