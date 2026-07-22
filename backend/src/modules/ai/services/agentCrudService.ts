/**
 * Agent 路由层 CRUD 抽象（v3 报告 P1-5 第三批迁移）
 *
 * 解决问题：路由层直访 Repository 违反 architecture.md §3.2。
 * 本 service 集中：
 *   1. Agent CRUD（list/getByIdWithModels/getById/getNameRoleCategory/create/update/delete）
 *   2. Agent 统计（countAll/countEnabled/countPreset/countByCategory）
 *   3. Agent 行为（incrementUsageStats）
 *   4. Agent Execution（listByAgent/countByAgent/countAll/create）
 */
import { agentRepository, agentExecutionRepository } from '../../../repositories';

export const agentCrudService = {
  // ── Agent 查询 ──

  listAgents(filters: Parameters<typeof agentRepository.list>[0]) {
    return agentRepository.list(filters);
  },

  getAgentByIdWithModels(id: string) {
    return agentRepository.getByIdWithModels(id);
  },

  getAgentById(id: string) {
    return agentRepository.getById(id);
  },

  getAgentNameRoleCategory(id: string) {
    return agentRepository.getNameRoleCategory(id);
  },

  // ── Agent 统计 ──

  countAllAgents() {
    return agentRepository.countAll();
  },

  countEnabledAgents() {
    return agentRepository.countEnabled();
  },

  countPresetAgents() {
    return agentRepository.countPreset();
  },

  countAgentsByCategory() {
    return agentRepository.countByCategory();
  },

  // ── Agent 写 ──

  createAgent(data: Parameters<typeof agentRepository.create>[0]) {
    return agentRepository.create(data);
  },

  updateAgent(id: string, data: Parameters<typeof agentRepository.update>[1]) {
    return agentRepository.update(id, data);
  },

  deleteAgent(id: string) {
    agentRepository.delete(id);
  },

  incrementUsageStats(id: string) {
    agentRepository.incrementUsageStats(id);
  },

  // ── Agent Execution ──

  countAllExecutions() {
    return agentExecutionRepository.countAll();
  },

  listExecutionsByAgent(agentId: string, filters: Parameters<typeof agentExecutionRepository.listByAgent>[1]) {
    return agentExecutionRepository.listByAgent(agentId, filters);
  },

  countExecutionsByAgent(agentId: string, status?: string) {
    return agentExecutionRepository.countByAgent(agentId, status);
  },

  createExecution(data: Parameters<typeof agentExecutionRepository.create>[0]) {
    return agentExecutionRepository.create(data);
  },
};
