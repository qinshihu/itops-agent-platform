import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createVendorAdapter, STANDARD_INSPECTION_TYPES } from './vendorAdapter';

describe('vendorAdapter', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  it("should be defined", () => { expect(createVendorAdapter).toBeDefined(); });
it("should create vendor adapter", () => { const a = createVendorAdapter("huawei"); expect(a).toBeDefined(); });
it("should have ST", () => { expect(Array.isArray(STANDARD_INSPECTION_TYPES)).toBe(true); });

});
