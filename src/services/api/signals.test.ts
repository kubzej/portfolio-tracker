import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  signalExists,
  logSignal,
  logMultipleSignals,
  getRecentSignals,
  getSignalsForTicker,
  getSignalsByType,
  getSignalPerformance,
  calculateWinRate,
  deleteSignal,
  clearAllSignals,
} from './signals';

// Mock supabase
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockSingle = vi.fn();

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  delete: mockDelete,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe('signals API', () => {
  // Track chain state for assertions
  let chainMock: ReturnType<typeof createChainMock>;

  function createChainMock(defaultData: any = []) {
    let resolveData = defaultData;
    let resolveError: any = null;

    const mock: any = {
      eq: vi.fn(),
      gte: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
      // Make it thenable for await
      then: (resolve: (val: any) => void) => {
        resolve({ data: resolveData, error: resolveError });
        return mock;
      },
      // Allow setting response for specific test
      _setResponse: (data: any, error: any = null) => {
        resolveData = data;
        resolveError = error;
      },
    };

    // Chain methods return mock itself
    mock.eq.mockImplementation(() => mock);
    mock.gte.mockImplementation(() => mock);
    mock.order.mockImplementation(() => mock);
    mock.limit.mockImplementation(() => mock);
    mock.select.mockImplementation(() => mock);
    mock.single.mockImplementation(() => mock);

    return mock;
  }

  beforeEach(() => {
    vi.clearAllMocks();

    chainMock = createChainMock();

    mockSelect.mockReturnValue(chainMock);

    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: mockSingle,
      }),
    });

    mockDelete.mockReturnValue(chainMock);
  });

  describe('signalExists', () => {
    it('should return true when signal exists', async () => {
      chainMock._setResponse([{ id: '1' }]);

      const result = await signalExists(
        { portfolioId: 'p1' },
        'AAPL',
        'DIP_OPPORTUNITY'
      );

      expect(result).toBe(true);
    });

    it('should return false when no signal exists', async () => {
      chainMock._setResponse([]);

      const result = await signalExists(
        { portfolioId: 'p1' },
        'AAPL',
        'DIP_OPPORTUNITY'
      );

      expect(result).toBe(false);
    });

    it('should check by user_id for research signals', async () => {
      chainMock._setResponse([]);

      await signalExists({ userId: 'user-123' }, 'AAPL', 'MOMENTUM');

      expect(chainMock.eq).toHaveBeenCalledWith('user_id', 'user-123');
    });

    it('should return false on error (allowing insert)', async () => {
      chainMock._setResponse(null, { message: 'DB error' });

      const result = await signalExists(
        { portfolioId: 'p1' },
        'AAPL',
        'DIP_OPPORTUNITY'
      );

      expect(result).toBe(false);
    });
  });

  describe('logSignal', () => {
    const mockRecommendation = {
      ticker: 'AAPL',
      stockName: 'Apple Inc.',
      currentPrice: 180,
      primarySignal: { type: 'DIP_OPPORTUNITY' as const, strength: 80 },
      signals: [{ type: 'DIP_OPPORTUNITY' as const, strength: 80 }],
      compositeScore: 75,
      fundamentalScore: 70,
      technicalScore: 65,
      analystScore: 80,
      newsScore: 60,
      insiderScore: 55,
      convictionScore: 72,
      dipScore: 85,
      convictionLevel: 'high' as const,
      isDip: true,
      dipQualityCheck: { fundamentals: true, analyst: true, news: true },
      technicalBias: 'bullish' as const,
      metadata: {
        rsiValue: 28,
        macdSignal: '0.5',
      },
      targetPrice: null,
      targetUpside: null,
      weight: 5,
      gainPercentage: 10,
      qualitySignal: null,
    };

    it('should log a new signal', async () => {
      // Signal doesn't exist
      chainMock._setResponse([]);

      // Insert succeeds
      mockSingle.mockResolvedValue({
        data: { id: '1', ticker: 'AAPL', signal_type: 'DIP_OPPORTUNITY' },
        error: null,
      });

      const result = await logSignal({
        portfolioId: 'p1',
        recommendation: mockRecommendation,
      });

      expect(result).toBeTruthy();
      expect(result?.signal_type).toBe('DIP_OPPORTUNITY');
    });

    it('should return null for duplicate signal', async () => {
      // Signal exists
      chainMock._setResponse([{ id: '1' }]);

      const result = await logSignal({
        portfolioId: 'p1',
        recommendation: mockRecommendation,
      });

      expect(result).toBeNull();
    });

    it('should use custom signal type if provided', async () => {
      chainMock._setResponse([]);

      mockSingle.mockResolvedValue({
        data: { id: '1', signal_type: 'MOMENTUM' },
        error: null,
      });

      const result = await logSignal({
        portfolioId: 'p1',
        recommendation: mockRecommendation,
        signalType: 'MOMENTUM',
      });

      expect(result?.signal_type).toBe('MOMENTUM');
    });
  });

  describe('getRecentSignals', () => {
    it('should fetch recent signals for portfolio', async () => {
      const mockSignals = [
        { id: '1', ticker: 'AAPL', signal_type: 'DIP_OPPORTUNITY' },
      ];

      chainMock._setResponse(mockSignals);

      const result = await getRecentSignals('p1');

      expect(mockFrom).toHaveBeenCalledWith('signal_log');
      expect(chainMock.eq).toHaveBeenCalledWith('portfolio_id', 'p1');
      expect(result).toEqual(mockSignals);
    });

    it('should respect limit parameter', async () => {
      chainMock._setResponse([]);

      await getRecentSignals('p1', 10);

      expect(chainMock.limit).toHaveBeenCalledWith(10);
    });

    it('should throw on error', async () => {
      chainMock._setResponse(null, { message: 'Fetch error' });

      await expect(getRecentSignals('p1')).rejects.toEqual({
        message: 'Fetch error',
      });
    });
  });

  describe('getSignalsForTicker', () => {
    it('should fetch signals for specific ticker', async () => {
      chainMock._setResponse([{ id: '1', ticker: 'AAPL' }]);

      const result = await getSignalsForTicker('p1', 'AAPL');

      expect(chainMock.eq).toHaveBeenCalledWith('ticker', 'AAPL');
      expect(result).toHaveLength(1);
    });
  });

  describe('getSignalsByType', () => {
    it('should fetch signals by type', async () => {
      chainMock._setResponse([
        { id: '1', signal_type: 'DIP_OPPORTUNITY' },
        { id: '2', signal_type: 'DIP_OPPORTUNITY' },
      ]);

      const result = await getSignalsByType('p1', 'DIP_OPPORTUNITY');

      expect(chainMock.eq).toHaveBeenCalledWith(
        'signal_type',
        'DIP_OPPORTUNITY'
      );
      expect(result).toHaveLength(2);
    });
  });

  describe('getSignalPerformance', () => {
    it('should fetch signal performance stats', async () => {
      const mockPerf = [
        {
          signal_type: 'DIP_OPPORTUNITY',
          total_signals: 10,
          evaluated_1d: 8,
          winners_1d: 6,
        },
      ];

      chainMock._setResponse(mockPerf);

      const result = await getSignalPerformance('p1');

      expect(mockFrom).toHaveBeenCalledWith('signal_performance');
      expect(result).toEqual(mockPerf);
    });
  });

  describe('calculateWinRate', () => {
    it('should calculate win rate for 1d', () => {
      const perf = {
        evaluated_1d: 10,
        winners_1d: 7,
      } as any;

      const result = calculateWinRate(perf, '1d');

      expect(result).toBe(70);
    });

    it('should calculate win rate for 1w', () => {
      const perf = {
        evaluated_1w: 20,
        winners_1w: 12,
      } as any;

      const result = calculateWinRate(perf, '1w');

      expect(result).toBe(60);
    });

    it('should return null when no evaluations', () => {
      const perf = {
        evaluated_1d: 0,
        winners_1d: 0,
      } as any;

      const result = calculateWinRate(perf, '1d');

      expect(result).toBeNull();
    });
  });

  describe('deleteSignal', () => {
    it('should delete a signal', async () => {
      chainMock._setResponse(null);

      await deleteSignal('signal-1');

      expect(mockFrom).toHaveBeenCalledWith('signal_log');
      expect(mockDelete).toHaveBeenCalled();
      expect(chainMock.eq).toHaveBeenCalledWith('id', 'signal-1');
    });

    it('should throw on error', async () => {
      chainMock._setResponse(null, { message: 'Delete error' });

      await expect(deleteSignal('signal-1')).rejects.toEqual({
        message: 'Delete error',
      });
    });
  });

  describe('clearAllSignals', () => {
    it('should delete all signals for portfolio', async () => {
      chainMock._setResponse(null);

      await clearAllSignals('p1');

      expect(chainMock.eq).toHaveBeenCalledWith('portfolio_id', 'p1');
    });
  });
});
