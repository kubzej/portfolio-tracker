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
  /** Raw score before normalization (v3.1: tracks actual point values) */
  rawScore?: number;
  /** Raw max score before normalization (v3.1: e.g., 140b, 120b, 80b, 60b) */
  rawMaxScore?: number;
}

/** Signal types that can be generated */
export type SignalType =
  // === ACTION SIGNALS (what to do) ===
  | 'DIP_OPPORTUNITY' // Oversold + fundamentals OK
  | 'BREAKOUT' // Price breaking out with volume
  | 'REVERSAL' // MACD divergence + oversold = potential reversal
  | 'MOMENTUM' // Technical bullish trend
  | 'ACCUMULATE' // Good stock, wait for better price or DCA
  | 'GOOD_ENTRY' // Research: quality stock below analyst target
  | 'WAIT_FOR_DIP' // Research: quality stock but price too high
  | 'NEAR_TARGET' // Close to target - consider action
  | 'TAKE_PROFIT' // Large gains - consider realizing
  | 'CONSIDER_TRIM' // Overbought + high weight
  // === QUALITY SIGNALS (stock assessment) ===
  | 'CONVICTION' // High conviction - top tier
  | 'QUALITY_CORE' // Strong fundamentals + analysts
  | 'UNDERVALUED' // Big upside potential
  | 'STRONG_TREND' // ADX strong + bullish
  | 'STEADY' // Solid, no action needed
  | 'WATCH' // Deteriorating metrics
  | 'WEAK' // Poor fundamentals/trend
  | 'OVERBOUGHT' // RSI + Stoch overbought
  | 'NEUTRAL'; // No strong signals

/** Signal category - separates action signals from quality signals */
export type SignalCategory = 'action' | 'quality';

/** Mapping of signal types to their categories */
export const SIGNAL_CATEGORIES: Record<SignalType, SignalCategory> = {
  // Action signals - what to do
  DIP_OPPORTUNITY: 'action',
  BREAKOUT: 'action',
  REVERSAL: 'action',
  MOMENTUM: 'action',
  ACCUMULATE: 'action',
  GOOD_ENTRY: 'action',
  WAIT_FOR_DIP: 'action',
  NEAR_TARGET: 'action',
  TAKE_PROFIT: 'action',
  CONSIDER_TRIM: 'action',

  // Quality signals - stock quality assessment
  CONVICTION: 'quality',
  QUALITY_CORE: 'quality',
  UNDERVALUED: 'quality',
  STRONG_TREND: 'quality',
  STEADY: 'quality',
  WATCH: 'quality',
  WEAK: 'quality',
  OVERBOUGHT: 'quality',
  NEUTRAL: 'quality',
};

/** A single insight/signal for a stock */
export interface StockSignal {
  type: SignalType;
  category: SignalCategory;
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
  portfolioScore: number | null; // null for Research view

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

  // Category-based signals for UI (one per category, null if none)
  actionSignal: StockSignal | null; // DIP, BREAKOUT, MOMENTUM, TRIM, etc.
  qualitySignal: StockSignal | null; // CONVICTION, QUALITY, STEADY, WATCH, etc.

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

  // Explanation data for debugging/understanding
  explanation: SignalExplanation;
}

/** Detailed explanation of signal decision process */
export interface SignalExplanation {
  // Raw technical indicators
  technicalIndicators: {
    rsi14: number | null;
    macdHistogram: number | null;
    macdSignalLine: number | null;
    stochK: number | null;
    stochD: number | null;
    adx: number | null;
    bollingerUpper: number | null;
    bollingerLower: number | null;
    bollingerMiddle: number | null;
    sma20: number | null;
    sma50: number | null;
    sma200: number | null;
    atr14: number | null;
  };

  // Raw fundamental data
  fundamentalData: {
    peRatio: number | null;
    forwardPE: number | null;
    pegRatio: number | null;
    roe: number | null;
    profitMargin: number | null;
    debtToEquity: number | null;
    revenueGrowth: number | null;
    epsGrowth: number | null;
    currentRatio: number | null;
  };

  // Analyst data
  analystData: {
    targetPrice: number | null;
    currentPrice: number | null;
    upside: number | null;
    strongBuy: number;
    buy: number;
    hold: number;
    sell: number;
    strongSell: number;
    totalAnalysts: number;
    consensusScore: number | null; // 1-5 scale
  };

  // Score components with points
  scoreBreakdown: {
    fundamental: { points: number; maxPoints: number; percent: number };
    technical: { points: number; maxPoints: number; percent: number };
    analyst: { points: number; maxPoints: number; percent: number };
    news: { points: number; maxPoints: number; percent: number };
    insider: { points: number; maxPoints: number; percent: number };
    portfolio: { points: number; maxPoints: number; percent: number } | null;
    composite: { points: number; maxPoints: number; percent: number };
  };

  // Signal evaluation results
  signalEvaluation: SignalEvaluationResult[];

  // Decision path - why we chose these signals
  decisionPath: {
    actionSignal: {
      chosen: SignalType | null;
      reason: string;
    };
    qualitySignal: {
      chosen: SignalType | null;
      reason: string;
    };
  };

  // Thresholds used for reference
  thresholds: typeof SIGNAL_THRESHOLDS;
}

/** Result of evaluating a single signal */
export interface SignalEvaluationResult {
  signal: SignalType;
  category: SignalCategory;
  passed: boolean;
  conditions: SignalCondition[];
}

/** A single condition that was checked */
export interface SignalCondition {
  name: string;
  actual: number | string | null;
  required: string; // e.g., "≥ 50", "< 30", "true"
  passed: boolean;
}

/** Input data for generating recommendations */
export interface RecommendationInput {
  analystData: EnrichedAnalystData;
  technicalData?: TechnicalData;
  newsArticles?: NewsArticle[];
  insiderTimeRange: InsiderTimeRange;
  /** If true, portfolio score is excluded (for Research view) */
  isResearch?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Weight distribution for composite score (v3.1)
 *
 * Holdings view (500 points total):
 * - Fundamental: 140b = 28%
 * - Technical: 120b = 24%
 * - Analyst: 80b = 16%
 * - News+Insider: 60b = 12%
 * - Portfolio: 100b = 20%
 */
const SCORE_WEIGHTS = {
  fundamental: 0.28,
  technical: 0.24,
  analyst: 0.16,
  newsInsider: 0.12,
  portfolio: 0.2,
};

/**
 * Weight distribution for Research view (v3.1)
 *
 * Research view (400 points total, no portfolio):
 * - Fundamental: 140b = 35%
 * - Technical: 120b = 30%
 * - Analyst: 80b = 20%
 * - News+Insider: 60b = 15%
 */
const SCORE_WEIGHTS_RESEARCH = {
  fundamental: 0.35,
  technical: 0.3,
  analyst: 0.2,
  newsInsider: 0.15,
};

/** Signal priorities (lower = higher priority) */
const SIGNAL_PRIORITIES: Record<SignalType, number> = {
  // Action signals (priority 1-12)
  DIP_OPPORTUNITY: 1,
  BREAKOUT: 2,
  REVERSAL: 3,
  MOMENTUM: 4,
  ACCUMULATE: 5,
  GOOD_ENTRY: 6,
  WAIT_FOR_DIP: 7,
  NEAR_TARGET: 8,
  TAKE_PROFIT: 9,
  CONSIDER_TRIM: 10,
  // Quality signals (priority 11-20)
  CONVICTION: 11,
  QUALITY_CORE: 12,
  UNDERVALUED: 13,
  STRONG_TREND: 14,
  STEADY: 15,
  WATCH: 16,
  WEAK: 17,
  OVERBOUGHT: 18,
  NEUTRAL: 20,
};

/**
 * v3.1 Signal Thresholds (% scale)
 * All thresholds are expressed as percentages (0-100)
 *
 * Technical (max 120b normalized to 0-100):
 * - TECH_STRONG: ≥70% = bullish momentum
 * - TECH_WEAK: <40% = bearish concerns
 *
 * Fundamental (max 140b normalized to 0-100):
 * - FUND_STRONG: ≥50% = solid fundamentals
 * - FUND_WATCH_HIGH: <35% = deteriorating
 * - FUND_WATCH_LOW: <20% = very weak
 *
 * News/Insider:
 * - INSIDER_WEAK: <35% = selling pressure
 * - NEWS_WATCH_HIGH: <50% = negative sentiment
 * - NEWS_WATCH_LOW: <25% = very negative
 */
const SIGNAL_THRESHOLDS = {
  // Technical thresholds
  TECH_STRONG: 60, // For MOMENTUM
  TECH_MODERATE: 40, // For STEADY
  TECH_WEAK: 30, // For WEAK quality

  // Fundamental thresholds
  FUND_QUALITY: 60, // For QUALITY_CORE
  FUND_STRONG: 50, // For UNDERVALUED check
  FUND_MODERATE: 40, // For STEADY
  FUND_WATCH: 35, // For WATCH quality
  FUND_WEAK: 25, // For WEAK quality

  // Analyst thresholds
  ANALYST_QUALITY: 55, // For QUALITY_CORE

  // Insider thresholds
  INSIDER_WEAK: 35,

  // News thresholds
  NEWS_WATCH: 40,

  // DIP thresholds
  DIP_TRIGGER: 50,
  DIP_ACCUMULATE_MIN: 20,
  DIP_ACCUMULATE_MAX: 50,

  // Position thresholds
  WEIGHT_OVERWEIGHT: 8,
  WEIGHT_MAX: 15,

  // Target thresholds
  TARGET_NEAR: 10, // Within 10% of target
  TARGET_UPSIDE_HIGH: 30, // For UNDERVALUED (>30% upside)
  TARGET_LOW_UPSIDE: 5,

  // Gain thresholds
  GAIN_TAKE_PROFIT: 50, // Consider taking profit at 50%+ gain

  // RSI thresholds
  RSI_OVERBOUGHT: 70,
  RSI_OVERSOLD: 30,

  // ADX thresholds
  ADX_STRONG: 25, // Strong trend
  ADX_WEAK: 20, // Weak/no trend
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
 * Calculate fundamental score (0-140 points, normalized to 0-100 for compatibility)
 * Based on: PEG (20b), P/E (20b), ROE (30b), Net Margin (25b), Revenue Growth (25b), D/E (10b), Current Ratio (10b)
 * Total: 140 points
 */
function calculateFundamentalScore(
  f: FundamentalMetrics | null | undefined
): ScoreComponent {
  const details: string[] = [];
  let score = 0;
  const maxScore = 140; // New 140-point system

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

  // === PEG Score (0-20 points) ===
  let pegScore = 0;
  const hasPeg =
    f.pegRatio !== null && f.pegRatio !== undefined && f.pegRatio > 0;

  if (hasPeg) {
    const peg = f.pegRatio!;
    if (peg >= 0.5 && peg <= 1.2) {
      pegScore = 20;
      details.push(`PEG ${peg.toFixed(2)} - ideální ocenění`);
    } else if (peg > 1.2 && peg <= 2.0) {
      pegScore = 15;
      details.push(`PEG ${peg.toFixed(2)} - mírně drahé vs růst`);
    } else if (peg >= 0.3 && peg < 0.5) {
      pegScore = 10;
      details.push(`PEG ${peg.toFixed(2)} - velmi levné`);
    } else if (peg > 2.0 && peg <= 3.0) {
      pegScore = 5;
      details.push(`PEG ${peg.toFixed(2)} - drahé vs růst`);
    } else if (peg < 0.3) {
      pegScore = 0;
      details.push(`PEG ${peg.toFixed(2)} - extrémně levné (ověřte)`);
    } else {
      pegScore = 0;
      details.push(`PEG ${peg.toFixed(2)} - extrémně drahé`);
    }
    score += pegScore;
  }

  // === Absolutní P/E Score (0-20 points) ===
  let peScore = 0;
  if (f.peRatio !== null && f.peRatio !== undefined) {
    const pe = f.peRatio;
    if (pe > 0 && pe < 5) {
      peScore = 3;
      details.push(`P/E ${pe.toFixed(1)} - extrémně nízké`);
    } else if (pe >= 5 && pe < 7) {
      peScore = 8;
      details.push(`P/E ${pe.toFixed(1)} - velmi levné`);
    } else if (pe >= 7 && pe < 10) {
      peScore = 15;
      details.push(`P/E ${pe.toFixed(1)} - levné`);
    } else if (pe >= 10 && pe <= 20) {
      peScore = 20;
      details.push(`P/E ${pe.toFixed(1)} - férové ocenění`);
    } else if (pe > 20 && pe <= 30) {
      peScore = 15;
      details.push(`P/E ${pe.toFixed(1)} - dražší`);
    } else if (pe > 30 && pe <= 40) {
      peScore = 8;
      details.push(`P/E ${pe.toFixed(1)} - velmi drahé`);
    } else if (pe > 40 && pe <= 60) {
      peScore = 3;
      details.push(`P/E ${pe.toFixed(1)} - extrémní`);
    } else if (pe > 60) {
      peScore = 0;
      details.push(`P/E ${pe.toFixed(1)} - spekulativní`);
    } else {
      peScore = 0;
      details.push(`P/E ${pe.toFixed(1)} - ztrátové`);
    }
  }

  // If no PEG, P/E can be worth max 20 points
  // If we have PEG, P/E is also 20 points (total 40 for valuation)
  if (!hasPeg) {
    // No PEG - P/E is only valuation metric, keep its score
    score += peScore;
  } else {
    // Have PEG - add P/E score as well
    score += peScore;
  }

  // === ROE Score (0-30 points) with D/E Penalty ===
  let roeScore = 0;
  let roePenalty = 0;
  if (f.roe !== null && f.roe !== undefined) {
    const roe = f.roe;
    if (roe > 25) {
      roeScore = 30;
      details.push(`ROE ${roe.toFixed(1)}% - vynikající rentabilita`);
    } else if (roe > 18) {
      roeScore = 24;
      details.push(`ROE ${roe.toFixed(1)}% - velmi dobrá rentabilita`);
    } else if (roe > 12) {
      roeScore = 18;
      details.push(`ROE ${roe.toFixed(1)}% - dobrá rentabilita`);
    } else if (roe > 5) {
      roeScore = 9;
      details.push(`ROE ${roe.toFixed(1)}% - průměrná rentabilita`);
    } else if (roe > 0) {
      roeScore = 4;
      details.push(`ROE ${roe.toFixed(1)}% - slabá rentabilita`);
    } else {
      roeScore = 0;
      details.push(`ROE ${roe.toFixed(1)}% - záporná rentabilita`);
    }

    // D/E Penalty for high leverage
    if (
      f.debtToEquity !== null &&
      f.debtToEquity !== undefined &&
      f.debtToEquity > 1.5
    ) {
      if (roe > 25) {
        roePenalty = -6;
      } else if (roe > 18) {
        roePenalty = -5;
      } else if (roe > 12) {
        roePenalty = -3;
      }
      if (roePenalty < 0) {
        details.push(`ROE penalizace ${roePenalty}b (vysoký dluh)`);
      }
    }
  }
  score += Math.max(0, roeScore + roePenalty);

  // === Net Margin Score (0-25 points) ===
  if (f.netMargin !== null && f.netMargin !== undefined) {
    const margin = f.netMargin;
    if (margin > 25) {
      score += 25;
      details.push(`Net Margin ${margin.toFixed(1)}% - vynikající`);
    } else if (margin > 15) {
      score += 20;
      details.push(`Net Margin ${margin.toFixed(1)}% - velmi dobrá`);
    } else if (margin > 8) {
      score += 13;
      details.push(`Net Margin ${margin.toFixed(1)}% - dobrá`);
    } else if (margin > 0) {
      score += 6;
      details.push(`Net Margin ${margin.toFixed(1)}% - nízká`);
    } else {
      details.push(`Net Margin ${margin.toFixed(1)}% - ztrátová`);
    }
  }

  // === Revenue Growth Score (0-25 points) ===
  if (f.revenueGrowth !== null && f.revenueGrowth !== undefined) {
    const growth = f.revenueGrowth;
    if (growth > 25) {
      score += 25;
      details.push(`Revenue Growth ${growth.toFixed(1)}% - silný růst`);
    } else if (growth > 15) {
      score += 20;
      details.push(`Revenue Growth ${growth.toFixed(1)}% - dobrý růst`);
    } else if (growth > 5) {
      score += 13;
      details.push(`Revenue Growth ${growth.toFixed(1)}% - mírný růst`);
    } else if (growth > 0) {
      score += 6;
      details.push(`Revenue Growth ${growth.toFixed(1)}% - minimální růst`);
    } else {
      details.push(`Revenue Growth ${growth.toFixed(1)}% - pokles tržeb`);
    }
  }

  // === D/E Ratio Score (0-10 points) ===
  if (f.debtToEquity !== null && f.debtToEquity !== undefined) {
    const de = f.debtToEquity;
    if (de < 0.3) {
      score += 10;
      details.push(`D/E ${de.toFixed(2)} - minimální dluh`);
    } else if (de < 0.7) {
      score += 8;
      details.push(`D/E ${de.toFixed(2)} - nízký dluh`);
    } else if (de < 1.5) {
      score += 5;
      details.push(`D/E ${de.toFixed(2)} - střední dluh`);
    } else if (de < 2.5) {
      score += 2;
      details.push(`D/E ${de.toFixed(2)} - vysoký dluh`);
    } else {
      details.push(`D/E ${de.toFixed(2)} - velmi vysoký dluh`);
    }
  }

  // === Current Ratio Score (0-10 points) ===
  if (f.currentRatio !== null && f.currentRatio !== undefined) {
    const cr = f.currentRatio;
    if (cr > 2.0) {
      score += 10;
      details.push(`Current Ratio ${cr.toFixed(2)} - silná likvidita`);
    } else if (cr > 1.5) {
      score += 8;
      details.push(`Current Ratio ${cr.toFixed(2)} - dobrá likvidita`);
    } else if (cr > 1.0) {
      score += 5;
      details.push(`Current Ratio ${cr.toFixed(2)} - dostatečná likvidita`);
    } else if (cr > 0.5) {
      score += 2;
      details.push(`Current Ratio ${cr.toFixed(2)} - nízká likvidita`);
    } else {
      details.push(`Current Ratio ${cr.toFixed(2)} - kritická likvidita`);
    }
  }

  // Cap at maxScore
  score = Math.min(maxScore, score);

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
 * Calculate technical score (0-120 points, normalized to 0-100 for compatibility)
 * Based on: RSI (15b), MACD (35b), Bollinger (10b), ADX (25b), 200-day MA (25b), Volume (10b)
 * Total: 120 points
 * Optimized for monthly/yearly position trading horizon
 */
function calculateTechnicalScore(
  tech: TechnicalData | undefined
): ScoreComponent {
  const details: string[] = [];
  let score = 0;
  const maxScore = 120; // New 120-point system
  let bullishSignals = 0;
  let bearishSignals = 0;

  if (!tech) {
    return {
      category: 'Technical',
      score: 60, // Neutral when no data (50% of 120)
      maxScore,
      percent: 50,
      details: ['No technical data available'],
      sentiment: 'neutral',
    };
  }

  // === RSI Score (0-15 points) ===
  if (tech.rsi14 !== null && tech.rsi14 !== undefined) {
    const rsi = tech.rsi14;
    let rsiScore = 0;
    if (rsi < 20) {
      rsiScore = 15;
      details.push(`RSI ${rsi.toFixed(0)} - extrémně přeprodané`);
      bullishSignals++;
    } else if (rsi >= 20 && rsi < 30) {
      rsiScore = 13;
      details.push(`RSI ${rsi.toFixed(0)} - přeprodané`);
      bullishSignals++;
    } else if (rsi >= 30 && rsi < 40) {
      rsiScore = 11;
      details.push(`RSI ${rsi.toFixed(0)} - podhodnocené`);
    } else if (rsi >= 40 && rsi < 50) {
      rsiScore = 9;
      details.push(`RSI ${rsi.toFixed(0)} - neutrální, mírně slabší`);
    } else if (rsi >= 50 && rsi < 60) {
      rsiScore = 7;
      details.push(`RSI ${rsi.toFixed(0)} - neutrální, mírně silnější`);
    } else if (rsi >= 60 && rsi < 70) {
      rsiScore = 5;
      details.push(`RSI ${rsi.toFixed(0)} - spíše překoupené`);
    } else if (rsi >= 70 && rsi < 80) {
      rsiScore = 3;
      details.push(`RSI ${rsi.toFixed(0)} - překoupené`);
      bearishSignals++;
    } else {
      rsiScore = 1;
      details.push(`RSI ${rsi.toFixed(0)} - extrémně překoupené`);
      bearishSignals++;
    }
    score += rsiScore;
  }

  // === MACD Score (0-35 points) - highest weight ===
  if (tech.macdHistogram !== null && tech.macdHistogram !== undefined) {
    const histogram = tech.macdHistogram;
    const macdTrend = tech.macdTrend;
    let macdScore = 0;

    // Base score based on MACD position and histogram direction
    if (histogram > 0 && macdTrend === 'bullish') {
      // Bullish + histogram rising
      macdScore = 28;
      details.push('MACD silně býčí momentum');
      bullishSignals++;
    } else if (histogram > 0) {
      // Just bullish
      macdScore = 23;
      details.push('MACD býčí');
      bullishSignals++;
    } else if (histogram > -0.5 && histogram <= 0) {
      // MACD slightly below signal (mírně medvědí)
      macdScore = 12;
      details.push('MACD mírně medvědí');
    } else if (histogram < 0 && macdTrend === 'bearish') {
      // Bearish + histogram falling
      macdScore = 3;
      details.push('MACD silně medvědí momentum');
      bearishSignals++;
    } else if (histogram < 0) {
      // Just bearish
      macdScore = 7;
      details.push('MACD medvědí');
      bearishSignals++;
    } else {
      macdScore = 16;
      details.push('MACD neutrální');
    }

    // MACD Divergence adjustment (±7 points)
    if (tech.macdDivergence === 'bullish') {
      macdScore = Math.min(35, macdScore + 7);
      details.push('MACD bullish divergence detekována');
      bullishSignals++;
    } else if (tech.macdDivergence === 'bearish') {
      macdScore = Math.max(0, macdScore - 7);
      details.push('MACD bearish divergence detekována');
      bearishSignals++;
    }

    score += Math.min(35, macdScore);
  }

  // === Bollinger Bands Score (0-10 points) ===
  if (
    tech.bollingerUpper !== null &&
    tech.bollingerLower !== null &&
    tech.currentPrice !== null
  ) {
    const price = tech.currentPrice;
    const upper = tech.bollingerUpper;
    const lower = tech.bollingerLower;
    const middle = tech.bollingerMiddle ?? (upper + lower) / 2;
    const bandWidth = upper - lower;
    let bbScore = 0;

    // Calculate position within bands
    if (price < lower - bandWidth * 0.5) {
      // Far below lower band
      bbScore = 9;
      details.push('Cena výrazně pod BB pásmem');
      bullishSignals++;
    } else if (price < lower) {
      // Below lower band
      bbScore = 7;
      details.push('Cena pod dolním BB pásmem');
      bullishSignals++;
    } else if (price >= lower && price < middle) {
      // Lower zone
      bbScore = 5;
      details.push('Cena ve spodní BB zóně');
    } else if (price >= middle && price < upper) {
      // Upper zone
      bbScore = 4;
      details.push('Cena v horní BB zóně');
    } else if (price >= upper && price < upper + bandWidth * 0.5) {
      // Above upper band
      bbScore = 2;
      details.push('Cena nad horním BB pásmem');
      bearishSignals++;
    } else {
      // Far above upper band
      bbScore = 1;
      details.push('Cena výrazně nad BB pásmem');
      bearishSignals++;
    }

    // Squeeze bonus (narrow bands = potential breakout)
    const bandwidthPercent = middle > 0 ? (bandWidth / middle) * 100 : 0;
    if (bandwidthPercent < 5) {
      bbScore = Math.min(10, bbScore + 1);
      details.push('BB squeeze detekován');
    }

    score += bbScore;
  }

  // === ADX Score (0-25 points) ===
  if (tech.adx !== null && tech.plusDI !== null && tech.minusDI !== null) {
    const adx = tech.adx;
    const plusDI = tech.plusDI;
    const minusDI = tech.minusDI;
    const isUptrend = plusDI > minusDI;
    let adxScore = 0;

    if (adx > 40) {
      // Very strong trend (direction doesn't matter as much)
      adxScore = 25;
      details.push(`ADX ${adx.toFixed(0)} - velmi silný trend`);
      if (isUptrend) bullishSignals++;
    } else if (adx >= 30 && adx <= 40) {
      if (isUptrend) {
        adxScore = 21;
        details.push(`ADX ${adx.toFixed(0)} - silný uptrend`);
        bullishSignals++;
      } else {
        adxScore = 14;
        details.push(`ADX ${adx.toFixed(0)} - silný downtrend`);
        bearishSignals++;
      }
    } else if (adx >= 25 && adx < 30) {
      if (isUptrend) {
        adxScore = 16;
        details.push(`ADX ${adx.toFixed(0)} - střední uptrend`);
      } else {
        adxScore = 10;
        details.push(`ADX ${adx.toFixed(0)} - střední downtrend`);
      }
    } else if (adx >= 20 && adx < 25) {
      adxScore = 6;
      details.push(`ADX ${adx.toFixed(0)} - slabý trend`);
    } else {
      adxScore = 3;
      details.push(`ADX ${adx.toFixed(0)} - sideways`);
    }

    score += adxScore;
  }

  // === 200-day MA Score (0-25 points) ===
  if (
    tech.sma200 !== null &&
    tech.sma200 !== undefined &&
    tech.currentPrice !== null
  ) {
    const price = tech.currentPrice;
    const sma200 = tech.sma200;
    const priceVsSma200 =
      tech.priceVsSma200 ?? ((price - sma200) / sma200) * 100;
    let ma200Score = 0;

    // Determine if MA is rising (using price vs MA history if available)
    // For now, we estimate based on whether price is significantly above MA
    const maRising = priceVsSma200 > 5; // Simplified: assume rising if price > 5% above

    if (price > sma200 && maRising) {
      ma200Score = 25;
      details.push('Cena nad rostoucí 200 MA - silný uptrend');
      bullishSignals++;
    } else if (price > sma200) {
      ma200Score = 19;
      details.push('Cena nad 200 MA - bullish trend');
      bullishSignals++;
    } else if (priceVsSma200 >= -5 && priceVsSma200 <= 5) {
      ma200Score = 12;
      details.push('Cena u klíčové 200 MA úrovně');
    } else if (price < sma200 && priceVsSma200 >= -15) {
      ma200Score = 6;
      details.push('Cena pod 200 MA - pod trendem');
      bearishSignals++;
    } else {
      ma200Score = 0;
      details.push('Cena výrazně pod 200 MA - silný downtrend');
      bearishSignals++;
    }

    score += ma200Score;
  }

  // === Volume Score (0-10 points) ===
  if (tech.avgVolume20 !== null && tech.currentVolume !== null) {
    const volumeRatio = tech.currentVolume / tech.avgVolume20;
    const priceUp = tech.priceVsSma50 !== null && tech.priceVsSma50 > 0;
    let volumeScore = 0;

    if (volumeRatio > 1.5 && priceUp) {
      volumeScore = 10;
      details.push('Vysoký objem potvrzuje růst');
      bullishSignals++;
    } else if (volumeRatio > 1.5 && !priceUp) {
      volumeScore = 8;
      details.push('Vysoký objem při poklesu - možná kapitulace');
    } else if (volumeRatio > 1.0) {
      volumeScore = 7;
      details.push('Nadprůměrný objem');
    } else if (volumeRatio >= 0.7) {
      volumeScore = 5;
      details.push('Normální objem');
    } else {
      volumeScore = 2;
      details.push('Nízký objem');
    }

    score += volumeScore;
  }

  // Cap at maxScore
  score = Math.min(maxScore, score);

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
 * Calculate analyst score (0-80 points, normalized to 0-100 for compatibility)
 * Based on: Consensus (50b), Coverage (15b), Target Upside (10b), Agreement (5b)
 * Total: 80 points
 */
function calculateAnalystScore(item: EnrichedAnalystData): ScoreComponent {
  const details: string[] = [];
  let score = 0;
  const maxScore = 80; // New 80-point system

  // === Consensus Score (0-50 points) ===
  // Scale: -2 (Strong Sell) to +2 (Strong Buy)
  if (item.consensusScore !== null) {
    const cs = item.consensusScore;
    let consensusPoints = 0;
    if (cs > 1.5) {
      consensusPoints = 50;
      details.push(`Consensus ${cs.toFixed(2)} - Strong Buy`);
    } else if (cs > 1.0) {
      consensusPoints = 40;
      details.push(`Consensus ${cs.toFixed(2)} - Buy`);
    } else if (cs > 0.5) {
      consensusPoints = 32;
      details.push(`Consensus ${cs.toFixed(2)} - Moderate Buy`);
    } else if (cs > 0.0) {
      consensusPoints = 25;
      details.push(`Consensus ${cs.toFixed(2)} - Weak Buy`);
    } else if (cs > -0.5) {
      consensusPoints = 16;
      details.push(`Consensus ${cs.toFixed(2)} - Hold`);
    } else if (cs > -1.0) {
      consensusPoints = 8;
      details.push(`Consensus ${cs.toFixed(2)} - Underperform`);
    } else {
      consensusPoints = 0;
      details.push(`Consensus ${cs.toFixed(2)} - Sell`);
    }
    score += consensusPoints;
  }

  // === Analyst Coverage (0-15 points) ===
  if (item.numberOfAnalysts !== null) {
    const count = item.numberOfAnalysts;
    let coveragePoints = 0;
    if (count >= 20) {
      coveragePoints = 15;
      details.push(`${count} analytiků - vysoká pozornost`);
    } else if (count >= 10) {
      coveragePoints = 12;
      details.push(`${count} analytiků - dobrá pozornost`);
    } else if (count >= 5) {
      coveragePoints = 8;
      details.push(`${count} analytiků - střední pozornost`);
    } else if (count >= 1) {
      coveragePoints = 4;
      details.push(`${count} analytiků - nízká pozornost`);
    } else {
      details.push('Žádná data od analytiků');
    }
    score += coveragePoints;
  }

  // === Price Target Upside (0-10 points) ===
  // Use analyst target price from Yahoo if available
  const analystTargetPrice =
    'analystTargetPrice' in item
      ? (item as { analystTargetPrice?: number | null }).analystTargetPrice
      : null;

  if (analystTargetPrice && item.currentPrice && item.currentPrice > 0) {
    const upside =
      ((analystTargetPrice - item.currentPrice) / item.currentPrice) * 100;
    let upsidePoints = 0;
    if (upside > 30) {
      upsidePoints = 10;
      details.push(`Target upside +${upside.toFixed(0)}% - vysoký potenciál`);
    } else if (upside > 15) {
      upsidePoints = 8;
      details.push(`Target upside +${upside.toFixed(0)}% - solidní`);
    } else if (upside > 5) {
      upsidePoints = 5;
      details.push(`Target upside +${upside.toFixed(0)}% - mírný`);
    } else if (upside > -5) {
      upsidePoints = 3;
      details.push(
        `Target upside ${upside > 0 ? '+' : ''}${upside.toFixed(
          0
        )}% - blízko fair value`
      );
    } else {
      upsidePoints = 1;
      details.push(`Cena ${Math.abs(upside).toFixed(0)}% nad cílem analytiků`);
    }
    score += upsidePoints;
  }

  // === Analyst Agreement (0-5 points) ===
  // Calculate agreement based on recommendation distribution
  const total =
    (item.strongBuy || 0) +
    (item.buy || 0) +
    (item.hold || 0) +
    (item.sell || 0) +
    (item.strongSell || 0);

  if (total > 0) {
    const strongBuyPct = ((item.strongBuy || 0) / total) * 100;
    const buyPct = ((item.buy || 0) / total) * 100;
    const holdPct = ((item.hold || 0) / total) * 100;
    const sellPct = (((item.sell || 0) + (item.strongSell || 0)) / total) * 100;
    const bullishPct = strongBuyPct + buyPct;

    let agreementPoints = 0;
    // Check for strong consensus (>60% in one direction)
    if (bullishPct > 60 || sellPct > 60 || holdPct > 60) {
      agreementPoints = 5;
      details.push('Silný konsensus analytiků');
    } else if (bullishPct > 50 || sellPct > 50 || holdPct > 50) {
      agreementPoints = 4;
      details.push('Mírný konsensus analytiků');
    } else if (Math.max(bullishPct, sellPct, holdPct) >= 30) {
      agreementPoints = 2;
      details.push('Smíšené názory analytiků');
    } else {
      agreementPoints = 1;
      details.push('Vysoká nejistota mezi analytiky');
    }
    score += agreementPoints;
  }

  // Cap at maxScore
  score = Math.min(maxScore, score);

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
 * Calculate combined News + Insider score (0-100, normalized from 60 points)
 *
 * Position Trading Scoring (v3.1):
 * - News Sentiment: 35b max (58.3% of category)
 * - Insider Activity: 25b max (41.7% of category)
 * - Total: 60 raw points, normalized to 0-100 for composite
 *
 * News Sentiment scoring (35b max):
 * | Avg Sentiment | Points |
 * |---------------|--------|
 * | > 0.5         | 35     |
 * | 0.15 - 0.5    | 28     |
 * | -0.15 - 0.15  | 17     |
 * | -0.5 - -0.15  | 8      |
 * | < -0.5        | 0      |
 *
 * Insider Activity scoring (25b max):
 * | MSPR Range    | Points |
 * |---------------|--------|
 * | > 50          | 25     |
 * | 25 - 50       | 21     |
 * | 0 - 25        | 16     |
 * | -25 - 0       | 12     |
 * | -50 - -25     | 6      |
 * | < -50         | 0      |
 */
function calculateNewsInsiderScore(
  ticker: string,
  articles: NewsArticle[] | undefined,
  item: EnrichedAnalystData,
  timeRange: InsiderTimeRange
): ScoreComponent {
  const details: string[] = [];
  const MAX_RAW_SCORE = 60; // 35 (news) + 25 (insider)
  let newsRawScore = 17; // Default neutral (middle of 0-35)
  let insiderRawScore = 12; // Default neutral (middle of 0-25)

  // === News Sentiment Score (0-35 points) ===
  let avgSentiment = 0;
  let hasNewsData = false;

  if (articles && articles.length > 0) {
    // Filter articles for this ticker
    const tickerArticles = articles.filter(
      (a) => a.ticker === ticker || a.relatedTickers?.includes(ticker)
    );

    if (tickerArticles.length > 0) {
      hasNewsData = true;
      // Calculate average sentiment (-1 to +1)
      avgSentiment =
        tickerArticles.reduce((sum, a) => {
          return sum + (a.sentiment?.score ?? 0);
        }, 0) / tickerArticles.length;

      // Apply tiered scoring based on sentiment
      if (avgSentiment > 0.5) {
        newsRawScore = 35;
        details.push(
          `Sentiment velmi pozitivní (+${(avgSentiment * 100).toFixed(0)}%)`
        );
      } else if (avgSentiment >= 0.15) {
        newsRawScore = 28;
        details.push(
          `Sentiment pozitivní (+${(avgSentiment * 100).toFixed(0)}%)`
        );
      } else if (avgSentiment >= -0.15) {
        newsRawScore = 17;
        details.push(
          `Sentiment neutrální (${(avgSentiment * 100).toFixed(0)}%)`
        );
      } else if (avgSentiment >= -0.5) {
        newsRawScore = 8;
        details.push(
          `Sentiment negativní (${(avgSentiment * 100).toFixed(0)}%)`
        );
      } else {
        newsRawScore = 0;
        details.push(
          `Sentiment velmi negativní (${(avgSentiment * 100).toFixed(0)}%)`
        );
      }

      // Add article count info
      const positive = tickerArticles.filter(
        (a) => (a.sentiment?.score ?? 0) > 0.2
      ).length;
      const negative = tickerArticles.filter(
        (a) => (a.sentiment?.score ?? 0) < -0.2
      ).length;
      details.push(
        `${tickerArticles.length} článků (${positive}+ / ${negative}-)`
      );
    }
  }

  if (!hasNewsData) {
    details.push('Žádné zprávy');
  }

  // === Insider Activity Score (0-25 points) ===
  const insider = getFilteredInsiderSentiment(item, timeRange);
  let hasInsiderData = false;

  if (insider.mspr !== null) {
    hasInsiderData = true;
    const mspr = insider.mspr;

    // Apply tiered scoring based on MSPR
    if (mspr > 50) {
      insiderRawScore = 25;
      details.push(`MSPR +${mspr.toFixed(0)} - silný nákup insiderů`);
    } else if (mspr >= 25) {
      insiderRawScore = 21;
      details.push(`MSPR +${mspr.toFixed(0)} - nákup insiderů`);
    } else if (mspr >= 0) {
      insiderRawScore = 16;
      details.push(`MSPR +${mspr.toFixed(0)} - mírný nákup`);
    } else if (mspr >= -25) {
      insiderRawScore = 12;
      details.push(`MSPR ${mspr.toFixed(0)} - mírný prodej`);
    } else if (mspr >= -50) {
      insiderRawScore = 6;
      details.push(`MSPR ${mspr.toFixed(0)} - prodej insiderů`);
    } else {
      insiderRawScore = 0;
      details.push(`MSPR ${mspr.toFixed(0)} - silný prodej insiderů`);
    }

    // Add net share change if available
    if (insider.change !== null && insider.change !== 0) {
      const changeStr = insider.change > 0 ? '+' : '';
      details.push(
        `Čistá změna: ${changeStr}${insider.change.toLocaleString()} akcií`
      );
    }
  }

  if (!hasInsiderData) {
    details.push('Žádná insider data');
  }

  // === Calculate total and normalize ===
  const totalRawScore = newsRawScore + insiderRawScore;
  const normalizedScore = Math.round((totalRawScore / MAX_RAW_SCORE) * 100);

  // Determine overall sentiment
  let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (avgSentiment > 0.15 || (insider.mspr ?? 0) > 15) {
    sentiment = 'bullish';
  } else if (avgSentiment < -0.15 || (insider.mspr ?? 0) < -15) {
    sentiment = 'bearish';
  }

  return {
    category: 'News+Insider',
    score: normalizedScore,
    maxScore: 100,
    percent: normalizedScore,
    details,
    sentiment,
    rawScore: totalRawScore,
    rawMaxScore: MAX_RAW_SCORE,
  };
}

/**
 * @deprecated Use calculateNewsInsiderScore instead
 * Kept for backward compatibility during migration
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
      details: ['Žádné zprávy pro tuto akcii'],
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
 * @deprecated Use calculateNewsInsiderScore instead
 * Kept for backward compatibility during migration
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
      details: ['Nejsou k dispozici data o insiderech'],
      sentiment: 'neutral',
    };
  }

  // MSPR ranges from roughly -100 to +100
  // Convert to 0-100 score (50 = neutral)
  score = Math.round(50 + insider.mspr / 2);
  score = Math.max(0, Math.min(100, score));

  if (insider.mspr > 50) {
    details.push(`MSPR +${insider.mspr.toFixed(1)} - velmi silné nákupy`);
  } else if (insider.mspr > 25) {
    details.push(`MSPR +${insider.mspr.toFixed(1)} - silné nákupy`);
  } else if (insider.mspr > 0) {
    details.push(`MSPR +${insider.mspr.toFixed(1)} - mírné nákupy`);
  } else if (insider.mspr > -25) {
    details.push(`MSPR ${insider.mspr.toFixed(1)} - mírné prodeje`);
  } else if (insider.mspr > -50) {
    details.push(`MSPR ${insider.mspr.toFixed(1)} - silné prodeje`);
  } else {
    details.push(`MSPR ${insider.mspr.toFixed(1)} - velmi silné prodeje`);
  }

  if (insider.change !== null) {
    details.push(
      `Čisté akcie: ${
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
 * Calculate portfolio context score (0-100, normalized from 100 points)
 *
 * Position Trading Scoring (v3.1):
 * Only available for Holdings view (not Research - no personal position data)
 *
 * Components:
 * - Target Upside: 35b max (personal target price vs current)
 * - Distance from Avg Buy: 25b max (DCA opportunity detection)
 * - Position Weight: 20b max (concentration risk)
 * - Unrealized Gain: 20b max (profit-taking signals)
 * - Total: 100 raw points = 100 normalized (no conversion needed)
 */
function calculatePortfolioScore(item: EnrichedAnalystData): ScoreComponent {
  const details: string[] = [];
  let score = 0;
  const maxScore = 100;

  // === Target Price Upside (0-35 points) ===
  // Personal target price vs current price
  if (
    item.targetPrice !== null &&
    item.currentPrice !== null &&
    item.currentPrice > 0
  ) {
    const upside =
      ((item.targetPrice - item.currentPrice) / item.currentPrice) * 100;

    let targetPoints = 0;
    if (upside > 30) {
      targetPoints = 35;
      details.push(`Upside +${upside.toFixed(0)}% - vysoký potenciál`);
    } else if (upside > 20) {
      targetPoints = 28;
      details.push(`Upside +${upside.toFixed(0)}% - dobrý potenciál`);
    } else if (upside > 10) {
      targetPoints = 21;
      details.push(`Upside +${upside.toFixed(0)}% - střední potenciál`);
    } else if (upside > 5) {
      targetPoints = 14;
      details.push(`Upside +${upside.toFixed(0)}% - omezený potenciál`);
    } else if (upside > 0) {
      targetPoints = 7;
      details.push(`Upside +${upside.toFixed(0)}% - blízko cíle`);
    } else {
      targetPoints = 0;
      details.push(
        `Cena ${Math.abs(upside).toFixed(0)}% nad cílem - zvažte realizaci`
      );
    }
    score += targetPoints;
  } else {
    // No target price set - give neutral score
    score += 17; // Middle of 0-35
    details.push('Cílová cena nenastavena');
  }

  // === Distance from Average Buy Price (0-25 points) ===
  // Below avg = DCA opportunity, far above = profit-taking consideration
  if (item.avgBuyPrice > 0 && item.currentPrice !== null) {
    const distanceFromAvg =
      ((item.currentPrice - item.avgBuyPrice) / item.avgBuyPrice) * 100;

    let distancePoints = 0;
    if (distanceFromAvg < -15) {
      distancePoints = 25;
      details.push(
        `${distanceFromAvg.toFixed(0)}% pod průměrem - DCA příležitost`
      );
    } else if (distanceFromAvg < -10) {
      distancePoints = 20;
      details.push(
        `${distanceFromAvg.toFixed(0)}% pod průměrem - přidej na dipu`
      );
    } else if (distanceFromAvg < 0) {
      distancePoints = 15;
      details.push(`${distanceFromAvg.toFixed(0)}% pod průměrem`);
    } else if (distanceFromAvg < 25) {
      distancePoints = 10;
      details.push(`+${distanceFromAvg.toFixed(0)}% nad průměrem - mírný zisk`);
    } else if (distanceFromAvg < 50) {
      distancePoints = 5;
      details.push(
        `+${distanceFromAvg.toFixed(0)}% nad průměrem - solidní zisk`
      );
    } else {
      distancePoints = 2;
      details.push(
        `+${distanceFromAvg.toFixed(0)}% nad průměrem - zvažte rebalancing`
      );
    }
    score += distancePoints;
  }

  // === Position Weight (0-20 points) ===
  // Ideal weight is 3-6%, too high = concentration risk
  if (item.weight !== undefined) {
    let weightPoints = 0;
    if (item.weight > 12) {
      weightPoints = 4;
      details.push(`Váha ${item.weight.toFixed(1)}% - převážená pozice`);
    } else if (item.weight > 6) {
      weightPoints = 12;
      details.push(`Váha ${item.weight.toFixed(1)}% - mírně velká`);
    } else if (item.weight >= 3) {
      weightPoints = 20;
      details.push(`Váha ${item.weight.toFixed(1)}% - vyvážená pozice`);
    } else {
      weightPoints = 15;
      details.push(`Váha ${item.weight.toFixed(1)}% - malá pozice`);
    }
    score += weightPoints;
  }

  // === Unrealized Gain (0-20 points) ===
  // In profit = good, high profit = consider taking some
  if (item.gainPercentage !== undefined) {
    let gainPoints = 0;
    if (item.gainPercentage > 75) {
      gainPoints = 10;
      details.push(`+${item.gainPercentage.toFixed(0)}% zisk - rebalance!`);
    } else if (item.gainPercentage > 40) {
      gainPoints = 13;
      details.push(
        `+${item.gainPercentage.toFixed(0)}% zisk - zvažte realizaci`
      );
    } else if (item.gainPercentage > 15) {
      gainPoints = 16;
      details.push(`+${item.gainPercentage.toFixed(0)}% zisk - zdravý zisk`);
    } else if (item.gainPercentage > 0) {
      gainPoints = 20;
      details.push(`+${item.gainPercentage.toFixed(0)}% - v zisku`);
    } else if (item.gainPercentage > -15) {
      gainPoints = 14;
      details.push(`${item.gainPercentage.toFixed(0)}% - mírná ztráta`);
    } else if (item.gainPercentage > -30) {
      gainPoints = 10;
      details.push(`${item.gainPercentage.toFixed(0)}% - větší ztráta`);
    } else {
      gainPoints = 4;
      details.push(`${item.gainPercentage.toFixed(0)}% - velká ztráta`);
    }
    score += gainPoints;
  }

  // Cap at 100
  score = Math.min(100, score);

  return {
    category: 'Portfolio',
    score,
    maxScore,
    percent: score, // Already 0-100
    details,
    sentiment: score >= 65 ? 'bullish' : score <= 35 ? 'bearish' : 'neutral',
    rawScore: score,
    rawMaxScore: 100,
  };
}

// ============================================================================
// DIP DETECTION
// ============================================================================

/**
 * Calculate DIP score (0-100)
 * Identifies oversold conditions that may present buying opportunities
 *
 * v3.1 Changes (Position Trading):
 * - Removed Stochastic (too fast for position trading)
 * - Removed Distance from Avg (moved to Portfolio Score)
 * - Added MACD Divergence (trend reversal signal)
 * - Added Volume Confirmation (capitulation detection)
 * - Simplified to 200-MA only (removed SMA50)
 * - Added RSI 35 tier
 *
 * Components:
 * - RSI Based: 0-25 points
 * - Bollinger: 0-20 points
 * - 200-MA Position: 0-20 points
 * - 52-Week Position: 0-15 points
 * - MACD Divergence: 0-10 points
 * - Volume Confirmation: 0-10 points
 * Total: 100 points
 */
function calculateDipScore(
  tech: TechnicalData | undefined,
  item: EnrichedAnalystData
): { score: number; details: string[] } {
  let score = 0;
  const details: string[] = [];

  // === RSI Based (0-25 points) ===
  if (tech?.rsi14 !== null && tech?.rsi14 !== undefined) {
    const rsi = tech.rsi14;
    if (rsi < 25) {
      score += 25;
      details.push(`RSI ${rsi.toFixed(0)} - extrémně přeprodané`);
    } else if (rsi < 30) {
      score += 20;
      details.push(`RSI ${rsi.toFixed(0)} - přeprodané`);
    } else if (rsi < 35) {
      // v3.1: Added tier for RSI 30-35
      score += 15;
      details.push(`RSI ${rsi.toFixed(0)} - mírně přeprodané`);
    } else if (rsi < 40) {
      score += 8;
      details.push(`RSI ${rsi.toFixed(0)} - blízko k přeprodenosti`);
    }
  }

  // === Bollinger Position (0-20 points) ===
  if (
    tech &&
    tech.bollingerLower !== null &&
    tech.bollingerMiddle !== null &&
    tech.bollingerUpper !== null &&
    tech.currentPrice !== null
  ) {
    const price = tech.currentPrice;
    const lower = tech.bollingerLower;
    const upper = tech.bollingerUpper;
    const bandWidth = upper - lower;

    if (price < lower - bandWidth * 0.5) {
      // Far below lower band
      score += 20;
      details.push('Cena výrazně pod dolním BB pásmem');
    } else if (price < lower) {
      // Below lower band
      score += 15;
      details.push('Cena pod dolním BB pásmem');
    } else if (price < lower + bandWidth * 0.2) {
      // Near lower band (lower zone)
      score += 8;
      details.push('Cena ve spodní BB zóně');
    }
  }

  // === 200-MA Position (0-20 points) ===
  // v3.1: Only 200-MA, removed SMA50 (position trading focus)
  if (
    tech?.currentPrice !== null &&
    tech?.currentPrice !== undefined &&
    tech?.sma200 !== null &&
    tech?.sma200 !== undefined
  ) {
    const price = tech.currentPrice;
    const sma200 = tech.sma200;
    const distanceFromMa = ((price - sma200) / sma200) * 100;

    if (distanceFromMa < -15) {
      score += 20;
      details.push(`Cena ${Math.abs(distanceFromMa).toFixed(0)}% pod 200-MA`);
    } else if (distanceFromMa < -10) {
      score += 15;
      details.push(`Cena ${Math.abs(distanceFromMa).toFixed(0)}% pod 200-MA`);
    } else if (distanceFromMa < -5) {
      score += 10;
      details.push(`Cena ${Math.abs(distanceFromMa).toFixed(0)}% pod 200-MA`);
    } else if (distanceFromMa < 0) {
      score += 5;
      details.push('Cena mírně pod 200-MA');
    }
  }

  // === 52-Week Position (0-15 points) ===
  // Note: fiftyTwoWeekHigh is in AnalystData (item), not TechnicalData
  if (
    item.fiftyTwoWeekHigh !== null &&
    item.fiftyTwoWeekHigh !== undefined &&
    item.currentPrice !== null
  ) {
    const dropFromHigh =
      ((item.fiftyTwoWeekHigh - item.currentPrice) / item.fiftyTwoWeekHigh) *
      100;

    if (dropFromHigh > 35) {
      score += 15;
      details.push(`${dropFromHigh.toFixed(0)}% pod 52W maximum`);
    } else if (dropFromHigh > 25) {
      score += 12;
      details.push(`${dropFromHigh.toFixed(0)}% pod 52W maximum`);
    } else if (dropFromHigh > 15) {
      score += 8;
      details.push(`${dropFromHigh.toFixed(0)}% pod 52W maximum`);
    } else if (dropFromHigh > 10) {
      score += 4;
      details.push(`${dropFromHigh.toFixed(0)}% pod 52W maximum`);
    }
  }

  // === MACD Divergence (0-10 points) ===
  // v3.1: NEW - bullish divergence indicates potential reversal
  if (tech?.macdHistogram !== null && tech?.macdHistogram !== undefined) {
    const histogram = tech.macdHistogram;

    // Check for improving histogram (potential bullish divergence)
    // Note: Full divergence detection would need price/MACD history comparison
    // For now, we use histogram improvement as a proxy
    if (histogram > 0 && tech.macd !== null && tech.macd !== undefined) {
      // Histogram positive while in downtrend (potential bullish divergence)
      if (
        tech.currentPrice !== null &&
        tech.sma200 !== null &&
        tech.currentPrice < tech.sma200
      ) {
        score += 10;
        details.push('MACD bullish divergence (histogram zlepšení)');
      }
    } else if (histogram > -0.5 && histogram <= 0) {
      // Histogram improving from negative
      score += 5;
      details.push('MACD histogram se zlepšuje');
    }

    // MACD Divergence - direct detection from edge function
    if (tech.macdDivergence === 'bullish') {
      score += 10;
      details.push('MACD bullish divergence - potenciální obrat');
    }
  }

  // === Volume Confirmation (0-10 points) ===
  // v3.1: NEW - high volume on down days suggests capitulation
  if (tech?.volumeChange !== null && tech?.volumeChange !== undefined) {
    const volumeChange = tech.volumeChange; // % change vs 20-day average

    // High volume during oversold conditions = potential capitulation
    if (volumeChange > 100) {
      // Volume > 2× average
      score += 10;
      details.push('Extrémní objem - možná kapitulace');
    } else if (volumeChange > 50) {
      // Volume > 1.5× average
      score += 7;
      details.push('Vysoký objem');
    } else if (volumeChange > 0) {
      // Volume above average
      score += 3;
      details.push('Nadprůměrný objem');
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
  // v3.1 Position Trading:
  // - AGGRESSIVE: 2 weeks interval (underweight <3%)
  // - NORMAL: 1 month interval (balanced 3-8%)
  // - CAUTIOUS: 2 months interval (overweight 8-12%)
  // - NO_DCA: Position already overweight (>12%)
  let dcaRecommendation: 'AGGRESSIVE' | 'NORMAL' | 'CAUTIOUS' | 'NO_DCA';
  let dcaReason: string;
  let maxAddPercent: number;

  if (weight > 12) {
    dcaRecommendation = 'NO_DCA';
    dcaReason = 'Pozice převážená (>12%)';
    maxAddPercent = 0;
  } else if (weight > 8) {
    dcaRecommendation = 'CAUTIOUS';
    dcaReason = 'Pozice mírně převážená (8-12%), interval 2 měsíce';
    maxAddPercent = 0.5;
  } else if (weight >= 3) {
    dcaRecommendation = 'NORMAL';
    dcaReason = 'Vyvážená pozice (3-8%), interval 1 měsíc';
    maxAddPercent = 1;
  } else {
    dcaRecommendation = 'AGGRESSIVE';
    dcaReason = 'Podvážená pozice (<3%), interval 2 týdny';
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
  // v3.1: Dynamic trailing based on gain level
  // +50% gain: trailing -6%
  // +30% gain: trailing -8%
  // +20% gain: trailing -10%
  // Default: -15% (conviction-based fallback)
  let trailingStopPercent: number | null = null;
  const currentGainPercent =
    avgBuyPrice > 0 ? ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100 : 0;

  if (currentGainPercent >= 50) {
    trailingStopPercent = 6;
  } else if (currentGainPercent >= 30) {
    trailingStopPercent = 8;
  } else if (currentGainPercent >= 20) {
    trailingStopPercent = 10;
  } else if (convictionLevel === 'HIGH') {
    trailingStopPercent = 15;
  } else if (convictionLevel === 'MEDIUM') {
    trailingStopPercent = 12;
  } else {
    trailingStopPercent = 10;
  }

  // Determine holding period
  let holdingPeriod: 'SWING' | 'MEDIUM' | 'LONG';
  let holdingReason: string;

  if (convictionLevel === 'HIGH' && technicalBias !== 'BEARISH') {
    holdingPeriod = 'LONG';
    holdingReason = 'Silné fundamenty a pozitivní výhled';
  } else if (convictionLevel === 'LOW' || technicalBias === 'BEARISH') {
    holdingPeriod = 'SWING';
    if (technicalBias === 'BEARISH') {
      holdingReason = 'Bearish technika — zvažte rychlý výstup';
    } else {
      holdingReason = 'Slabé fundamenty — obchodujte jen momentum';
    }
  } else {
    holdingPeriod = 'MEDIUM';
    holdingReason = 'Držte do cíle, přehodnocujte kvartálně';
  }

  // Override for extreme cases
  if (item.gainPercentage > 50 && convictionLevel !== 'HIGH') {
    holdingPeriod = 'SWING';
    holdingReason = 'Velký nerealizovaný zisk — zvažte výběr zisku';
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
 *
 * v3.1 Changes:
 * - Replaced RSI momentum with 200-MA Position + Volume Health
 * - Better suited for position trading (monthly/yearly horizon)
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

  // v3.1: 200-MA Position (0-10 points) - replaces RSI momentum
  // Better suited for position trading - long-term trend confirmation
  if (
    tech?.sma200 !== null &&
    tech?.sma200 !== undefined &&
    tech.currentPrice !== null &&
    tech.currentPrice !== undefined
  ) {
    const priceVsSma200 = tech.currentPrice / tech.sma200;
    if (priceVsSma200 > 1.05) {
      // Price > 5% above 200-MA - solid uptrend
      score += 10;
      details.push('Price solidly above 200-MA (uptrend)');
    } else if (priceVsSma200 > 1.0) {
      // Price above 200-MA - above support
      score += 7;
      details.push('Price above 200-MA support');
    } else if (priceVsSma200 > 0.95) {
      // Price close to 200-MA (within 5% below)
      score += 3;
      details.push('Price near 200-MA');
    }
    // Below 95% of 200-MA = 0 points (downtrend)
  }

  // v3.1: Volume Health (0-8 points) - replaces RSI range check
  // Indicates institutional interest and trend confirmation
  if (tech?.volumeChange !== null && tech?.volumeChange !== undefined) {
    const volumeChange = tech.volumeChange; // % change vs average
    if (volumeChange > 20) {
      // Volume > 120% of average - rising interest
      score += 8;
      details.push('Rising volume interest');
    } else if (volumeChange > 0) {
      // Volume above average - stable interest
      score += 5;
      details.push('Stable volume');
    } else if (volumeChange > -30) {
      // Volume somewhat below average
      score += 2;
    }
    // Volume < 70% of average = 0 points (low interest)
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
 *
 * v3.2: Two categories only - ACTION (what to do) and QUALITY (stock assessment)
 * Each stock gets max 1 action signal and max 1 quality signal
 * v3.3: Added isResearch for Research-specific signals (GOOD_ENTRY, WAIT_FOR_DIP)
 */
function generateSignals(
  _compositeScore: number,
  fundamentalScore: number,
  technicalScore: number,
  analystScore: number,
  newsScore: number,
  insiderScore: number,
  _portfolioScore: number,
  dipScore: number,
  dipQualityPasses: boolean,
  convictionScore: number,
  convictionLevel: 'HIGH' | 'MEDIUM' | 'LOW',
  targetUpside: number | null,
  gainPercentage: number,
  weight: number,
  tech: TechnicalData | undefined,
  isResearch: boolean = false
): StockSignal[] {
  const signals: StockSignal[] = [];

  const rsiValue = tech?.rsi14 ?? null;
  const adxValue = tech?.adx ?? null;
  const adxTrend = tech?.adxTrend ?? null;
  const stochK = tech?.stochasticK ?? null;
  const macdDivergence = tech?.macdDivergence ?? null;
  const bollingerSignal = tech?.bollingerSignal ?? null;
  const volumeSignal = tech?.volumeSignal ?? null;

  // =========================================================================
  // ACTION SIGNALS (what to do) - pick the best one
  // =========================================================================
  let actionSignal: StockSignal | null = null;

  // === DIP OPPORTUNITY === (highest priority action)
  if (dipScore >= SIGNAL_THRESHOLDS.DIP_TRIGGER && dipQualityPasses) {
    actionSignal = {
      type: 'DIP_OPPORTUNITY',
      category: 'action',
      strength: dipScore,
      title: 'DIP příležitost',
      description: `Přeprodáno (skóre ${dipScore}). Fundamenty OK.`,
      priority: SIGNAL_PRIORITIES.DIP_OPPORTUNITY,
    };
  }

  // === BREAKOUT === (price breaking upper Bollinger with high volume)
  if (
    !actionSignal &&
    bollingerSignal === 'overbought' &&
    volumeSignal === 'high' &&
    technicalScore >= SIGNAL_THRESHOLDS.TECH_STRONG
  ) {
    actionSignal = {
      type: 'BREAKOUT',
      category: 'action',
      strength: technicalScore,
      title: 'Průraz',
      description: 'Cena proráží s vysokým objemem. Potenciální breakout.',
      priority: SIGNAL_PRIORITIES.BREAKOUT,
    };
  }

  // === REVERSAL === (MACD bullish divergence + oversold)
  if (
    !actionSignal &&
    macdDivergence === 'bullish' &&
    rsiValue !== null &&
    rsiValue < 40
  ) {
    actionSignal = {
      type: 'REVERSAL',
      category: 'action',
      strength: 65,
      title: 'Obrat',
      description: 'MACD divergence naznačuje potenciální obrat trendu.',
      priority: SIGNAL_PRIORITIES.REVERSAL,
    };
  }

  // === MOMENTUM === (strong technicals, healthy RSI)
  if (
    !actionSignal &&
    technicalScore >= SIGNAL_THRESHOLDS.TECH_STRONG &&
    rsiValue !== null &&
    rsiValue > 45 &&
    rsiValue < SIGNAL_THRESHOLDS.RSI_OVERBOUGHT
  ) {
    actionSignal = {
      type: 'MOMENTUM',
      category: 'action',
      strength: technicalScore,
      title: 'Momentum',
      description: 'Technické indikátory ukazují býčí trend.',
      priority: SIGNAL_PRIORITIES.MOMENTUM,
    };
  }

  // === ACCUMULATE === (quality stock, moderate dip)
  if (
    !actionSignal &&
    convictionLevel !== 'LOW' &&
    dipScore >= SIGNAL_THRESHOLDS.DIP_ACCUMULATE_MIN &&
    dipScore < SIGNAL_THRESHOLDS.DIP_ACCUMULATE_MAX &&
    fundamentalScore >= SIGNAL_THRESHOLDS.FUND_MODERATE
  ) {
    actionSignal = {
      type: 'ACCUMULATE',
      category: 'action',
      strength: 55,
      title: 'Akumulovat',
      description: 'Kvalitní akcie. Vhodné pro postupný nákup (DCA).',
      priority: SIGNAL_PRIORITIES.ACCUMULATE,
    };
  }

  // === GOOD ENTRY === (Research: quality stock below analyst target)
  if (
    !actionSignal &&
    isResearch &&
    targetUpside !== null &&
    targetUpside >= 15 && // At least 15% upside
    fundamentalScore >= SIGNAL_THRESHOLDS.FUND_MODERATE &&
    convictionLevel !== 'LOW'
  ) {
    actionSignal = {
      type: 'GOOD_ENTRY',
      category: 'action',
      strength: Math.min(80, 50 + targetUpside / 3),
      title: 'Dobrý vstup',
      description: `Kvalitní akcie s +${targetUpside.toFixed(0)}% potenciálem.`,
      priority: SIGNAL_PRIORITIES.GOOD_ENTRY,
    };
  }

  // === WAIT FOR DIP === (Research: quality stock but price too high)
  if (
    !actionSignal &&
    isResearch &&
    convictionLevel !== 'LOW' &&
    fundamentalScore >= SIGNAL_THRESHOLDS.FUND_MODERATE &&
    (targetUpside === null || targetUpside < 10) && // Near or above target
    rsiValue !== null &&
    rsiValue > 55 // Not oversold
  ) {
    actionSignal = {
      type: 'WAIT_FOR_DIP',
      category: 'action',
      strength: 50,
      title: 'Počkat na pokles',
      description:
        'Kvalitní akcie, ale cena příliš vysoká. Vyčkejte na pokles.',
      priority: SIGNAL_PRIORITIES.WAIT_FOR_DIP,
    };
  }

  // === NEAR TARGET === (approaching target price)
  if (
    !actionSignal &&
    targetUpside !== null &&
    targetUpside <= SIGNAL_THRESHOLDS.TARGET_NEAR &&
    targetUpside > 0
  ) {
    actionSignal = {
      type: 'NEAR_TARGET',
      category: 'action',
      strength: Math.round(100 - targetUpside * 5),
      title: 'Blízko cíle',
      description: `${targetUpside.toFixed(
        1
      )}% do cílové ceny. Zvažte strategii.`,
      priority: SIGNAL_PRIORITIES.NEAR_TARGET,
    };
  }

  // === TAKE PROFIT === (large unrealized gains)
  if (
    !actionSignal &&
    gainPercentage >= SIGNAL_THRESHOLDS.GAIN_TAKE_PROFIT &&
    convictionLevel !== 'HIGH'
  ) {
    actionSignal = {
      type: 'TAKE_PROFIT',
      category: 'action',
      strength: Math.min(90, 50 + gainPercentage / 2),
      title: 'Realizovat zisk',
      description: `+${gainPercentage.toFixed(
        0
      )}% zisk. Zvažte částečnou realizaci.`,
      priority: SIGNAL_PRIORITIES.TAKE_PROFIT,
    };
  }

  // === CONSIDER TRIM === (overbought + overweight)
  if (
    !actionSignal &&
    rsiValue !== null &&
    rsiValue > SIGNAL_THRESHOLDS.RSI_OVERBOUGHT &&
    weight > SIGNAL_THRESHOLDS.WEIGHT_OVERWEIGHT
  ) {
    actionSignal = {
      type: 'CONSIDER_TRIM',
      category: 'action',
      strength: 65,
      title: 'Redukovat',
      description: 'Překoupeno s vysokou vahou. Zvažte redukci pozice.',
      priority: SIGNAL_PRIORITIES.CONSIDER_TRIM,
    };
  }

  // =========================================================================
  // QUALITY SIGNALS (stock assessment) - pick the best one
  // =========================================================================
  let qualitySignal: StockSignal | null = null;

  // === CONVICTION === (top tier quality)
  if (convictionLevel === 'HIGH') {
    qualitySignal = {
      type: 'CONVICTION',
      category: 'quality',
      strength: convictionScore,
      title: 'Přesvědčení',
      description: 'Vysoká kvalita. Dlouhodobě držet.',
      priority: SIGNAL_PRIORITIES.CONVICTION,
    };
  }

  // === QUALITY CORE === (strong fundamentals + analysts)
  if (
    !qualitySignal &&
    fundamentalScore >= SIGNAL_THRESHOLDS.FUND_QUALITY &&
    analystScore >= SIGNAL_THRESHOLDS.ANALYST_QUALITY
  ) {
    qualitySignal = {
      type: 'QUALITY_CORE',
      category: 'quality',
      strength: Math.round((fundamentalScore + analystScore) / 2),
      title: 'Kvalita',
      description: 'Silné fundamenty a pozitivní analytici.',
      priority: SIGNAL_PRIORITIES.QUALITY_CORE,
    };
  }

  // === UNDERVALUED === (big upside potential + decent fundamentals)
  if (
    !qualitySignal &&
    targetUpside !== null &&
    targetUpside >= SIGNAL_THRESHOLDS.TARGET_UPSIDE_HIGH &&
    fundamentalScore >= SIGNAL_THRESHOLDS.FUND_MODERATE
  ) {
    qualitySignal = {
      type: 'UNDERVALUED',
      category: 'quality',
      strength: Math.min(85, 50 + targetUpside / 2),
      title: 'Podhodnocená',
      description: `+${targetUpside.toFixed(0)}% potenciál dle analytiků.`,
      priority: SIGNAL_PRIORITIES.UNDERVALUED,
    };
  }

  // === STRONG TREND === (ADX strong + bullish)
  if (
    !qualitySignal &&
    adxValue !== null &&
    adxValue >= SIGNAL_THRESHOLDS.ADX_STRONG &&
    adxTrend === 'bullish'
  ) {
    qualitySignal = {
      type: 'STRONG_TREND',
      category: 'quality',
      strength: Math.min(80, 50 + adxValue),
      title: 'Silný trend',
      description: 'ADX ukazuje silný býčí trend.',
      priority: SIGNAL_PRIORITIES.STRONG_TREND,
    };
  }

  // === STEADY === (solid fundamentals and technicals)
  if (
    !qualitySignal &&
    fundamentalScore >= SIGNAL_THRESHOLDS.FUND_MODERATE &&
    technicalScore >= SIGNAL_THRESHOLDS.TECH_MODERATE &&
    convictionLevel !== 'LOW'
  ) {
    qualitySignal = {
      type: 'STEADY',
      category: 'quality',
      strength: Math.round((fundamentalScore + technicalScore) / 2),
      title: 'Stabilní',
      description: 'Solidní akcie. Pokračujte v držení.',
      priority: SIGNAL_PRIORITIES.STEADY,
    };
  }

  // === OVERBOUGHT === (RSI + Stochastic overbought)
  if (
    !qualitySignal &&
    rsiValue !== null &&
    rsiValue > SIGNAL_THRESHOLDS.RSI_OVERBOUGHT &&
    stochK !== null &&
    stochK > 80
  ) {
    qualitySignal = {
      type: 'OVERBOUGHT',
      category: 'quality',
      strength: 60,
      title: 'Překoupeno',
      description: 'RSI a Stochastic ukazují překoupenost.',
      priority: SIGNAL_PRIORITIES.OVERBOUGHT,
    };
  }

  // === WATCH === (deteriorating metrics)
  if (
    !qualitySignal &&
    (fundamentalScore < SIGNAL_THRESHOLDS.FUND_WATCH ||
      insiderScore < SIGNAL_THRESHOLDS.INSIDER_WEAK ||
      newsScore < SIGNAL_THRESHOLDS.NEWS_WATCH)
  ) {
    qualitySignal = {
      type: 'WATCH',
      category: 'quality',
      strength: 45,
      title: 'Sledovat',
      description: 'Některé metriky se zhoršují.',
      priority: SIGNAL_PRIORITIES.WATCH,
    };
  }

  // === WEAK === (poor fundamentals or technicals)
  if (
    !qualitySignal &&
    (fundamentalScore < SIGNAL_THRESHOLDS.FUND_WEAK ||
      technicalScore < SIGNAL_THRESHOLDS.TECH_WEAK)
  ) {
    qualitySignal = {
      type: 'WEAK',
      category: 'quality',
      strength: 30,
      title: 'Slabá',
      description: 'Slabé fundamenty nebo technický obraz.',
      priority: SIGNAL_PRIORITIES.WEAK,
    };
  }

  // === NEUTRAL === (fallback)
  if (!qualitySignal) {
    qualitySignal = {
      type: 'NEUTRAL',
      category: 'quality',
      strength: 50,
      title: 'Neutrální',
      description: 'Žádné výrazné signály.',
      priority: SIGNAL_PRIORITIES.NEUTRAL,
    };
  }

  // =========================================================================
  // Combine signals
  // =========================================================================
  if (actionSignal) {
    signals.push(actionSignal);
  }
  signals.push(qualitySignal);

  // Sort by priority
  return signals.sort((a, b) => a.priority - b.priority);
}

// ============================================================================
// EXPLANATION GENERATION
// ============================================================================

/**
 * Generate detailed explanation of signal evaluation
 */
function generateExplanation(
  item: EnrichedAnalystData,
  tech: TechnicalData | undefined,
  fundamentalComponent: ScoreComponent,
  technicalComponent: ScoreComponent,
  analystComponent: ScoreComponent,
  newsComponent: ScoreComponent,
  insiderComponent: ScoreComponent,
  portfolioComponent: ScoreComponent | null,
  compositeScore: number,
  dipScore: number,
  dipQualityPasses: boolean,
  convictionScore: number,
  convictionLevel: 'HIGH' | 'MEDIUM' | 'LOW',
  targetUpside: number | null,
  gainPercentage: number,
  weight: number,
  actionSignal: SignalType | null,
  qualitySignal: SignalType
): SignalExplanation {
  const rsiValue = tech?.rsi14 ?? null;
  const adxValue = tech?.adx ?? null;
  const adxTrend = tech?.adxTrend ?? null;
  const stochK = tech?.stochasticK ?? null;
  const stochD = tech?.stochasticD ?? null;
  const macdDivergence = tech?.macdDivergence ?? null;
  const bollingerSignal = tech?.bollingerSignal ?? null;
  const volumeSignal = tech?.volumeSignal ?? null;

  // Build signal evaluation results
  const signalEvaluation: SignalEvaluationResult[] = [];

  // === ACTION SIGNALS ===

  // DIP_OPPORTUNITY
  signalEvaluation.push({
    signal: 'DIP_OPPORTUNITY',
    category: 'action',
    passed: dipScore >= SIGNAL_THRESHOLDS.DIP_TRIGGER && dipQualityPasses,
    conditions: [
      {
        name: 'dipScore',
        actual: Math.round(dipScore),
        required: `≥ ${SIGNAL_THRESHOLDS.DIP_TRIGGER}`,
        passed: dipScore >= SIGNAL_THRESHOLDS.DIP_TRIGGER,
      },
      {
        name: 'dipQualityPasses',
        actual: dipQualityPasses ? 'ano' : 'ne',
        required: 'ano',
        passed: dipQualityPasses,
      },
    ],
  });

  // BREAKOUT
  signalEvaluation.push({
    signal: 'BREAKOUT',
    category: 'action',
    passed:
      bollingerSignal === 'overbought' &&
      volumeSignal === 'high' &&
      technicalComponent.percent >= SIGNAL_THRESHOLDS.TECH_STRONG,
    conditions: [
      {
        name: 'bollingerSignal',
        actual: bollingerSignal ?? 'N/A',
        required: 'overbought',
        passed: bollingerSignal === 'overbought',
      },
      {
        name: 'volumeSignal',
        actual: volumeSignal ?? 'N/A',
        required: 'high',
        passed: volumeSignal === 'high',
      },
      {
        name: 'technicalScore',
        actual: Math.round(technicalComponent.percent),
        required: `≥ ${SIGNAL_THRESHOLDS.TECH_STRONG}`,
        passed: technicalComponent.percent >= SIGNAL_THRESHOLDS.TECH_STRONG,
      },
    ],
  });

  // REVERSAL
  signalEvaluation.push({
    signal: 'REVERSAL',
    category: 'action',
    passed: macdDivergence === 'bullish' && rsiValue !== null && rsiValue < 40,
    conditions: [
      {
        name: 'macdDivergence',
        actual: macdDivergence ?? 'N/A',
        required: 'bullish',
        passed: macdDivergence === 'bullish',
      },
      {
        name: 'RSI',
        actual: rsiValue !== null ? Math.round(rsiValue) : 'N/A',
        required: '< 40',
        passed: rsiValue !== null && rsiValue < 40,
      },
    ],
  });

  // MOMENTUM
  signalEvaluation.push({
    signal: 'MOMENTUM',
    category: 'action',
    passed:
      technicalComponent.percent >= SIGNAL_THRESHOLDS.TECH_STRONG &&
      rsiValue !== null &&
      rsiValue > 45 &&
      rsiValue < SIGNAL_THRESHOLDS.RSI_OVERBOUGHT,
    conditions: [
      {
        name: 'technicalScore',
        actual: Math.round(technicalComponent.percent),
        required: `≥ ${SIGNAL_THRESHOLDS.TECH_STRONG}`,
        passed: technicalComponent.percent >= SIGNAL_THRESHOLDS.TECH_STRONG,
      },
      {
        name: 'RSI',
        actual: rsiValue !== null ? Math.round(rsiValue) : 'N/A',
        required: '45-70',
        passed:
          rsiValue !== null &&
          rsiValue > 45 &&
          rsiValue < SIGNAL_THRESHOLDS.RSI_OVERBOUGHT,
      },
    ],
  });

  // ACCUMULATE
  signalEvaluation.push({
    signal: 'ACCUMULATE',
    category: 'action',
    passed:
      convictionLevel !== 'LOW' &&
      dipScore >= SIGNAL_THRESHOLDS.DIP_ACCUMULATE_MIN &&
      dipScore < SIGNAL_THRESHOLDS.DIP_ACCUMULATE_MAX &&
      fundamentalComponent.percent >= SIGNAL_THRESHOLDS.FUND_MODERATE,
    conditions: [
      {
        name: 'convictionLevel',
        actual: convictionLevel,
        required: 'MEDIUM nebo HIGH',
        passed: convictionLevel !== 'LOW',
      },
      {
        name: 'dipScore',
        actual: Math.round(dipScore),
        required: `${SIGNAL_THRESHOLDS.DIP_ACCUMULATE_MIN}-${SIGNAL_THRESHOLDS.DIP_ACCUMULATE_MAX}`,
        passed:
          dipScore >= SIGNAL_THRESHOLDS.DIP_ACCUMULATE_MIN &&
          dipScore < SIGNAL_THRESHOLDS.DIP_ACCUMULATE_MAX,
      },
      {
        name: 'fundamentalScore',
        actual: Math.round(fundamentalComponent.percent),
        required: `≥ ${SIGNAL_THRESHOLDS.FUND_MODERATE}`,
        passed: fundamentalComponent.percent >= SIGNAL_THRESHOLDS.FUND_MODERATE,
      },
    ],
  });

  // GOOD_ENTRY (Research only)
  signalEvaluation.push({
    signal: 'GOOD_ENTRY',
    category: 'action',
    passed:
      portfolioComponent === null && // isResearch
      targetUpside !== null &&
      targetUpside >= 15 &&
      fundamentalComponent.percent >= SIGNAL_THRESHOLDS.FUND_MODERATE &&
      convictionLevel !== 'LOW',
    conditions: [
      {
        name: 'isResearch',
        actual: portfolioComponent === null ? 'ano' : 'ne',
        required: 'ano',
        passed: portfolioComponent === null,
      },
      {
        name: 'targetUpside',
        actual: targetUpside !== null ? `${Math.round(targetUpside)}%` : 'N/A',
        required: '≥ 15%',
        passed: targetUpside !== null && targetUpside >= 15,
      },
      {
        name: 'fundamentalScore',
        actual: Math.round(fundamentalComponent.percent),
        required: `≥ ${SIGNAL_THRESHOLDS.FUND_MODERATE}`,
        passed: fundamentalComponent.percent >= SIGNAL_THRESHOLDS.FUND_MODERATE,
      },
      {
        name: 'convictionLevel',
        actual: convictionLevel,
        required: 'MEDIUM nebo HIGH',
        passed: convictionLevel !== 'LOW',
      },
    ],
  });

  // WAIT_FOR_DIP (Research only)
  signalEvaluation.push({
    signal: 'WAIT_FOR_DIP',
    category: 'action',
    passed:
      portfolioComponent === null && // isResearch
      convictionLevel !== 'LOW' &&
      fundamentalComponent.percent >= SIGNAL_THRESHOLDS.FUND_MODERATE &&
      (targetUpside === null || targetUpside < 10) &&
      rsiValue !== null &&
      rsiValue > 55,
    conditions: [
      {
        name: 'isResearch',
        actual: portfolioComponent === null ? 'ano' : 'ne',
        required: 'ano',
        passed: portfolioComponent === null,
      },
      {
        name: 'convictionLevel',
        actual: convictionLevel,
        required: 'MEDIUM nebo HIGH',
        passed: convictionLevel !== 'LOW',
      },
      {
        name: 'fundamentalScore',
        actual: Math.round(fundamentalComponent.percent),
        required: `≥ ${SIGNAL_THRESHOLDS.FUND_MODERATE}`,
        passed: fundamentalComponent.percent >= SIGNAL_THRESHOLDS.FUND_MODERATE,
      },
      {
        name: 'targetUpside',
        actual: targetUpside !== null ? `${Math.round(targetUpside)}%` : 'N/A',
        required: '< 10% nebo N/A',
        passed: targetUpside === null || targetUpside < 10,
      },
      {
        name: 'RSI',
        actual: rsiValue !== null ? Math.round(rsiValue) : 'N/A',
        required: '> 55',
        passed: rsiValue !== null && rsiValue > 55,
      },
    ],
  });

  // NEAR_TARGET
  signalEvaluation.push({
    signal: 'NEAR_TARGET',
    category: 'action',
    passed:
      targetUpside !== null &&
      targetUpside <= SIGNAL_THRESHOLDS.TARGET_NEAR &&
      targetUpside > 0,
    conditions: [
      {
        name: 'targetUpside',
        actual: targetUpside !== null ? `${Math.round(targetUpside)}%` : 'N/A',
        required: `≤ ${SIGNAL_THRESHOLDS.TARGET_NEAR}% a > 0`,
        passed:
          targetUpside !== null &&
          targetUpside <= SIGNAL_THRESHOLDS.TARGET_NEAR &&
          targetUpside > 0,
      },
    ],
  });

  // TAKE_PROFIT
  signalEvaluation.push({
    signal: 'TAKE_PROFIT',
    category: 'action',
    passed:
      gainPercentage >= SIGNAL_THRESHOLDS.GAIN_TAKE_PROFIT &&
      convictionLevel !== 'HIGH',
    conditions: [
      {
        name: 'gainPercentage',
        actual: `${Math.round(gainPercentage)}%`,
        required: `≥ ${SIGNAL_THRESHOLDS.GAIN_TAKE_PROFIT}%`,
        passed: gainPercentage >= SIGNAL_THRESHOLDS.GAIN_TAKE_PROFIT,
      },
      {
        name: 'convictionLevel',
        actual: convictionLevel,
        required: '≠ HIGH',
        passed: convictionLevel !== 'HIGH',
      },
    ],
  });

  // CONSIDER_TRIM
  signalEvaluation.push({
    signal: 'CONSIDER_TRIM',
    category: 'action',
    passed:
      rsiValue !== null &&
      rsiValue > SIGNAL_THRESHOLDS.RSI_OVERBOUGHT &&
      weight > SIGNAL_THRESHOLDS.WEIGHT_OVERWEIGHT,
    conditions: [
      {
        name: 'RSI',
        actual: rsiValue !== null ? Math.round(rsiValue) : 'N/A',
        required: `> ${SIGNAL_THRESHOLDS.RSI_OVERBOUGHT}`,
        passed:
          rsiValue !== null && rsiValue > SIGNAL_THRESHOLDS.RSI_OVERBOUGHT,
      },
      {
        name: 'weight',
        actual: `${weight.toFixed(1)}%`,
        required: `> ${SIGNAL_THRESHOLDS.WEIGHT_OVERWEIGHT}%`,
        passed: weight > SIGNAL_THRESHOLDS.WEIGHT_OVERWEIGHT,
      },
    ],
  });

  // === QUALITY SIGNALS ===

  // CONVICTION
  signalEvaluation.push({
    signal: 'CONVICTION',
    category: 'quality',
    passed: convictionLevel === 'HIGH',
    conditions: [
      {
        name: 'convictionLevel',
        actual: convictionLevel,
        required: 'HIGH',
        passed: convictionLevel === 'HIGH',
      },
      {
        name: 'convictionScore',
        actual: Math.round(convictionScore),
        required: '≥ 70',
        passed: convictionScore >= 70,
      },
    ],
  });

  // QUALITY_CORE
  signalEvaluation.push({
    signal: 'QUALITY_CORE',
    category: 'quality',
    passed:
      fundamentalComponent.percent >= SIGNAL_THRESHOLDS.FUND_QUALITY &&
      analystComponent.percent >= SIGNAL_THRESHOLDS.ANALYST_QUALITY,
    conditions: [
      {
        name: 'fundamentalScore',
        actual: Math.round(fundamentalComponent.percent),
        required: `≥ ${SIGNAL_THRESHOLDS.FUND_QUALITY}`,
        passed: fundamentalComponent.percent >= SIGNAL_THRESHOLDS.FUND_QUALITY,
      },
      {
        name: 'analystScore',
        actual: Math.round(analystComponent.percent),
        required: `≥ ${SIGNAL_THRESHOLDS.ANALYST_QUALITY}`,
        passed: analystComponent.percent >= SIGNAL_THRESHOLDS.ANALYST_QUALITY,
      },
    ],
  });

  // UNDERVALUED
  signalEvaluation.push({
    signal: 'UNDERVALUED',
    category: 'quality',
    passed:
      targetUpside !== null &&
      targetUpside >= SIGNAL_THRESHOLDS.TARGET_UPSIDE_HIGH &&
      fundamentalComponent.percent >= SIGNAL_THRESHOLDS.FUND_MODERATE,
    conditions: [
      {
        name: 'targetUpside',
        actual: targetUpside !== null ? `${Math.round(targetUpside)}%` : 'N/A',
        required: `≥ ${SIGNAL_THRESHOLDS.TARGET_UPSIDE_HIGH}%`,
        passed:
          targetUpside !== null &&
          targetUpside >= SIGNAL_THRESHOLDS.TARGET_UPSIDE_HIGH,
      },
      {
        name: 'fundamentalScore',
        actual: Math.round(fundamentalComponent.percent),
        required: `≥ ${SIGNAL_THRESHOLDS.FUND_MODERATE}`,
        passed: fundamentalComponent.percent >= SIGNAL_THRESHOLDS.FUND_MODERATE,
      },
    ],
  });

  // STRONG_TREND
  signalEvaluation.push({
    signal: 'STRONG_TREND',
    category: 'quality',
    passed:
      adxValue !== null &&
      adxValue >= SIGNAL_THRESHOLDS.ADX_STRONG &&
      adxTrend === 'bullish',
    conditions: [
      {
        name: 'ADX',
        actual: adxValue !== null ? Math.round(adxValue) : 'N/A',
        required: `≥ ${SIGNAL_THRESHOLDS.ADX_STRONG}`,
        passed: adxValue !== null && adxValue >= SIGNAL_THRESHOLDS.ADX_STRONG,
      },
      {
        name: 'adxTrend',
        actual: adxTrend ?? 'N/A',
        required: 'bullish',
        passed: adxTrend === 'bullish',
      },
    ],
  });

  // STEADY
  signalEvaluation.push({
    signal: 'STEADY',
    category: 'quality',
    passed:
      fundamentalComponent.percent >= SIGNAL_THRESHOLDS.FUND_MODERATE &&
      technicalComponent.percent >= SIGNAL_THRESHOLDS.TECH_MODERATE &&
      convictionLevel !== 'LOW',
    conditions: [
      {
        name: 'fundamentalScore',
        actual: Math.round(fundamentalComponent.percent),
        required: `≥ ${SIGNAL_THRESHOLDS.FUND_MODERATE}`,
        passed: fundamentalComponent.percent >= SIGNAL_THRESHOLDS.FUND_MODERATE,
      },
      {
        name: 'technicalScore',
        actual: Math.round(technicalComponent.percent),
        required: `≥ ${SIGNAL_THRESHOLDS.TECH_MODERATE}`,
        passed: technicalComponent.percent >= SIGNAL_THRESHOLDS.TECH_MODERATE,
      },
      {
        name: 'convictionLevel',
        actual: convictionLevel,
        required: '≠ LOW',
        passed: convictionLevel !== 'LOW',
      },
    ],
  });

  // OVERBOUGHT
  signalEvaluation.push({
    signal: 'OVERBOUGHT',
    category: 'quality',
    passed:
      rsiValue !== null &&
      rsiValue > SIGNAL_THRESHOLDS.RSI_OVERBOUGHT &&
      stochK !== null &&
      stochK > 80,
    conditions: [
      {
        name: 'RSI',
        actual: rsiValue !== null ? Math.round(rsiValue) : 'N/A',
        required: `> ${SIGNAL_THRESHOLDS.RSI_OVERBOUGHT}`,
        passed:
          rsiValue !== null && rsiValue > SIGNAL_THRESHOLDS.RSI_OVERBOUGHT,
      },
      {
        name: 'StochK',
        actual: stochK !== null ? Math.round(stochK) : 'N/A',
        required: '> 80',
        passed: stochK !== null && stochK > 80,
      },
    ],
  });

  // WATCH
  signalEvaluation.push({
    signal: 'WATCH',
    category: 'quality',
    passed:
      fundamentalComponent.percent < SIGNAL_THRESHOLDS.FUND_WATCH ||
      insiderComponent.percent < SIGNAL_THRESHOLDS.INSIDER_WEAK ||
      newsComponent.percent < SIGNAL_THRESHOLDS.NEWS_WATCH,
    conditions: [
      {
        name: 'fundamentalScore',
        actual: Math.round(fundamentalComponent.percent),
        required: `< ${SIGNAL_THRESHOLDS.FUND_WATCH}`,
        passed: fundamentalComponent.percent < SIGNAL_THRESHOLDS.FUND_WATCH,
      },
      {
        name: 'insiderScore',
        actual: Math.round(insiderComponent.percent),
        required: `< ${SIGNAL_THRESHOLDS.INSIDER_WEAK}`,
        passed: insiderComponent.percent < SIGNAL_THRESHOLDS.INSIDER_WEAK,
      },
      {
        name: 'newsScore',
        actual: Math.round(newsComponent.percent),
        required: `< ${SIGNAL_THRESHOLDS.NEWS_WATCH}`,
        passed: newsComponent.percent < SIGNAL_THRESHOLDS.NEWS_WATCH,
      },
    ],
  });

  // WEAK
  signalEvaluation.push({
    signal: 'WEAK',
    category: 'quality',
    passed:
      fundamentalComponent.percent < SIGNAL_THRESHOLDS.FUND_WEAK ||
      technicalComponent.percent < SIGNAL_THRESHOLDS.TECH_WEAK,
    conditions: [
      {
        name: 'fundamentalScore',
        actual: Math.round(fundamentalComponent.percent),
        required: `< ${SIGNAL_THRESHOLDS.FUND_WEAK}`,
        passed: fundamentalComponent.percent < SIGNAL_THRESHOLDS.FUND_WEAK,
      },
      {
        name: 'technicalScore',
        actual: Math.round(technicalComponent.percent),
        required: `< ${SIGNAL_THRESHOLDS.TECH_WEAK}`,
        passed: technicalComponent.percent < SIGNAL_THRESHOLDS.TECH_WEAK,
      },
    ],
  });

  // NEUTRAL (always possible as fallback)
  signalEvaluation.push({
    signal: 'NEUTRAL',
    category: 'quality',
    passed: true, // fallback
    conditions: [
      {
        name: 'fallback',
        actual: 'ano',
        required: 'fallback signál',
        passed: true,
      },
    ],
  });

  // Build decision path explanation
  const actionReason = actionSignal
    ? `${actionSignal} splnil všechny podmínky s nejvyšší prioritou`
    : 'Žádný action signál nesplnil podmínky';

  const qualityReason =
    qualitySignal === 'NEUTRAL'
      ? 'Žádný quality signál nesplnil podmínky, použit fallback NEUTRAL'
      : `${qualitySignal} splnil všechny podmínky s nejvyšší prioritou`;

  // Get analyst recommendation data from item directly
  const totalAnalysts =
    (item.strongBuy ?? 0) +
    (item.buy ?? 0) +
    (item.hold ?? 0) +
    (item.sell ?? 0) +
    (item.strongSell ?? 0);

  // Calculate consensus score (1-5 scale, 5 = strong buy)
  let consensusScore: number | null = null;
  if (totalAnalysts > 0) {
    consensusScore =
      ((item.strongBuy ?? 0) * 5 +
        (item.buy ?? 0) * 4 +
        (item.hold ?? 0) * 3 +
        (item.sell ?? 0) * 2 +
        (item.strongSell ?? 0) * 1) /
      totalAnalysts;
  }

  const maxPoints = portfolioComponent ? 500 : 400;

  return {
    technicalIndicators: {
      rsi14: rsiValue !== null ? Math.round(rsiValue * 10) / 10 : null,
      macdHistogram:
        tech?.macdHistogram !== null && tech?.macdHistogram !== undefined
          ? Math.round(tech.macdHistogram * 100) / 100
          : null,
      macdSignalLine: tech?.macdSignal ?? null,
      stochK: stochK !== null ? Math.round(stochK) : null,
      stochD: stochD !== null ? Math.round(stochD) : null,
      adx: adxValue !== null ? Math.round(adxValue) : null,
      bollingerUpper: tech?.bollingerUpper ?? null,
      bollingerLower: tech?.bollingerLower ?? null,
      bollingerMiddle: tech?.bollingerMiddle ?? null,
      sma20: null, // Not in TechnicalData
      sma50: tech?.sma50 ?? null,
      sma200: tech?.sma200 ?? null,
      atr14: tech?.atr14 ?? null,
    },

    fundamentalData: {
      peRatio: item.fundamentals?.peRatio ?? null,
      forwardPE: item.fundamentals?.forwardPe ?? null,
      pegRatio: item.fundamentals?.pegRatio ?? null,
      roe: item.fundamentals?.roe ?? null,
      profitMargin: item.fundamentals?.netMargin ?? null,
      debtToEquity: item.fundamentals?.debtToEquity ?? null,
      revenueGrowth: item.fundamentals?.revenueGrowth ?? null,
      epsGrowth: item.fundamentals?.epsGrowth ?? null,
      currentRatio: item.fundamentals?.currentRatio ?? null,
    },

    analystData: {
      targetPrice: item.analystTargetPrice ?? item.targetPrice ?? null,
      currentPrice: item.currentPrice ?? null,
      upside: targetUpside !== null ? Math.round(targetUpside) : null,
      strongBuy: item.strongBuy ?? 0,
      buy: item.buy ?? 0,
      hold: item.hold ?? 0,
      sell: item.sell ?? 0,
      strongSell: item.strongSell ?? 0,
      totalAnalysts,
      consensusScore:
        consensusScore !== null ? Math.round(consensusScore * 10) / 10 : null,
    },

    scoreBreakdown: {
      fundamental: {
        points: fundamentalComponent.score,
        maxPoints: fundamentalComponent.maxScore,
        percent: Math.round(fundamentalComponent.percent),
      },
      technical: {
        points: technicalComponent.score,
        maxPoints: technicalComponent.maxScore,
        percent: Math.round(technicalComponent.percent),
      },
      analyst: {
        points: analystComponent.score,
        maxPoints: analystComponent.maxScore,
        percent: Math.round(analystComponent.percent),
      },
      news: {
        points: newsComponent.score,
        maxPoints: newsComponent.maxScore,
        percent: Math.round(newsComponent.percent),
      },
      insider: {
        points: insiderComponent.score,
        maxPoints: insiderComponent.maxScore,
        percent: Math.round(insiderComponent.percent),
      },
      portfolio: portfolioComponent
        ? {
            points: portfolioComponent.score,
            maxPoints: portfolioComponent.maxScore,
            percent: Math.round(portfolioComponent.percent),
          }
        : null,
      composite: {
        points: Math.round(compositeScore * (maxPoints / 100)),
        maxPoints,
        percent: Math.round(compositeScore),
      },
    },

    signalEvaluation,

    decisionPath: {
      actionSignal: {
        chosen: actionSignal,
        reason: actionReason,
      },
      qualitySignal: {
        chosen: qualitySignal,
        reason: qualityReason,
      },
    },

    thresholds: SIGNAL_THRESHOLDS,
  };
}

// ============================================================================
// MAIN RECOMMENDATION FUNCTION
// ============================================================================

/**
 * Generate complete recommendation for a stock
 *
 * v3.1 Scoring System:
 * - Research view: 400 points total (no portfolio context)
 * - Holdings view: 500 points total (includes portfolio overlay)
 *
 * All individual scores are normalized to 0-100 for consistent weighting.
 */
export function generateRecommendation(
  input: RecommendationInput
): StockRecommendation {
  const {
    analystData: item,
    technicalData: tech,
    newsArticles,
    insiderTimeRange,
    isResearch = false,
  } = input;

  // Calculate all score components
  const fundamentalComponent = calculateFundamentalScore(item.fundamentals);
  const technicalComponent = calculateTechnicalScore(tech);
  const analystComponent = calculateAnalystScore(item);

  // v3.1: Combined News+Insider score (replaces separate scores)
  const newsInsiderComponent = calculateNewsInsiderScore(
    item.ticker,
    newsArticles,
    item,
    insiderTimeRange
  );

  // Legacy separate scores (for backward compatibility in UI if needed)
  const newsComponent = calculateNewsScore(item.ticker, newsArticles);
  const insiderComponent = calculateInsiderScore(item, insiderTimeRange);

  const portfolioComponent = isResearch ? null : calculatePortfolioScore(item);

  // Calculate composite score - use different weights for Research vs Holdings
  // v3.1: Uses new weight distribution
  const compositeScore = isResearch
    ? Math.round(
        fundamentalComponent.percent * SCORE_WEIGHTS_RESEARCH.fundamental +
          technicalComponent.percent * SCORE_WEIGHTS_RESEARCH.technical +
          analystComponent.percent * SCORE_WEIGHTS_RESEARCH.analyst +
          newsInsiderComponent.percent * SCORE_WEIGHTS_RESEARCH.newsInsider
      )
    : Math.round(
        fundamentalComponent.percent * SCORE_WEIGHTS.fundamental +
          technicalComponent.percent * SCORE_WEIGHTS.technical +
          analystComponent.percent * SCORE_WEIGHTS.analyst +
          newsInsiderComponent.percent * SCORE_WEIGHTS.newsInsider +
          portfolioComponent!.percent * SCORE_WEIGHTS.portfolio
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
  // For Research view, use analystTargetPrice since there's no personal targetPrice
  let targetUpside: number | null = null;
  const effectiveTargetPrice =
    item.targetPrice ?? item.analystTargetPrice ?? null;
  if (
    effectiveTargetPrice !== null &&
    item.currentPrice !== null &&
    item.currentPrice > 0
  ) {
    targetUpside =
      ((effectiveTargetPrice - item.currentPrice) / item.currentPrice) * 100;
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
    portfolioComponent?.percent ?? 0,
    dipResult.score,
    dipQuality.passes,
    conviction.score,
    conviction.level,
    targetUpside,
    item.gainPercentage ?? 0,
    item.weight,
    tech,
    isResearch
  );

  // Compile strengths and concerns
  const strengths: string[] = [];
  const concerns: string[] = [];

  if (fundamentalComponent.percent >= 65) strengths.push('Silné fundamenty');
  if (technicalComponent.percent >= 65) strengths.push('Býčí technika');
  if (analystComponent.percent >= 65)
    strengths.push('Pozitivní sentiment analytiků');
  if (insiderComponent.percent >= 60) strengths.push('Insider nákupy');
  if (conviction.level === 'HIGH') strengths.push('Vysoká kvalita');
  if (dipResult.score >= 50 && dipQuality.passes)
    strengths.push('DIP příležitost');

  if (fundamentalComponent.percent < 35) concerns.push('Slabé fundamenty');
  if (technicalComponent.percent < 35) concerns.push('Medvědí technika');
  if (analystComponent.percent < 35)
    concerns.push('Negativní sentiment analytiků');
  if (insiderComponent.percent < 40) concerns.push('Insider prodeje');
  if (newsComponent.percent < 35) concerns.push('Negativní zprávy');
  if (item.weight > 12) concerns.push('Převážená pozice');

  // Action items
  const actionItems: string[] = [];
  const primarySignal = signals[0];

  if (primarySignal.type === 'DIP_OPPORTUNITY') {
    actionItems.push('Zvažte navýšení pozice');
    if (distanceFromAvg < -10) actionItems.push('Dobrá DCA příležitost');
  }
  if (primarySignal.type === 'CONVICTION') {
    actionItems.push('Držte i přes krátkodobou volatilitu');
  }
  if (primarySignal.type === 'CONSIDER_TRIM') {
    actionItems.push('Zvažte částečný výběr zisků');
  }
  if (primarySignal.type === 'WATCH') {
    actionItems.push('Sledujte nadčcházející výsledky');
    actionItems.push('Nastavte cenové alerty');
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

  // Get action and quality signals for explanation
  const actionSignalType =
    signals.find((s) => s.category === 'action')?.type ?? null;
  const qualitySignalType =
    signals.find((s) => s.category === 'quality')?.type ?? 'NEUTRAL';

  // Generate explanation data
  const explanation = generateExplanation(
    item,
    tech,
    fundamentalComponent,
    technicalComponent,
    analystComponent,
    newsComponent,
    insiderComponent,
    portfolioComponent,
    compositeScore,
    dipResult.score,
    dipQuality.passes,
    conviction.score,
    conviction.level,
    targetUpside,
    item.gainPercentage ?? 0,
    item.weight,
    actionSignalType,
    qualitySignalType
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
    portfolioScore: portfolioComponent?.percent ?? null,

    convictionScore: conviction.score,
    convictionLevel: conviction.level,

    dipScore: dipResult.score,
    isDip: dipResult.score >= 50,
    dipQualityCheck: dipQuality.passes,

    breakdown: isResearch
      ? [
          fundamentalComponent,
          technicalComponent,
          analystComponent,
          newsComponent,
          insiderComponent,
        ]
      : [
          fundamentalComponent,
          technicalComponent,
          analystComponent,
          newsComponent,
          insiderComponent,
          portfolioComponent!,
        ],

    signals,
    primarySignal,

    // Category-based signals (2 categories: action + quality)
    actionSignal: signals.find((s) => s.category === 'action') ?? null,
    qualitySignal: signals.find((s) => s.category === 'quality') ?? null,

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

    explanation,
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

// ============================================================================
// SIGNAL CATEGORY HELPERS
// ============================================================================

/** Category labels for UI display */
export const SIGNAL_CATEGORY_LABELS: Record<SignalCategory, string> = {
  action: 'Akce',
  quality: 'Kvalita',
};

/**
 * Get the primary signals for display (one from each category)
 * Returns [actionSignal, qualitySignal] - the two most important for tile display
 */
export function getDisplaySignals(
  rec: StockRecommendation
): [StockSignal | null, StockSignal | null] {
  return [rec.actionSignal, rec.qualitySignal];
}

/**
 * Check if stock has any actionable signal (not just quality/neutral)
 */
export function hasActionableSignal(rec: StockRecommendation): boolean {
  return rec.actionSignal !== null;
}
