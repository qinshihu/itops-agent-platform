/**
 * User 路由层 CRUD 抽象（v3 报告 P1-5 第三批迁移）
 *
 * 解决问题：路由层直访 Repository 违反 architecture.md §3.2。
 * 本 service 集中：
 *   1. 用户 CRUD（list/getByIdSafe/getById/getUsername/existsByUsername）
 *   2. 创建/更新/解锁/删除
 */
import { userRepository } from '../../../repositories';

export const userCrudService = {
  // ── 查询 ──

  listUsers() {
    return userRepository.list();
  },

  getUserByIdSafe(id: string) {
    return userRepository.getByIdSafe(id);
  },

  getUserById(id: string) {
    return userRepository.getById(id);
  },

  getUsername(id: string) {
    return userRepository.getUsername(id);
  },

  existsByUsername(username: string) {
    return userRepository.existsByUsername(username);
  },

  // ── 创建 ──

  createUser(input: Parameters<typeof userRepository.create>[0]) {
    return userRepository.create(input);
  },

  // ── 更新 ──

  updateUser(id: string, updates: Parameters<typeof userRepository.update>[1]) {
    userRepository.update(id, updates);
  },

  // ── 状态 ──

  unlockUser(id: string) {
    userRepository.unlock(id);
  },

  deleteUser(id: string) {
    userRepository.delete(id);
  },

  // ── 认证相关（供 authRoutes 使用）──

  getForAuth(username: string) {
    return userRepository.getForAuth(username);
  },

  getForWebSocket(id: string) {
    return userRepository.getForWebSocket(id);
  },

  getProfile(id: string) {
    return userRepository.getProfile(id);
  },

  touchLogin(id: string) {
    userRepository.touchLogin(id);
  },

  updatePassword(id: string, hashedPassword: string) {
    userRepository.updatePassword(id, hashedPassword);
  },
};
