import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  k8sContextRepository: {
    listActive: vi.fn(() => []),
    insert: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../../../repositories/k8sContextRepository', () => ({
  k8sContextRepository: mocks.k8sContextRepository,
}));

vi.mock('../../../utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../utils/errorHelpers', () => ({
  getErrorMessage: vi.fn((e: unknown) => (e instanceof Error ? e.message : String(e))),
}));

import { kubernetesService } from './kubernetesService';

describe('kubernetesService', () => {
  it('isAvailable should return false when no contexts loaded', () => {
    expect(kubernetesService.isAvailable()).toBe(false);
  });

  it('listContexts should return empty array when no contexts', () => {
    const contexts = kubernetesService.listContexts();
    expect(contexts).toEqual([]);
  });

  it('initialize should not throw when no active contexts', () => {
    mocks.k8sContextRepository.listActive.mockReturnValue([]);
    expect(() => kubernetesService.initialize()).not.toThrow();
  });
});