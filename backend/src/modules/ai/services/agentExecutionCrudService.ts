/**
 * Agent Execution 路由层抽象（v3 报告 P1-5 第三批迁移）
 * 轻量：仅暴露 routes 实际使用的方法
 */
import { agentExecutionRepository } from '../../../repositories';

export const agentExecutionCrudService = {
  createExecution(data: Parameters<typeof agentExecutionRepository.create>[0]) {
    return agentExecutionRepository.create(data);
  },
};
