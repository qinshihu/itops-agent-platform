/**
 * 设置模块（settings）
 *
 * 职责：系统级 KV 配置 + AI Provider（豆包/OpenAI/Local AI）配置 + 预设 Agent 模型同步
 * 范围：原 infra/settingsRoutes.ts + infra/settingsCrudService.ts 拆分
 * 依赖：repositories（settingsRepository, agentRepository）、auth/credentialService
 * 阶段：P1-6 infra 拆分的子域 1（2026-07-07）
 */

export { default as routes } from './routes';
