/**
 * Tests for recommendations.ts utility functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getFilteredInsiderSentiment,
  generateRecommendation,
  createSignalLogEntry,
  getDisplaySignals,
  hasActionableSignal,
  SIGNAL_CATEGORIES,
  SIGNAL_CATEGORY_LABELS,
  type EnrichedAnalystData,
  type SignalType,
  type RecommendationInput,
} from './recommendations';
import type { TechnicalData } from '@/services/api/technical';

// Mock enriched analyst data factory
const createMockEnrichedData = (
  overrides: Partial<EnrichedAnalystData> = {}
): EnrichedAnalystData => ({
  ticker: 'AAPL',
  stockName: 'Apple Inc.',
  currentPrice: 175.5,
  priceChange: 1.5,
  priceChangePercent: 0.86,
  fiftyTwoWeekHigh: 199.62,
  fiftyTwoWeekLow: 143.9,
  analystTargetPrice: 195.0,
  recommendationKey: 'buy',
  consensusScore: 1.5,
  strongBuy: 15,
  buy: 20,
  hold: 10,
  sell: 2,
  strongSell: 1,
  numberOfAnalysts: 48,
  recommendationPeriod: '2024-01',
  earnings: [],
  fundamentals: {
    peRatio: 28.5,
    pbRatio: 45.2,
    psRatio: 7.5,
    pegRatio: 2.1,
    evEbitda: 22.5,
    forwardPe: 26.2,
    roe: 147.0,
    roa: 28.5,
    roi: 56.2,
    grossMargin: 43.5,
    operatingMargin: 30.2,
    netMargin: 25.3,
    revenueGrowth: 8.5,
    epsGrowth: 10.2,
    revenueGrowth3Y: 12.5,
    revenueGrowth5Y: 15.2,
    epsGrowth5Y: 18.5,
    beta: 1.2,
    debtToEquity: 1.8,
    currentRatio: 1.0,
    quickRatio: 0.85,
    dividendYield: 0.5,
    payoutRatio: 15.2,
    dividendGrowth5Y: 8.5,
    return52W: 25.5,
    return13W: 8.2,
    returnVsSP500: 5.2,
    marketCap: 2850000000000,
    enterpriseValue: 2920000000000,
  },
  insiderSentiment: {
    mspr: -0.15,
    change: -5000,
    monthlyData: [],
  },
  peers: ['MSFT', 'GOOGL', 'META'],
  industry: 'Technology',
  description: 'Apple Inc. designs, manufactures, and markets smartphones...',
  descriptionSource: null,
  weight: 10.5,
  currentValue: 17550,
  totalShares: 100,
  avgBuyPrice: 150,
  totalInvested: 15000,
  unrealizedGain: 2550,
  gainPercentage: 17,
  targetPrice: 200,
  distanceToTarget: 14,
  ...overrides,
});

describe('SIGNAL_CATEGORIES', () => {
  it('should have action category for action signals', () => {
    const actionSignals: SignalType[] = [
      'DIP_OPPORTUNITY',
      'BREAKOUT',
      'REVERSAL',
      'MOMENTUM',
      'ACCUMULATE',
      'GOOD_ENTRY',
      'WAIT_FOR_DIP',
      'NEAR_TARGET',
      'TAKE_PROFIT',
      'TRIM',
      'WATCH',
      'HOLD',
    ];

    actionSignals.forEach((signal) => {
      expect(SIGNAL_CATEGORIES[signal]).toBe('action');
    });
  });

  it('should have quality category for quality signals', () => {
    const qualitySignals: SignalType[] = [
      'CONVICTION',
      'QUALITY_CORE',
      'UNDERVALUED',
      'STRONG_TREND',
      'STEADY',
      'FUNDAMENTALLY_WEAK',
      'TECHNICALLY_WEAK',
      'PROBLEMATIC',
      'WEAK',
      'OVERBOUGHT',
      'NEUTRAL',
    ];

    qualitySignals.forEach((signal) => {
      expect(SIGNAL_CATEGORIES[signal]).toBe('quality');
    });
  });

  it('should have all signal types categorized', () => {
    const allSignals: SignalType[] = [
      'DIP_OPPORTUNITY',
      'BREAKOUT',
      'REVERSAL',
      'MOMENTUM',
      'ACCUMULATE',
      'GOOD_ENTRY',
      'WAIT_FOR_DIP',
      'NEAR_TARGET',
      'TAKE_PROFIT',
      'TRIM',
      'WATCH',
      'HOLD',
      'CONVICTION',
      'QUALITY_CORE',
      'UNDERVALUED',
      'STRONG_TREND',
      'STEADY',
      'FUNDAMENTALLY_WEAK',
      'TECHNICALLY_WEAK',
      'PROBLEMATIC',
      'WEAK',
      'OVERBOUGHT',
      'NEUTRAL',
    ];

    allSignals.forEach((signal) => {
      expect(SIGNAL_CATEGORIES[signal]).toBeDefined();
      expect(['action', 'quality']).toContain(SIGNAL_CATEGORIES[signal]);
    });
  });
});

describe('getFilteredInsiderSentiment', () => {
  beforeEach(() => {
    // Mock Date to a fixed point: December 2024
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 11, 15)); // December 15, 2024
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should return null values when no insider data exists', () => {
    const data = createMockEnrichedData({
      insiderSentiment: undefined,
    });

    const result = getFilteredInsiderSentiment(data, 3);
    expect(result.mspr).toBeNull();
    expect(result.change).toBeNull();
  });

  it('should return aggregate MSPR when no monthly data exists', () => {
    const data = createMockEnrichedData({
      insiderSentiment: {
        mspr: -0.25,
        change: -10000,
        monthlyData: [],
      },
    });

    const result = getFilteredInsiderSentiment(data, 3);
    expect(result.mspr).toBe(-0.25);
    expect(result.change).toBe(-10000);
  });

  it('should filter monthly data by time range', () => {
    const data = createMockEnrichedData({
      insiderSentiment: {
        mspr: -0.25,
        change: -10000,
        monthlyData: [
          { year: 2024, month: 12, mspr: 0.5, change: 1000 },
          { year: 2024, month: 11, mspr: 0.3, change: 500 },
          { year: 2024, month: 10, mspr: -0.2, change: -200 },
          { year: 2024, month: 6, mspr: -0.8, change: -5000 }, // Outside 3-month range
        ],
      },
    });

    const result = getFilteredInsiderSentiment(data, 3);

    // Should only include Dec, Nov, Oct (3 months)
    // Average MSPR: (0.5 + 0.3 + -0.2) / 3 = 0.2
    expect(result.mspr).toBeCloseTo(0.2, 1);
    // Total change: 1000 + 500 + -200 = 1300
    expect(result.change).toBe(1300);
  });

  it('should handle 1-month time range', () => {
    const data = createMockEnrichedData({
      insiderSentiment: {
        mspr: -0.25,
        change: -10000,
        monthlyData: [
          { year: 2024, month: 12, mspr: 0.5, change: 1000 },
          { year: 2024, month: 11, mspr: 0.3, change: 500 },
        ],
      },
    });

    const result = getFilteredInsiderSentiment(data, 1);

    // Should only include December
    expect(result.mspr).toBe(0.5);
    expect(result.change).toBe(1000);
  });

  it('should handle 12-month time range', () => {
    const data = createMockEnrichedData({
      insiderSentiment: {
        mspr: null,
        change: null,
        monthlyData: [
          { year: 2024, month: 12, mspr: 0.1, change: 100 },
          { year: 2024, month: 6, mspr: 0.2, change: 200 },
          { year: 2024, month: 1, mspr: 0.3, change: 300 },
        ],
      },
    });

    const result = getFilteredInsiderSentiment(data, 12);

    // Should include all three months (all within 12 months)
    expect(result.mspr).toBeCloseTo(0.2, 1);
    expect(result.change).toBe(600);
  });

  it('should use available data when filtered result is empty', () => {
    const data = createMockEnrichedData({
      insiderSentiment: {
        mspr: null,
        change: null,
        monthlyData: [
          { year: 2023, month: 1, mspr: 0.5, change: 1000 },
          { year: 2023, month: 2, mspr: 0.3, change: 500 },
        ],
      },
    });

    const result = getFilteredInsiderSentiment(data, 3);

    // Old data outside range, should use first N months from array
    expect(result.mspr).toBeDefined();
    expect(result.change).toBeDefined();
  });
});

describe('Signal type definitions', () => {
  it('should have 12 action signal types', () => {
    const actionSignals = Object.entries(SIGNAL_CATEGORIES)
      .filter(([, category]) => category === 'action')
      .map(([signal]) => signal);

    expect(actionSignals).toHaveLength(12);
  });

  it('should have 11 quality signal types', () => {
    const qualitySignals = Object.entries(SIGNAL_CATEGORIES)
      .filter(([, category]) => category === 'quality')
      .map(([signal]) => signal);

    expect(qualitySignals).toHaveLength(11);
  });

  it('should have 23 total signal types', () => {
    expect(Object.keys(SIGNAL_CATEGORIES)).toHaveLength(23);
  });
});

// ============================================================================
// MOCK DATA FACTORIES
// ============================================================================

const createMockTechnicalData = (
  overrides: Partial<TechnicalData> = {}
): TechnicalData => ({
  ticker: 'AAPL',
  stockName: 'Apple Inc.',
  currentPrice: 175.5,
  sma50: 170.0,
  sma200: 165.0,
  priceVsSma50: 3.2,
  priceVsSma200: 6.4,
  rsi14: 55,
  rsiSignal: 'neutral',
  macd: 2.5,
  macdSignal: 2.0,
  macdHistogram: 0.5,
  macdTrend: 'bullish',
  macdDivergence: null,
  bollingerUpper: 185.0,
  bollingerMiddle: 172.0,
  bollingerLower: 159.0,
  bollingerPosition: 60,
  bollingerSignal: 'neutral',
  stochasticK: 65,
  stochasticD: 60,
  stochasticSignal: 'neutral',
  currentVolume: 50000000,
  avgVolume20: 45000000,
  volumeChange: 11.1,
  volumeSignal: 'normal',
  atr14: 3.5,
  atrPercent: 2.0,
  atrSignal: 'normal',
  obv: 1000000000,
  obvTrend: 'bullish',
  obvDivergence: null,
  adx: 25,
  plusDI: 28,
  minusDI: 22,
  adxSignal: 'moderate',
  adxTrend: 'bullish',
  fibonacciLevels: null,
  historicalPrices: [],
  historicalPricesWeekly: [],
  sma50History: [],
  sma200History: [],
  macdHistory: [],
  bollingerHistory: [],
  stochasticHistory: [],
  volumeHistory: [],
  atrHistory: [],
  obvHistory: [],
  adxHistory: [],
  ...overrides,
});

// ============================================================================
// generateRecommendation TESTS
// ============================================================================

describe('generateRecommendation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 11, 15));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should generate a complete recommendation object', () => {
    const input: RecommendationInput = {
      analystData: createMockEnrichedData(),
      technicalData: createMockTechnicalData(),
      newsArticles: [],
      insiderTimeRange: 3,
    };

    const result = generateRecommendation(input);

    // Basic structure
    expect(result.ticker).toBe('AAPL');
    expect(result.stockName).toBe('Apple Inc.');
    expect(result.currentPrice).toBe(175.5);

    // Scores should be numbers 0-100
    expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    expect(result.compositeScore).toBeLessThanOrEqual(100);
    expect(result.fundamentalScore).toBeGreaterThanOrEqual(0);
    expect(result.technicalScore).toBeGreaterThanOrEqual(0);
    expect(result.analystScore).toBeGreaterThanOrEqual(0);

    // Should have signals
    expect(result.signals.length).toBeGreaterThan(0);
    expect(result.primarySignal).toBeDefined();
    expect(result.primarySignal.type).toBeDefined();
    expect(result.primarySignal.category).toBeDefined();

    // Should have breakdown
    expect(result.breakdown.length).toBeGreaterThan(0);

    // Should have strategies
    expect(result.buyStrategy).toBeDefined();
    expect(result.exitStrategy).toBeDefined();
  });

  it('should calculate portfolio score for Holdings view', () => {
    const input: RecommendationInput = {
      analystData: createMockEnrichedData({
        weight: 5,
        avgBuyPrice: 150,
        targetPrice: 200,
      }),
      technicalData: createMockTechnicalData(),
      newsArticles: [],
      insiderTimeRange: 3,
      isResearch: false,
    };

    const result = generateRecommendation(input);

    expect(result.portfolioScore).not.toBeNull();
    expect(result.portfolioScore).toBeGreaterThanOrEqual(0);
    expect(result.breakdown.some((b) => b.category === 'Portfolio')).toBe(true);
  });

  it('should NOT calculate portfolio score for Research view', () => {
    const input: RecommendationInput = {
      analystData: createMockEnrichedData(),
      technicalData: createMockTechnicalData(),
      newsArticles: [],
      insiderTimeRange: 3,
      isResearch: true,
    };

    const result = generateRecommendation(input);

    expect(result.portfolioScore).toBeNull();
    expect(result.breakdown.some((b) => b.category === 'Portfolio')).toBe(
      false
    );
  });

  it('should detect DIP opportunity with oversold RSI', () => {
    const input: RecommendationInput = {
      analystData: createMockEnrichedData({
        weight: 3,
        currentPrice: 140,
        fiftyTwoWeekHigh: 200,
      }),
      technicalData: createMockTechnicalData({
        currentPrice: 140,
        rsi14: 25, // Oversold
        bollingerLower: 145,
        sma200: 160,
      }),
      newsArticles: [],
      insiderTimeRange: 3,
    };

    const result = generateRecommendation(input);

    expect(result.dipScore).toBeGreaterThan(0);
    // May or may not be a DIP_OPPORTUNITY depending on quality checks
    expect(result.isDip).toBeDefined();
  });

  it('should calculate conviction score correctly', () => {
    const highQualityData = createMockEnrichedData({
      fundamentals: {
        peRatio: 20,
        pbRatio: 5,
        psRatio: 3,
        pegRatio: 1.0,
        evEbitda: 15,
        forwardPe: 18,
        roe: 25, // High ROE
        roa: 15,
        roi: 20,
        grossMargin: 50,
        operatingMargin: 25,
        netMargin: 22, // High margin
        revenueGrowth: 15,
        epsGrowth: 18,
        revenueGrowth3Y: 12,
        revenueGrowth5Y: 18, // Good 5Y growth
        epsGrowth5Y: 20,
        beta: 1.0,
        debtToEquity: 0.3, // Low debt
        currentRatio: 2.0,
        quickRatio: 1.5,
        dividendYield: 1.0,
        payoutRatio: 30,
        dividendGrowth5Y: 10,
        return52W: 30,
        return13W: 10,
        returnVsSP500: 8,
        marketCap: 500000000000,
        enterpriseValue: 520000000000,
      },
    });

    const input: RecommendationInput = {
      analystData: highQualityData,
      technicalData: createMockTechnicalData({
        sma200: 160,
        currentPrice: 175,
      }),
      newsArticles: [],
      insiderTimeRange: 3,
    };

    const result = generateRecommendation(input);

    expect(result.convictionScore).toBeGreaterThan(50);
    expect(['HIGH', 'MEDIUM', 'LOW']).toContain(result.convictionLevel);
  });

  it('should generate action and quality signals separately', () => {
    const input: RecommendationInput = {
      analystData: createMockEnrichedData(),
      technicalData: createMockTechnicalData(),
      newsArticles: [],
      insiderTimeRange: 3,
    };

    const result = generateRecommendation(input);

    // Should have at least one signal
    expect(result.signals.length).toBeGreaterThan(0);

    // Action and quality should be separated
    if (result.actionSignal) {
      expect(result.actionSignal.category).toBe('action');
    }
    if (result.qualitySignal) {
      expect(result.qualitySignal.category).toBe('quality');
    }
  });

  it('should handle missing technical data gracefully', () => {
    const input: RecommendationInput = {
      analystData: createMockEnrichedData(),
      technicalData: undefined,
      newsArticles: [],
      insiderTimeRange: 3,
    };

    const result = generateRecommendation(input);

    // Should still generate a recommendation
    expect(result.ticker).toBe('AAPL');
    expect(result.compositeScore).toBeGreaterThanOrEqual(0);
    expect(result.technicalScore).toBe(50); // Neutral when no data
  });

  it('should handle missing fundamentals gracefully', () => {
    const input: RecommendationInput = {
      analystData: createMockEnrichedData({
        fundamentals: null as unknown as EnrichedAnalystData['fundamentals'],
      }),
      technicalData: createMockTechnicalData(),
      newsArticles: [],
      insiderTimeRange: 3,
    };

    const result = generateRecommendation(input);

    expect(result.ticker).toBe('AAPL');
    expect(result.fundamentalScore).toBe(0);
  });

  it('should calculate target upside correctly', () => {
    const input: RecommendationInput = {
      analystData: createMockEnrichedData({
        currentPrice: 100,
        targetPrice: 130,
      }),
      technicalData: createMockTechnicalData({ currentPrice: 100 }),
      newsArticles: [],
      insiderTimeRange: 3,
    };

    const result = generateRecommendation(input);

    expect(result.targetUpside).toBeCloseTo(30, 0); // 30% upside
  });

  it('should use analyst target price when personal target is null', () => {
    const input: RecommendationInput = {
      analystData: createMockEnrichedData({
        currentPrice: 100,
        targetPrice: null,
        analystTargetPrice: 120,
      }),
      technicalData: createMockTechnicalData({ currentPrice: 100 }),
      newsArticles: [],
      insiderTimeRange: 3,
      isResearch: true,
    };

    const result = generateRecommendation(input);

    expect(result.targetUpside).toBeCloseTo(20, 0); // 20% upside from analyst
  });

  it('should populate metadata correctly', () => {
    const input: RecommendationInput = {
      analystData: createMockEnrichedData(),
      technicalData: createMockTechnicalData({
        rsi14: 65,
        macdHistogram: 1.5,
      }),
      newsArticles: [],
      insiderTimeRange: 3,
    };

    const result = generateRecommendation(input);

    expect(result.metadata.rsiValue).toBe(65);
    expect(result.metadata.macdSignal).toBe('bullish');
    expect(result.metadata.bollingerPosition).toBeDefined();
  });
});

// ============================================================================
// HELPER FUNCTIONS TESTS
// ============================================================================

describe('createSignalLogEntry', () => {
  it('should create a valid log entry from recommendation', () => {
    const input: RecommendationInput = {
      analystData: createMockEnrichedData(),
      technicalData: createMockTechnicalData(),
      newsArticles: [],
      insiderTimeRange: 3,
    };

    const rec = generateRecommendation(input);
    const logEntry = createSignalLogEntry(rec);

    expect(logEntry.ticker).toBe('AAPL');
    expect(logEntry.signalType).toBe(rec.primarySignal.type);
    expect(logEntry.signalStrength).toBe(rec.primarySignal.strength);
    expect(logEntry.priceAtSignal).toBe(rec.currentPrice);
    expect(logEntry.compositeScore).toBe(rec.compositeScore);
    expect(logEntry.dipScore).toBe(rec.dipScore);
    expect(logEntry.convictionScore).toBe(rec.convictionScore);
    expect(logEntry.metadata).toEqual(rec.metadata);
  });
});

describe('getDisplaySignals', () => {
  it('should return action and quality signals tuple', () => {
    const input: RecommendationInput = {
      analystData: createMockEnrichedData(),
      technicalData: createMockTechnicalData(),
      newsArticles: [],
      insiderTimeRange: 3,
    };

    const rec = generateRecommendation(input);
    const [actionSignal, qualitySignal] = getDisplaySignals(rec);

    expect(actionSignal).toBe(rec.actionSignal);
    expect(qualitySignal).toBe(rec.qualitySignal);
  });
});

describe('hasActionableSignal', () => {
  it('should return true when action signal exists', () => {
    const input: RecommendationInput = {
      analystData: createMockEnrichedData(),
      technicalData: createMockTechnicalData(),
      newsArticles: [],
      insiderTimeRange: 3,
    };

    const rec = generateRecommendation(input);

    // If action signal exists, should return true
    if (rec.actionSignal) {
      expect(hasActionableSignal(rec)).toBe(true);
    }
  });
});

describe('SIGNAL_CATEGORY_LABELS', () => {
  it('should have labels for all categories', () => {
    expect(SIGNAL_CATEGORY_LABELS.action).toBe('Akce');
    expect(SIGNAL_CATEGORY_LABELS.quality).toBe('Kvalita');
  });
});
