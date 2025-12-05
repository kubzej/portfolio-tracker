import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPeersData } from './peers';

// Mock supabase
const mockInvoke = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

describe('peers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchPeersData', () => {
    it('should fetch peers data for a ticker', async () => {
      const mockResult = {
        mainStock: {
          ticker: 'AAPL',
          name: 'Apple Inc.',
          currentPrice: 180,
          peRatio: 28,
        },
        peers: [
          { ticker: 'MSFT', name: 'Microsoft', currentPrice: 350 },
          { ticker: 'GOOGL', name: 'Alphabet', currentPrice: 140 },
        ],
        errors: [],
      };

      mockInvoke.mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const result = await fetchPeersData('AAPL');

      expect(mockInvoke).toHaveBeenCalledWith('fetch-peers-data', {
        body: { ticker: 'AAPL', peers: undefined },
      });
      expect(result.mainStock.ticker).toBe('AAPL');
      expect(result.peers).toHaveLength(2);
    });

    it('should accept custom peers list', async () => {
      mockInvoke.mockResolvedValue({
        data: { mainStock: {}, peers: [], errors: [] },
        error: null,
      });

      await fetchPeersData('AAPL', ['MSFT', 'GOOGL']);

      expect(mockInvoke).toHaveBeenCalledWith('fetch-peers-data', {
        body: { ticker: 'AAPL', peers: ['MSFT', 'GOOGL'] },
      });
    });

    it('should return rate limit info', async () => {
      const mockResult = {
        mainStock: {},
        peers: [],
        errors: [],
        rateLimited: { finnhub: true, yahoo: false, alpha: false },
      };

      mockInvoke.mockResolvedValue({
        data: mockResult,
        error: null,
      });

      const result = await fetchPeersData('AAPL');

      expect(result.rateLimited?.finnhub).toBe(true);
    });

    it('should throw on edge function error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Rate limited' },
      });

      await expect(fetchPeersData('AAPL')).rejects.toThrow('Rate limited');
    });
  });
});
