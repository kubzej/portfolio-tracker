/**
 * Smart Recommendations System
 *
 * Generates contextual insights for portfolio stocks by combining:
 * - Fundamental analysis (valuation, profitability, growth, financial health)
 * - Technical analysis (RSI, MACD, Bollinger, ADX, Stochastic, Fibonacci)
 * - Analyst sentiment (consensus score, target price)
 * - News sentiment (article sentiment scores)
 * - Insider activity (MSPR, net shares)
 * - Portfolio context (weight, avg price, unrealized gain)
 */

import type { AnalystData, FundamentalMetrics } from '@/services/api/analysis';
import type { TechnicalData } from '@/services/api/technical';
import type { NewsArticle } from '@/services/api/news';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

/** Extended analyst data with portfolio context */
export interface EnrichedAnalystData extends AnalystData {
  weight: number;
  currentValue: number;
  totalShares: number;
  avgBuyPrice: number;
  totalInvested: number;
  unrealizedGain: number;
  gainPercentage: number;
  targetPrice: number | null;
  distanceToTarget: number | null;
}

/** Insider sentiment time range options (in months) */
export type InsiderTimeRange = 1 | 2 | 3 | 6 | 12;

/** Score breakdown for a single category */
export interface ScoreComponent {
  category: string;
  score: number;
  maxScore: number;
  percent: number;
  details: string[];
  sentiment: 'bullish' | 'bearish' | 'neutral';
}

/** Signal types that can be generated */
export type SignalType =
  | 'DIP_OPPORTUNITY' // Oversold + fundamentals OK
  | 'MOMENTUM' // Technical bullish trend
  | 'CONVICTION_HOLD' // Long-term strong metrics
  | 'NEAR_TARGET' // Close to analyst target price
  | 'WATCH_CLOSELY' // Something is changing
  | 'CONSIDER_TRIM' // Overbought + high weight + near target
  | 'ACCUMULATE' // Good stock, wait for better price
  | 'NEUTRAL'; // No strong signal

/** A single insight/signal for a stock */
export interface StockSignal {
  type: SignalType;
  strength: number; // 0-100
  title: string;
  description: string;
  priority: number; // For sorting (lower = higher priority)
}

/** Complete recommendation for a stock */
export interface StockRecommendation {
  ticker: string;
  stockName: string;

  // Portfolio context
  weight: number;
  avgBuyPrice: number;
  currentPrice: number;
  gainPercentage: number;
  distanceFromAvg: number; // % difference from avg buy price

  // Composite scores (0-100)
  compositeScore: number;
  fundamentalScore: number;
  technicalScore: number;
  analystScore: number;
  newsScore: number;
  insiderScore: number;
  portfolioScore: number;

  // Conviction score (0-100) - long-term quality
  convictionScore: number;
  convictionLevel: 'HIGH' | 'MEDIUM' | 'LOW';

  // DIP score (0-100) - buying opportunity
  dipScore: number;
  isDip: boolean;
  dipQualityCheck: boolean; // Passes fundamental checks

  // Score breakdowns
  breakdown: ScoreComponent[];

  // Generated signals (sorted by priority)
  signals: StockSignal[];
  primarySignal: StockSignal;

  // Key points for display
  strengths: string[];
  concerns: string[];
  actionItems: string[];

  // Target price analysis
  targetPrice: number | null;
  targetUpside: number | null; // % upside to target

  // 52-week data
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  distanceFrom52wHigh: number | null; // % below 52w high

  // Technical summary
  technicalBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';

  // Buy Strategy
  buyStrategy: {
    buyZoneLow: number | null;
    buyZoneHigh: number | null;
    inBuyZone: boolean;
    dcaRecommendation: 'AGGRESSIVE' | 'NORMAL' | 'CAUTIOUS' | 'NO_DCA';
    dcaReason: string;
    maxAddPercent: number; // max % of portfolio to add
    riskRewardRatio: number | null;
    supportPrice: number | null;
  };

  // Exit Strategy
  exitStrategy: {
    takeProfit1: number | null; // First partial exit (e.g., 25% at this level)
    takeProfit2: number | null; // Second exit level
    takeProfit3: number | null; // Final target
    stopLoss: number | null;
    trailingStopPercent: number | null;
    holdingPeriod: 'SWING' | 'MEDIUM' | 'LONG'; // Recommended holding period
    holdingReason: string;
    resistanceLevel: number | null;
  };

  // For signal logging
  metadata: {
    rsiValue: number | null;
    macdSignal: string | null;
    bollingerPosition: string | null;
    newsSentiment: number | null;
    insiderMspr: number | null;
  };
}

/** Input data for generating recommendations */
export interface RecommendationInput {
  analystData: EnrichedAnalystData;
  technicalData?: TechnicalData;
  newsArticles?: NewsArticle[];
  insiderTimeRange: InsiderTimeRange;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Weight distribution for composite score */
const SCORE_WEIGHTS = {
  fundamental: 0.2,
  technical: 0.25,
  analyst: 0.15,
  news: 0.1,
  insider: 0.1,
  portfolio: 0.2,
};

/** Signal priorities (lower = higher priority) */
const SIGNAL_PRIORITIES: Record<SignalType, number> = {
  DIP_OPPORTUNITY: 1,
  MOMENTUM: 2,
  CONVICTION_HOLD: 3,
  NEAR_TARGET: 4,
  CONSIDER_TRIM: 5,
  WATCH_CLOSELY: 6,
  ACCUMULATE: 7,
  NEUTRAL: 10,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Filter insider sentiment data based on time range (in months)
 */
export function getFilteredInsiderSentiment(
  item: EnrichedAnalystData,
  months: InsiderTimeRange
): { mspr: number | null; change: number | null } {
  const monthlyData = item.insiderSentiment?.monthlyData;

  if (!monthlyData || monthlyData.length === 0) {
    if (
      item.insiderSentiment?.mspr !== null &&
      item.insiderSentiment?.mspr !== undefined
    ) {
      return {
        mspr: item.insiderSentiment.mspr,
        change: item.insiderSentiment.change ?? null,
      };
    }
    return { mspr: null, change: null };
  }

  const now = new Date();
  const cutoffYear = now.getFullYear();
  const cutoffMonth = now.getMonth() + 1;

  const filtered = monthlyData.filter((d) => {
    const monthsDiff = (cutoffYear - d.year) * 12 + (cutoffMonth - d.month);
    return monthsDiff >= 0 && monthsDiff < months;
  });

  const dataToUse =
    filtered.length > 0 ? filtered : monthlyData.slice(0, months);

  if (dataToUse.length === 0) {
    return { mspr: null, change: null };
  }

  const avgMspr =
    dataToUse.reduce((sum, d) => sum + d.mspr, 0) / dataToUse.length;
  const totalChange = dataToUse.reduce((sum, d) => sum + d.change, 0);

  return {
    mspr: Math.round(avgMspr * 100) / 100,
    change: totalChange,
  };
}

/**
 * Get sentiment label from score
 */
function getSentiment(
  score: number,
  maxScore: number
): 'bullish' | 'bearish' | 'neutral' {
  const percent = (score / maxScore) * 100;
  if (percent >= 65) return 'bullish';
  if (percent <= 35) return 'bearish';
  return 'neutral';
}

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

/**
 * Calculate fundamental score (0-100)
 * Based on: P/E, ROE, margins, growth, debt
 */
function calculateFundamentalScore(
  f: FundamentalMetrics | null | undefined
): ScoreComponent {
  const details: string[] = [];
  let score = 0;
  const maxScore = 100;

  if (!f) {
    return {
      category: 'Fundamentals',
      score: 0,
      maxScore,
      percent: 0,
      details: ['No fundamental data available'],
      sentiment: 'neutral',
    };
  }

  // P/E Ratio (0-20 points) - lower is better (within reason)
  if (f.peRatio !== null && f.peRatio !== undefined && f.peRatio > 0) {
    if (f.peRatio < 12) {
      score += 20;
      details.push(`P/E ${f.peRatio.toFixed(1)} - undervalued`);
    } else if (f.peRatio < 20) {
      score += 15;
      details.push(`P/E ${f.peRatio.toFixed(1)} - fair value`);
    } else if (f.peRatio < 30) {
      score += 10;
      details.push(`P/E ${f.peRatio.toFixed(1)} - growth premium`);
    } else if (f.peRatio < 50) {
      score += 5;
      details.push(`P/E ${f.peRatio.toFixed(1)} - expensive`);
    } else {
      details.push(`P/E ${f.peRatio.toFixed(1)} - very expensive`);
    }
  }

  // ROE (0-20 points) - higher is better
  if (f.roe !== null && f.roe !== undefined) {
    if (f.roe > 25) {
      score += 20;
      details.push(`ROE ${f.roe.toFixed(1)}% - exceptional`);
    } else if (f.roe > 18) {
      score += 16;
      details.push(`ROE ${f.roe.toFixed(1)}% - excellent`);
    } else if (f.roe > 12) {
      score += 12;
      details.push(`ROE ${f.roe.toFixed(1)}% - good`);
    } else if (f.roe > 5) {
      score += 6;
      details.push(`ROE ${f.roe.toFixed(1)}% - moderate`);
    } else if (f.roe > 0) {
      score += 2;
      details.push(`ROE ${f.roe.toFixed(1)}% - weak`);
    } else {
      details.push(`ROE ${f.roe.toFixed(1)}% - negative`);
    }
  }

  // Net Margin (0-20 points) - higher is better
  if (f.netMargin !== null && f.netMargin !== undefined) {
    if (f.netMargin > 25) {
      score += 20;
      details.push(`Net margin ${f.netMargin.toFixed(1)}% - exceptional`);
    } else if (f.netMargin > 15) {
      score += 15;
      details.push(`Net margin ${f.netMargin.toFixed(1)}% - strong`);
    } else if (f.netMargin > 8) {
      score += 10;
      details.push(`Net margin ${f.netMargin.toFixed(1)}% - decent`);
    } else if (f.netMargin > 0) {
      score += 5;
      details.push(`Net margin ${f.netMargin.toFixed(1)}% - thin`);
    } else {
      details.push(`Net margin ${f.netMargin.toFixed(1)}% - unprofitable`);
    }
  }

  // Revenue Growth (0-20 points)
  if (f.revenueGrowth !== null && f.revenueGrowth !== undefined) {
    if (f.revenueGrowth > 25) {
      score += 20;
      details.push(`Revenue growth ${f.revenueGrowth.toFixed(1)}% - rapid`);
    } else if (f.revenueGrowth > 15) {
      score += 15;
      details.push(`Revenue growth ${f.revenueGrowth.toFixed(1)}% - strong`);
    } else if (f.revenueGrowth > 5) {
      score += 10;
      details.push(`Revenue growth ${f.revenueGrowth.toFixed(1)}% - moderate`);
    } else if (f.revenueGrowth > 0) {
      score += 5;
      details.push(`Revenue growth ${f.revenueGrowth.toFixed(1)}% - slow`);
    } else {
      details.push(`Revenue growth ${f.revenueGrowth.toFixed(1)}% - declining`);
    }
  }

  // Debt/Equity (0-20 points) - lower is better
  if (f.debtToEquity !== null && f.debtToEquity !== undefined) {
    if (f.debtToEquity < 0.3) {
      score += 20;
      details.push(`D/E ${f.debtToEquity.toFixed(2)} - minimal debt`);
    } else if (f.debtToEquity < 0.7) {
      score += 16;
      details.push(`D/E ${f.debtToEquity.toFixed(2)} - low debt`);
    } else if (f.debtToEquity < 1.5) {
      score += 10;
      details.push(`D/E ${f.debtToEquity.toFixed(2)} - moderate debt`);
    } else if (f.debtToEquity < 2.5) {
      score += 4;
      details.push(`D/E ${f.debtToEquity.toFixed(2)} - high debt`);
    } else {
      details.push(`D/E ${f.debtToEquity.toFixed(2)} - very high debt`);
    }
  }

  return {
    category: 'Fundamentals',
    score,
    maxScore,
    percent: (score / maxScore) * 100,
    details,
    sentiment: getSentiment(score, maxScore),
  };
}

/**
 * Calculate technical score (0-100)
 * Based on: RSI, MACD, Bollinger, ADX, Stochastic
 */
function calculateTechnicalScore(
  tech: TechnicalData | undefined
): ScoreComponent {
  const details: string[] = [];
  let score = 0;
  const maxScore = 100;
  let bullishSignals = 0;
  let bearishSignals = 0;

  if (!tech) {
    return {
      category: 'Technical',
      score: 50, // Neutral when no data
      maxScore,
      percent: 50,
      details: ['No technical data available'],
      sentiment: 'neutral',
    };
  }

  // RSI (0-25 points)
  if (tech.rsi14 !== null && tech.rsi14 !== undefined) {
    const rsi = tech.rsi14;
    if (rsi < 30) {
      score += 25; // Oversold = bullish opportunity
      details.push(`RSI ${rsi.toFixed(0)} - oversold (bullish)`);
      bullishSignals++;
    } else if (rsi < 45) {
      score += 18;
      details.push(`RSI ${rsi.toFixed(0)} - approaching oversold`);
      bullishSignals++;
    } else if (rsi > 70) {
      score += 5;
      details.push(`RSI ${rsi.toFixed(0)} - overbought (bearish)`);
      bearishSignals++;
    } else if (rsi > 60) {
      score += 12;
      details.push(`RSI ${rsi.toFixed(0)} - bullish momentum`);
    } else {
      score += 15;
      details.push(`RSI ${rsi.toFixed(0)} - neutral`);
    }
  }

  // MACD (0-20 points)
  if (tech.macdHistogram !== null && tech.macdHistogram !== undefined) {
    const histogram = tech.macdHistogram;
    const macdTrend = tech.macdTrend;
    if (histogram > 0 && macdTrend === 'bullish') {
      score += 20;
      details.push('MACD bullish & strengthening');
      bullishSignals++;
    } else if (histogram > 0) {
      score += 15;
      details.push('MACD bullish');
      bullishSignals++;
    } else if (histogram < 0 && macdTrend === 'bearish') {
      score += 5;
      details.push('MACD bearish & weakening');
      bearishSignals++;
    } else if (histogram < 0) {
      score += 8;
      details.push('MACD bearish');
      bearishSignals++;
    } else {
      score += 10;
      details.push('MACD neutral');
    }
  }

  // Bollinger Bands (0-20 points)
  if (
    tech.bollingerUpper !== null &&
    tech.bollingerLower !== null &&
    tech.currentPrice !== null
  ) {
    const price = tech.currentPrice;
    const upper = tech.bollingerUpper;
    const lower = tech.bollingerLower;
    const middle = tech.bollingerMiddle ?? (upper + lower) / 2;

    if (price < lower) {
      score += 20; // Below lower band = potential bounce
      details.push('Price below lower Bollinger (oversold)');
      bullishSignals++;
    } else if (price < middle && price > lower) {
      score += 15;
      details.push('Price in lower Bollinger zone');
    } else if (price > upper) {
      score += 5;
      details.push('Price above upper Bollinger (overbought)');
      bearishSignals++;
    } else if (price > middle) {
      score += 12;
      details.push('Price in upper Bollinger zone');
    } else {
      score += 10;
      details.push('Price at Bollinger midline');
    }
  }

  // ADX - Trend Strength (0-15 points)
  if (tech.adx !== null && tech.plusDI !== null && tech.minusDI !== null) {
    const adx = tech.adx;
    const plusDI = tech.plusDI;
    const minusDI = tech.minusDI;
    if (adx > 25 && plusDI > minusDI) {
      score += 15;
      details.push(`ADX ${adx.toFixed(0)} - strong uptrend`);
      bullishSignals++;
    } else if (adx > 25 && minusDI > plusDI) {
      score += 5;
      details.push(`ADX ${adx.toFixed(0)} - strong downtrend`);
      bearishSignals++;
    } else if (adx < 20) {
      score += 8;
      details.push(`ADX ${adx.toFixed(0)} - weak trend/consolidation`);
    } else {
      score += 10;
      details.push(`ADX ${adx.toFixed(0)} - moderate trend`);
    }
  }

  // Stochastic (0-20 points)
  if (tech.stochasticK !== null && tech.stochasticD !== null) {
    const k = tech.stochasticK;
    const d = tech.stochasticD;
    if (k < 20 && d < 20) {
      score += 20;
      details.push(`Stoch %K:${k.toFixed(0)} %D:${d.toFixed(0)} - oversold`);
      bullishSignals++;
    } else if (k < 30) {
      score += 15;
      details.push(`Stoch %K:${k.toFixed(0)} - approaching oversold`);
    } else if (k > 80 && d > 80) {
      score += 5;
      details.push(`Stoch %K:${k.toFixed(0)} %D:${d.toFixed(0)} - overbought`);
      bearishSignals++;
    } else if (k > 70) {
      score += 10;
      details.push(`Stoch %K:${k.toFixed(0)} - strong momentum`);
    } else {
      score += 12;
      details.push(`Stoch %K:${k.toFixed(0)} - neutral`);
    }
  }

  // Determine overall sentiment based on signal count
  let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (bullishSignals >= 3) sentiment = 'bullish';
  else if (bearishSignals >= 3) sentiment = 'bearish';
  else if (bullishSignals > bearishSignals) sentiment = 'bullish';
  else if (bearishSignals > bullishSignals) sentiment = 'bearish';

  return {
    category: 'Technical',
    score,
    maxScore,
    percent: (score / maxScore) * 100,
    details,
    sentiment,
  };
}

/**
 * Calculate analyst score (0-100)
 * Based on: consensus score, analyst count
 */
function calculateAnalystScore(item: EnrichedAnalystData): ScoreComponent {
  const details: string[] = [];
  let score = 0;
  const maxScore = 100;

  // Consensus Score (0-70 points)
  // Scale: -2 (Strong Sell) to +2 (Strong Buy)
  if (item.consensusScore !== null) {
    const cs = item.consensusScore;
    if (cs > 1.5) {
      score += 70;
      details.push(`Consensus ${cs.toFixed(2)} - Strong Buy`);
    } else if (cs > 1) {
      score += 58;
      details.push(`Consensus ${cs.toFixed(2)} - Buy`);
    } else if (cs > 0.5) {
      score += 48;
      details.push(`Consensus ${cs.toFixed(2)} - Moderate Buy`);
    } else if (cs > 0) {
      score += 38;
      details.push(`Consensus ${cs.toFixed(2)} - Weak Buy`);
    } else if (cs > -0.5) {
      score += 28;
      details.push(`Consensus ${cs.toFixed(2)} - Hold`);
    } else if (cs > -1) {
      score += 14;
      details.push(`Consensus ${cs.toFixed(2)} - Underperform`);
    } else {
      score += 0;
      details.push(`Consensus ${cs.toFixed(2)} - Sell`);
    }
  }

  // Analyst Coverage (0-30 points) - more analysts = more reliable
  if (item.numberOfAnalysts !== null) {
    const count = item.numberOfAnalysts;
    if (count >= 20) {
      score += 30;
      details.push(`${count} analysts - high coverage`);
    } else if (count >= 10) {
      score += 24;
      details.push(`${count} analysts - good coverage`);
    } else if (count >= 5) {
      score += 16;
      details.push(`${count} analysts - moderate coverage`);
    } else if (count >= 1) {
      score += 8;
      details.push(`${count} analysts - low coverage`);
    } else {
      details.push('No analyst coverage');
    }
  }

  return {
    category: 'Analyst',
    score,
    maxScore,
    percent: (score / maxScore) * 100,
    details,
    sentiment: getSentiment(score, maxScore),
  };
}

/**
 * Calculate news sentiment score (0-100)
 * Based on: average sentiment from recent articles
 */
function calculateNewsScore(
  ticker: string,
  articles: NewsArticle[] | undefined
): ScoreComponent {
  const details: string[] = [];
  let score = 50; // Default neutral
  const maxScore = 100;

  if (!articles || articles.length === 0) {
    return {
      category: 'News',
      score: 50,
      maxScore,
      percent: 50,
      details: ['No recent news articles'],
      sentiment: 'neutral',
    };
  }

  // Filter articles for this ticker
  const tickerArticles = articles.filter(
    (a) => a.ticker === ticker || a.relatedTickers?.includes(ticker)
  );

  if (tickerArticles.length === 0) {
    return {
      category: 'News',
      score: 50,
      maxScore,
      percent: 50,
      details: ['No news for this stock'],
      sentiment: 'neutral',
    };
  }

  // Calculate average sentiment (-1 to +1)
  const avgSentiment =
    tickerArticles.reduce((sum, a) => {
      return sum + (a.sentiment?.score ?? 0);
    }, 0) / tickerArticles.length;

  // Convert -1..+1 to 0..100
  score = Math.round((avgSentiment + 1) * 50);

  // Count positive/negative articles
  const positive = tickerArticles.filter(
    (a) => (a.sentiment?.score ?? 0) > 0.2
  ).length;
  const negative = tickerArticles.filter(
    (a) => (a.sentiment?.score ?? 0) < -0.2
  ).length;
  const neutral = tickerArticles.length - positive - negative;

  details.push(
    `${tickerArticles.length} articles: ${positive} positive, ${neutral} neutral, ${negative} negative`
  );
  details.push(
    `Average sentiment: ${avgSentiment > 0 ? '+' : ''}${(
      avgSentiment * 100
    ).toFixed(0)}%`
  );

  return {
    category: 'News',
    score,
    maxScore,
    percent: (score / maxScore) * 100,
    details,
    sentiment:
      avgSentiment > 0.15
        ? 'bullish'
        : avgSentiment < -0.15
        ? 'bearish'
        : 'neutral',
  };
}

/**
 * Calculate insider sentiment score (0-100)
 * Based on: MSPR and net share changes
 */
function calculateInsiderScore(
  item: EnrichedAnalystData,
  timeRange: InsiderTimeRange
): ScoreComponent {
  const details: string[] = [];
  let score = 50; // Default neutral
  const maxScore = 100;

  const insider = getFilteredInsiderSentiment(item, timeRange);

  if (insider.mspr === null) {
    return {
      category: 'Insider',
      score: 50,
      maxScore,
      percent: 50,
      details: ['No insider data available'],
      sentiment: 'neutral',
    };
  }

  // MSPR ranges from roughly -100 to +100
  // Convert to 0-100 score (50 = neutral)
  score = Math.round(50 + insider.mspr / 2);
  score = Math.max(0, Math.min(100, score));

  if (insider.mspr > 50) {
    details.push(`MSPR +${insider.mspr.toFixed(1)} - very strong buying`);
  } else if (insider.mspr > 25) {
    details.push(`MSPR +${insider.mspr.toFixed(1)} - strong buying`);
  } else if (insider.mspr > 0) {
    details.push(`MSPR +${insider.mspr.toFixed(1)} - moderate buying`);
  } else if (insider.mspr > -25) {
    details.push(`MSPR ${insider.mspr.toFixed(1)} - moderate selling`);
  } else if (insider.mspr > -50) {
    details.push(`MSPR ${insider.mspr.toFixed(1)} - strong selling`);
  } else {
    details.push(`MSPR ${insider.mspr.toFixed(1)} - very strong selling`);
  }

  if (insider.change !== null) {
    details.push(
      `Net shares: ${
        insider.change > 0 ? '+' : ''
      }${insider.change.toLocaleString()}`
    );
  }

  return {
    category: 'Insider',
    score,
    maxScore,
    percent: (score / maxScore) * 100,
    details,
    sentiment:
      insider.mspr > 15
        ? 'bullish'
        : insider.mspr < -15
        ? 'bearish'
        : 'neutral',
  };
}

/**
 * Calculate portfolio context score (0-100)
 * Based on: position size, distance from avg price, gain/loss, target price upside
 */
function calculatePortfolioScore(item: EnrichedAnalystData): ScoreComponent {
  const details: string[] = [];
  let score = 0;
  const maxScore = 100;

  // Target Price Upside (0-30 points) - your personal target
  if (
    item.targetPrice !== null &&
    item.currentPrice !== null &&
    item.currentPrice > 0
  ) {
    const upside =
      ((item.targetPrice - item.currentPrice) / item.currentPrice) * 100;
    if (upside > 40) {
      score += 30;
      details.push(`Target upside +${upside.toFixed(0)}% - high potential`);
    } else if (upside > 25) {
      score += 25;
      details.push(`Target upside +${upside.toFixed(0)}% - good potential`);
    } else if (upside > 15) {
      score += 20;
      details.push(`Target upside +${upside.toFixed(0)}% - moderate`);
    } else if (upside > 5) {
      score += 12;
      details.push(`Target upside +${upside.toFixed(0)}% - limited`);
    } else if (upside > -5) {
      score += 6;
      details.push(
        `Near target price (${upside > 0 ? '+' : ''}${upside.toFixed(0)}%)`
      );
    } else {
      score += 0;
      details.push(
        `Above target ${Math.abs(upside).toFixed(0)}% - consider trimming`
      );
    }
  }

  // Distance from average buy price (0-25 points)
  if (item.avgBuyPrice > 0 && item.currentPrice !== null) {
    const distanceFromAvg =
      ((item.currentPrice - item.avgBuyPrice) / item.avgBuyPrice) * 100;

    if (distanceFromAvg < -20) {
      score += 25; // Significantly below avg = good DCA opportunity
      details.push(
        `${distanceFromAvg.toFixed(1)}% below avg cost - DCA opportunity`
      );
    } else if (distanceFromAvg < -10) {
      score += 20;
      details.push(`${distanceFromAvg.toFixed(1)}% below avg cost`);
    } else if (distanceFromAvg < 0) {
      score += 15;
      details.push(`${distanceFromAvg.toFixed(1)}% below avg cost`);
    } else if (distanceFromAvg < 20) {
      score += 12;
      details.push(`+${distanceFromAvg.toFixed(1)}% above avg cost`);
    } else if (distanceFromAvg < 50) {
      score += 8;
      details.push(`+${distanceFromAvg.toFixed(1)}% above avg cost`);
    } else {
      score += 4;
      details.push(
        `+${distanceFromAvg.toFixed(
          1
        )}% above avg cost - consider taking profits`
      );
    }
  }

  // Position weight (0-20 points)
  // Balanced weight (2-8%) is ideal
  if (item.weight !== undefined) {
    if (item.weight > 15) {
      score += 4;
      details.push(`Weight ${item.weight.toFixed(1)}% - overweight (risk)`);
    } else if (item.weight > 8) {
      score += 12;
      details.push(`Weight ${item.weight.toFixed(1)}% - slightly overweight`);
    } else if (item.weight >= 2) {
      score += 20;
      details.push(`Weight ${item.weight.toFixed(1)}% - balanced position`);
    } else {
      score += 16;
      details.push(`Weight ${item.weight.toFixed(1)}% - small position`);
    }
  }

  // Unrealized gain status (0-25 points)
  if (item.gainPercentage !== undefined) {
    if (item.gainPercentage > 100) {
      score += 15;
      details.push(
        `+${item.gainPercentage.toFixed(0)}% gain - strong performer`
      );
    } else if (item.gainPercentage > 50) {
      score += 18;
      details.push(`+${item.gainPercentage.toFixed(0)}% gain - solid return`);
    } else if (item.gainPercentage > 20) {
      score += 22;
      details.push(`+${item.gainPercentage.toFixed(0)}% gain`);
    } else if (item.gainPercentage > 0) {
      score += 25;
      details.push(`+${item.gainPercentage.toFixed(0)}% gain - in profit`);
    } else if (item.gainPercentage > -10) {
      score += 20;
      details.push(`${item.gainPercentage.toFixed(0)}% - small loss`);
    } else if (item.gainPercentage > -25) {
      score += 15;
      details.push(`${item.gainPercentage.toFixed(0)}% - moderate loss`);
    } else {
      score += 8;
      details.push(`${item.gainPercentage.toFixed(0)}% - significant loss`);
    }
  }

  // Cap at 100
  score = Math.min(100, score);

  return {
    category: 'Portfolio',
    score,
    maxScore,
    percent: (score / maxScore) * 100,
    details,
    sentiment: score >= 65 ? 'bullish' : score <= 35 ? 'bearish' : 'neutral',
  };
}

// ============================================================================
// DIP DETECTION
// ============================================================================

/**
 * Calculate DIP score (0-100)
 * Identifies oversold conditions that may present buying opportunities
 */
function calculateDipScore(
  tech: TechnicalData | undefined,
  item: EnrichedAnalystData
): { score: number; details: string[] } {
  let score = 0;
  const details: string[] = [];

  // RSI based (0-25 points)
  if (tech?.rsi14 !== null && tech?.rsi14 !== undefined) {
    const rsi = tech.rsi14;
    if (rsi < 25) {
      score += 25;
      details.push(`RSI ${rsi.toFixed(0)} - deeply oversold`);
    } else if (rsi < 30) {
      score += 20;
      details.push(`RSI ${rsi.toFixed(0)} - oversold`);
    } else if (rsi < 40) {
      score += 10;
      details.push(`RSI ${rsi.toFixed(0)} - approaching oversold`);
    }
  }

  // Bollinger position (0-20 points)
  if (
    tech &&
    tech.bollingerLower !== null &&
    tech.bollingerMiddle !== null &&
    tech.currentPrice !== null
  ) {
    const price = tech.currentPrice;
    const lower = tech.bollingerLower;
    const middle = tech.bollingerMiddle;
    const bandWidth = middle - lower;

    if (price < lower) {
      score += 20;
      details.push('Below lower Bollinger band');
    } else if (price < lower + bandWidth * 0.2) {
      score += 12;
      details.push('Near lower Bollinger band');
    }
  }

  // SMA position (0-20 points)
  if (tech?.currentPrice !== null && tech?.currentPrice !== undefined) {
    const price = tech.currentPrice;
    const sma50 = tech.sma50;
    const sma200 = tech.sma200;

    if (sma200 !== null && sma200 !== undefined && price < sma200 * 0.9) {
      score += 15;
      details.push('Price >10% below SMA200');
    } else if (sma200 !== null && sma200 !== undefined && price < sma200) {
      score += 10;
      details.push('Price below SMA200');
    }

    if (sma50 !== null && sma50 !== undefined && price < sma50 * 0.95) {
      score += 5;
      details.push('Price below SMA50');
    }
  }

  // 52-week position (0-15 points)
  if (
    item.fiftyTwoWeekHigh !== null &&
    item.fiftyTwoWeekLow !== null &&
    item.currentPrice !== null
  ) {
    const dropFromHigh =
      ((item.fiftyTwoWeekHigh - item.currentPrice) / item.fiftyTwoWeekHigh) *
      100;

    if (dropFromHigh > 30) {
      score += 15;
      details.push(`${dropFromHigh.toFixed(0)}% below 52W high`);
    } else if (dropFromHigh > 20) {
      score += 10;
      details.push(`${dropFromHigh.toFixed(0)}% below 52W high`);
    } else if (dropFromHigh > 10) {
      score += 5;
      details.push(`${dropFromHigh.toFixed(0)}% below 52W high`);
    }
  }

  // Stochastic (0-10 points)
  if (tech?.stochasticK !== null && tech?.stochasticK !== undefined) {
    const k = tech.stochasticK;
    if (k < 20) {
      score += 10;
      details.push(`Stochastic oversold (${k.toFixed(0)})`);
    } else if (k < 30) {
      score += 5;
      details.push(`Stochastic low (${k.toFixed(0)})`);
    }
  }

  // Distance from avg buy price (0-10 points)
  if (item.avgBuyPrice > 0 && item.currentPrice !== null) {
    const distanceFromAvg =
      ((item.currentPrice - item.avgBuyPrice) / item.avgBuyPrice) * 100;
    if (distanceFromAvg < -15) {
      score += 10;
      details.push(`${distanceFromAvg.toFixed(0)}% below avg cost`);
    } else if (distanceFromAvg < -5) {
      score += 5;
      details.push(`${distanceFromAvg.toFixed(0)}% below avg cost`);
    }
  }

  return { score: Math.min(100, score), details };
}

/**
 * Check if DIP passes fundamental quality checks
 */
function checkDipQuality(
  fundamentalScore: number,
  analystScore: number,
  newsScore: number
): { passes: boolean; reasons: string[] } {
  const reasons: string[] = [];
  let passes = true;

  // Fundamentals should be at least decent (>35%)
  if (fundamentalScore < 35) {
    passes = false;
    reasons.push('Weak fundamentals');
  }

  // Analyst sentiment shouldn't be strongly negative (<25%)
  if (analystScore < 25) {
    passes = false;
    reasons.push('Analysts bearish');
  }

  // News sentiment shouldn't be extremely negative (<20%)
  if (newsScore < 20) {
    passes = false;
    reasons.push('Very negative news');
  }

  return { passes, reasons };
}

// ============================================================================
// BUY STRATEGY
// ============================================================================

interface BuyStrategy {
  buyZoneLow: number | null;
  buyZoneHigh: number | null;
  inBuyZone: boolean;
  dcaRecommendation: 'AGGRESSIVE' | 'NORMAL' | 'CAUTIOUS' | 'NO_DCA';
  dcaReason: string;
  maxAddPercent: number;
  riskRewardRatio: number | null;
  supportPrice: number | null;
}

/**
 * Calculate Buy Strategy
 * Determines buy zone, DCA recommendation, and risk/reward
 */
function calculateBuyStrategy(
  item: EnrichedAnalystData,
  tech: TechnicalData | undefined,
  isDip: boolean,
  isPrimarySignalBuyable: boolean
): BuyStrategy {
  const currentPrice = item.currentPrice ?? 0;
  const avgBuyPrice = item.avgBuyPrice;
  const weight = item.weight;
  const targetPrice = item.targetPrice;

  // Calculate support price (lowest of key technical levels)
  let supportPrice: number | null = null;
  const supportLevels: number[] = [];

  // Bollinger lower band
  if (tech?.bollingerLower !== null && tech?.bollingerLower !== undefined) {
    supportLevels.push(tech.bollingerLower);
  }

  // SMA 200
  if (tech?.sma200 !== null && tech?.sma200 !== undefined) {
    supportLevels.push(tech.sma200);
  }

  // 52-week low (strong support)
  if (item.fiftyTwoWeekLow !== null) {
    supportLevels.push(item.fiftyTwoWeekLow);
  }

  if (supportLevels.length > 0) {
    // Use a weighted support - not the absolute lowest, but a reasonable one
    supportLevels.sort((a, b) => a - b);
    // Take the second lowest if available, otherwise the lowest
    supportPrice =
      supportLevels.length > 1 ? supportLevels[1] : supportLevels[0];
  }

  // Calculate Buy Zone
  // Low: Support level or 10% below current price
  // High: Avg buy price or current price (don't buy higher than you already have)
  let buyZoneLow: number | null = null;
  let buyZoneHigh: number | null = null;

  if (currentPrice > 0) {
    // Buy zone low - based on technical support or % drop
    if (supportPrice && supportPrice < currentPrice) {
      buyZoneLow = supportPrice;
    } else {
      buyZoneLow = currentPrice * 0.9; // 10% below current
    }

    // Buy zone high - don't recommend buying higher than avg price (with some tolerance)
    if (avgBuyPrice > 0) {
      buyZoneHigh = Math.min(avgBuyPrice * 1.05, currentPrice); // Max 5% above avg or current
    } else {
      buyZoneHigh = currentPrice;
    }

    // Ensure low < high
    if (buyZoneLow >= buyZoneHigh) {
      buyZoneLow = buyZoneHigh * 0.9;
    }
  }

  // Is current price in buy zone?
  const inBuyZone =
    buyZoneLow !== null &&
    buyZoneHigh !== null &&
    currentPrice >= buyZoneLow &&
    currentPrice <= buyZoneHigh;

  // DCA Recommendation based on weight
  let dcaRecommendation: 'AGGRESSIVE' | 'NORMAL' | 'CAUTIOUS' | 'NO_DCA';
  let dcaReason: string;
  let maxAddPercent: number;

  if (weight > 12) {
    dcaRecommendation = 'NO_DCA';
    dcaReason = 'Position overweight (>12%)';
    maxAddPercent = 0;
  } else if (weight > 8) {
    dcaRecommendation = 'CAUTIOUS';
    dcaReason = 'Position overweight (8-12%)';
    maxAddPercent = 0.5;
  } else if (weight >= 3) {
    dcaRecommendation = 'NORMAL';
    dcaReason = 'Position balanced (3-8%)';
    maxAddPercent = 1;
  } else {
    dcaRecommendation = 'AGGRESSIVE';
    dcaReason = 'Position underweight (<3%)';
    maxAddPercent = 2;
  }

  // Override if not a buy signal
  if (!isPrimarySignalBuyable && !isDip) {
    if (dcaRecommendation !== 'NO_DCA') {
      dcaRecommendation = 'CAUTIOUS';
      dcaReason = 'No strong buy signal';
      maxAddPercent = Math.min(maxAddPercent, 0.5);
    }
  }

  // Calculate Risk/Reward ratio
  let riskRewardRatio: number | null = null;
  if (
    targetPrice &&
    currentPrice > 0 &&
    supportPrice &&
    supportPrice < currentPrice
  ) {
    const potentialUpside = targetPrice - currentPrice;
    const potentialDownside = currentPrice - supportPrice;
    if (potentialDownside > 0) {
      riskRewardRatio =
        Math.round((potentialUpside / potentialDownside) * 10) / 10;
    }
  }

  return {
    buyZoneLow,
    buyZoneHigh,
    inBuyZone,
    dcaRecommendation,
    dcaReason,
    maxAddPercent,
    riskRewardRatio,
    supportPrice,
  };
}

// ============================================================================
// EXIT STRATEGY
// ============================================================================

interface ExitStrategy {
  takeProfit1: number | null;
  takeProfit2: number | null;
  takeProfit3: number | null;
  stopLoss: number | null;
  trailingStopPercent: number | null;
  holdingPeriod: 'SWING' | 'MEDIUM' | 'LONG';
  holdingReason: string;
  resistanceLevel: number | null;
}

/**
 * Calculate Exit Strategy
 * Determines take-profit levels, stop-loss, and recommended holding period
 */
function calculateExitStrategy(
  item: EnrichedAnalystData,
  tech: TechnicalData | undefined,
  convictionLevel: 'HIGH' | 'MEDIUM' | 'LOW',
  technicalBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL'
): ExitStrategy {
  const currentPrice = item.currentPrice ?? 0;
  const avgBuyPrice = item.avgBuyPrice;
  const targetPrice = item.targetPrice ?? item.analystTargetPrice ?? null;
  const fib = tech?.fibonacciLevels;

  // Calculate resistance level (highest of key levels)
  let resistanceLevel: number | null = null;
  const resistanceLevels: number[] = [];

  // Bollinger upper band
  if (tech?.bollingerUpper !== null && tech?.bollingerUpper !== undefined) {
    resistanceLevels.push(tech.bollingerUpper);
  }

  // 52-week high
  if (item.fiftyTwoWeekHigh !== null) {
    resistanceLevels.push(item.fiftyTwoWeekHigh);
  }

  // Fibonacci levels (if in downtrend, retracement levels are resistance)
  if (fib && fib.trend === 'downtrend') {
    resistanceLevels.push(fib.level382, fib.level500, fib.level618);
  }

  if (resistanceLevels.length > 0) {
    // Use lowest resistance above current price
    const aboveCurrent = resistanceLevels.filter((r) => r > currentPrice);
    if (aboveCurrent.length > 0) {
      resistanceLevel = Math.min(...aboveCurrent);
    }
  }

  // Calculate take-profit levels
  let takeProfit1: number | null = null;
  let takeProfit2: number | null = null;
  let takeProfit3: number | null = null;

  if (currentPrice > 0) {
    // TP1: 8-12% gain or first resistance
    const tp1Percent = technicalBias === 'BULLISH' ? 0.12 : 0.08;
    takeProfit1 = Math.round(currentPrice * (1 + tp1Percent) * 100) / 100;

    // If resistance is closer, use that
    if (resistanceLevel && resistanceLevel < takeProfit1) {
      takeProfit1 = resistanceLevel;
    }

    // TP2: 20-25% gain or target price
    const tp2Percent = technicalBias === 'BULLISH' ? 0.25 : 0.18;
    takeProfit2 = Math.round(currentPrice * (1 + tp2Percent) * 100) / 100;

    // If we have target price, use it as TP2 or TP3
    if (targetPrice && targetPrice > currentPrice) {
      if (targetPrice <= takeProfit1 * 1.1) {
        // Target is close to TP1, make it TP1
        takeProfit1 = targetPrice;
        takeProfit2 = Math.round(targetPrice * 1.15 * 100) / 100;
      } else if (targetPrice <= takeProfit2 * 1.1) {
        // Target is close to TP2
        takeProfit2 = targetPrice;
      }
    }

    // TP3: 35-50% gain or 52w high
    const tp3Percent = convictionLevel === 'HIGH' ? 0.5 : 0.35;
    takeProfit3 = Math.round(currentPrice * (1 + tp3Percent) * 100) / 100;

    // If target price is higher, use it for TP3
    if (targetPrice && targetPrice > takeProfit2) {
      takeProfit3 = targetPrice;
    }

    // If 52w high is achievable and higher than TP3, consider it
    if (item.fiftyTwoWeekHigh && item.fiftyTwoWeekHigh > takeProfit3) {
      takeProfit3 = item.fiftyTwoWeekHigh;
    }
  }

  // Calculate stop-loss
  let stopLoss: number | null = null;
  if (currentPrice > 0 && avgBuyPrice > 0) {
    // Base stop-loss on avg buy price (don't want to lose money)
    // Allow 8-15% drawdown from avg depending on conviction
    const maxDrawdown =
      convictionLevel === 'HIGH'
        ? 0.15
        : convictionLevel === 'MEDIUM'
        ? 0.12
        : 0.08;
    stopLoss = Math.round(avgBuyPrice * (1 - maxDrawdown) * 100) / 100;

    // If we're already at a loss, use technical support
    if (currentPrice < avgBuyPrice && tech?.bollingerLower) {
      const technicalStop = tech.bollingerLower * 0.97; // 3% below Bollinger
      stopLoss = Math.max(stopLoss, technicalStop);
    }
  }

  // Trailing stop percentage
  let trailingStopPercent: number | null = null;
  if (convictionLevel === 'HIGH') {
    trailingStopPercent = 15; // Wide trailing for high conviction
  } else if (convictionLevel === 'MEDIUM') {
    trailingStopPercent = 10;
  } else {
    trailingStopPercent = 7; // Tight for low conviction
  }

  // Determine holding period
  let holdingPeriod: 'SWING' | 'MEDIUM' | 'LONG';
  let holdingReason: string;

  if (convictionLevel === 'HIGH' && technicalBias !== 'BEARISH') {
    holdingPeriod = 'LONG';
    holdingReason = 'Strong fundamentals and positive outlook';
  } else if (convictionLevel === 'LOW' || technicalBias === 'BEARISH') {
    holdingPeriod = 'SWING';
    if (technicalBias === 'BEARISH') {
      holdingReason = 'Bearish technicals - consider quick exit';
    } else {
      holdingReason = 'Weak fundamentals - trade momentum only';
    }
  } else {
    holdingPeriod = 'MEDIUM';
    holdingReason = 'Hold for target, reassess quarterly';
  }

  // Override for extreme cases
  if (item.gainPercentage > 50 && convictionLevel !== 'HIGH') {
    holdingPeriod = 'SWING';
    holdingReason = 'Large unrealized gain - consider taking profits';
  }

  return {
    takeProfit1,
    takeProfit2,
    takeProfit3,
    stopLoss,
    trailingStopPercent,
    holdingPeriod,
    holdingReason,
    resistanceLevel,
  };
}

// ============================================================================
// CONVICTION SCORE
// ============================================================================

/**
 * Calculate Conviction Score (0-100)
 * Measures long-term quality and holding conviction
 */
function calculateConvictionScore(
  item: EnrichedAnalystData,
  tech: TechnicalData | undefined,
  insiderScore: number
): { score: number; level: 'HIGH' | 'MEDIUM' | 'LOW'; details: string[] } {
  let score = 0;
  const details: string[] = [];
  const f = item.fundamentals;

  // === Fundamental Stability (40 points max) ===

  // High ROE (0-12 points)
  if (f?.roe !== null && f?.roe !== undefined) {
    if (f.roe > 20) {
      score += 12;
      details.push(`Strong ROE: ${f.roe.toFixed(1)}%`);
    } else if (f.roe > 15) {
      score += 9;
    } else if (f.roe > 10) {
      score += 5;
    }
  }

  // Consistent growth (0-10 points)
  if (f?.revenueGrowth5Y !== null && f?.revenueGrowth5Y !== undefined) {
    if (f.revenueGrowth5Y > 15) {
      score += 10;
      details.push(`5Y revenue CAGR: ${f.revenueGrowth5Y.toFixed(1)}%`);
    } else if (f.revenueGrowth5Y > 10) {
      score += 7;
    } else if (f.revenueGrowth5Y > 5) {
      score += 4;
    }
  }

  // Strong margins (0-10 points)
  if (f?.netMargin !== null && f?.netMargin !== undefined) {
    if (f.netMargin > 20) {
      score += 10;
      details.push(`High margins: ${f.netMargin.toFixed(1)}%`);
    } else if (f.netMargin > 12) {
      score += 7;
    } else if (f.netMargin > 5) {
      score += 3;
    }
  }

  // Low debt (0-8 points)
  if (f?.debtToEquity !== null && f?.debtToEquity !== undefined) {
    if (f.debtToEquity < 0.5) {
      score += 8;
      details.push('Low debt');
    } else if (f.debtToEquity < 1) {
      score += 5;
    } else if (f.debtToEquity < 2) {
      score += 2;
    }
  }

  // === Market Position (30 points max) ===

  // Analyst consensus (0-12 points)
  if (item.consensusScore !== null && item.consensusScore > 0.5) {
    const points = Math.min(12, Math.round(item.consensusScore * 6));
    score += points;
    details.push('Positive analyst consensus');
  }

  // Target price upside (0-10 points)
  // Priority: 1) Personal target (holdings), 2) Analyst target (from Yahoo), 3) Consensus proxy
  let targetUpside: number | null = null;
  let targetSource: 'personal' | 'analyst' | 'estimated' | null = null;

  if (
    item.targetPrice !== null &&
    item.currentPrice !== null &&
    item.currentPrice > 0
  ) {
    // Personal target price available (holdings)
    targetUpside =
      ((item.targetPrice - item.currentPrice) / item.currentPrice) * 100;
    targetSource = 'personal';
  } else if (
    'analystTargetPrice' in item &&
    (item as { analystTargetPrice?: number | null }).analystTargetPrice !==
      null &&
    item.currentPrice !== null &&
    item.currentPrice > 0
  ) {
    // Analyst target price from Yahoo Finance (research)
    const analystTarget = (item as { analystTargetPrice: number })
      .analystTargetPrice;
    targetUpside =
      ((analystTarget - item.currentPrice) / item.currentPrice) * 100;
    targetSource = 'analyst';
  } else if (item.consensusScore !== null) {
    // Fallback: estimate upside from analyst consensus
    if (item.consensusScore >= 1.5) {
      targetUpside = 25;
    } else if (item.consensusScore >= 1.0) {
      targetUpside = 15;
    } else if (item.consensusScore >= 0.5) {
      targetUpside = 8;
    }
    targetSource = 'estimated';
  }

  if (targetUpside !== null) {
    if (targetUpside > 25) {
      score += 10;
      if (targetSource === 'personal') {
        details.push(`${targetUpside.toFixed(0)}% upside to target`);
      } else if (targetSource === 'analyst') {
        details.push(`${targetUpside.toFixed(0)}% upside to analyst target`);
      }
    } else if (targetUpside > 15) {
      score += 7;
      if (targetSource === 'analyst') {
        details.push(`${targetUpside.toFixed(0)}% upside to analyst target`);
      }
    } else if (targetUpside > 5) {
      score += 3;
    }
  }

  // Earnings consistency (0-8 points)
  if (item.earnings && item.earnings.length >= 4) {
    const beats = item.earnings
      .slice(0, 4)
      .filter(
        (e) => e.surprisePercent !== null && e.surprisePercent > 0
      ).length;
    if (beats >= 4) {
      score += 8;
      details.push('Beat earnings 4/4 quarters');
    } else if (beats >= 3) {
      score += 6;
      details.push(`Beat earnings ${beats}/4 quarters`);
    } else if (beats >= 2) {
      score += 3;
    }
  }

  // === Momentum & Sentiment (30 points max) ===

  // Insider buying (0-12 points)
  if (insiderScore > 65) {
    score += 12;
    details.push('Strong insider buying');
  } else if (insiderScore > 55) {
    score += 8;
  } else if (insiderScore > 45) {
    score += 4;
  }

  // Price above SMA200 (0-10 points)
  if (
    tech?.sma200 !== null &&
    tech?.sma200 !== undefined &&
    tech.currentPrice !== null &&
    tech.currentPrice !== undefined
  ) {
    if (tech.currentPrice > tech.sma200) {
      score += 10;
      details.push('Price above SMA200 (uptrend)');
    } else if (tech.currentPrice > tech.sma200 * 0.95) {
      score += 5;
    }
  }

  // Recent momentum (0-8 points)
  if (tech?.rsi14 !== null && tech?.rsi14 !== undefined) {
    const rsi = tech.rsi14;
    if (rsi > 50 && rsi < 70) {
      score += 8;
      details.push('Healthy momentum');
    } else if (rsi > 40 && rsi < 60) {
      score += 5;
    }
  }

  // Determine level
  let level: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  if (score >= 70) level = 'HIGH';
  else if (score >= 45) level = 'MEDIUM';

  return { score: Math.min(100, score), level, details };
}

// ============================================================================
// SIGNAL GENERATION
// ============================================================================

/**
 * Generate signals based on all scores
 */
function generateSignals(
  _compositeScore: number,
  fundamentalScore: number,
  technicalScore: number,
  _analystScore: number,
  newsScore: number,
  insiderScore: number,
  _portfolioScore: number,
  dipScore: number,
  dipQualityPasses: boolean,
  convictionScore: number,
  convictionLevel: 'HIGH' | 'MEDIUM' | 'LOW',
  targetUpside: number | null,
  _distanceFromAvg: number,
  weight: number,
  tech: TechnicalData | undefined
): StockSignal[] {
  const signals: StockSignal[] = [];

  // === DIP OPPORTUNITY ===
  if (dipScore >= 50 && dipQualityPasses) {
    signals.push({
      type: 'DIP_OPPORTUNITY',
      strength: dipScore,
      title: 'DIP Opportunity',
      description: `Oversold conditions (DIP score: ${dipScore}). Fundamentals check out.`,
      priority: SIGNAL_PRIORITIES.DIP_OPPORTUNITY,
    });
  }

  // === MOMENTUM ===
  const rsiValue = tech?.rsi14 ?? null;
  if (
    technicalScore >= 70 &&
    rsiValue !== null &&
    rsiValue > 50 &&
    rsiValue < 70
  ) {
    signals.push({
      type: 'MOMENTUM',
      strength: technicalScore,
      title: 'Momentum Play',
      description: 'Technical indicators are bullish with confirmed trend.',
      priority: SIGNAL_PRIORITIES.MOMENTUM,
    });
  }

  // === CONVICTION HOLD ===
  if (convictionLevel === 'HIGH') {
    signals.push({
      type: 'CONVICTION_HOLD',
      strength: convictionScore,
      title: 'High Conviction Hold',
      description:
        'Strong long-term fundamentals. Hold through short-term noise.',
      priority: SIGNAL_PRIORITIES.CONVICTION_HOLD,
    });
  }

  // === NEAR TARGET ===
  if (targetUpside !== null && Math.abs(targetUpside) <= 8) {
    signals.push({
      type: 'NEAR_TARGET',
      strength: 100 - Math.abs(targetUpside) * 5,
      title: 'Near Target Price',
      description: `Within ${Math.abs(targetUpside).toFixed(
        1
      )}% of analyst target.`,
      priority: SIGNAL_PRIORITIES.NEAR_TARGET,
    });
  }

  // === CONSIDER TRIM ===
  if (
    technicalScore < 40 &&
    (rsiValue ?? 50) > 70 &&
    weight > 8 &&
    targetUpside !== null &&
    targetUpside < 5
  ) {
    signals.push({
      type: 'CONSIDER_TRIM',
      strength: 70,
      title: 'Consider Trimming',
      description:
        'Overbought, high weight, and near target. Consider taking some profits.',
      priority: SIGNAL_PRIORITIES.CONSIDER_TRIM,
    });
  }

  // === WATCH CLOSELY ===
  if (
    (fundamentalScore < 35 && fundamentalScore > 20) ||
    insiderScore < 35 ||
    (newsScore < 30 && newsScore > 15)
  ) {
    signals.push({
      type: 'WATCH_CLOSELY',
      strength: 50,
      title: 'Watch Closely',
      description: 'Some metrics are deteriorating. Monitor for changes.',
      priority: SIGNAL_PRIORITIES.WATCH_CLOSELY,
    });
  }

  // === ACCUMULATE ===
  if (
    convictionLevel !== 'LOW' &&
    dipScore < 40 &&
    dipScore > 20 &&
    fundamentalScore >= 50
  ) {
    signals.push({
      type: 'ACCUMULATE',
      strength: 60,
      title: 'Accumulate',
      description: 'Good quality stock. Wait for better entry or DCA slowly.',
      priority: SIGNAL_PRIORITIES.ACCUMULATE,
    });
  }

  // If no signals, add neutral
  if (signals.length === 0) {
    signals.push({
      type: 'NEUTRAL',
      strength: 50,
      title: 'No Strong Signal',
      description: 'No actionable signals at this time.',
      priority: SIGNAL_PRIORITIES.NEUTRAL,
    });
  }

  // Sort by priority
  return signals.sort((a, b) => a.priority - b.priority);
}

// ============================================================================
// MAIN RECOMMENDATION FUNCTION
// ============================================================================

/**
 * Generate complete recommendation for a stock
 */
export function generateRecommendation(
  input: RecommendationInput
): StockRecommendation {
  const {
    analystData: item,
    technicalData: tech,
    newsArticles,
    insiderTimeRange,
  } = input;

  // Calculate all score components
  const fundamentalComponent = calculateFundamentalScore(item.fundamentals);
  const technicalComponent = calculateTechnicalScore(tech);
  const analystComponent = calculateAnalystScore(item);
  const newsComponent = calculateNewsScore(item.ticker, newsArticles);
  const insiderComponent = calculateInsiderScore(item, insiderTimeRange);
  const portfolioComponent = calculatePortfolioScore(item);

  // Calculate composite score
  const compositeScore = Math.round(
    fundamentalComponent.percent * SCORE_WEIGHTS.fundamental +
      technicalComponent.percent * SCORE_WEIGHTS.technical +
      analystComponent.percent * SCORE_WEIGHTS.analyst +
      newsComponent.percent * SCORE_WEIGHTS.news +
      insiderComponent.percent * SCORE_WEIGHTS.insider +
      portfolioComponent.percent * SCORE_WEIGHTS.portfolio
  );

  // Calculate DIP score
  const dipResult = calculateDipScore(tech, item);
  const dipQuality = checkDipQuality(
    fundamentalComponent.percent,
    analystComponent.percent,
    newsComponent.percent
  );

  // Calculate conviction score
  const conviction = calculateConvictionScore(
    item,
    tech,
    insiderComponent.percent
  );

  // Calculate target upside
  let targetUpside: number | null = null;
  if (
    item.targetPrice !== null &&
    item.currentPrice !== null &&
    item.currentPrice > 0
  ) {
    targetUpside =
      ((item.targetPrice - item.currentPrice) / item.currentPrice) * 100;
  }

  // Calculate distance from average
  let distanceFromAvg = 0;
  if (item.avgBuyPrice > 0 && item.currentPrice !== null) {
    distanceFromAvg =
      ((item.currentPrice - item.avgBuyPrice) / item.avgBuyPrice) * 100;
  }

  // Determine technical bias
  let technicalBias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  if (technicalComponent.sentiment === 'bullish') technicalBias = 'BULLISH';
  else if (technicalComponent.sentiment === 'bearish')
    technicalBias = 'BEARISH';

  // Generate signals
  const signals = generateSignals(
    compositeScore,
    fundamentalComponent.percent,
    technicalComponent.percent,
    analystComponent.percent,
    newsComponent.percent,
    insiderComponent.percent,
    portfolioComponent.percent,
    dipResult.score,
    dipQuality.passes,
    conviction.score,
    conviction.level,
    targetUpside,
    distanceFromAvg,
    item.weight,
    tech
  );

  // Compile strengths and concerns
  const strengths: string[] = [];
  const concerns: string[] = [];

  if (fundamentalComponent.percent >= 65) strengths.push('Strong fundamentals');
  if (technicalComponent.percent >= 65) strengths.push('Bullish technicals');
  if (analystComponent.percent >= 65)
    strengths.push('Positive analyst sentiment');
  if (insiderComponent.percent >= 60) strengths.push('Insider buying');
  if (conviction.level === 'HIGH') strengths.push('High conviction quality');
  if (dipResult.score >= 50 && dipQuality.passes)
    strengths.push('DIP opportunity');

  if (fundamentalComponent.percent < 35) concerns.push('Weak fundamentals');
  if (technicalComponent.percent < 35) concerns.push('Bearish technicals');
  if (analystComponent.percent < 35)
    concerns.push('Negative analyst sentiment');
  if (insiderComponent.percent < 40) concerns.push('Insider selling');
  if (newsComponent.percent < 35) concerns.push('Negative news sentiment');
  if (item.weight > 12) concerns.push('Overweight position');

  // Action items
  const actionItems: string[] = [];
  const primarySignal = signals[0];

  if (primarySignal.type === 'DIP_OPPORTUNITY') {
    actionItems.push('Consider adding to position');
    if (distanceFromAvg < -10) actionItems.push('Good DCA opportunity');
  }
  if (primarySignal.type === 'CONVICTION_HOLD') {
    actionItems.push('Hold through short-term volatility');
  }
  if (primarySignal.type === 'CONSIDER_TRIM') {
    actionItems.push('Consider taking partial profits');
  }
  if (primarySignal.type === 'WATCH_CLOSELY') {
    actionItems.push('Monitor upcoming earnings');
    actionItems.push('Set price alerts');
  }

  // Calculate buy strategy
  const isPrimarySignalBuyable = [
    'DIP_OPPORTUNITY',
    'ACCUMULATE',
    'MOMENTUM',
  ].includes(primarySignal.type);
  const buyStrategy = calculateBuyStrategy(
    item,
    tech,
    dipResult.score >= 50,
    isPrimarySignalBuyable
  );

  // Calculate exit strategy
  const exitStrategy = calculateExitStrategy(
    item,
    tech,
    conviction.level,
    technicalBias
  );

  return {
    ticker: item.ticker,
    stockName: item.stockName,

    weight: item.weight,
    avgBuyPrice: item.avgBuyPrice,
    currentPrice: item.currentPrice ?? 0,
    gainPercentage: item.gainPercentage,
    distanceFromAvg,

    compositeScore,
    fundamentalScore: fundamentalComponent.percent,
    technicalScore: technicalComponent.percent,
    analystScore: analystComponent.percent,
    newsScore: newsComponent.percent,
    insiderScore: insiderComponent.percent,
    portfolioScore: portfolioComponent.percent,

    convictionScore: conviction.score,
    convictionLevel: conviction.level,

    dipScore: dipResult.score,
    isDip: dipResult.score >= 50,
    dipQualityCheck: dipQuality.passes,

    breakdown: [
      fundamentalComponent,
      technicalComponent,
      analystComponent,
      newsComponent,
      insiderComponent,
      portfolioComponent,
    ],

    signals,
    primarySignal,

    strengths: strengths.slice(0, 4),
    concerns: concerns.slice(0, 4),
    actionItems: actionItems.slice(0, 3),

    targetPrice: item.targetPrice,
    targetUpside,

    fiftyTwoWeekHigh: item.fiftyTwoWeekHigh,
    fiftyTwoWeekLow: item.fiftyTwoWeekLow,
    distanceFrom52wHigh:
      item.fiftyTwoWeekHigh && item.currentPrice
        ? ((item.fiftyTwoWeekHigh - item.currentPrice) /
            item.fiftyTwoWeekHigh) *
          100
        : null,

    technicalBias,

    buyStrategy,

    exitStrategy,

    metadata: {
      rsiValue: tech?.rsi14 ?? null,
      macdSignal:
        tech?.macdHistogram !== null && tech?.macdHistogram !== undefined
          ? tech.macdHistogram > 0
            ? 'bullish'
            : 'bearish'
          : null,
      bollingerPosition:
        tech &&
        tech.bollingerLower !== null &&
        tech.bollingerUpper !== null &&
        tech.currentPrice !== null
          ? tech.currentPrice < tech.bollingerLower
            ? 'below'
            : tech.currentPrice > tech.bollingerUpper
            ? 'above'
            : 'within'
          : null,
      newsSentiment:
        newsComponent.percent > 50
          ? (newsComponent.percent - 50) / 50
          : (newsComponent.percent - 50) / 50,
      insiderMspr: getFilteredInsiderSentiment(item, insiderTimeRange).mspr,
    },
  };
}

/**
 * Generate recommendations for all stocks in portfolio
 */
export function generateAllRecommendations(
  analystData: EnrichedAnalystData[],
  technicalData: TechnicalData[],
  newsArticles: NewsArticle[],
  insiderTimeRange: InsiderTimeRange
): StockRecommendation[] {
  return analystData
    .filter((item) => item.weight > 0)
    .map((item) => {
      const tech = technicalData.find((t) => t.ticker === item.ticker);
      return generateRecommendation({
        analystData: item,
        technicalData: tech,
        newsArticles,
        insiderTimeRange,
      });
    })
    .sort((a, b) => {
      // Sort by primary signal priority, then by composite score
      if (a.primarySignal.priority !== b.primarySignal.priority) {
        return a.primarySignal.priority - b.primarySignal.priority;
      }
      return b.compositeScore - a.compositeScore;
    });
}

// ============================================================================
// SIGNAL LOGGING (for future historical analysis)
// ============================================================================

export interface SignalLogEntry {
  ticker: string;
  signalType: SignalType;
  signalStrength: number;
  priceAtSignal: number;
  compositeScore: number;
  dipScore: number;
  convictionScore: number;
  metadata: StockRecommendation['metadata'];
}

/**
 * Create a signal log entry for database storage
 */
export function createSignalLogEntry(rec: StockRecommendation): SignalLogEntry {
  return {
    ticker: rec.ticker,
    signalType: rec.primarySignal.type,
    signalStrength: rec.primarySignal.strength,
    priceAtSignal: rec.currentPrice,
    compositeScore: rec.compositeScore,
    dipScore: rec.dipScore,
    convictionScore: rec.convictionScore,
    metadata: rec.metadata,
  };
}
