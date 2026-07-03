import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock upstream dependencies
vi.mock("../../../../models/database", () => ({ default: {}, db: {}, initializeDatabase: vi.fn(), performMaintenance: vi.fn(), getIOInstance: vi.fn() }));
vi.mock("../../../../utils/logger", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), shutdown: vi.fn() } }));
vi.mock("../llm/llmService", () => ({
  generateCompletion: vi.fn(),
  generateCompletionWithTools: vi.fn(),
  checkLLMAvailability: vi.fn(),
}));

import {
  Coordinator,
  SpecialistBase,
  specialistRegistry,
  initializeMultiAgentSystem,
  getCoordinator,
  executeTask,
  AgentType,
  TaskStatus,
} from './index';

describe('MultiAgent Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('index exports', () => {
    it('should export Coordinator', () => {
      expect(Coordinator).toBeDefined();
    });

    it('should export SpecialistBase', () => {
      expect(SpecialistBase).toBeDefined();
    });

    it('should export specialistRegistry', () => {
      expect(specialistRegistry).toBeDefined();
    });

    it('should export initializeMultiAgentSystem', () => {
      expect(typeof initializeMultiAgentSystem).toBe('function');
    });

    it('should export getCoordinator', () => {
      expect(typeof getCoordinator).toBe('function');
    });

    it('should export executeTask', () => {
      expect(typeof executeTask).toBe('function');
    });

    it('should export AgentType and TaskStatus enums', () => {
      expect(AgentType).toBeDefined();
      expect(TaskStatus).toBeDefined();
    });
  });

  describe('Coordinator', () => {
    it('should create a Coordinator instance', () => {
      const coordinator = new Coordinator('TestCoordinator');
      expect(coordinator).toBeDefined();
      expect(coordinator.id).toBeDefined();
      expect(coordinator.name).toBe('TestCoordinator');
      expect(coordinator.type).toBe(AgentType.COORDINATOR);
    });

    it('should create with default name', () => {
      const coordinator = new Coordinator();
      expect(coordinator.name).toBeDefined();
    });

    it('should accept custom config', () => {
      const coordinator = new Coordinator('Custom', {
        maxDecompositionDepth: 2,
        maxConcurrentTasks: 3,
      });
      expect(coordinator.config.maxDecompositionDepth).toBe(2);
      expect(coordinator.config.maxConcurrentTasks).toBe(3);
    });
  });

  describe('SpecialistBase', () => {
    it('should create a SpecialistBase subclass', () => {
      class TestSpecialist extends SpecialistBase {
        readonly domain = { name: 'test', description: 'Test domain', capabilities: ['test'] };
        async executeTask(input: string): Promise<string> {
          return `executed: ${input}`;
        }
      }
      const specialist = new TestSpecialist();
      expect(specialist).toBeDefined();
      expect(specialist.id).toBeDefined();
      expect(specialist.enabled).toBe(true);
    });
  });
});
