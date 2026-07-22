/* eslint-disable @typescript-eslint/no-explicit-any */
import { exec } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { logger } from '../../../utils/logger';
import { composeProjectsRepo } from '../../../repositories/configRepository';
import fs from 'fs';
import path from 'path';
import { getErrorMessage } from '../../../utils/errorHelpers';

const execAsync = promisify(exec);

interface ComposeProject {
  id: string;
  name: string;
  description?: string;
  composeContent: string;
  status: 'running' | 'stopped' | 'error' | 'deploying';
  serviceCount: number;
  runningCount: number;
  workingDir?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

interface ComposeServiceInfo {
  name: string;
  image: string;
  status: string;
  ports: string;
}

class ComposeService {
  private composeDataDir: string;

  constructor() {
    this.composeDataDir = process.env.COMPOSE_DATA_DIR || path.join(process.cwd(), 'data', 'compose');
    if (!fs.existsSync(this.composeDataDir)) {
      fs.mkdirSync(this.composeDataDir, { recursive: true });
    }
    // 表结构由 migration v044 维护，本服务不再 ensureTables。
  }

  /**
   * 列出所有 Compose 项目
   */
  listProjects(): ComposeProject[] {
    const rows = composeProjectsRepo.listAll();
    return rows.map(r => ({
      id: r.id, name: r.name, description: r.description ?? undefined,
      composeContent: r.compose_content,
      status: r.status as ComposeProject['status'], serviceCount: r.service_count,
      runningCount: r.running_count, workingDir: r.working_dir ?? undefined,
      tags: r.tags ? JSON.parse(r.tags) : [],
      createdAt: r.created_at, updatedAt: r.updated_at,
    }));
  }

  /**
   * 获取项目详情
   */
  getProject(projectId: string): ComposeProject | null {
    const row = composeProjectsRepo.getById(projectId);
    if (!row) return null;
    return {
      id: row.id, name: row.name, description: row.description ?? undefined,
      composeContent: row.compose_content,
      status: row.status as ComposeProject['status'], serviceCount: row.service_count,
      runningCount: row.running_count, workingDir: row.working_dir ?? undefined,
      tags: row.tags ? JSON.parse(row.tags) : [],
      createdAt: row.created_at, updatedAt: row.updated_at,
    };
  }

  /**
   * 创建/保存 Compose 项目
   */
  createProject(name: string, composeContent: string, description?: string, tags?: string[]): ComposeProject {
    const id = randomUUID();
    const _now = new Date().toISOString();

    const projectDir = path.join(this.composeDataDir, id);
    fs.mkdirSync(projectDir, { recursive: true });
    fs.writeFileSync(path.join(projectDir, 'docker-compose.yml'), composeContent);

    composeProjectsRepo.create({
      id,
      name,
      description: description || '',
      compose_content: composeContent,
      working_dir: projectDir,
      tags: JSON.stringify(tags || []),
    });

    return this.getProject(id)!;
  }

  /**
   * 更新 Compose 项目
   */
  updateProject(projectId: string, updates: Partial<Pick<ComposeProject, 'name' | 'description' | 'composeContent' | 'tags'>>): ComposeProject {
    const existing = this.getProject(projectId);
    if (!existing) throw new Error('项目不存在');

    if (updates.composeContent) {
      const projectDir = existing.workingDir || path.join(this.composeDataDir, projectId);
      fs.mkdirSync(projectDir, { recursive: true });
      fs.writeFileSync(path.join(projectDir, 'docker-compose.yml'), updates.composeContent);
    }

    const now = new Date().toISOString();
    composeProjectsRepo.updateNamesAndContent(projectId, {
      name: updates.name || existing.name,
      description: updates.description !== undefined ? (updates.description ?? null) : (existing.description ?? null),
      compose_content: updates.composeContent || existing.composeContent,
      tags: updates.tags ? JSON.stringify(updates.tags) : JSON.stringify(existing.tags || []),
      updated_at: now,
    });

    return this.getProject(projectId)!;
  }

  /**
   * 删除 Compose 项目
   */
  async deleteProject(projectId: string): Promise<void> {
    const project = this.getProject(projectId);
    if (!project) throw new Error('项目不存在');

    if (project.status === 'running') {
      try { await this.downProject(projectId); } catch { /* ignore */ }
    }

    if (project.workingDir && fs.existsSync(project.workingDir)) {
      fs.rmSync(project.workingDir, { recursive: true, force: true });
    }

    composeProjectsRepo.delete(projectId);
  }

  /**
   * docker compose up -d
   */
  async upProject(projectId: string): Promise<string> {
    const project = this.getProject(projectId);
    if (!project) throw new Error('项目不存在');

    composeProjectsRepo.setDeploying(projectId);

    try {
      const { stdout, stderr } = await execAsync('docker compose up -d', {
        cwd: project.workingDir || this.composeDataDir,
        timeout: 120000,
      });

      await this.refreshStatus(projectId);
      return stdout || stderr;
    } catch (err: unknown) {
      composeProjectsRepo.setError(projectId);
      throw new Error((err as { stderr?: string }).stderr || getErrorMessage(err));
    }
  }

  /**
   * docker compose down
   */
  async downProject(projectId: string): Promise<string> {
    const project = this.getProject(projectId);
    if (!project) throw new Error('项目不存在');

    try {
      const { stdout, stderr } = await execAsync('docker compose down', {
        cwd: project.workingDir || this.composeDataDir,
        timeout: 60000,
      });
      composeProjectsRepo.setStopped(projectId);
      return stdout || stderr;
    } catch (err: unknown) {
      throw new Error((err as { stderr?: string }).stderr || getErrorMessage(err));
    }
  }

  /**
   * docker compose restart
   */
  async restartProject(projectId: string): Promise<string> {
    const project = this.getProject(projectId);
    if (!project) throw new Error('项目不存在');

    try {
      const { stdout, stderr } = await execAsync('docker compose restart', {
        cwd: project.workingDir || this.composeDataDir,
        timeout: 60000,
      });
      await this.refreshStatus(projectId);
      return stdout || stderr;
    } catch (err: unknown) {
      throw new Error((err as { stderr?: string }).stderr || getErrorMessage(err));
    }
  }

  /**
   * docker compose ps
   */
  async listServices(projectId: string): Promise<ComposeServiceInfo[]> {
    const project = this.getProject(projectId);
    if (!project) throw new Error('项目不存在');

    try {
      const { stdout } = await execAsync('docker compose ps --format json', {
        cwd: project.workingDir || this.composeDataDir,
        timeout: 10000,
      });

      if (!stdout.trim()) return [];

      return stdout.trim().split('\n').map(line => {
        const s = JSON.parse(line);
        return {
          name: s.Name || s.Service,
          image: s.Image || '',
          status: s.State || 'unknown',
          ports: s.Ports || '',
        };
      });
    } catch {
      return [];
    }
  }

  /**
   * docker compose logs
   */
  async getLogs(projectId: string, tail = 100): Promise<string> {
    const project = this.getProject(projectId);
    if (!project) throw new Error('项目不存在');

    try {
      const { stdout } = await execAsync(`docker compose logs --tail=${tail} --no-color`, {
        cwd: project.workingDir || this.composeDataDir,
        timeout: 15000,
      });
      return stdout;
    } catch (err: unknown) {
      return (err as { stdout?: string }).stdout || (err as { stderr?: string }).stderr || '';
    }
  }

  /**
   * 验证 docker-compose.yml 语法
   */
  async validate(content: string): Promise<{ valid: boolean; errors: string[] }> {
    const tempDir = path.join(this.composeDataDir, '_validate');
    try {
      fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(path.join(tempDir, 'docker-compose.yml'), content);

      await execAsync('docker compose config --quiet', { cwd: tempDir, timeout: 10000 });
      return { valid: true, errors: [] };
    } catch (err: unknown) {
      return { valid: false, errors: [(err as { stderr?: string }).stderr || getErrorMessage(err) || '未知错误'] };
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  /**
   * 刷新项目状态
   */
  async refreshStatus(projectId: string): Promise<void> {
    try {
      const services = await this.listServices(projectId);
      const runningCount = services.filter(s => s.status.toLowerCase().includes('up')).length;

      composeProjectsRepo.updateStatus(projectId, runningCount > 0 ? 'running' : 'stopped', services.length, runningCount);
    } catch (err) {
      logger.error('Failed to refresh compose status:', err);
    }
  }
}

export const composeService = new ComposeService();
