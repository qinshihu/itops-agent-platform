/**
 * Docker Endpoint 路由层抽象（v3 报告 P1-5 第三批迁移）
 * 轻量：仅暴露 routes 实际使用的方法
 */
import { dockerEndpointRepository } from '../../../repositories';

export const dockerEndpointCrudService = {
  /**
   * 更新 endpoint 状态 + 错误信息
   */
  updateStatusAndError(id: string, status: string, lastError: string | null) {
    dockerEndpointRepository.updateStatusAndError(id, status, lastError);
  },
};
