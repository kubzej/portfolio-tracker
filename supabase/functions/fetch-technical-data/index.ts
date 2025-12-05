// Supabase Edge Function for fetching technical analysis data
// Calculates SMA, RSI from Yahoo Finance historical data (FREE)
// Deploy with: supabase functions deploy fetch-technical-data

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// Technical data for a single stock
interface TechnicalData {
  ticker: string;
  stockName: string;
  currentPrice: number | null;
  // Moving Averages
  sma50: number | null;
  sma200: number | null;
  // Price vs MAs
  priceVsSma50: number | null; // % above/below 50 SMA
  priceVsSma200: number | null; // % above/below 200 SMA
  // RSI
  rsi14: number | null;
  rsiSignal: 'overbought' | 'oversold' | 'neutral' | null;
  // MACD
  macd: number | null; // MACD line (12 EMA - 26 EMA)
  macdSignal: number | null; // 9-day EMA of MACD
  macdHistogram: number | null; // MACD - Signal
  macdTrend: 'bullish' | 'bearish' | 'neutral' | null;
  macdDivergence: 'bullish' | 'bearish' | null; // v3.1: Price/MACD divergence
  // Bollinger Bands
  bollingerUpper: number | null;
  bollingerMiddle: number | null; // 20 SMA
  bollingerLower: number | null;
  bollingerPosition: number | null; // Where price is within bands (0-100%)
  bollingerSignal: 'overbought' | 'oversold' | 'neutral' | null;
  // Stochastic Oscillator
  stochasticK: number | null; // %K line (fast)
  stochasticD: number | null; // %D line (slow, SMA of %K)
  stochasticSignal: 'overbought' | 'oversold' | 'neutral' | null;
  // Volume Analysis
  currentVolume: number | null; // Latest trading volume
  avgVolume20: number | null; // 20-day average volume
  volumeChange: number | null; // % change vs average
  volumeSignal: 'high' | 'low' | 'normal' | null;
  // ATR (Average True Range)
  atr14: number | null; // 14-day ATR
  atrPercent: number | null; // ATR as % of current price
  atrSignal: 'high' | 'low' | 'normal' | null; // Volatility level
  // OBV (On-Balance Volume)
  obv: number | null; // Current OBV value
  obvTrend: 'bullish' | 'bearish' | 'neutral' | null; // OBV trend
  obvDivergence: 'bullish' | 'bearish' | null; // Divergence with price
  // ADX (Average Directional Index)
  adx: number | null; // ADX value (trend strength)
  plusDI: number | null; // +DI (bullish directional indicator)
  minusDI: number | null; // -DI (bearish directional indicator)
  adxSignal: 'strong' | 'moderate' | 'weak' | 'no-trend' | null;
  adxTrend: 'bullish' | 'bearish' | 'neutral' | null; // Based on +DI vs -DI
  // Fibonacci Retracement
  fibonacciLevels: {
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
  } | null;
  // Historical data for charts
  historicalPrices: {
    date: string;
    open: number;
    close: number;
    high: number;
    low: number;
    volume: number;
  }[];
  // 5Y weekly data for long-term chart
  historicalPricesWeekly: {
    date: string;
    open: number;
    close: number;
    high: number;
    low: number;
    volume: number;
  }[];
  sma50History: { date: string; value: number }[];
  sma200History: { date: string; value: number }[];
  macdHistory: {
    date: string;
    macd: number;
    signal: number;
    histogram: number;
  }[];
  bollingerHistory: {
    date: string;
    upper: number;
    middle: number;
    lower: number;
  }[];
  stochasticHistory: {
    date: string;
    k: number;
    d: number;
  }[];
  volumeHistory: {
    date: string;
    volume: number;
    avgVolume: number | null;
  }[];
  atrHistory: {
    date: string;
    atr: number;
    atrPercent: number;
  }[];
  obvHistory: {
    date: string;
    obv: number;
    obvSma: number | null; // 20-day SMA of OBV for trend
  }[];
  adxHistory: {
    date: string;
    adx: number;
    plusDI: number;
    minusDI: number;
  }[];
  // Error tracking
  error?: string;
}

// Calculate Simple Moving Average
export function calculateSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(0, period);
  const sum = slice.reduce((acc, val) => acc + val, 0);
  return sum / period;
}

// Calculate Exponential Moving Average
// prices should be in chronological order (oldest first)
export function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length < period) return [];

  const emaValues: number[] = [];
  const multiplier = 2 / (period + 1);

  // Start with SMA for first EMA value
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += prices[i];
  }
  let ema = sum / period;
  emaValues.push(ema);

  // Calculate EMA for remaining prices
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
    emaValues.push(ema);
  }

  return emaValues;
}

// Calculate MACD (12, 26, 9)
// Returns arrays aligned so all three arrays have the same length and correspond to the same dates
export function calculateMACD(prices: number[]): {
  macd: number[];
  signal: number[];
  histogram: number[];
  startIndex: number; // Index in original prices array where data starts
} {
  // Need at least 26 + 9 - 1 = 34 days for signal line
  if (prices.length < 34)
    return { macd: [], signal: [], histogram: [], startIndex: 0 };

  const ema12 = calculateEMA(prices, 12);
  const ema26 = calculateEMA(prices, 26);

  // EMA12 has (prices.length - 11) values, starting at index 11
  // EMA26 has (prices.length - 25) values, starting at index 25
  // MACD line = EMA12 - EMA26, aligned to where EMA26 starts
  const macdLine: number[] = [];
  const ema12Offset = 26 - 12; // 14 - how many more values EMA12 has

  for (let i = 0; i < ema26.length; i++) {
    macdLine.push(ema12[i + ema12Offset] - ema26[i]);
  }

  // Signal line = 9-day EMA of MACD line
  // This will have (macdLine.length - 8) values
  const signalLine = calculateEMA(macdLine, 9);

  if (signalLine.length === 0)
    return { macd: [], signal: [], histogram: [], startIndex: 0 };

  // Align all arrays to have same length (where signal line starts)
  const alignedMacd = macdLine.slice(8); // Remove first 8 values to align with signal
  const histogram: number[] = [];

  for (let i = 0; i < signalLine.length; i++) {
    histogram.push(alignedMacd[i] - signalLine[i]);
  }

  // Start index in original prices: 25 (EMA26 start) + 8 (signal start) = 33
  return { macd: alignedMacd, signal: signalLine, histogram, startIndex: 33 };
}

/**
 * Detect MACD Divergence (v3.1)
 *
 * Bullish Divergence: Price makes lower lows but MACD makes higher lows
 * - Indicates potential reversal from downtrend to uptrend
 *
 * Bearish Divergence: Price makes higher highs but MACD makes lower highs
 * - Indicates potential reversal from uptrend to downtrend
 *
 * Uses last 20 trading days (approx 1 month) for detection
 * Looks for swing points (local min/max) in both price and MACD
 */
function detectMACDDivergence(
  prices: number[],
  macdValues: number[],
  lookbackPeriod: number = 20
): 'bullish' | 'bearish' | null {
  if (prices.length < lookbackPeriod || macdValues.length < lookbackPeriod) {
    return null;
  }

  // Get recent data
  const recentPrices = prices.slice(-lookbackPeriod);
  const recentMacd = macdValues.slice(-lookbackPeriod);

  // Find swing lows (for bullish divergence detection)
  const priceLows: { index: number; value: number }[] = [];
  const macdLows: { index: number; value: number }[] = [];

  // Find swing highs (for bearish divergence detection)
  const priceHighs: { index: number; value: number }[] = [];
  const macdHighs: { index: number; value: number }[] = [];

  // Scan for swing points (need at least 2 days on each side)
  for (let i = 2; i < lookbackPeriod - 2; i++) {
    // Swing low: lower than 2 neighbors on each side
    if (
      recentPrices[i] < recentPrices[i - 1] &&
      recentPrices[i] < recentPrices[i - 2] &&
      recentPrices[i] < recentPrices[i + 1] &&
      recentPrices[i] < recentPrices[i + 2]
    ) {
      priceLows.push({ index: i, value: recentPrices[i] });
    }

    if (
      recentMacd[i] < recentMacd[i - 1] &&
      recentMacd[i] < recentMacd[i - 2] &&
      recentMacd[i] < recentMacd[i + 1] &&
      recentMacd[i] < recentMacd[i + 2]
    ) {
      macdLows.push({ index: i, value: recentMacd[i] });
    }

    // Swing high: higher than 2 neighbors on each side
    if (
      recentPrices[i] > recentPrices[i - 1] &&
      recentPrices[i] > recentPrices[i - 2] &&
      recentPrices[i] > recentPrices[i + 1] &&
      recentPrices[i] > recentPrices[i + 2]
    ) {
      priceHighs.push({ index: i, value: recentPrices[i] });
    }

    if (
      recentMacd[i] > recentMacd[i - 1] &&
      recentMacd[i] > recentMacd[i - 2] &&
      recentMacd[i] > recentMacd[i + 1] &&
      recentMacd[i] > recentMacd[i + 2]
    ) {
      macdHighs.push({ index: i, value: recentMacd[i] });
    }
  }

  // Check for BULLISH divergence (price lower low, MACD higher low)
  if (priceLows.length >= 2 && macdLows.length >= 2) {
    const lastPriceLow = priceLows[priceLows.length - 1];
    const prevPriceLow = priceLows[priceLows.length - 2];

    // Find corresponding MACD lows (closest in time)
    const lastMacdLow = macdLows.reduce((closest, low) =>
      Math.abs(low.index - lastPriceLow.index) <
      Math.abs(closest.index - lastPriceLow.index)
        ? low
        : closest
    );
    const prevMacdLow = macdLows.reduce((closest, low) =>
      Math.abs(low.index - prevPriceLow.index) <
      Math.abs(closest.index - prevPriceLow.index)
        ? low
        : closest
    );

    // Bullish: Price makes lower low, MACD makes higher low
    if (
      lastPriceLow.value < prevPriceLow.value && // Price lower low
      lastMacdLow.value > prevMacdLow.value && // MACD higher low
      Math.abs(lastPriceLow.index - lastMacdLow.index) <= 3 // Swing points are close in time
    ) {
      return 'bullish';
    }
  }

  // Check for BEARISH divergence (price higher high, MACD lower high)
  if (priceHighs.length >= 2 && macdHighs.length >= 2) {
    const lastPriceHigh = priceHighs[priceHighs.length - 1];
    const prevPriceHigh = priceHighs[priceHighs.length - 2];

    // Find corresponding MACD highs (closest in time)
    const lastMacdHigh = macdHighs.reduce((closest, high) =>
      Math.abs(high.index - lastPriceHigh.index) <
      Math.abs(closest.index - lastPriceHigh.index)
        ? high
        : closest
    );
    const prevMacdHigh = macdHighs.reduce((closest, high) =>
      Math.abs(high.index - prevPriceHigh.index) <
      Math.abs(closest.index - prevPriceHigh.index)
        ? high
        : closest
    );

    // Bearish: Price makes higher high, MACD makes lower high
    if (
      lastPriceHigh.value > prevPriceHigh.value && // Price higher high
      lastMacdHigh.value < prevMacdHigh.value && // MACD lower high
      Math.abs(lastPriceHigh.index - lastMacdHigh.index) <= 3 // Swing points are close in time
    ) {
      return 'bearish';
    }
  }

  return null;
}

// Calculate Stochastic Oscillator (14, 3, 3)
// Returns %K and %D values
// prices should be in chronological order (oldest first)
export function calculateStochastic(
  closes: number[],
  highs: number[],
  lows: number[],
  kPeriod: number = 14,
  dPeriod: number = 3
): {
  k: number[];
  d: number[];
  startIndex: number;
} {
  if (closes.length < kPeriod + dPeriod - 1) {
    return { k: [], d: [], startIndex: 0 };
  }

  const kValues: number[] = [];

  // Calculate %K values
  for (let i = kPeriod - 1; i < closes.length; i++) {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;

    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (highs[j] > highestHigh) highestHigh = highs[j];
      if (lows[j] < lowestLow) lowestLow = lows[j];
    }

    const range = highestHigh - lowestLow;
    const k = range === 0 ? 50 : ((closes[i] - lowestLow) / range) * 100;
    kValues.push(k);
  }

  // Calculate %D (SMA of %K)
  const dValues: number[] = [];
  for (let i = dPeriod - 1; i < kValues.length; i++) {
    let sum = 0;
    for (let j = i - dPeriod + 1; j <= i; j++) {
      sum += kValues[j];
    }
    dValues.push(sum / dPeriod);
  }

  // Align K values to match D values length
  const alignedK = kValues.slice(dPeriod - 1);

  // Start index: kPeriod - 1 (for K) + dPeriod - 1 (for D) = kPeriod + dPeriod - 2
  return { k: alignedK, d: dValues, startIndex: kPeriod + dPeriod - 2 };
}

// Calculate Bollinger Bands (20, 2)
export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  stdDev: number = 2
): {
  upper: number[];
  middle: number[];
  lower: number[];
} {
  if (prices.length < period) return { upper: [], middle: [], lower: [] };

  const upper: number[] = [];
  const middle: number[] = [];
  const lower: number[] = [];

  for (let i = period - 1; i < prices.length; i++) {
    // Calculate SMA (middle band)
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sum += prices[j];
    }
    const sma = sum / period;

    // Calculate standard deviation
    let sumSquaredDiff = 0;
    for (let j = i - period + 1; j <= i; j++) {
      sumSquaredDiff += Math.pow(prices[j] - sma, 2);
    }
    const std = Math.sqrt(sumSquaredDiff / period);

    middle.push(sma);
    upper.push(sma + stdDev * std);
    lower.push(sma - stdDev * std);
  }

  return { upper, middle, lower };
}

// Calculate ATR (Average True Range)
// Measures volatility - higher ATR = more volatile
// prices should be in chronological order (oldest first)
export function calculateATR(
  closes: number[],
  highs: number[],
  lows: number[],
  period: number = 14
): {
  atr: number[];
  startIndex: number;
} {
  if (closes.length < period + 1) {
    return { atr: [], startIndex: 0 };
  }

  // Calculate True Range for each day
  // TR = max(high - low, |high - prevClose|, |low - prevClose|)
  const trueRanges: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const high = highs[i];
    const low = lows[i];
    const prevClose = closes[i - 1];

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRanges.push(tr);
  }

  // Calculate ATR using Wilder's smoothing method (like RSI)
  const atrValues: number[] = [];

  // First ATR is simple average of first 'period' TRs
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += trueRanges[i];
  }
  let atr = sum / period;
  atrValues.push(atr);

  // Subsequent ATRs use smoothing: ATR = ((prevATR * (period-1)) + currentTR) / period
  for (let i = period; i < trueRanges.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
    atrValues.push(atr);
  }

  // Start index in original prices: period (need period+1 prices for period TRs, then period TRs for first ATR)
  return { atr: atrValues, startIndex: period };
}

// Calculate RSI (Relative Strength Index)
export function calculateRSI(
  prices: number[],
  period: number = 14
): number | null {
  if (prices.length < period + 1) return null;

  // Calculate price changes (most recent first, so we need to reverse logic)
  const changes: number[] = [];
  for (let i = 0; i < prices.length - 1; i++) {
    changes.push(prices[i] - prices[i + 1]); // newer - older = gain/loss
  }

  if (changes.length < period) return null;

  // Separate gains and losses
  let gains = 0;
  let losses = 0;

  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) {
      gains += changes[i];
    } else {
      losses += Math.abs(changes[i]);
    }
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100; // No losses = RSI 100

  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  return Math.round(rsi * 100) / 100;
}

// Fetch technical data for a single ticker
async function fetchTechnicalData(
  ticker: string,
  stockName: string
): Promise<TechnicalData> {
  const baseData: TechnicalData = {
    ticker,
    stockName,
    currentPrice: null,
    sma50: null,
    sma200: null,
    priceVsSma50: null,
    priceVsSma200: null,
    rsi14: null,
    rsiSignal: null,
    macd: null,
    macdSignal: null,
    macdHistogram: null,
    macdTrend: null,
    macdDivergence: null,
    bollingerUpper: null,
    bollingerMiddle: null,
    bollingerLower: null,
    bollingerPosition: null,
    bollingerSignal: null,
    stochasticK: null,
    stochasticD: null,
    stochasticSignal: null,
    currentVolume: null,
    avgVolume20: null,
    volumeChange: null,
    volumeSignal: null,
    atr14: null,
    atrPercent: null,
    atrSignal: null,
    obv: null,
    obvTrend: null,
    obvDivergence: null,
    adx: null,
    plusDI: null,
    minusDI: null,
    adxSignal: null,
    adxTrend: null,
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
  };

  try {
    // Fetch 1 year of daily data from Yahoo Finance (need ~250 trading days for 200 SMA)
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker
    )}?interval=1d&range=1y`;

    const response = await fetch(yahooUrl);
    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data?.chart?.result?.[0];

    if (!result) {
      throw new Error('No data from Yahoo Finance');
    }

    const timestamps = result.timestamp;
    const quotes = result.indicators?.quote?.[0];

    if (!timestamps || !quotes?.close) {
      throw new Error('Invalid data structure from Yahoo Finance');
    }

    // Build historical price array (most recent first)
    const historicalPrices: {
      date: string;
      open: number;
      close: number;
      high: number;
      low: number;
      volume: number;
    }[] = [];
    const closePrices: number[] = [];
    const openPrices: number[] = [];
    const highPrices: number[] = [];
    const lowPrices: number[] = [];
    const volumes: number[] = [];

    for (let i = timestamps.length - 1; i >= 0; i--) {
      const open = quotes.open[i];
      const close = quotes.close[i];
      const high = quotes.high[i];
      const low = quotes.low[i];
      const volume = quotes.volume[i];
      if (
        close !== null &&
        close !== undefined &&
        open !== null &&
        high !== null &&
        low !== null &&
        volume !== null
      ) {
        const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
        historicalPrices.push({ date, open, close, high, low, volume });
        closePrices.push(close);
        openPrices.push(open);
        highPrices.push(high);
        lowPrices.push(low);
        volumes.push(volume);
      }
    }

    if (closePrices.length === 0) {
      throw new Error('No valid price data');
    }

    // Current price is the most recent
    const currentPrice = closePrices[0];

    // Calculate SMAs
    const sma50 = calculateSMA(closePrices, 50);
    const sma200 = calculateSMA(closePrices, 200);

    // Calculate price vs SMAs (percentage)
    const priceVsSma50 =
      sma50 !== null ? ((currentPrice - sma50) / sma50) * 100 : null;
    const priceVsSma200 =
      sma200 !== null ? ((currentPrice - sma200) / sma200) * 100 : null;

    // Calculate RSI
    const rsi14 = calculateRSI(closePrices, 14);

    // Determine RSI signal
    let rsiSignal: 'overbought' | 'oversold' | 'neutral' | null = null;
    if (rsi14 !== null) {
      if (rsi14 > 70) {
        rsiSignal = 'overbought';
      } else if (rsi14 < 30) {
        rsiSignal = 'oversold';
      } else {
        rsiSignal = 'neutral';
      }
    }

    // Convert to chronological order for charts (oldest first)
    const chronologicalPrices = [...historicalPrices].reverse();
    const chronologicalCloses = chronologicalPrices.map((p) => p.close);
    const chronologicalHighs = chronologicalPrices.map((p) => p.high);
    const chronologicalLows = chronologicalPrices.map((p) => p.low);
    const chronologicalVolumes = chronologicalPrices.map((p) => p.volume);

    // Calculate SMA histories in chronological order
    const sma50History: { date: string; value: number }[] = [];
    const sma200History: { date: string; value: number }[] = [];

    for (let i = 0; i < chronologicalPrices.length; i++) {
      // 50 DMA - need at least 50 days of data
      if (i >= 49) {
        let sum50 = 0;
        for (let j = i - 49; j <= i; j++) {
          sum50 += chronologicalPrices[j].close;
        }
        sma50History.push({
          date: chronologicalPrices[i].date,
          value: Math.round((sum50 / 50) * 100) / 100,
        });
      }

      // 200 DMA - need at least 200 days of data
      if (i >= 199) {
        let sum200 = 0;
        for (let j = i - 199; j <= i; j++) {
          sum200 += chronologicalPrices[j].close;
        }
        sma200History.push({
          date: chronologicalPrices[i].date,
          value: Math.round((sum200 / 200) * 100) / 100,
        });
      }
    }

    // Calculate MACD
    const macdResult = calculateMACD(chronologicalCloses);
    let macd: number | null = null;
    let macdSignalValue: number | null = null;
    let macdHistogram: number | null = null;
    let macdTrend: 'bullish' | 'bearish' | 'neutral' | null = null;
    let macdDivergence: 'bullish' | 'bearish' | null = null;
    const macdHistory: {
      date: string;
      macd: number;
      signal: number;
      histogram: number;
    }[] = [];

    if (macdResult.macd.length > 0) {
      // Get current values (most recent)
      const lastIdx = macdResult.macd.length - 1;
      macd = Math.round(macdResult.macd[lastIdx] * 1000) / 1000;
      macdSignalValue = Math.round(macdResult.signal[lastIdx] * 1000) / 1000;
      macdHistogram = Math.round(macdResult.histogram[lastIdx] * 1000) / 1000;

      // Determine MACD trend
      if (macdHistogram > 0 && macd > 0) {
        macdTrend = 'bullish';
      } else if (macdHistogram < 0 && macd < 0) {
        macdTrend = 'bearish';
      } else {
        macdTrend = 'neutral';
      }

      // v3.1: Detect MACD divergence
      // Get aligned prices for divergence detection
      const alignedPrices = chronologicalCloses.slice(macdResult.startIndex);
      if (alignedPrices.length >= 20 && macdResult.macd.length >= 20) {
        macdDivergence = detectMACDDivergence(
          alignedPrices,
          macdResult.macd,
          20
        );
      }

      // Build MACD history - all arrays are aligned
      for (let i = 0; i < macdResult.macd.length; i++) {
        const dateIndex = macdResult.startIndex + i;
        if (dateIndex < chronologicalPrices.length) {
          macdHistory.push({
            date: chronologicalPrices[dateIndex].date,
            macd: Math.round(macdResult.macd[i] * 1000) / 1000,
            signal: Math.round(macdResult.signal[i] * 1000) / 1000,
            histogram: Math.round(macdResult.histogram[i] * 1000) / 1000,
          });
        }
      }
    }

    // Calculate Bollinger Bands
    const bbResult = calculateBollingerBands(chronologicalCloses, 20, 2);
    let bollingerUpper: number | null = null;
    let bollingerMiddle: number | null = null;
    let bollingerLower: number | null = null;
    let bollingerPosition: number | null = null;
    let bollingerSignal: 'overbought' | 'oversold' | 'neutral' | null = null;
    const bollingerHistory: {
      date: string;
      upper: number;
      middle: number;
      lower: number;
    }[] = [];

    if (bbResult.upper.length > 0) {
      // Get current values
      bollingerUpper =
        Math.round(bbResult.upper[bbResult.upper.length - 1] * 100) / 100;
      bollingerMiddle =
        Math.round(bbResult.middle[bbResult.middle.length - 1] * 100) / 100;
      bollingerLower =
        Math.round(bbResult.lower[bbResult.lower.length - 1] * 100) / 100;

      // Calculate position within bands (0% = at lower, 100% = at upper)
      const bandWidth = bollingerUpper - bollingerLower;
      if (bandWidth > 0) {
        bollingerPosition = Math.round(
          ((currentPrice - bollingerLower) / bandWidth) * 100
        );
        bollingerPosition = Math.max(0, Math.min(100, bollingerPosition)); // Clamp to 0-100
      }

      // Determine Bollinger signal
      if (currentPrice > bollingerUpper) {
        bollingerSignal = 'overbought';
      } else if (currentPrice < bollingerLower) {
        bollingerSignal = 'oversold';
      } else {
        bollingerSignal = 'neutral';
      }

      // Build Bollinger history
      const bbStartIndex = 19; // 0-indexed, starts at day 20
      for (let i = 0; i < bbResult.upper.length; i++) {
        const dateIndex = bbStartIndex + i;
        if (dateIndex < chronologicalPrices.length) {
          bollingerHistory.push({
            date: chronologicalPrices[dateIndex].date,
            upper: Math.round(bbResult.upper[i] * 100) / 100,
            middle: Math.round(bbResult.middle[i] * 100) / 100,
            lower: Math.round(bbResult.lower[i] * 100) / 100,
          });
        }
      }
    }

    // Calculate Stochastic Oscillator
    const stochResult = calculateStochastic(
      chronologicalCloses,
      chronologicalHighs,
      chronologicalLows,
      14,
      3
    );
    let stochasticK: number | null = null;
    let stochasticD: number | null = null;
    let stochasticSignal: 'overbought' | 'oversold' | 'neutral' | null = null;
    const stochasticHistory: { date: string; k: number; d: number }[] = [];

    if (stochResult.k.length > 0) {
      // Get current values (most recent)
      stochasticK =
        Math.round(stochResult.k[stochResult.k.length - 1] * 100) / 100;
      stochasticD =
        Math.round(stochResult.d[stochResult.d.length - 1] * 100) / 100;

      // Determine signal based on %K and %D
      if (stochasticK > 80) {
        stochasticSignal = 'overbought';
      } else if (stochasticK < 20) {
        stochasticSignal = 'oversold';
      } else {
        stochasticSignal = 'neutral';
      }

      // Build history
      for (let i = 0; i < stochResult.k.length; i++) {
        const dateIndex = stochResult.startIndex + i;
        if (dateIndex < chronologicalPrices.length) {
          stochasticHistory.push({
            date: chronologicalPrices[dateIndex].date,
            k: Math.round(stochResult.k[i] * 100) / 100,
            d: Math.round(stochResult.d[i] * 100) / 100,
          });
        }
      }
    }

    // Calculate Volume Analysis
    let currentVolume: number | null = null;
    let avgVolume20: number | null = null;
    let volumeChange: number | null = null;
    let volumeSignal: 'high' | 'low' | 'normal' | null = null;
    const volumeHistory: {
      date: string;
      volume: number;
      avgVolume: number | null;
    }[] = [];

    if (chronologicalVolumes.length > 0) {
      // Current volume (most recent)
      currentVolume = chronologicalVolumes[chronologicalVolumes.length - 1];

      // Calculate 20-day average volume
      if (chronologicalVolumes.length >= 20) {
        let sum = 0;
        for (
          let i = chronologicalVolumes.length - 20;
          i < chronologicalVolumes.length;
          i++
        ) {
          sum += chronologicalVolumes[i];
        }
        avgVolume20 = Math.round(sum / 20);
      }

      // Calculate volume change vs average
      if (avgVolume20 !== null && avgVolume20 > 0) {
        volumeChange = Math.round(
          ((currentVolume - avgVolume20) / avgVolume20) * 100
        );

        // Determine signal
        if (volumeChange > 50) {
          volumeSignal = 'high'; // 50% above average
        } else if (volumeChange < -50) {
          volumeSignal = 'low'; // 50% below average
        } else {
          volumeSignal = 'normal';
        }
      }

      // Build volume history with moving average
      for (let i = 0; i < chronologicalVolumes.length; i++) {
        let avg: number | null = null;
        if (i >= 19) {
          let sum = 0;
          for (let j = i - 19; j <= i; j++) {
            sum += chronologicalVolumes[j];
          }
          avg = Math.round(sum / 20);
        }
        volumeHistory.push({
          date: chronologicalPrices[i].date,
          volume: chronologicalVolumes[i],
          avgVolume: avg,
        });
      }
    }

    // Calculate ATR (Average True Range)
    let atr14: number | null = null;
    let atrPercent: number | null = null;
    let atrSignal: 'high' | 'low' | 'normal' | null = null;
    const atrHistory: { date: string; atr: number; atrPercent: number }[] = [];

    const atrResult = calculateATR(
      chronologicalCloses,
      chronologicalHighs,
      chronologicalLows,
      14
    );

    if (atrResult.atr.length > 0) {
      // Current ATR (most recent)
      atr14 = Math.round(atrResult.atr[atrResult.atr.length - 1] * 100) / 100;

      // ATR as percentage of current price
      if (currentPrice > 0) {
        atrPercent = Math.round((atr14 / currentPrice) * 10000) / 100;

        // Signal based on ATR%: <2% low, 2-5% normal, >5% high volatility
        if (atrPercent < 2) {
          atrSignal = 'low';
        } else if (atrPercent > 5) {
          atrSignal = 'high';
        } else {
          atrSignal = 'normal';
        }
      }

      // Build ATR history
      for (let i = 0; i < atrResult.atr.length; i++) {
        const dateIndex = atrResult.startIndex + i;
        if (dateIndex < chronologicalPrices.length) {
          const atrValue = Math.round(atrResult.atr[i] * 100) / 100;
          const priceAtDate = chronologicalCloses[dateIndex];
          const atrPct =
            priceAtDate > 0
              ? Math.round((atrValue / priceAtDate) * 10000) / 100
              : 0;
          atrHistory.push({
            date: chronologicalPrices[dateIndex].date,
            atr: atrValue,
            atrPercent: atrPct,
          });
        }
      }
    }

    // Calculate OBV (On-Balance Volume)
    // OBV adds volume on up days, subtracts on down days
    let obv: number | null = null;
    let obvTrend: 'bullish' | 'bearish' | 'neutral' | null = null;
    let obvDivergence: 'bullish' | 'bearish' | null = null;
    const obvHistory: { date: string; obv: number; obvSma: number | null }[] =
      [];

    if (chronologicalCloses.length > 1 && chronologicalVolumes.length > 1) {
      const obvValues: number[] = [];
      let runningObv = 0;

      // First day starts at 0
      obvValues.push(runningObv);

      // Calculate OBV for each subsequent day
      for (let i = 1; i < chronologicalCloses.length; i++) {
        const priceChange = chronologicalCloses[i] - chronologicalCloses[i - 1];
        const volume = chronologicalVolumes[i] || 0;

        if (priceChange > 0) {
          runningObv += volume; // Price up = add volume
        } else if (priceChange < 0) {
          runningObv -= volume; // Price down = subtract volume
        }
        // If price unchanged, OBV stays the same
        obvValues.push(runningObv);
      }

      // Current OBV
      obv = obvValues[obvValues.length - 1];

      // Build OBV history with 20-day SMA
      for (let i = 0; i < obvValues.length; i++) {
        let sma: number | null = null;
        if (i >= 19) {
          let sum = 0;
          for (let j = i - 19; j <= i; j++) {
            sum += obvValues[j];
          }
          sma = Math.round(sum / 20);
        }
        obvHistory.push({
          date: chronologicalPrices[i].date,
          obv: obvValues[i],
          obvSma: sma,
        });
      }

      // Determine OBV trend (compare current OBV to 20-day SMA)
      const currentObvSma = obvHistory[obvHistory.length - 1]?.obvSma;
      if (currentObvSma !== null) {
        if (obv > currentObvSma * 1.05) {
          obvTrend = 'bullish'; // OBV above SMA by 5%+
        } else if (obv < currentObvSma * 0.95) {
          obvTrend = 'bearish'; // OBV below SMA by 5%+
        } else {
          obvTrend = 'neutral';
        }
      }

      // Detect divergence (OBV vs Price over last 20 days)
      if (chronologicalCloses.length >= 20 && obvValues.length >= 20) {
        const priceStart = chronologicalCloses[chronologicalCloses.length - 20];
        const priceEnd = chronologicalCloses[chronologicalCloses.length - 1];
        const obvStart = obvValues[obvValues.length - 20];
        const obvEnd = obvValues[obvValues.length - 1];

        const priceUp = priceEnd > priceStart;
        const obvUp = obvEnd > obvStart;

        // Bullish divergence: Price down but OBV up (accumulation)
        if (!priceUp && obvUp) {
          obvDivergence = 'bullish';
        }
        // Bearish divergence: Price up but OBV down (distribution)
        else if (priceUp && !obvUp) {
          obvDivergence = 'bearish';
        }
      }
    }

    // ============ ADX (Average Directional Index) Calculation ============
    let adx: number | null = null;
    let plusDI: number | null = null;
    let minusDI: number | null = null;
    let adxSignal: 'strong' | 'moderate' | 'weak' | 'no-trend' | null = null;
    let adxTrend: 'bullish' | 'bearish' | 'neutral' | null = null;
    const adxHistory: {
      date: string;
      adx: number;
      plusDI: number;
      minusDI: number;
    }[] = [];

    if (chronologicalHighs.length >= 28 && chronologicalLows.length >= 28) {
      // Calculate True Range, +DM, -DM
      const trValues: number[] = [];
      const plusDMValues: number[] = [];
      const minusDMValues: number[] = [];

      for (let i = 1; i < chronologicalHighs.length; i++) {
        const high = chronologicalHighs[i];
        const low = chronologicalLows[i];
        const prevHigh = chronologicalHighs[i - 1];
        const prevLow = chronologicalLows[i - 1];
        const prevClose = chronologicalCloses[i - 1];

        // True Range
        const tr = Math.max(
          high - low,
          Math.abs(high - prevClose),
          Math.abs(low - prevClose)
        );
        trValues.push(tr);

        // +DM and -DM
        const upMove = high - prevHigh;
        const downMove = prevLow - low;

        if (upMove > downMove && upMove > 0) {
          plusDMValues.push(upMove);
        } else {
          plusDMValues.push(0);
        }

        if (downMove > upMove && downMove > 0) {
          minusDMValues.push(downMove);
        } else {
          minusDMValues.push(0);
        }
      }

      // Calculate smoothed ATR14, +DI14, -DI14 using Wilder's smoothing
      const period = 14;
      if (trValues.length >= period) {
        // Initial smoothed values (sum of first 14)
        let smoothedTR = trValues.slice(0, period).reduce((a, b) => a + b, 0);
        let smoothedPlusDM = plusDMValues
          .slice(0, period)
          .reduce((a, b) => a + b, 0);
        let smoothedMinusDM = minusDMValues
          .slice(0, period)
          .reduce((a, b) => a + b, 0);

        const dxValues: number[] = [];

        for (let i = period; i < trValues.length; i++) {
          // Wilder's smoothing
          smoothedTR = smoothedTR - smoothedTR / period + trValues[i];
          smoothedPlusDM =
            smoothedPlusDM - smoothedPlusDM / period + plusDMValues[i];
          smoothedMinusDM =
            smoothedMinusDM - smoothedMinusDM / period + minusDMValues[i];

          // Calculate +DI and -DI
          const pDI = smoothedTR > 0 ? (smoothedPlusDM / smoothedTR) * 100 : 0;
          const mDI = smoothedTR > 0 ? (smoothedMinusDM / smoothedTR) * 100 : 0;

          // Calculate DX
          const diSum = pDI + mDI;
          const dx = diSum > 0 ? (Math.abs(pDI - mDI) / diSum) * 100 : 0;
          dxValues.push(dx);

          // Calculate ADX (14-period smoothed DX)
          if (dxValues.length >= period) {
            let adxValue: number;
            if (dxValues.length === period) {
              // First ADX is simple average
              adxValue = dxValues.reduce((a, b) => a + b, 0) / period;
            } else {
              // Subsequent ADX uses Wilder's smoothing
              const prevAdx = adxHistory[adxHistory.length - 1]?.adx || 0;
              adxValue = (prevAdx * (period - 1) + dx) / period;
            }

            adxHistory.push({
              date: chronologicalPrices[i + 1].date, // +1 because we started from index 1
              adx: Math.round(adxValue * 100) / 100,
              plusDI: Math.round(pDI * 100) / 100,
              minusDI: Math.round(mDI * 100) / 100,
            });
          }
        }

        // Get current values
        if (adxHistory.length > 0) {
          const latest = adxHistory[adxHistory.length - 1];
          adx = latest.adx;
          plusDI = latest.plusDI;
          minusDI = latest.minusDI;

          // Determine trend strength signal
          if (adx >= 40) {
            adxSignal = 'strong';
          } else if (adx >= 25) {
            adxSignal = 'moderate';
          } else if (adx >= 20) {
            adxSignal = 'weak';
          } else {
            adxSignal = 'no-trend';
          }

          // Determine trend direction based on +DI vs -DI
          if (plusDI > minusDI + 5) {
            adxTrend = 'bullish';
          } else if (minusDI > plusDI + 5) {
            adxTrend = 'bearish';
          } else {
            adxTrend = 'neutral';
          }
        }
      }
    }

    // ============ Fibonacci Retracement Calculation ============
    let fibonacciLevels: TechnicalData['fibonacciLevels'] = null;

    // Use last 50 trading days to find swing high/low
    const lookbackDays = Math.min(50, chronologicalCloses.length);
    if (lookbackDays >= 20) {
      // Note: recentCloses could be used for additional analysis
      const recentHighs = chronologicalHighs.slice(-lookbackDays);
      const recentLows = chronologicalLows.slice(-lookbackDays);

      const periodHigh = Math.max(...recentHighs);
      const periodLow = Math.min(...recentLows);
      const range = periodHigh - periodLow;

      if (range > 0) {
        // Determine trend direction: is price closer to high or low?
        const latestClose = chronologicalCloses[chronologicalCloses.length - 1];
        const midPoint = (periodHigh + periodLow) / 2;
        const isUptrend = latestClose >= midPoint;

        // Calculate Fibonacci levels
        // In uptrend: retracement from high
        // In downtrend: retracement from low
        const level0 = periodHigh;
        const level100 = periodLow;
        const level236 = periodHigh - range * 0.236;
        const level382 = periodHigh - range * 0.382;
        const level500 = periodHigh - range * 0.5;
        const level618 = periodHigh - range * 0.618;
        const level786 = periodHigh - range * 0.786;

        // Determine which level price is near (within 2%)
        let currentLevel: string | null = null;
        const tolerance = range * 0.02;

        if (Math.abs(latestClose - level0) <= tolerance) currentLevel = '0%';
        else if (Math.abs(latestClose - level236) <= tolerance)
          currentLevel = '23.6%';
        else if (Math.abs(latestClose - level382) <= tolerance)
          currentLevel = '38.2%';
        else if (Math.abs(latestClose - level500) <= tolerance)
          currentLevel = '50%';
        else if (Math.abs(latestClose - level618) <= tolerance)
          currentLevel = '61.8%';
        else if (Math.abs(latestClose - level786) <= tolerance)
          currentLevel = '78.6%';
        else if (Math.abs(latestClose - level100) <= tolerance)
          currentLevel = '100%';

        fibonacciLevels = {
          high: Math.round(periodHigh * 100) / 100,
          low: Math.round(periodLow * 100) / 100,
          level0: Math.round(level0 * 100) / 100,
          level236: Math.round(level236 * 100) / 100,
          level382: Math.round(level382 * 100) / 100,
          level500: Math.round(level500 * 100) / 100,
          level618: Math.round(level618 * 100) / 100,
          level786: Math.round(level786 * 100) / 100,
          level100: Math.round(level100 * 100) / 100,
          currentLevel,
          trend: isUptrend ? 'uptrend' : 'downtrend',
        };
      }
    }

    // ============ Fetch 5Y Weekly Data for Long-term Chart ============
    const historicalPricesWeekly: {
      date: string;
      open: number;
      close: number;
      high: number;
      low: number;
      volume: number;
    }[] = [];

    try {
      const yahooWeeklyUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        ticker
      )}?interval=1wk&range=5y`;

      const weeklyResponse = await fetch(yahooWeeklyUrl);
      if (weeklyResponse.ok) {
        const weeklyData = await weeklyResponse.json();
        const weeklyResult = weeklyData?.chart?.result?.[0];

        if (weeklyResult?.timestamp && weeklyResult?.indicators?.quote?.[0]) {
          const weeklyTimestamps = weeklyResult.timestamp;
          const weeklyQuotes = weeklyResult.indicators.quote[0];

          // Build weekly price array (chronological order - oldest first)
          for (let i = 0; i < weeklyTimestamps.length; i++) {
            const open = weeklyQuotes.open[i];
            const close = weeklyQuotes.close[i];
            const high = weeklyQuotes.high[i];
            const low = weeklyQuotes.low[i];
            const volume = weeklyQuotes.volume[i];

            if (
              close !== null &&
              close !== undefined &&
              open !== null &&
              high !== null &&
              low !== null
            ) {
              const date = new Date(weeklyTimestamps[i] * 1000)
                .toISOString()
                .split('T')[0];
              historicalPricesWeekly.push({
                date,
                open: Math.round(open * 100) / 100,
                close: Math.round(close * 100) / 100,
                high: Math.round(high * 100) / 100,
                low: Math.round(low * 100) / 100,
                volume: volume || 0,
              });
            }
          }
        }
      }
    } catch (weeklyError) {
      console.error(`Error fetching weekly data for ${ticker}:`, weeklyError);
      // Continue without weekly data - not critical
    }

    return {
      ticker,
      stockName,
      currentPrice: Math.round(currentPrice * 100) / 100,
      sma50: sma50 !== null ? Math.round(sma50 * 100) / 100 : null,
      sma200: sma200 !== null ? Math.round(sma200 * 100) / 100 : null,
      priceVsSma50:
        priceVsSma50 !== null ? Math.round(priceVsSma50 * 100) / 100 : null,
      priceVsSma200:
        priceVsSma200 !== null ? Math.round(priceVsSma200 * 100) / 100 : null,
      rsi14,
      rsiSignal,
      macd,
      macdSignal: macdSignalValue,
      macdHistogram,
      macdTrend,
      macdDivergence,
      bollingerUpper,
      bollingerMiddle,
      bollingerLower,
      bollingerPosition,
      bollingerSignal,
      stochasticK,
      stochasticD,
      stochasticSignal,
      currentVolume,
      avgVolume20,
      volumeChange,
      volumeSignal,
      atr14,
      atrPercent,
      atrSignal,
      obv,
      obvTrend,
      obvDivergence,
      adx,
      plusDI,
      minusDI,
      adxSignal,
      adxTrend,
      fibonacciLevels,
      // All in chronological order (oldest to newest)
      historicalPrices: chronologicalPrices,
      historicalPricesWeekly,
      sma50History,
      sma200History,
      macdHistory,
      bollingerHistory,
      stochasticHistory,
      volumeHistory,
      atrHistory,
      obvHistory,
      adxHistory,
    };
  } catch (error) {
    console.error(`Error fetching technical data for ${ticker}:`, error);
    return { ...baseData, error: String(error) };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get portfolio ID and optional single ticker from request body
    const { portfolioId, ticker: singleTicker } = await req
      .json()
      .catch(() => ({}));

    // If single ticker requested, fetch just that
    if (singleTicker) {
      const data = await fetchTechnicalData(singleTicker, singleTicker);
      return new Response(JSON.stringify({ data: [data], errors: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get holdings for the portfolio
    let holdingsQuery = supabase
      .from('holdings')
      .select('stock_id, ticker, stock_name');

    if (portfolioId) {
      holdingsQuery = holdingsQuery.eq('portfolio_id', portfolioId);
    }

    const { data: holdings, error: holdingsError } = await holdingsQuery;

    if (holdingsError) {
      throw holdingsError;
    }

    if (!holdings || holdings.length === 0) {
      return new Response(JSON.stringify({ data: [], errors: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Deduplicate holdings by ticker
    const uniqueHoldings = Array.from(
      new Map(holdings.map((h) => [h.ticker, h])).values()
    );

    // Fetch technical data for all tickers
    const results: TechnicalData[] = [];
    const errors: string[] = [];

    for (const holding of uniqueHoldings) {
      const data = await fetchTechnicalData(holding.ticker, holding.stock_name);

      if (data.error) {
        errors.push(`${holding.ticker}: ${data.error}`);
      }

      results.push(data);

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return new Response(JSON.stringify({ data: results, errors }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
