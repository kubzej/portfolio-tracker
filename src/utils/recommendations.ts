import type { AnalystData } from '@/services/api/analysis';

// Extended analyst data with portfolio context
export interface EnrichedAnalystData extends AnalystData {
  weight: number;
  currentValue: number;
  totalShares: number;
  avgBuyPrice: number;
  totalInvested: number;
  unrealizedGain: number;
  gainPercentage: number;
}

export interface ScoreBreakdown {
  category: string;
  score: number;
  maxScore: number;
  details: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}

export interface StockRecommendation {
  ticker: string;
  stockName: string;
  weight: number;
  totalScore: number;
  maxPossibleScore: number;
  scorePercent: number;
  recommendation: 'Strong Buy' | 'Buy' | 'Hold' | 'Reduce' | 'Sell';
  recommendationClass: string;
  breakdown: ScoreBreakdown[];
  keyStrengths: string[];
  keyWeaknesses: string[];
  actionItems: string[];
}

// Insider sentiment time range options (in months)
export type InsiderTimeRange = 1 | 2 | 3 | 6 | 12;

interface InsiderData {
  mspr: number | null;
  change: number | null;
}

/**
 * Filter insider sentiment data based on time range (in months)
 */
export function getFilteredInsiderSentiment(
  item: EnrichedAnalystData,
  months: InsiderTimeRange
): InsiderData {
  const monthlyData = item.insiderSentiment?.monthlyData;

  // If no monthlyData but we have aggregated values, use those (backward compatibility)
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

  // Calculate the cutoff date
  const now = new Date();
  const cutoffYear = now.getFullYear();
  const cutoffMonth = now.getMonth() + 1; // 1-indexed

  // Filter to only include months within the range
  const filtered = monthlyData.filter((d) => {
    const monthsDiff = (cutoffYear - d.year) * 12 + (cutoffMonth - d.month);
    return monthsDiff >= 0 && monthsDiff < months;
  });

  // If no data in selected range, try using all available data
  const dataToUse =
    filtered.length > 0 ? filtered : monthlyData.slice(0, months);

  if (dataToUse.length === 0) {
    return { mspr: null, change: null };
  }

  // Calculate aggregates
  const avgMspr =
    dataToUse.reduce((sum, d) => sum + d.mspr, 0) / dataToUse.length;
  const totalChange = dataToUse.reduce((sum, d) => sum + d.change, 0);

  return {
    mspr: Math.round(avgMspr * 100) / 100,
    change: totalChange,
  };
}

/**
 * Calculate recommendation score and details for a stock
 */
export function getStockRecommendation(
  item: EnrichedAnalystData,
  insiderTimeRange: InsiderTimeRange
): StockRecommendation {
  const breakdown: ScoreBreakdown[] = [];
  const keyStrengths: string[] = [];
  const keyWeaknesses: string[] = [];
  const actionItems: string[] = [];
  const f = item.fundamentals;

  // 1. VALUATION SCORE (max 25 points)
  let valuationScore = 0;
  const valuationMax = 25;
  const valuationDetails: string[] = [];

  // P/E Ratio (0-8 points)
  if (f?.peRatio !== null && f?.peRatio !== undefined && f.peRatio > 0) {
    if (f.peRatio < 15) {
      valuationScore += 8;
      valuationDetails.push('P/E < 15 (undervalued)');
      keyStrengths.push('Attractively valued P/E ratio');
    } else if (f.peRatio < 25) {
      valuationScore += 5;
      valuationDetails.push('P/E 15-25 (fair)');
    } else if (f.peRatio < 40) {
      valuationScore += 2;
      valuationDetails.push('P/E 25-40 (expensive)');
    } else {
      valuationDetails.push('P/E > 40 (very expensive)');
      keyWeaknesses.push('Very high P/E ratio');
    }
  }

  // Forward P/E vs Trailing P/E (0-5 points) - earnings growth expected
  if (
    f?.peRatio !== null &&
    f?.forwardPe !== null &&
    f.peRatio > 0 &&
    f.forwardPe > 0
  ) {
    const peImprovement = ((f.peRatio - f.forwardPe) / f.peRatio) * 100;
    if (peImprovement > 20) {
      valuationScore += 5;
      valuationDetails.push('Strong earnings growth expected');
      keyStrengths.push('Earnings expected to grow significantly');
    } else if (peImprovement > 10) {
      valuationScore += 3;
      valuationDetails.push('Moderate earnings growth expected');
    } else if (peImprovement < -10) {
      valuationDetails.push('Earnings expected to decline');
      keyWeaknesses.push('Analysts expect earnings decline');
    }
  }

  // PEG Ratio (0-6 points) - growth at reasonable price
  if (f?.pegRatio !== null && f?.pegRatio !== undefined && f.pegRatio > 0) {
    if (f.pegRatio < 1) {
      valuationScore += 6;
      valuationDetails.push('PEG < 1 (growth undervalued)');
      keyStrengths.push('Growth at a reasonable price (PEG < 1)');
    } else if (f.pegRatio < 1.5) {
      valuationScore += 4;
      valuationDetails.push('PEG 1-1.5 (fairly valued growth)');
    } else if (f.pegRatio < 2) {
      valuationScore += 2;
      valuationDetails.push('PEG 1.5-2 (expensive growth)');
    } else {
      valuationDetails.push('PEG > 2 (overpriced for growth)');
    }
  }

  // P/B Ratio (0-6 points)
  if (f?.pbRatio !== null && f?.pbRatio !== undefined && f.pbRatio > 0) {
    if (f.pbRatio < 1) {
      valuationScore += 6;
      valuationDetails.push('P/B < 1 (below book value)');
      keyStrengths.push('Trading below book value');
    } else if (f.pbRatio < 3) {
      valuationScore += 4;
      valuationDetails.push('P/B 1-3 (reasonable)');
    } else if (f.pbRatio < 5) {
      valuationScore += 2;
      valuationDetails.push('P/B 3-5 (premium)');
    }
  }

  breakdown.push({
    category: 'Valuation',
    score: valuationScore,
    maxScore: valuationMax,
    details: valuationDetails.join('; ') || 'Insufficient data',
    sentiment:
      valuationScore >= 15
        ? 'positive'
        : valuationScore <= 8
        ? 'negative'
        : 'neutral',
  });

  // 2. PROFITABILITY SCORE (max 20 points)
  let profitScore = 0;
  const profitMax = 20;
  const profitDetails: string[] = [];

  // ROE (0-7 points)
  if (f?.roe !== null && f?.roe !== undefined) {
    if (f.roe > 20) {
      profitScore += 7;
      profitDetails.push('Excellent ROE > 20%');
      keyStrengths.push('Exceptional return on equity');
    } else if (f.roe > 15) {
      profitScore += 5;
      profitDetails.push('Good ROE 15-20%');
    } else if (f.roe > 10) {
      profitScore += 3;
      profitDetails.push('Moderate ROE 10-15%');
    } else if (f.roe > 0) {
      profitScore += 1;
      profitDetails.push('Low ROE < 10%');
    } else {
      profitDetails.push('Negative ROE');
      keyWeaknesses.push('Negative return on equity');
    }
  }

  // Net Margin (0-7 points)
  if (f?.netMargin !== null && f?.netMargin !== undefined) {
    if (f.netMargin > 20) {
      profitScore += 7;
      profitDetails.push('Excellent margins > 20%');
      keyStrengths.push('Very high profit margins');
    } else if (f.netMargin > 10) {
      profitScore += 5;
      profitDetails.push('Good margins 10-20%');
    } else if (f.netMargin > 5) {
      profitScore += 3;
      profitDetails.push('Moderate margins 5-10%');
    } else if (f.netMargin > 0) {
      profitScore += 1;
      profitDetails.push('Thin margins < 5%');
      keyWeaknesses.push('Very thin profit margins');
    } else {
      profitDetails.push('Unprofitable');
      keyWeaknesses.push('Company is not profitable');
    }
  }

  // Gross Margin (0-6 points) - pricing power
  if (f?.grossMargin !== null && f?.grossMargin !== undefined) {
    if (f.grossMargin > 50) {
      profitScore += 6;
      profitDetails.push('Strong pricing power');
      keyStrengths.push('Strong pricing power (high gross margin)');
    } else if (f.grossMargin > 30) {
      profitScore += 4;
      profitDetails.push('Decent gross margin');
    } else if (f.grossMargin > 15) {
      profitScore += 2;
      profitDetails.push('Low gross margin');
    }
  }

  breakdown.push({
    category: 'Profitability',
    score: profitScore,
    maxScore: profitMax,
    details: profitDetails.join('; ') || 'Insufficient data',
    sentiment:
      profitScore >= 14
        ? 'positive'
        : profitScore <= 6
        ? 'negative'
        : 'neutral',
  });

  // 3. GROWTH SCORE (max 20 points)
  let growthScore = 0;
  const growthMax = 20;
  const growthDetails: string[] = [];

  // Revenue Growth (0-8 points)
  if (f?.revenueGrowth !== null && f?.revenueGrowth !== undefined) {
    if (f.revenueGrowth > 20) {
      growthScore += 8;
      growthDetails.push('Strong revenue growth > 20%');
      keyStrengths.push('Rapidly growing revenue');
    } else if (f.revenueGrowth > 10) {
      growthScore += 6;
      growthDetails.push('Good revenue growth 10-20%');
    } else if (f.revenueGrowth > 0) {
      growthScore += 3;
      growthDetails.push('Modest revenue growth');
    } else {
      growthDetails.push('Revenue declining');
      keyWeaknesses.push('Revenue is declining');
    }
  }

  // EPS Growth (0-7 points)
  if (f?.epsGrowth !== null && f?.epsGrowth !== undefined) {
    if (f.epsGrowth > 20) {
      growthScore += 7;
      growthDetails.push('Strong EPS growth > 20%');
    } else if (f.epsGrowth > 10) {
      growthScore += 5;
      growthDetails.push('Good EPS growth 10-20%');
    } else if (f.epsGrowth > 0) {
      growthScore += 2;
      growthDetails.push('Modest EPS growth');
    } else {
      growthDetails.push('EPS declining');
    }
  }

  // 5-Year Revenue Growth (0-5 points) - consistency
  if (f?.revenueGrowth5Y !== null && f?.revenueGrowth5Y !== undefined) {
    if (f.revenueGrowth5Y > 15) {
      growthScore += 5;
      growthDetails.push('Consistent 5Y growth');
      keyStrengths.push('Consistent long-term growth track record');
    } else if (f.revenueGrowth5Y > 8) {
      growthScore += 3;
      growthDetails.push('Moderate 5Y growth');
    } else if (f.revenueGrowth5Y > 0) {
      growthScore += 1;
      growthDetails.push('Slow 5Y growth');
    }
  }

  breakdown.push({
    category: 'Growth',
    score: growthScore,
    maxScore: growthMax,
    details: growthDetails.join('; ') || 'Insufficient data',
    sentiment:
      growthScore >= 14
        ? 'positive'
        : growthScore <= 6
        ? 'negative'
        : 'neutral',
  });

  // 4. FINANCIAL HEALTH SCORE (max 15 points)
  let healthScore = 0;
  const healthMax = 15;
  const healthDetails: string[] = [];

  // Debt to Equity (0-6 points)
  if (f?.debtToEquity !== null && f?.debtToEquity !== undefined) {
    if (f.debtToEquity < 0.3) {
      healthScore += 6;
      healthDetails.push('Very low debt');
      keyStrengths.push('Very strong balance sheet');
    } else if (f.debtToEquity < 0.7) {
      healthScore += 5;
      healthDetails.push('Low debt');
    } else if (f.debtToEquity < 1.5) {
      healthScore += 3;
      healthDetails.push('Moderate debt');
    } else if (f.debtToEquity < 2.5) {
      healthScore += 1;
      healthDetails.push('High debt');
      keyWeaknesses.push('High debt levels');
    } else {
      healthDetails.push('Very high debt risk');
      keyWeaknesses.push('Dangerously high debt');
      actionItems.push('Monitor debt levels closely');
    }
  }

  // Current Ratio (0-5 points) - liquidity
  if (f?.currentRatio !== null && f?.currentRatio !== undefined) {
    if (f.currentRatio > 2) {
      healthScore += 5;
      healthDetails.push('Strong liquidity');
    } else if (f.currentRatio > 1.5) {
      healthScore += 4;
      healthDetails.push('Good liquidity');
    } else if (f.currentRatio > 1) {
      healthScore += 2;
      healthDetails.push('Adequate liquidity');
    } else {
      healthDetails.push('Liquidity concerns');
      keyWeaknesses.push('Potential liquidity issues');
    }
  }

  // Beta (0-4 points) - lower volatility preferred
  if (f?.beta !== null && f?.beta !== undefined) {
    if (f.beta >= 0 && f.beta < 0.8) {
      healthScore += 4;
      healthDetails.push('Low volatility');
      keyStrengths.push('Lower volatility than market');
    } else if (f.beta < 1.2) {
      healthScore += 3;
      healthDetails.push('Market-like volatility');
    } else if (f.beta < 1.5) {
      healthScore += 1;
      healthDetails.push('Above-average volatility');
    } else {
      healthDetails.push('High volatility');
      keyWeaknesses.push('Very volatile stock');
    }
  }

  breakdown.push({
    category: 'Financial Health',
    score: healthScore,
    maxScore: healthMax,
    details: healthDetails.join('; ') || 'Insufficient data',
    sentiment:
      healthScore >= 11
        ? 'positive'
        : healthScore <= 5
        ? 'negative'
        : 'neutral',
  });

  // 5. ANALYST & INSIDER SENTIMENT (max 20 points)
  let sentimentScore = 0;
  const sentimentMax = 20;
  const sentimentDetails: string[] = [];

  // Analyst Consensus (0-10 points)
  if (item.consensusScore !== null) {
    if (item.consensusScore > 1) {
      sentimentScore += 10;
      sentimentDetails.push('Strong Buy consensus');
      keyStrengths.push('Analysts strongly recommend buying');
    } else if (item.consensusScore > 0.5) {
      sentimentScore += 8;
      sentimentDetails.push('Buy consensus');
    } else if (item.consensusScore > 0) {
      sentimentScore += 6;
      sentimentDetails.push('Moderate Buy');
    } else if (item.consensusScore > -0.5) {
      sentimentScore += 4;
      sentimentDetails.push('Hold consensus');
    } else if (item.consensusScore > -1) {
      sentimentScore += 2;
      sentimentDetails.push('Underperform rating');
      keyWeaknesses.push('Analysts recommend reducing');
      actionItems.push('Consider reducing position');
    } else {
      sentimentDetails.push('Sell rating');
      keyWeaknesses.push('Analysts recommend selling');
      actionItems.push('Review position - analysts bearish');
    }
  }

  // Insider Sentiment (0-10 points)
  const insiderData = getFilteredInsiderSentiment(item, insiderTimeRange);
  if (insiderData.mspr !== null) {
    if (insiderData.mspr > 50) {
      sentimentScore += 10;
      sentimentDetails.push('Very strong insider buying');
      keyStrengths.push('Heavy insider buying - bullish signal');
    } else if (insiderData.mspr > 25) {
      sentimentScore += 8;
      sentimentDetails.push('Strong insider buying');
      keyStrengths.push('Insiders are buying');
    } else if (insiderData.mspr > 0) {
      sentimentScore += 5;
      sentimentDetails.push('Modest insider buying');
    } else if (insiderData.mspr > -25) {
      sentimentScore += 2;
      sentimentDetails.push('Some insider selling');
    } else {
      sentimentDetails.push('Heavy insider selling');
      keyWeaknesses.push('Insiders are selling heavily');
      actionItems.push('Investigate insider selling');
    }
  }

  breakdown.push({
    category: 'Sentiment',
    score: sentimentScore,
    maxScore: sentimentMax,
    details: sentimentDetails.join('; ') || 'Insufficient data',
    sentiment:
      sentimentScore >= 14
        ? 'positive'
        : sentimentScore <= 6
        ? 'negative'
        : 'neutral',
  });

  // Calculate total score
  const totalScore =
    valuationScore + profitScore + growthScore + healthScore + sentimentScore;
  const maxPossibleScore =
    valuationMax + profitMax + growthMax + healthMax + sentimentMax;
  const scorePercent = (totalScore / maxPossibleScore) * 100;

  // Determine recommendation
  let recommendation: StockRecommendation['recommendation'];
  let recommendationClass: string;

  if (scorePercent >= 75) {
    recommendation = 'Strong Buy';
    recommendationClass = 'strong-buy';
    actionItems.push('Consider increasing position');
  } else if (scorePercent >= 60) {
    recommendation = 'Buy';
    recommendationClass = 'buy';
    actionItems.push('Good candidate for adding on dips');
  } else if (scorePercent >= 45) {
    recommendation = 'Hold';
    recommendationClass = 'hold';
    actionItems.push('Monitor for changes in fundamentals');
  } else if (scorePercent >= 30) {
    recommendation = 'Reduce';
    recommendationClass = 'reduce';
    actionItems.push('Consider trimming position');
  } else {
    recommendation = 'Sell';
    recommendationClass = 'sell';
    actionItems.push('Consider exiting position');
  }

  // Add 52-week position context
  if (
    item.currentPrice !== null &&
    item.fiftyTwoWeekHigh !== null &&
    item.fiftyTwoWeekLow !== null
  ) {
    const position =
      ((item.currentPrice - item.fiftyTwoWeekLow) /
        (item.fiftyTwoWeekHigh - item.fiftyTwoWeekLow)) *
      100;
    if (position < 20) {
      keyStrengths.push('Near 52-week low - potential value');
      if (recommendation === 'Hold' || recommendation === 'Buy') {
        actionItems.push('Near lows - could be good entry point');
      }
    } else if (position > 80) {
      keyWeaknesses.push('Near 52-week high - less upside');
      if (recommendation === 'Hold') {
        actionItems.push('Near highs - consider taking some profits');
      }
    }
  }

  // Earnings context
  if (item.earnings && item.earnings.length > 0) {
    const recentBeats = item.earnings
      .slice(0, 4)
      .filter(
        (e) => e.surprisePercent !== null && e.surprisePercent > 0
      ).length;
    if (recentBeats >= 3) {
      keyStrengths.push(`Beat earnings ${recentBeats}/4 quarters`);
    } else if (recentBeats <= 1) {
      keyWeaknesses.push('Struggling to beat earnings estimates');
    }
  }

  return {
    ticker: item.ticker,
    stockName: item.stockName,
    weight: item.weight,
    totalScore,
    maxPossibleScore,
    scorePercent,
    recommendation,
    recommendationClass,
    breakdown,
    keyStrengths: keyStrengths.slice(0, 4), // Top 4
    keyWeaknesses: keyWeaknesses.slice(0, 4),
    actionItems: actionItems.slice(0, 3),
  };
}

/**
 * Get recommendations for all stocks
 */
export function getAllRecommendations(
  data: EnrichedAnalystData[],
  insiderTimeRange: InsiderTimeRange
): StockRecommendation[] {
  return data
    .filter((item) => item.weight > 0)
    .map((item) => getStockRecommendation(item, insiderTimeRange))
    .sort((a, b) => b.scorePercent - a.scorePercent);
}
