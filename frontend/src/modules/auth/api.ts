/**
 * Auth 模块 API 服务层
 * 封装所有认证与用户管理相关端点的调用
 */

import api from '@/lib/api';

// ============================================================
// 类型定义
// ============================================================

// ── 认证 ──

/** 登录用户信息（与 AuthContext 中的 User 一致） */
export interface AuthUser {
  id: string;
  username: string;
  role: string;
  email: string;
  passwordMustChange?: boolean;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: AuthUser;
  refreshToken: string;
}

export interface RefreshResult {
  token: string;
  refreshToken: string;
}

export interface ChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

// ── 用户管理 ──

/** 用户管理记录（Users 页面） */
export interface UserRecord {
  id: string;
  username: string;
  email: string | null;
  role: string;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  email?: string;
  role: string;
  enabled?: boolean;
}

export interface UpdateUserInput {
  username?: string;
  password?: string;
  email?: string;
  role?: string;
  enabled?: boolean;
}

// ============================================================
// authApi 对象
// ============================================================

export const authApi = {
  // ── 认证 ──

  /** 登录 */
  async login(input: LoginInput): Promise<LoginResult> {
    const { data } = await api.post('/api/auth/login', input);
    return data;
  },

  /** 登出 */
  async logout(): Promise<void> {
    await api.post('/api/auth/logout');
  },

  /** 刷新令牌 */
  async refresh(refreshToken: string): Promise<RefreshResult> {
    const { data } = await api.post('/api/auth/refresh', { refreshToken });
    return data;
  },

  /** 获取当前登录用户 */
  async getCurrentUser(): Promise<AuthUser> {
    const { data } = await api.get('/api/auth/me');
    return data;
  },

  /** 修改密码 */
  async changePassword(input: ChangePasswordInput): Promise<void> {
    await api.post('/api/auth/change-password', input);
  },

  // ── 用户管理 ──

  /** 获取用户列表 */
  async listUsers(): Promise<UserRecord[]> {
    const { data } = await api.get('/api/users');
    return data;
  },

  /** 创建用户 */
  async createUser(input: CreateUserInput): Promise<UserRecord> {
    const { data } = await api.post('/api/users', input);
    return data;
  },

  /** 更新用户 */
  async updateUser(id: string, input: UpdateUserInput): Promise<UserRecord> {
    const { data } = await api.put(`/api/users/${id}`, input);
    return data;
  },

  /** 删除用户 */
  async deleteUser(id: string): Promise<void> {
    await api.delete(`/api/users/${id}`);
  },
};

export default authApi;
