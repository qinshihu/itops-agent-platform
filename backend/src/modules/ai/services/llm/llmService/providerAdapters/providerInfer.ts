/**
 * providerAdapters Provider 推断子模块（2026-07-21 拆分）
 *
 * 把原 providerAdapters.ts L473-529 的 getProviderForModel 抽出
 * 根据 model ID 关键词推断属于哪个 API 提供商（用于向后兼容路由）
 *
 * 拆分原则遵循 architecture.md §3.3.1 + 第 3 条「向后兼容的 import 路径」
 */

import type { ProviderName } from './availability';

/** 判断模型属于哪个API提供商（用于向后兼容） */
export function getProviderForModel(modelId: string): ProviderName {
  if (!modelId) return 'local';

  // 火山引擎关键词
  const volcengineKeywords = ['doubao', 'volcengine', 'ark'];
  for (const keyword of volcengineKeywords) {
    if (modelId.toLowerCase().includes(keyword)) {
      return 'volcengine';
    }
  }

  // DeepSeek 关键词
  const deepseekKeywords = ['deepseek'];
  for (const keyword of deepseekKeywords) {
    if (modelId.toLowerCase().includes(keyword)) {
      return 'deepseek';
    }
  }

  // 阿里云关键词
  const aliyunKeywords = ['qwen', '通义'];
  for (const keyword of aliyunKeywords) {
    if (modelId.toLowerCase().includes(keyword)) {
      return 'aliyun';
    }
  }

  // 智谱关键词
  const zhipuKeywords = ['glm-', 'chatglm'];
  for (const keyword of zhipuKeywords) {
    if (modelId.toLowerCase().includes(keyword)) {
      return 'zhipu';
    }
  }

  // OpenAI 关键词
  const openaiKeywords = ['gpt', 'dall-e', 'text-', 'o1', 'o3'];
  for (const keyword of openaiKeywords) {
    if (modelId.toLowerCase().includes(keyword)) {
      return 'openai';
    }
  }

  // 其他开源模型关键词
  const localKeywords = [
    'llama', 'mistral', 'yi', 'baichuan',
    'phi', 'gemma', 'falcon', 'vicuna', 'zephyr',
    'wizardlm', 'openhermes', 'neural', 'tinyllama', 'stablelm', 'orca',
  ];
  for (const keyword of localKeywords) {
    if (modelId.toLowerCase().includes(keyword)) {
      return 'local';
    }
  }

  return 'local'; // 未识别的模型默认尝试本地
}
