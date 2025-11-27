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
  // Historical data for charts (last 200 days)
  historicalPrices: { date: string; close: number }[];
  sma50History: { date: string; value: number }[];
  sma200History: { date: string; value: number }[];
  // Error tracking
  error?: string;
}

// Calculate Simple Moving Average
function calculateSMA(prices: number[], period: number): number | null {
  if (prices.length < period) return null;
  const slice = prices.slice(0, period);
  const sum = slice.reduce((acc, val) => acc + val, 0);
  return sum / period;
}

// Calculate RSI (Relative Strength Index)
function calculateRSI(prices: number[], period: number = 14): number | null {
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
    historicalPrices: [],
    sma50History: [],
    sma200History: [],
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
    const historicalPrices: { date: string; close: number }[] = [];
    const closePrices: number[] = [];

    for (let i = timestamps.length - 1; i >= 0; i--) {
      const close = quotes.close[i];
      if (close !== null && close !== undefined) {
        const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
        historicalPrices.push({ date, close });
        closePrices.push(close);
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

    // Calculate SMA histories in chronological order
    // SMA for day N uses prices from day N-period+1 to day N
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
      // All in chronological order (oldest to newest)
      historicalPrices: chronologicalPrices,
      sma50History,
      sma200History,
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
