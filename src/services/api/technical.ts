import { supabase } from '@/lib/supabase';

// Historical price point for charts (daily)
export interface PricePoint {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

// Intraday price point (includes timestamp for 1D/1W charts)
export interface IntradayPricePoint extends PricePoint {
  timestamp: number;
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

// OBV data point for charts
export interface OBVPoint {
  date: string;
  obv: number;
  obvSma: number | null;
}

// ADX data point for charts
export interface ADXPoint {
  date: string;
  adx: number;
  plusDI: number;
  minusDI: number;
}

// Fibonacci Retracement levels
export interface FibonacciLevels {
  high: number;
  low: number;
  level0: number; // 0% (high)
  level236: number; // 23.6%
  level382: number; // 38.2%
  level500: number; // 50%
  level618: number; // 61.8%
  level786: number; // 78.6%
  level100: number; // 100% (low)
  currentLevel: string | null; // Which level price is near
  trend: 'uptrend' | 'downtrend'; // Direction of the move
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
  macdDivergence: 'bullish' | 'bearish' | null; // v3.1: MACD divergence detection
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
  // OBV (On-Balance Volume)
  obv: number | null;
  obvTrend: 'bullish' | 'bearish' | 'neutral' | null;
  obvDivergence: 'bullish' | 'bearish' | null;
  // ADX (Average Directional Index)
  adx: number | null;
  plusDI: number | null;
  minusDI: number | null;
  adxSignal: 'strong' | 'moderate' | 'weak' | 'no-trend' | null;
  adxTrend: 'bullish' | 'bearish' | 'neutral' | null;
  // Fibonacci Retracement
  fibonacciLevels: FibonacciLevels | null;
  // Historical data for charts (chronological - oldest first)
  historicalPrices: PricePoint[]; // 1Y daily
  historicalPricesWeekly: PricePoint[]; // 5Y weekly
  sma50History: SMAPoint[];
  sma200History: SMAPoint[];
  macdHistory: MACDPoint[];
  bollingerHistory: BollingerPoint[];
  stochasticHistory: StochasticPoint[];
  volumeHistory: VolumePoint[];
  atrHistory: ATRPoint[];
  obvHistory: OBVPoint[];
  adxHistory: ADXPoint[];
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

// Time range type for charts
export type TimeRange = '1d' | '1w' | '1m' | '3m' | '6m' | '1y' | '5y';

// Intraday response from edge function
export interface IntradayResponse {
  ticker: string;
  range: '1d' | '1w';
  interval: string;
  currency: string;
  previousClose: number | null;
  prices: IntradayPricePoint[];
  error?: string;
}

/**
 * Fetch intraday price data for 1D/1W charts (lazy loaded)
 */
export async function fetchIntradayData(
  ticker: string,
  range: '1d' | '1w'
): Promise<IntradayResponse> {
  const { data, error } = await supabase.functions.invoke(
    'fetch-price-intraday',
    {
      body: { ticker, range },
    }
  );

  if (error) {
    throw new Error(error.message);
  }

  // Normalize the response (edge function uses 'data', we use 'prices')
  const response = data as {
    ticker: string;
    range: '1d' | '1w';
    interval: string;
    currency: string;
    previousClose: number | null;
    data: IntradayPricePoint[];
    error?: string;
  };
  return {
    ticker: response.ticker,
    range: response.range,
    interval: response.interval,
    currency: response.currency,
    previousClose: response.previousClose,
    prices: response.data || [],
    error: response.error,
  };
}
