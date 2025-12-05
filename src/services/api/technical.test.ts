import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchTechnicalData, fetchSingleTechnicalData } from './technical';

// Mock supabase
const mockInvoke = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

describe('technical', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchTechnicalData', () => {
    it('should fetch technical data for all holdings', async () => {
      const mockResult = {
        data: [
          {
            ticker: 'AAPL',
            stockName: 'Apple Inc.',
            currentPrice: 180,
            rsi14: 55,
            sma50: 175,
            sma200: 165,
          },
        ],
        errors: [],
      };

      mockInvoke.mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const result = await fetchTechnicalData();

      expect(mockInvoke).toHaveBeenCalledWith('fetch-technical-data', {
        body: { portfolioId: undefined },
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].rsi14).toBe(55);
    });

    it('should filter by portfolio ID', async () => {
      mockInvoke.mockResolvedValue({
        data: { data: [], errors: [] },
        error: null,
      });

      await fetchTechnicalData('portfolio-123');

      expect(mockInvoke).toHaveBeenCalledWith('fetch-technical-data', {
        body: { portfolioId: 'portfolio-123' },
      });
    });

    it('should return rate limit info', async () => {
      const mockResult = {
        data: [],
        errors: [],
        rateLimited: { yahoo: true },
      };

      mockInvoke.mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const result = await fetchTechnicalData();

      expect(result.rateLimited?.yahoo).toBe(true);
    });

    it('should throw on edge function error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Technical API error' },
      });

      await expect(fetchTechnicalData()).rejects.toThrow('Technical API error');
    });
  });

  describe('fetchSingleTechnicalData', () => {
    it('should fetch technical data for a single ticker', async () => {
      const mockResult = {
        data: [
          {
            ticker: 'AAPL',
            rsi14: 65,
            macd: 2.5,
            macdSignal: 1.8,
            bollingerPosition: 0.7,
          },
        ],
        errors: [],
      };

      mockInvoke.mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const result = await fetchSingleTechnicalData('AAPL');

      expect(mockInvoke).toHaveBeenCalledWith('fetch-technical-data', {
        body: { ticker: 'AAPL' },
      });
      expect(result?.ticker).toBe('AAPL');
      expect(result?.rsi14).toBe(65);
    });

    it('should return null when no data', async () => {
      mockInvoke.mockResolvedValue({
        data: { data: [], errors: [] },
        error: null,
      });

      const result = await fetchSingleTechnicalData('UNKNOWN');

      expect(result).toBeNull();
    });

    it('should include historical data', async () => {
      const mockResult = {
        data: [
          {
            ticker: 'AAPL',
            historicalPrices: [{ date: '2024-01-01', close: 180 }],
            sma50History: [{ date: '2024-01-01', value: 175 }],
            macdHistory: [
              { date: '2024-01-01', macd: 2, signal: 1.5, histogram: 0.5 },
            ],
          },
        ],
        errors: [],
      };

      mockInvoke.mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const result = await fetchSingleTechnicalData('AAPL');

      expect(result?.historicalPrices).toHaveLength(1);
      expect(result?.sma50History).toHaveLength(1);
      expect(result?.macdHistory).toHaveLength(1);
    });

    it('should throw on error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Single technical error' },
      });

      await expect(fetchSingleTechnicalData('AAPL')).rejects.toThrow(
        'Single technical error'
      );
    });
  });
});
