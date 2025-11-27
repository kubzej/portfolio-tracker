import { supabase } from '@/lib/supabase';

// Earnings surprise data for a single quarter
export interface EarningsData {
  actual: number | null;
  estimate: number | null;
  period: string | null;
  surprise: number | null;
  surprisePercent: number | null;
}

// Fundamental metrics from Finnhub
export interface FundamentalMetrics {
  peRatio: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  dividendYield: number | null;
  beta: number | null;
  roe: number | null; // Return on Equity
  roa: number | null; // Return on Assets
  grossMargin: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  quickRatio: number | null;
  revenueGrowth: number | null;
  epsGrowth: number | null;
  marketCap: number | null;
}

// Insider sentiment data
export interface InsiderSentiment {
  mspr: number | null; // Monthly Share Purchase Ratio (-100 to 100)
  change: number | null; // Net buying/selling
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
  targetPrice: number | null;
  targetHigh: number | null;
  targetLow: number | null;
  targetUpside: number | null;
  recommendationKey: string | null;
  strongBuy: number | null;
  buy: number | null;
  hold: number | null;
  sell: number | null;
  strongSell: number | null;
  numberOfAnalysts: number | null;
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
