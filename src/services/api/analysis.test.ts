import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchAnalystData, fetchSingleAnalystData } from './analysis';

// Mock supabase
const mockInvoke = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

describe('analysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchAnalystData', () => {
    it('should fetch analyst data for all holdings', async () => {
      const mockResult = {
        data: [
          {
            ticker: 'AAPL',
            stockName: 'Apple Inc.',
            currentPrice: 180,
            recommendationKey: 'buy',
            consensusScore: 1.5,
          },
        ],
        errors: [],
      };

      mockInvoke.mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const result = await fetchAnalystData();

      expect(mockInvoke).toHaveBeenCalledWith('fetch-analyst-data', {
        body: { portfolioId: undefined },
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].ticker).toBe('AAPL');
    });

    it('should filter by portfolio ID', async () => {
      mockInvoke.mockResolvedValue({
        data: { data: [], errors: [] },
        error: null,
      });

      await fetchAnalystData('portfolio-123');

      expect(mockInvoke).toHaveBeenCalledWith('fetch-analyst-data', {
        body: { portfolioId: 'portfolio-123' },
      });
    });

    it('should return rate limit info', async () => {
      const mockResult = {
        data: [],
        errors: [],
        rateLimited: { finnhub: true, yahoo: false, alpha: false },
      };

      mockInvoke.mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const result = await fetchAnalystData();

      expect(result.rateLimited?.finnhub).toBe(true);
    });

    it('should throw on edge function error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'API error' },
      });

      await expect(fetchAnalystData()).rejects.toThrow('API error');
    });
  });

  describe('fetchSingleAnalystData', () => {
    it('should fetch analyst data for a single ticker', async () => {
      const mockResult = {
        data: [
          {
            ticker: 'AAPL',
            stockName: 'Apple Inc.',
            currentPrice: 180,
            fundamentals: { peRatio: 28 },
          },
        ],
        errors: [],
      };

      mockInvoke.mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const result = await fetchSingleAnalystData('AAPL');

      expect(mockInvoke).toHaveBeenCalledWith('fetch-analyst-data', {
        body: expect.objectContaining({
          ticker: 'AAPL',
        }),
      });
      expect(result?.ticker).toBe('AAPL');
    });

    it('should pass stockName and finnhubTicker', async () => {
      mockInvoke.mockResolvedValue({
        data: { data: [{ ticker: 'CEZ.PR' }], errors: [] },
        error: null,
      });

      await fetchSingleAnalystData('CEZ.PR', 'ČEZ', 'BAACEZ.PR');

      expect(mockInvoke).toHaveBeenCalledWith('fetch-analyst-data', {
        body: expect.objectContaining({
          ticker: 'CEZ.PR',
          stockName: 'ČEZ',
          finnhubTicker: 'BAACEZ.PR',
        }),
      });
    });

    it('should return null when no data', async () => {
      mockInvoke.mockResolvedValue({
        data: { data: [], errors: [] },
        error: null,
      });

      const result = await fetchSingleAnalystData('UNKNOWN');

      expect(result).toBeNull();
    });

    it('should throw on error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Single ticker error' },
      });

      await expect(fetchSingleAnalystData('AAPL')).rejects.toThrow(
        'Single ticker error'
      );
    });
  });
});
