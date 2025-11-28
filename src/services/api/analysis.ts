import { supabase } from '@/lib/supabase';

// Earnings surprise data for a single quarter
export interface EarningsData {
  actual: number | null;
  estimate: number | null;
  period: string | null;
  surprise: number | null;
  surprisePercent: number | null;
}

// Fundamental metrics from Finnhub - all available from FREE tier
export interface FundamentalMetrics {
  // Valuation
  peRatio: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  pegRatio: number | null;
  evEbitda: number | null;
  forwardPe: number | null;
  // Profitability
  roe: number | null;
  roa: number | null;
  roi: number | null;
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  // Growth
  revenueGrowth: number | null;
  epsGrowth: number | null;
  revenueGrowth3Y: number | null;
  revenueGrowth5Y: number | null;
  epsGrowth5Y: number | null;
  // Risk
  beta: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  // Dividend
  dividendYield: number | null;
  payoutRatio: number | null;
  dividendGrowth5Y: number | null;
  // Performance
  return52W: number | null;
  return13W: number | null;
  returnVsSP500: number | null;
  // Size
  marketCap: number | null;
  enterpriseValue: number | null;
}

// Insider sentiment monthly data point
export interface InsiderMonthlyData {
  year: number;
  month: number;
  mspr: number;
  change: number;
}

// Insider sentiment data with all monthly points for client-side filtering
export interface InsiderSentiment {
  mspr: number | null; // Monthly Share Purchase Ratio (-100 to 100) - aggregated
  change: number | null; // Net buying/selling - aggregated
  monthlyData: InsiderMonthlyData[]; // All monthly data for time range filtering
}

export interface AnalystData {
  ticker: string;
  stockName: string;
  // Price data
  currentPrice: number | null;
  priceChange: number | null;
  priceChangePercent: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  // Analyst recommendations
  recommendationKey: string | null;
  consensusScore: number | null; // -2 (strong sell) to +2 (strong buy)
  strongBuy: number | null;
  buy: number | null;
  hold: number | null;
  sell: number | null;
  strongSell: number | null;
  numberOfAnalysts: number | null;
  recommendationPeriod: string | null; // When recommendations were last updated
  // Earnings data (last 4 quarters)
  earnings: EarningsData[];
  // Fundamental metrics
  fundamentals: FundamentalMetrics;
  // Insider sentiment
  insiderSentiment: InsiderSentiment | null;
  // Company peers
  peers: string[];
  // Company profile
  industry: string | null;
  // Error tracking
  error?: string;
}

export interface AnalysisResult {
  data: AnalystData[];
  errors: string[];
}

/**
 * Fetch analyst data for portfolio holdings
 */
export async function fetchAnalystData(
  portfolioId?: string
): Promise<AnalysisResult> {
  const { data, error } = await supabase.functions.invoke(
    'fetch-analyst-data',
    {
      body: { portfolioId },
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  return data as AnalysisResult;
}

/**
 * Fetch analyst data for a single ticker
 */
export async function fetchSingleAnalystData(
  ticker: string,
  stockName?: string,
  finnhubTicker?: string
): Promise<AnalystData | null> {
  const { data, error } = await supabase.functions.invoke(
    'fetch-analyst-data',
    {
      body: { ticker, stockName, finnhubTicker, _t: Date.now() },
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  const result = data as AnalysisResult;
  return result.data.length > 0 ? result.data[0] : null;
}
