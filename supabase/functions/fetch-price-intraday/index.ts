// Supabase Edge Function for fetching intraday price data
// Used for 1D (5min) and 1W (15min) charts - lazy loaded
// Deploy with: supabase functions deploy fetch-price-intraday

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface PricePoint {
  date: string;
  timestamp: number;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
}

interface IntradayResponse {
  ticker: string;
  range: '1d' | '1w';
  interval: string;
  currency: string;
  previousClose: number | null;
  data: PricePoint[];
  error?: string;
}

// Exported helper: Format timestamp to "YYYY-MM-DD HH:MM" format
export function formatIntradayDate(timestamp: number): string {
  const dateObj = new Date(timestamp * 1000);
  return dateObj.toISOString().slice(0, 16).replace('T', ' ');
}

// Exported helper: Round price to 2 decimal places
export function roundPrice(value: number): number {
  return Math.round(value * 100) / 100;
}

// Exported helper: Parse a single price point from Yahoo data
export function parsePricePoint(
  timestamp: number,
  open: number | null,
  close: number | null,
  high: number | null,
  low: number | null,
  volume: number | null
): PricePoint | null {
  if (
    close === null ||
    close === undefined ||
    open === null ||
    high === null ||
    low === null
  ) {
    return null;
  }

  return {
    date: formatIntradayDate(timestamp),
    timestamp,
    open: roundPrice(open),
    close: roundPrice(close),
    high: roundPrice(high),
    low: roundPrice(low),
    volume: volume || 0,
  };
}

// Exported helper: Get Yahoo Finance interval and range params
export function getYahooParams(range: '1d' | '1w'): {
  yahooRange: string;
  yahooInterval: string;
} {
  return {
    yahooRange: range === '1d' ? '1d' : '5d',
    yahooInterval: range === '1d' ? '5m' : '15m',
  };
}

async function fetchIntradayData(
  ticker: string,
  range: '1d' | '1w'
): Promise<IntradayResponse> {
  const { yahooRange, yahooInterval } = getYahooParams(range);

  const baseResponse: IntradayResponse = {
    ticker,
    range,
    interval: yahooInterval,
    currency: 'USD',
    previousClose: null,
    data: [],
  };

  try {
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker
    )}?interval=${yahooInterval}&range=${yahooRange}&includePrePost=false`;

    const response = await fetch(yahooUrl);
    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();
    const result = data?.chart?.result?.[0];

    if (!result) {
      throw new Error('No data from Yahoo Finance');
    }

    // Get currency
    const currency = result.meta?.currency || 'USD';
    const previousClose = result.meta?.previousClose || null;

    const timestamps = result.timestamp;
    const quotes = result.indicators?.quote?.[0];

    if (!timestamps || !quotes?.close) {
      throw new Error('Invalid data structure from Yahoo Finance');
    }

    // Build price array using exported helper
    const priceData: PricePoint[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const point = parsePricePoint(
        timestamps[i],
        quotes.open[i],
        quotes.close[i],
        quotes.high[i],
        quotes.low[i],
        quotes.volume[i]
      );
      if (point) {
        priceData.push(point);
      }
    }

    return {
      ticker,
      range,
      interval: yahooInterval,
      currency,
      previousClose,
      data: priceData,
    };
  } catch (error) {
    console.error(`Error fetching intraday data for ${ticker}:`, error);
    return {
      ...baseResponse,
      error: String(error),
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { ticker, range } = await req.json().catch(() => ({}));

    if (!ticker) {
      return new Response(JSON.stringify({ error: 'Ticker is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (range !== '1d' && range !== '1w') {
      return new Response(
        JSON.stringify({ error: 'Range must be "1d" or "1w"' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const data = await fetchIntradayData(ticker, range);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
