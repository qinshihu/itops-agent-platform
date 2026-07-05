import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ==================== Mocks ====================

const mockContainerInstance = {
  start: vi.fn(),
  stop: vi.fn(),
  restart: vi.fn(),
  remove: vi.fn(),
  inspect: vi.fn(),
  logs: vi.fn(),
  stats: vi.fn(),
  pause: vi.fn(),
  unpause: vi.fn(),
};

const mockImageInstance = {
  remove: vi.fn(),
  inspect: vi.fn(),
};

const mockVolumeInstance = {
  remove: vi.fn(),
  inspect: vi.fn(),
};

const mockNetworkInstance = {
  remove: vi.fn(),
  inspect: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
};

const mockDockerInstance = {
  ping: vi.fn(),
  listContainers: vi.fn(),
  getContainer: vi.fn().mockReturnValue(mockContainerInstance),
  listImages: vi.fn(),
  getImage: vi.fn().mockReturnValue(mockImageInstance),
  pull: vi.fn(),
  listVolumes: vi.fn(),
  createVolume: vi.fn(),
  getVolume: vi.fn().mockReturnValue(mockVolumeInstance),
  listNetworks: vi.fn(),
  createNetwork: vi.fn(),
  getNetwork: vi.fn().mockReturnValue(mockNetworkInstance),
  info: vi.fn(),
  version: vi.fn(),
  modem: {
    followProgress: vi.fn(),
  },
};

vi.mock('dockerode', () => ({
  default: vi.fn(() => mockDockerInstance),
}));

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ==================== Dynamic import to get fresh singleton ====================

async function getDockerService() {
  // Reset all mocks and re-import to get a fresh singleton instance
  vi.resetModules();
  // Re-apply module-level mock factory
  vi.doMock('dockerode', () => ({
    default: vi.fn(() => mockDockerInstance),
  }));
  const mod = await import('./dockerService');
  return mod.dockerService;
}

// ==================== Tests ====================

describe('DockerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- init() ----

  describe('init()', () => {
    it('should return true and set initialized on successful ping', async () => {
      mockDockerInstance.ping.mockResolvedValueOnce(undefined);
      const dockerService = await getDockerService();

      const result = await dockerService.init();

      expect(result).toBe(true);
      expect(mockDockerInstance.ping).toHaveBeenCalledOnce();
      expect(dockerService.isAvailable()).toBe(true);
    });

    it('should return false and set initialized to false on ping failure', async () => {
      mockDockerInstance.ping.mockRejectedValueOnce(new Error('connection refused'));
      const dockerService = await getDockerService();

      const result = await dockerService.init();

      expect(result).toBe(false);
      expect(mockDockerInstance.ping).toHaveBeenCalledOnce();
      expect(dockerService.isAvailable()).toBe(false);
    });
  });

  // ---- isAvailable() ----

  describe('isAvailable()', () => {
    it('should return false when not initialized', async () => {
      const dockerService = await getDockerService();
      expect(dockerService.isAvailable()).toBe(false);
    });

    it('should return true after successful init', async () => {
      mockDockerInstance.ping.mockResolvedValueOnce(undefined);
      const dockerService = await getDockerService();
      await dockerService.init();
      expect(dockerService.isAvailable()).toBe(true);
    });
  });

  // ---- listContainers() ----

  describe('listContainers()', () => {
    it('should throw when Docker is not available', async () => {
      const dockerService = await getDockerService();
      await expect(dockerService.listContainers()).rejects.toThrow('Docker service not available');
    });

    it('should return mapped container list', async () => {
      mockDockerInstance.ping.mockResolvedValueOnce(undefined);
      mockDockerInstance.listContainers.mockResolvedValueOnce([
        {
          Id: 'abc123',
          Names: ['/nginx'],
          Image: 'nginx:latest',
          ImageID: 'sha256:abc',
          State: 'running',
          Status: 'Up 2 hours',
          Ports: [{ PublicPort: 80, PrivatePort: 80 }],
          Created: 1700000000,
          Labels: { app: 'web' },
          NetworkSettings: {},
        },
      ]);

      const dockerService = await getDockerService();
      await dockerService.init();
      const containers = await dockerService.listContainers();

      expect(containers).toHaveLength(1);
      expect(containers[0]).toMatchObject({
        id: 'abc123',
        name: 'nginx',
        image: 'nginx:latest',
        imageId: 'sha256:abc',
        state: 'running',
        status: 'Up 2 hours',
      });
    });

    it('should handle containers with no names gracefully', async () => {
      mockDockerInstance.ping.mockResolvedValueOnce(undefined);
      mockDockerInstance.listContainers.mockResolvedValueOnce([
        {
          Id: 'xyz789',
          Names: [],
          Image: 'alpine',
          ImageID: 'sha256:xyz',
          State: 'exited',
          Status: 'Exited (0)',
          Ports: [],
          Created: 1700000000,
          Labels: {},
          NetworkSettings: {},
        } as any,
      ]);

      const dockerService = await getDockerService();
      await dockerService.init();
      const containers = await dockerService.listContainers();

      expect(containers[0].name).toBe('unnamed');
    });
  });

  // ---- startContainer() ----

  describe('startContainer()', () => {
    it('should throw when Docker is not available', async () => {
      const dockerService = await getDockerService();
      await expect(dockerService.startContainer('test-id')).rejects.toThrow('Docker service not available');
    });

    it('should call container.start()', async () => {
      mockDockerInstance.ping.mockResolvedValueOnce(undefined);
      const dockerService = await getDockerService();
      await dockerService.init();

      await dockerService.startContainer('test-container');

      expect(mockDockerInstance.getContainer).toHaveBeenCalledWith('test-container');
      expect(mockContainerInstance.start).toHaveBeenCalledOnce();
    });
  });

  // ---- stopContainer() ----

  describe('stopContainer()', () => {
    it('should call container.stop() with default timeout', async () => {
      mockDockerInstance.ping.mockResolvedValueOnce(undefined);
      const dockerService = await getDockerService();
      await dockerService.init();

      await dockerService.stopContainer('test-container');

      expect(mockDockerInstance.getContainer).toHaveBeenCalledWith('test-container');
      expect(mockContainerInstance.stop).toHaveBeenCalledWith({ t: 10 });
    });

    it('should call container.stop() with custom timeout', async () => {
      mockDockerInstance.ping.mockResolvedValueOnce(undefined);
      const dockerService = await getDockerService();
      await dockerService.init();

      await dockerService.stopContainer('test-container', 30);

      expect(mockContainerInstance.stop).toHaveBeenCalledWith({ t: 30 });
    });
  });

  // ---- restartContainer() ----

  describe('restartContainer()', () => {
    it('should call container.restart()', async () => {
      mockDockerInstance.ping.mockResolvedValueOnce(undefined);
      const dockerService = await getDockerService();
      await dockerService.init();

      await dockerService.restartContainer('test-container');

      expect(mockDockerInstance.getContainer).toHaveBeenCalledWith('test-container');
      expect(mockContainerInstance.restart).toHaveBeenCalledWith({ t: 10 });
    });
  });

  // ---- removeContainer() ----

  describe('removeContainer()', () => {
    it('should call container.remove() with default options', async () => {
      mockDockerInstance.ping.mockResolvedValueOnce(undefined);
      const dockerService = await getDockerService();
      await dockerService.init();

      await dockerService.removeContainer('test-container');

      expect(mockDockerInstance.getContainer).toHaveBeenCalledWith('test-container');
      expect(mockContainerInstance.remove).toHaveBeenCalledWith({ force: false, v: false });
    });

    it('should call container.remove() with force and v options', async () => {
      mockDockerInstance.ping.mockResolvedValueOnce(undefined);
      const dockerService = await getDockerService();
      await dockerService.init();

      await dockerService.removeContainer('test-container', true, true);

      expect(mockContainerInstance.remove).toHaveBeenCalledWith({ force: true, v: true });
    });
  });

  // ---- getContainer() ----

  describe('getContainer()', () => {
    it('should return container details', async () => {
      mockDockerInstance.ping.mockResolvedValueOnce(undefined);
      mockContainerInstance.inspect.mockResolvedValueOnce({
        Id: 'full-id-123',
        Name: '/my-container',
        Image: 'sha256:img',
        Created: '2024-01-01',
        State: {
          Status: 'running',
          Running: true,
          Paused: false,
          Restarting: false,
          StartedAt: '2024-01-01T00:00:00Z',
          FinishedAt: '',
          ExitCode: 0,
          Error: '',
        },
        Config: {
          Hostname: 'my-host',
          Image: 'nginx:latest',
          Env: ['PATH=/usr/bin'],
          Cmd: ['nginx'],
          WorkingDir: '/',
          Labels: {},
        },
        NetworkSettings: {
          IPAddress: '172.17.0.2',
          Gateway: '172.17.0.1',
          Networks: {},
          Ports: {},
        },
        Mounts: [],
        HostConfig: {
          RestartPolicy: { Name: 'no' },
          Memory: 0,
          CpuShares: 0,
          Privileged: false,
        },
      });

      const dockerService = await getDockerService();
      await dockerService.init();
      const info = await dockerService.getContainer('test-container');

      expect(info).toMatchObject({
        id: 'full-id-123',
        name: 'my-container',
        image: 'nginx:latest',
        state: { status: 'running', running: true },
      });
    });
  });

  // ---- pauseContainer / unpauseContainer ----

  describe('pauseContainer()', () => {
    it('should call container.pause()', async () => {
      mockDockerInstance.ping.mockResolvedValueOnce(undefined);
      const dockerService = await getDockerService();
      await dockerService.init();

      await dockerService.pauseContainer('test-container');

      expect(mockContainerInstance.pause).toHaveBeenCalledOnce();
    });
  });

  describe('unpauseContainer()', () => {
    it('should call container.unpause()', async () => {
      mockDockerInstance.ping.mockResolvedValueOnce(undefined);
      const dockerService = await getDockerService();
      await dockerService.init();

      await dockerService.unpauseContainer('test-container');

      expect(mockContainerInstance.unpause).toHaveBeenCalledOnce();
    });
  });

  // ---- getContainerLogs() ----

  describe('getContainerLogs()', () => {
    it('should return logs as string', async () => {
      mockDockerInstance.ping.mockResolvedValueOnce(undefined);
      const logBuffer = Buffer.from('log line 1\nlog line 2\n');
      mockContainerInstance.logs.mockResolvedValueOnce(logBuffer);

      const dockerService = await getDockerService();
      await dockerService.init();
      const logs = await dockerService.getContainerLogs('test-container');

      expect(logs).toBe('log line 1\nlog line 2\n');
      expect(mockContainerInstance.logs).toHaveBeenCalledWith({
        stdout: true,
        stderr: true,
        tail: 100,
        timestamps: true,
      });
    });
  });

  // ---- listImages() ----

  describe('listImages()', () => {
    it('should return mapped image list', async () => {
      mockDockerInstance.ping.mockResolvedValueOnce(undefined);
      mockDockerInstance.listImages.mockResolvedValueOnce([
        {
          Id: 'sha256:abc',
          RepoTags: ['nginx:latest', 'nginx:1.25'],
          Size: 100000,
          Created: 1700000000,
          VirtualSize: 200000,
          Labels: {},
        },
      ]);

      const dockerService = await getDockerService();
      await dockerService.init();
      const images = await dockerService.listImages();

      expect(images).toHaveLength(1);
      expect(images[0]).toMatchObject({
        id: 'sha256:abc',
        repository: 'nginx',
        tag: 'latest',
        size: 100000,
      });
    });

    it('should handle images with no tags', async () => {
      mockDockerInstance.ping.mockResolvedValueOnce(undefined);
      mockDockerInstance.listImages.mockResolvedValueOnce([
        {
          Id: 'sha256:dangling',
          RepoTags: null,
          Size: 50000,
          Created: 1700000000,
          VirtualSize: 100000,
          Labels: {},
        },
      ]);

      const dockerService = await getDockerService();
      await dockerService.init();
      const images = await dockerService.listImages();

      expect(images[0].repository).toBe('<none>');
      expect(images[0].tag).toBe('<none>');
    });
  });

  // ---- Multiple operations without init should throw ----

  describe('error handling when not initialized', () => {
    it.each([
      ['startContainer', ['id']],
      ['stopContainer', ['id']],
      ['restartContainer', ['id']],
      ['removeContainer', ['id']],
      ['getContainer', ['id']],
      ['getContainerLogs', ['id']],
      ['getContainerStats', ['id']],
      ['pauseContainer', ['id']],
      ['unpauseContainer', ['id']],
      ['listImages', []],
      ['listVolumes', []],
      ['listNetworks', []],
      ['getSystemInfo', []],
      ['getVersion', []],
      ['pullImage', ['nginx']],
      ['removeImage', ['id']],
      ['getImageInfo', ['id']],
      ['createVolume', ['vol']],
      ['removeVolume', ['vol']],
      ['getVolume', ['vol']],
      ['createNetwork', ['net']],
      ['removeNetwork', ['id']],
      ['getNetwork', ['id']],
      ['connectContainerToNetwork', ['net', 'ctr']],
      ['disconnectContainerFromNetwork', ['net', 'ctr']],
    ])('%s should throw when not initialized', async (method, args) => {
      const dockerService = await getDockerService();
      await expect(
        (dockerService as any)[method](...args)
      ).rejects.toThrow('Docker service not available');
    });
  });
});