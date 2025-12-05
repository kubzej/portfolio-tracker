import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  signalExists,
  logSignal,
  getRecentSignals,
  getSignalsForTicker,
  getSignalsByType,
  getSignalPerformance,
  calculateWinRate,
  deleteSignal,
  clearAllSignals,
} from './signals';
import type { StockRecommendation } from '@/utils/recommendations';

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
    from: (...args: Parameters<typeof mockFrom>) => mockFrom(...args),
  },
}));

describe('signals API', () => {
  // Track chain state for assertions
  interface ChainMock {
    eq: ReturnType<typeof vi.fn>;
    gte: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    single: ReturnType<typeof vi.fn>;
    then: (
      resolve: (val: { data: unknown; error: unknown }) => void
    ) => ChainMock;
    _setResponse: (data: unknown, error?: unknown) => void;
  }

  let chainMock: ChainMock;

  function createChainMock(defaultData: unknown = []): ChainMock {
    let resolveData = defaultData;
    let resolveError: unknown = null;

    const mock: ChainMock = {
      eq: vi.fn(),
      gte: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
      // Make it thenable for await
      then: (resolve: (val: { data: unknown; error: unknown }) => void) => {
        resolve({ data: resolveData, error: resolveError });
        return mock;
      },
      // Allow setting response for specific test
      _setResponse: (data: unknown, error: unknown = null) => {
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
    const mockRecommendation: StockRecommendation = {
      ticker: 'AAPL',
      stockName: 'Apple Inc.',
      currentPrice: 180,
      avgBuyPrice: 150,
      distanceFromAvg: 20,
      weight: 5,
      gainPercentage: 10,
      primarySignal: {
        type: 'DIP_OPPORTUNITY',
        category: 'action',
        strength: 80,
        title: 'DIP',
        description: 'Test',
        priority: 1,
      },
      signals: [
        {
          type: 'DIP_OPPORTUNITY',
          category: 'action',
          strength: 80,
          title: 'DIP',
          description: 'Test',
          priority: 1,
        },
      ],
      actionSignal: null,
      qualitySignal: null,
      compositeScore: 75,
      fundamentalScore: 70,
      technicalScore: 65,
      analystScore: 80,
      newsScore: 60,
      insiderScore: 55,
      portfolioScore: 50,
      convictionScore: 72,
      convictionLevel: 'HIGH',
      dipScore: 85,
      isDip: true,
      dipQualityCheck: true,
      breakdown: [],
      strengths: [],
      concerns: [],
      actionItems: [],
      targetPrice: null,
      targetUpside: null,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      distanceFrom52wHigh: null,
      technicalBias: 'BULLISH',
      buyStrategy: {
        buyZoneLow: null,
        buyZoneHigh: null,
        inBuyZone: false,
        dcaRecommendation: 'NORMAL',
        dcaReason: 'Test',
        maxAddPercent: 5,
        riskRewardRatio: null,
        supportPrice: null,
      },
      exitStrategy: {
        takeProfit1: null,
        takeProfit2: null,
        takeProfit3: null,
        stopLoss: null,
        trailingStopPercent: null,
        holdingPeriod: 'MEDIUM',
        holdingReason: 'Test',
        resistanceLevel: null,
      },
      metadata: {
        rsiValue: 28,
        macdSignal: '0.5',
        bollingerPosition: null,
        newsSentiment: null,
        insiderMspr: null,
      },
      explanation: {
        technicalIndicators: {
          rsi14: null,
          macdHistogram: null,
          macdSignalLine: null,
          stochK: null,
          stochD: null,
          adx: null,
          bollingerUpper: null,
          bollingerLower: null,
          bollingerMiddle: null,
          sma20: null,
          sma50: null,
          sma200: null,
          atr14: null,
        },
        fundamentalData: {
          peRatio: null,
          forwardPE: null,
          pegRatio: null,
          roe: null,
          profitMargin: null,
          debtToEquity: null,
          revenueGrowth: null,
          epsGrowth: null,
          currentRatio: null,
        },
        analystData: {
          targetPrice: null,
          currentPrice: null,
          upside: null,
          strongBuy: 0,
          buy: 0,
          hold: 0,
          sell: 0,
          strongSell: 0,
          totalAnalysts: 0,
          consensusScore: null,
        },
        scoreBreakdown: {
          fundamental: { points: 0, maxPoints: 100, percent: 0 },
          technical: { points: 0, maxPoints: 100, percent: 0 },
          analyst: { points: 0, maxPoints: 100, percent: 0 },
          news: { points: 0, maxPoints: 100, percent: 0 },
          insider: { points: 0, maxPoints: 100, percent: 0 },
          portfolio: null,
          composite: { points: 0, maxPoints: 100, percent: 0 },
        },
        signalEvaluation: [],
        decisionPath: {
          actionSignal: { chosen: null, reason: 'Test' },
          qualitySignal: { chosen: null, reason: 'Test' },
        },
        // Cast to proper type - actual values don't matter for tests
        thresholds: {
          TECH_STRONG: 60,
          TECH_MODERATE: 40,
          TECH_WEAK: 30,
          FUND_QUALITY: 60,
          FUND_STRONG: 50,
          FUND_MODERATE: 40,
          FUND_WATCH: 35,
          FUND_WEAK: 25,
          ANALYST_QUALITY: 55,
          INSIDER_WEAK: 35,
          NEWS_WATCH: 40,
          DIP_TRIGGER: 50,
          DIP_ACCUMULATE_MIN: 20,
          DIP_ACCUMULATE_MAX: 50,
          WEIGHT_OVERWEIGHT: 8,
          WEIGHT_DCA_MAX: 10,
          WEIGHT_DIP_MAX: 15,
          TARGET_NEAR: 10,
          TARGET_UPSIDE_HIGH: 30,
          TARGET_LOW_UPSIDE: 5,
          GAIN_TAKE_PROFIT: 50,
          RSI_OVERBOUGHT: 70,
          RSI_OVERSOLD: 30,
          ADX_STRONG: 25,
          ADX_WEAK: 20,
        },
      },
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
        portfolio_id: 'p1',
        signal_type: 'DIP_OPPORTUNITY' as const,
        total_signals: 10,
        evaluated_1d: 10,
        winners_1d: 7,
        avg_return_1d: null,
        evaluated_1w: 0,
        winners_1w: 0,
        avg_return_1w: null,
        evaluated_1m: 0,
        winners_1m: 0,
        avg_return_1m: null,
        avg_composite_score: null,
        avg_signal_strength: null,
      };

      const result = calculateWinRate(perf, '1d');

      expect(result).toBe(70);
    });

    it('should calculate win rate for 1w', () => {
      const perf = {
        portfolio_id: 'p1',
        signal_type: 'DIP_OPPORTUNITY' as const,
        total_signals: 20,
        evaluated_1d: 0,
        winners_1d: 0,
        avg_return_1d: null,
        evaluated_1w: 20,
        winners_1w: 12,
        avg_return_1w: null,
        evaluated_1m: 0,
        winners_1m: 0,
        avg_return_1m: null,
        avg_composite_score: null,
        avg_signal_strength: null,
      };

      const result = calculateWinRate(perf, '1w');

      expect(result).toBe(60);
    });

    it('should return null when no evaluations', () => {
      const perf = {
        portfolio_id: 'p1',
        signal_type: 'DIP_OPPORTUNITY' as const,
        total_signals: 0,
        evaluated_1d: 0,
        winners_1d: 0,
        avg_return_1d: null,
        evaluated_1w: 0,
        winners_1w: 0,
        avg_return_1w: null,
        evaluated_1m: 0,
        winners_1m: 0,
        avg_return_1m: null,
        avg_composite_score: null,
        avg_signal_strength: null,
      };

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
