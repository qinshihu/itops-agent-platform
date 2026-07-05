import axios from 'axios';
import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger';
import { imageRegistryRepository } from '../../../../repositories';
import { credentialService } from '../../auth/services/credentialService';
import { getErrorMessage } from '../../../utils/errorHelpers';

interface RegistryConfig {
  id: string;
  name: string;
  type: 'harbor' | 'dockerhub' | 'acr' | 'generic';
  url: string;
  username?: string;
  encryptedPassword?: string;
  encryptedPasswordIV?: string;
  status: 'active' | 'inactive' | 'error';
  errorMessage?: string;
  projectCount?: number;
  repoCount?: number;
  createdAt: string;
  updatedAt: string;
}

interface RegistryImage {
  registryId: string;
  project: string;
  repository: string;
  tag: string;
  size: number;
  pushedAt: string;
  pullCount: number;
  vulnerabilities?: { severity: string; count: number }[];
}

interface RegistryRow {
  id: string;
  name: string;
  type: string;
  url: string;
  username?: string;
  encrypted_password?: string;
  encrypted_password_iv?: string;
  status: string;
  error_message?: string;
  project_count?: number;
  repo_count?: number;
  created_at: string;
  updated_at: string;
}

class RegistryService {
  constructor() {
    // 表结构由 migration v045 维护，本服务不再 ensureTables。
  }

  private decryptPassword(registry: RegistryRow): string {
    try {
      if (registry.encrypted_password && registry.encrypted_password_iv) {
        return credentialService.decryptCredential(registry.encrypted_password, registry.encrypted_password_iv);
      }
    } catch { /* ignore */ }
    return '';
  }

  private getAuthHeader(registry: RegistryRow): { username: string; password: string } | null {
    const password = this.decryptPassword(registry);
    if (registry.username && password) {
      return { username: registry.username, password };
    }
    return null;
  }

  /**
   * 获取原始数据库行（用于解密等操作，返回 snake_case 格式）
   */
  private getRegistryRow(registryId: string): RegistryRow | undefined {
    return imageRegistryRepository.getById(registryId) as RegistryRow | undefined;
  }

  listRegistries(): RegistryConfig[] {
    const rows = imageRegistryRepository.list();
    return rows.map((r) => ({
      id: r.id, name: r.name, type: r.type as RegistryConfig['type'], url: r.url,
      username: r.username ?? undefined, encryptedPassword: r.encrypted_password ?? undefined,
      encryptedPasswordIV: r.encrypted_password_iv ?? undefined,
      status: r.status as RegistryConfig['status'], errorMessage: r.error_message ?? undefined,
      projectCount: r.project_count, repoCount: r.repo_count,
      createdAt: r.created_at, updatedAt: r.updated_at,
    }));
  }

  getRegistry(registryId: string): RegistryConfig | null {
    const row = imageRegistryRepository.getById(registryId);
    if (!row) return null;
    return {
      id: row.id, name: row.name, type: row.type as RegistryConfig['type'], url: row.url,
      username: row.username ?? undefined, encryptedPassword: row.encrypted_password ?? undefined,
      encryptedPasswordIV: row.encrypted_password_iv ?? undefined,
      status: row.status as RegistryConfig['status'], errorMessage: row.error_message ?? undefined,
      projectCount: row.project_count, repoCount: row.repo_count,
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  async addRegistry(config: {
    name: string; type: string; url: string; username?: string; password?: string;
  }): Promise<RegistryConfig> {
    const id = randomUUID();

    let encryptedPassword = '';
    let encryptedPasswordIV = '';
    if (config.password) {
      const { encrypted, iv } = credentialService.encryptCredential(config.password);
      encryptedPassword = encrypted;
      encryptedPasswordIV = iv;
    }

    imageRegistryRepository.create({
      id,
      name: config.name,
      type: config.type as RegistryConfig['type'],
      url: config.url,
      username: config.username || null,
      encrypted_password: encryptedPassword || null,
      encrypted_password_iv: encryptedPasswordIV || null,
    });

    return this.getRegistry(id)!;
  }

  async deleteRegistry(registryId: string): Promise<void> {
    imageRegistryRepository.delete(registryId);
  }

  async updateRegistry(registryId: string, config: {
    name?: string; type?: string; url?: string; username?: string; password?: string;
  }): Promise<RegistryConfig | null> {
    const existing = this.getRegistry(registryId);
    if (!existing) throw new Error('仓库不存在');

    const fields: Record<string, unknown> = {};
    if (config.name !== undefined) fields.name = config.name;
    if (config.type !== undefined) fields.type = config.type;
    if (config.url !== undefined) fields.url = config.url;
    if (config.username !== undefined) fields.username = config.username;
    if (config.password !== undefined) fields.encrypted_password = config.password;

    if (Object.keys(fields).length > 0) {
      imageRegistryRepository.update(registryId, fields);
    }

    return this.getRegistry(registryId);
  }

  async testConnection(registryId: string): Promise<{ success: boolean; message: string }> {
    const registry = this.getRegistry(registryId);
    if (!registry) throw new Error('仓库不存在');

    try {
      const auth = this.getAuthHeader(this.getRegistryRow(registryId)!);

      switch (registry.type) {
        case 'harbor': {
          const url = registry.url.replace(/\/+$/, '') + '/api/v2.0/health';
          await axios.get(url, {
            auth: auth || undefined,
            timeout: 10000,
          });
          return { success: true, message: `Harbor 连接成功 (${registry.url})` };
        }
        case 'dockerhub': {
          const url = 'https://hub.docker.com/v2/';
          await axios.get(url, {
            auth: auth || undefined,
            timeout: 10000,
          });
          return { success: true, message: 'Docker Hub 连接成功' };
        }
        case 'acr': {
          const url = registry.url.replace(/\/+$/, '') + '/v2/';
          await axios.get(url, {
            auth: auth || undefined,
            timeout: 10000,
          });
          return { success: true, message: `ACR 连接成功 (${registry.url})` };
        }
        default: {
          try {
            const url = registry.url.replace(/\/+$/, '') + '/v2/';
            await axios.get(url, { timeout: 10000 });
            return { success: true, message: `通用仓库连接成功 (${registry.url})` };
          } catch {
            return { success: false, message: '无法连接到通用仓库' };
          }
        }
      }
    } catch (err: unknown) {
      imageRegistryRepository.updateStatus(registryId, 'error', getErrorMessage(err));
      return { success: false, message: getErrorMessage(err) };
    }
  }

  async listImages(registryId: string, project?: string): Promise<RegistryImage[]> {
    const registry = this.getRegistry(registryId);
    if (!registry) throw new Error('仓库不存在');

    try {
      const auth = this.getAuthHeader(this.getRegistryRow(registryId)!);

      switch (registry.type) {
        case 'harbor': {
          const baseUrl = registry.url.replace(/\/+$/, '') + '/api/v2.0';
          const projects = project ? [project] : await this.getHarborProjects(registry);

          const images: RegistryImage[] = [];
          for (const p of projects.slice(0, 10)) {
            try {
              const repos = await axios.get(`${baseUrl}/projects/${p}/repositories?page_size=50`, {
                auth: auth || undefined, timeout: 15000,
              });
              for (const repo of (repos.data || [])) {
                const artifacts = await axios.get(
                  `${baseUrl}/projects/${p}/repositories/${encodeURIComponent(repo.name.replace(`${p}/`, ''))}/artifacts?page_size=10`,
                  { auth: auth || undefined, timeout: 10000 }
                );
                for (const art of (artifacts.data || [])) {
                  for (const tag of (art.tags || [])) {
                    images.push({
                      registryId,
                      project: p,
                      repository: repo.name,
                      tag: tag.name,
                      size: art.size || 0,
                      pushedAt: art.push_time || '',
                      pullCount: art.pull_count || 0,
                      vulnerabilities: art.scan_overview ? Object.entries(art.scan_overview).map(([sev, info]) => ({
                        severity: sev, count: (info as Record<string, unknown>).total as number || 0,
                      })) : [],
                    });
                  }
                }
              }
            } catch (err: unknown) {
              logger.warn(`Failed to fetch Harbor project ${p}:`, getErrorMessage(err));
            }
          }
          return images;
        }
        case 'dockerhub': {
          const url = 'https://hub.docker.com/v2/repositories/' + (project || 'library');
          const resp = await axios.get(url + '?page_size=50', {
            auth: auth || undefined, timeout: 15000,
          });
          return (resp.data.results || []).map((r: Record<string, unknown>) => ({
            registryId,
            project: project || 'library',
            repository: r.name,
            tag: r.last_updated || 'latest',
            size: r.full_size || 0,
            pushedAt: r.last_updated || '',
            pullCount: r.pull_count || 0,
          }));
        }
        default: {
          return [];
        }
      }
    } catch (err: unknown) {
      logger.error('Failed to list registry images:', getErrorMessage(err));
      return [];
    }
  }

  private async getHarborProjects(registry: RegistryConfig): Promise<string[]> {
    try {
      const baseUrl = registry.url.replace(/\/+$/, '') + '/api/v2.0';
      const auth = this.getAuthHeader(this.getRegistryRow(registry.id)!);
      const resp = await axios.get(`${baseUrl}/projects?page_size=50`, {
        auth: auth || undefined, timeout: 10000,
      });
      return (resp.data || []).map((p: Record<string, unknown>) => p.name);
    } catch {
      return ['library'];
    }
  }
}

export const registryService = new RegistryService();
