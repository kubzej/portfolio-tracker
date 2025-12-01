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

async function fetchIntradayData(
  ticker: string,
  range: '1d' | '1w'
): Promise<IntradayResponse> {
  const baseResponse: IntradayResponse = {
    ticker,
    range,
    interval: range === '1d' ? '5m' : '15m',
    currency: 'USD',
    previousClose: null,
    data: [],
  };

  try {
    // Yahoo Finance params for intraday
    // 1D: 5-minute intervals for current trading day
    // 1W: 15-minute intervals for last 5 trading days
    const yahooRange = range === '1d' ? '1d' : '5d';
    const yahooInterval = range === '1d' ? '5m' : '15m';

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

    // Build price array (chronological order - oldest first)
    const priceData: PricePoint[] = [];

    for (let i = 0; i < timestamps.length; i++) {
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
        low !== null
      ) {
        const timestamp = timestamps[i];
        const dateObj = new Date(timestamp * 1000);

        // Format: "2024-12-01 09:30" for intraday
        const date = dateObj.toISOString().slice(0, 16).replace('T', ' ');

        priceData.push({
          date,
          timestamp,
          open: Math.round(open * 100) / 100,
          close: Math.round(close * 100) / 100,
          high: Math.round(high * 100) / 100,
          low: Math.round(low * 100) / 100,
          volume: volume || 0,
        });
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
