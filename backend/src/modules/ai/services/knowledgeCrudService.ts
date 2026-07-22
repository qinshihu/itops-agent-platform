/**
 * Knowledge 路由层 CRUD 抽象（v3 报告 P1-5 第三批迁移）
 */
import { knowledgeRepository } from '../../../repositories';

export const knowledgeCrudService = {
  listKnowledge(filters: { category?: string; search?: string } = {}) {
    return knowledgeRepository.list(filters);
  },

  searchKnowledge(query: string) {
    return knowledgeRepository.search(query);
  },

  getKnowledgeById(id: string) {
    return knowledgeRepository.getById(id);
  },

  createKnowledge(input: Parameters<typeof knowledgeRepository.createFromRest>[0]) {
    return knowledgeRepository.createFromRest(input);
  },

  updateKnowledge(id: string, input: Parameters<typeof knowledgeRepository.updateFromRest>[1]) {
    return knowledgeRepository.updateFromRest(id, input);
  },

  deleteKnowledge(id: string) {
    knowledgeRepository.delete(id);
  },
};
