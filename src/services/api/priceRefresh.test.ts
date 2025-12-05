import { describe, it, expect, vi, beforeEach } from 'vitest';
import { refreshAllPrices } from './priceRefresh';

// Mock supabase
const mockInvoke = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

describe('priceRefresh', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('refreshAllPrices', () => {
    it('should call fetch-prices edge function', async () => {
      const mockResult = {
        updated: 10,
        failed: 2,
        errors: ['UNKNOWN: No data'],
      };

      mockInvoke.mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const result = await refreshAllPrices();

      expect(mockInvoke).toHaveBeenCalledWith('fetch-prices');
      expect(result).toEqual(mockResult);
    });

    it('should return result with counts', async () => {
      mockInvoke.mockResolvedValue({
        data: { updated: 5, failed: 0, errors: [] },
        error: null,
      });

      const result = await refreshAllPrices();

      expect(result.updated).toBe(5);
      expect(result.failed).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it('should throw on edge function error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Edge function error' },
      });

      await expect(refreshAllPrices()).rejects.toThrow('Edge function error');
    });
  });
});
