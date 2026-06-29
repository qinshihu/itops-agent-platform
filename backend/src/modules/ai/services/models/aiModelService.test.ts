import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock("../../../models/database", () => ({ default: {}, db: {}, initializeDatabase: vi.fn(), performMaintenance: vi.fn(), getIOInstance: vi.fn() }));
import { getEffectiveApiKey, getEffectiveApiBase, getAllModels, getEnabledModels, getModelById, getDefaultModel, createModel, updateModel, deleteModel, reorderModels, testModelConnectivity, migrateOldConfigToAIModels, migrateOldAgents } from './aiModelService.ts';

describe('aiModelService', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("should be defined", () => { expect(getEffectiveApiKey).toBeDefined(); });
//  () => { expect(Array.isArray(getAllModels())).toBe(true); });

});
