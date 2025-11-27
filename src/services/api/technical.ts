import { supabase } from '@/lib/supabase';

// Historical price point for charts
export interface PricePoint {
  date: string;
  close: number;
  high: number;
  low: number;
  volume: number;
}

// SMA data point for charts
export interface SMAPoint {
  date: string;
  value: number;
}

// MACD data point for charts
export interface MACDPoint {
  date: string;
  macd: number;
  signal: number;
  histogram: number;
}

// Bollinger Bands data point for charts
export interface BollingerPoint {
  date: string;
  upper: number;
  middle: number;
  lower: number;
}

// Stochastic Oscillator data point for charts
export interface StochasticPoint {
  date: string;
  k: number;
  d: number;
}

// Volume data point for charts
export interface VolumePoint {
  date: string;
  volume: number;
  avgVolume: number | null;
}

// ATR data point for charts
export interface ATRPoint {
  date: string;
  atr: number;
  atrPercent: number;
}

// Technical data for a single stock
export interface TechnicalData {
  ticker: string;
  stockName: string;
  currentPrice: number | null;
  // Moving Averages
  sma50: number | null;
  sma200: number | null;
  // Price vs MAs (percentage above/below)
  priceVsSma50: number | null;
  priceVsSma200: number | null;
  // RSI
  rsi14: number | null;
  rsiSignal: 'overbought' | 'oversold' | 'neutral' | null;
  // MACD
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  macdTrend: 'bullish' | 'bearish' | 'neutral' | null;
  // Bollinger Bands
  bollingerUpper: number | null;
  bollingerMiddle: number | null;
  bollingerLower: number | null;
  bollingerPosition: number | null;
  bollingerSignal: 'overbought' | 'oversold' | 'neutral' | null;
  // Stochastic Oscillator
  stochasticK: number | null;
  stochasticD: number | null;
  stochasticSignal: 'overbought' | 'oversold' | 'neutral' | null;
  // Volume Analysis
  currentVolume: number | null;
  avgVolume20: number | null;
  volumeChange: number | null;
  volumeSignal: 'high' | 'low' | 'normal' | null;
  // ATR (Average True Range)
  atr14: number | null;
  atrPercent: number | null;
  atrSignal: 'high' | 'low' | 'normal' | null;
  // Historical data for charts
  historicalPrices: PricePoint[];
  sma50History: SMAPoint[];
  sma200History: SMAPoint[];
  macdHistory: MACDPoint[];
  bollingerHistory: BollingerPoint[];
  stochasticHistory: StochasticPoint[];
  volumeHistory: VolumePoint[];
  atrHistory: ATRPoint[];
  // Error tracking
  error?: string;
}

export interface TechnicalResult {
  data: TechnicalData[];
  errors: string[];
}

/**
 * Fetch technical analysis data for portfolio holdings
 */
export async function fetchTechnicalData(
  portfolioId?: string
): Promise<TechnicalResult> {
  const { data, error } = await supabase.functions.invoke(
    'fetch-technical-data',
    {
      body: { portfolioId },
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  return data as TechnicalResult;
}

/**
 * Fetch technical data for a single ticker
 */
export async function fetchSingleTechnicalData(
  ticker: string
): Promise<TechnicalData | null> {
  const { data, error } = await supabase.functions.invoke(
    'fetch-technical-data',
    {
      body: { ticker },
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  const result = data as TechnicalResult;
  return result.data.length > 0 ? result.data[0] : null;
}
