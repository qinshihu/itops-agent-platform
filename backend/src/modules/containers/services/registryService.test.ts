import { describe, it, expect, vi, beforeEach } from 'vitest';

// ==================== Mocks ====================
// All mock objects must be defined INLINE inside vi.mock factories
// because vi.mock calls are hoisted above const declarations.

vi.mock('../../../models/database', () => {
  const stmt = {
    all: vi.fn(),
    get: vi.fn(),
    run: vi.fn(),
  };
  return {
    default: {
      prepare: vi.fn(() => stmt),
    },
  };
});

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../utils/errorHelpers', () => ({
  getErrorMessage: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : String(err)
  ),
}));

vi.mock('../../auth/services/credentialService', () => ({
  credentialService: {
    encryptCredential: vi.fn((val: string) => ({
      encrypted: 'encrypted_' + val,
      iv: 'iv_' + val,
    })),
    decryptCredential: vi.fn((enc: string, _iv: string) =>
      enc.replace('encrypted_', '')
    ),
  },
}));

vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
  },
}));

import axios from 'axios';
// eslint-disable-next-line no-restricted-imports -- test file: vi.mock hoists above imports, must import db for mock verification
import db from '../../../models/database';
import { registryService } from './registryService';
import { credentialService } from '../../auth/services/credentialService';

// Helper to get the mock statement from db
// db.prepare is a vi.fn that returns the stmt object
function getMockStmt() {
  return db.prepare('') as unknown as { all: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn>; run: ReturnType<typeof vi.fn> };
}

// ==================== Helpers ====================

function createRegistryRow(overrides: Record<string, any> = {}) {
  return {
    id: 'reg-001',
    name: 'test-harbor',
    type: 'harbor',
    url: 'https://harbor.example.com',
    username: 'admin',
    encrypted_password: 'encrypted_secret',
    encrypted_password_iv: 'iv_secret',
    status: 'active',
    error_message: null,
    project_count: 5,
    repo_count: 20,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-01-02T00:00:00.000Z',
    ...overrides,
  };
}

function expectRegistryShape(registry: any) {
  expect(registry).toHaveProperty('id');
  expect(registry).toHaveProperty('name');
  expect(registry).toHaveProperty('type');
  expect(registry).toHaveProperty('url');
  expect(registry).toHaveProperty('status');
  expect(registry).toHaveProperty('createdAt');
  expect(registry).toHaveProperty('updatedAt');
}

// ==================== Tests ====================

describe('RegistryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock behavior
    const stmt = getMockStmt();
    if (stmt) {
      stmt.all.mockReturnValue([]);
      stmt.get.mockReturnValue(undefined);
      stmt.run.mockReturnValue({ changes: 1 });
    }
  });

  // ---- listRegistries() ----

  describe('listRegistries()', () => {
    it('should return mapped registries from database', () => {
      const stmt = getMockStmt();
      const row = createRegistryRow();
      stmt.all.mockReturnValue([row]);

      const result = registryService.listRegistries();

      expect(db.prepare).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM image_registries')
      );
      expect(result).toHaveLength(1);
      expectRegistryShape(result[0]);
      expect(result[0].name).toBe('test-harbor');
      expect(result[0].type).toBe('harbor');
      expect(result[0].url).toBe('https://harbor.example.com');
    });

    it('should return empty array when no registries exist', () => {
      const stmt = getMockStmt();
      stmt.all.mockReturnValue([]);

      const result = registryService.listRegistries();

      expect(result).toEqual([]);
    });
  });

  // ---- getRegistry() ----

  describe('getRegistry()', () => {
    it('should return a registry by id', () => {
      const stmt = getMockStmt();
      const row = createRegistryRow();
      stmt.get.mockReturnValue(row);

      const result = registryService.getRegistry('reg-001');

      expect(db.prepare).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = ?')
      );
      expect(result).not.toBeNull();
      expect(result!.id).toBe('reg-001');
      expect(result!.name).toBe('test-harbor');
    });

    it('should return null when registry not found', () => {
      const stmt = getMockStmt();
      stmt.get.mockReturnValue(undefined);

      const result = registryService.getRegistry('nonexistent');

      expect(result).toBeNull();
    });
  });

  // ---- addRegistry() ----

  describe('addRegistry()', () => {
    it('should create a new registry and return it', async () => {
      const stmt = getMockStmt();
      const row = createRegistryRow({ id: 'new-reg' });
      stmt.get.mockReturnValue(row); // for the final getRegistry call

      const result = await registryService.addRegistry({
        name: 'new-registry',
        type: 'dockerhub',
        url: 'https://hub.docker.com',
      });

      expect(stmt.run).toHaveBeenCalledWith(
        expect.any(String), // id (UUID)
        'new-registry',
        'dockerhub',
        'https://hub.docker.com',
        null,
        null,
        null,
        expect.any(String), // now
        expect.any(String), // now
      );
      expect(result).not.toBeNull();
      expect(result.name).toBe('test-harbor');
    });

    it('should encrypt password when provided', async () => {
      const stmt = getMockStmt();
      const row = createRegistryRow();
      stmt.get.mockReturnValue(row);

      await registryService.addRegistry({
        name: 'secure-registry',
        type: 'harbor',
        url: 'https://harbor.example.com',
        username: 'admin',
        password: 'secret123',
      });

      expect(credentialService.encryptCredential).toHaveBeenCalledWith('secret123');
      // Verify encrypted password was passed to db
      const runCall = stmt.run.mock.calls[0];
      expect(runCall[5]).toBe('encrypted_secret123');
      expect(runCall[6]).toBe('iv_secret123');
    });
  });

  // ---- updateRegistry() ----

  describe('updateRegistry()', () => {
    it('should update registry fields and return updated registry', async () => {
      const stmt = getMockStmt();
      const row = createRegistryRow();
      stmt.get.mockReturnValue(row); // for getRegistry check + final

      const result = await registryService.updateRegistry('reg-001', {
        name: 'updated-harbor',
        url: 'https://new-harbor.example.com',
      });

      expect(stmt.run).toHaveBeenCalled();
      expect(result).not.toBeNull();
    });

    it('should throw when registry does not exist', async () => {
      const stmt = getMockStmt();
      stmt.get.mockReturnValue(undefined);

      await expect(
        registryService.updateRegistry('nonexistent', { name: 'test' })
      ).rejects.toThrow('仓库不存在');
    });
  });

  // ---- deleteRegistry() ----

  describe('deleteRegistry()', () => {
    it('should delete registry from database', async () => {
      const stmt = getMockStmt();

      await registryService.deleteRegistry('reg-001');

      expect(db.prepare).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM image_registries')
      );
      expect(stmt.run).toHaveBeenCalledWith('reg-001');
    });
  });

  // ---- testConnection() ----

  describe('testConnection()', () => {
    it('should throw when registry does not exist', async () => {
      const stmt = getMockStmt();
      stmt.get.mockReturnValue(undefined);

      await expect(
        registryService.testConnection('nonexistent')
      ).rejects.toThrow('仓库不存在');
    });

    it('should test Harbor connection successfully', async () => {
      const stmt = getMockStmt();
      const row = createRegistryRow();
      stmt.get.mockReturnValue(row);
      vi.mocked(axios.get).mockResolvedValueOnce({ data: {} });

      const result = await registryService.testConnection('reg-001');

      expect(result.success).toBe(true);
      expect(result.message).toContain('Harbor 连接成功');
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/v2.0/health'),
        expect.objectContaining({ timeout: 10000 })
      );
    });

    it('should test DockerHub connection successfully', async () => {
      const stmt = getMockStmt();
      const row = createRegistryRow({ type: 'dockerhub' });
      stmt.get.mockReturnValue(row);
      vi.mocked(axios.get).mockResolvedValueOnce({ data: {} });

      const result = await registryService.testConnection('reg-001');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Docker Hub 连接成功');
      expect(axios.get).toHaveBeenCalledWith(
        'https://hub.docker.com/v2/',
        expect.objectContaining({ timeout: 10000 })
      );
    });

    it('should test ACR connection successfully', async () => {
      const stmt = getMockStmt();
      const row = createRegistryRow({ type: 'acr', url: 'https://acr.example.com' });
      stmt.get.mockReturnValue(row);
      vi.mocked(axios.get).mockResolvedValueOnce({ data: {} });

      const result = await registryService.testConnection('reg-001');

      expect(result.success).toBe(true);
      expect(result.message).toContain('ACR 连接成功');
    });

    it('should test generic registry connection successfully', async () => {
      const stmt = getMockStmt();
      const row = createRegistryRow({ type: 'generic', url: 'https://registry.example.com' });
      stmt.get.mockReturnValue(row);
      vi.mocked(axios.get).mockResolvedValueOnce({ data: {} });

      const result = await registryService.testConnection('reg-001');

      expect(result.success).toBe(true);
      expect(result.message).toContain('通用仓库连接成功');
    });

    it('should return failure on generic connection error', async () => {
      const stmt = getMockStmt();
      const row = createRegistryRow({ type: 'generic' });
      stmt.get.mockReturnValue(row);
      vi.mocked(axios.get).mockRejectedValueOnce(new Error('Network error'));

      const result = await registryService.testConnection('reg-001');

      expect(result.success).toBe(false);
      expect(result.message).toContain('无法连接到通用仓库');
    });

    it('should update status to error on Harbor connection failure', async () => {
      const stmt = getMockStmt();
      const row = createRegistryRow();
      stmt.get.mockReturnValue(row);
      vi.mocked(axios.get).mockRejectedValueOnce(new Error('Connection refused'));

      const result = await registryService.testConnection('reg-001');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Connection refused');
      // Should update the registry status to error
      expect(stmt.run).toHaveBeenCalledWith(
        'Connection refused',
        'reg-001'
      );
    });
  });

  // ---- listImages() ----

  describe('listImages()', () => {
    it('should throw when registry does not exist', async () => {
      const stmt = getMockStmt();
      stmt.get.mockReturnValue(undefined);

      await expect(
        registryService.listImages('nonexistent')
      ).rejects.toThrow('仓库不存在');
    });

    it('should return empty array for generic/unknown registry type', async () => {
      const stmt = getMockStmt();
      const row = createRegistryRow({ type: 'generic' });
      stmt.get.mockReturnValue(row);

      const result = await registryService.listImages('reg-001');

      expect(result).toEqual([]);
    });

    it('should list Harbor images with projects', async () => {
      const stmt = getMockStmt();
      const row = createRegistryRow();
      stmt.get.mockReturnValue(row);

      // Mock projects list
      vi.mocked(axios.get)
        .mockResolvedValueOnce({ data: [{ name: 'project-a' }, { name: 'project-b' }] })
        // Mock repositories for project-a
        .mockResolvedValueOnce({
          data: [{ name: 'project-a/app1' }],
        })
        // Mock artifacts for app1
        .mockResolvedValueOnce({
          data: [{
            tags: [{ name: 'latest' }],
            size: 12345,
            push_time: '2024-01-01',
            pull_count: 100,
          }],
        })
        // Mock repositories for project-b
        .mockResolvedValueOnce({
          data: [{ name: 'project-b/app2' }],
        })
        // Mock artifacts for app2
        .mockResolvedValueOnce({
          data: [{
            tags: [{ name: 'v1.0' }],
            size: 67890,
            push_time: '2024-02-01',
            pull_count: 50,
            scan_overview: { high: { total: 2 }, medium: { total: 1 } },
          }],
        });

      const result = await registryService.listImages('reg-001');

      expect(result.length).toBeGreaterThanOrEqual(1);
      for (const img of result) {
        expect(img).toHaveProperty('registryId', 'reg-001');
        expect(img).toHaveProperty('project');
        expect(img).toHaveProperty('repository');
        expect(img).toHaveProperty('tag');
        expect(img).toHaveProperty('size');
      }
    });

    it('should return empty array on error', async () => {
      const stmt = getMockStmt();
      const row = createRegistryRow();
      stmt.get.mockReturnValue(row);
      vi.mocked(axios.get).mockRejectedValueOnce(new Error('Network error'));

      const result = await registryService.listImages('reg-001');

      expect(result).toEqual([]);
    });
  });
});