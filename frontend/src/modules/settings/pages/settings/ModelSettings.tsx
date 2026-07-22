/**
 * 模型设置（AI 模型管理）
 *
 * 从原 infra/pages/settings/ModelSettings.tsx 抽离（2026-07-08 增量-12）。
 * 实际实现委托给 ai 模块的 AIModels 页面。
 */

import AIModels from '../../../ai/pages/ai-models';

export default function ModelSettings() {
  return <AIModels />;
}
