// Supabase Edge Function for fetching stock prices
// Deploy with: supabase functions deploy fetch-prices

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

interface StockQuote {
  ticker: string;
  price: number;
  currency: string;
  change: number;
  changePercent: number;
}

async function fetchYahooQuote(ticker: string): Promise<StockQuote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker
    )}?interval=1d&range=1d`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Failed to fetch ${ticker}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const result = data?.chart?.result?.[0];

    if (!result) return null;

    const meta = result.meta;
    const price = meta.regularMarketPrice;
    const previousClose = meta.previousClose || meta.chartPreviousClose;

    return {
      ticker: meta.symbol,
      price: price,
      currency: meta.currency || 'USD',
      change: price - previousClose,
      changePercent: ((price - previousClose) / previousClose) * 100,
    };
  } catch (error) {
    console.error(`Error fetching ${ticker}:`, error);
    return null;
  }
}

async function fetchExchangeRate(
  from: string,
  to: string
): Promise<number | null> {
  if (from === to) return 1;

  try {
    const symbol = `${from}${to}=X`;
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=1d`;
    const response = await fetch(url);

    if (!response.ok) return null;

    const data = await response.json();
    return data?.chart?.result?.[0]?.meta?.regularMarketPrice || null;
  } catch (error) {
    console.error(`Error fetching rate ${from}/${to}:`, error);
    return null;
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

    // Get all holdings to know which tickers to fetch
    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select('stock_id, ticker, currency');

    if (holdingsError) {
      throw holdingsError;
    }

    if (!holdings || holdings.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No holdings to update', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch quotes for all tickers
    const results = {
      updated: 0,
      failed: 0,
      errors: [] as string[],
    };

    // Get unique currencies and fetch exchange rates to CZK
    const currencies = [...new Set(holdings.map((h) => h.currency))];
    const exchangeRates = new Map<string, number>();
    exchangeRates.set('CZK', 1);

    for (const currency of currencies) {
      if (currency !== 'CZK') {
        const rate = await fetchExchangeRate(currency, 'CZK');
        if (rate) {
          exchangeRates.set(currency, rate);
        }
      }
    }

    // Fetch and update prices for each holding
    for (const holding of holdings) {
      const quote = await fetchYahooQuote(holding.ticker);

      if (!quote) {
        results.failed++;
        results.errors.push(`No quote for ${holding.ticker}`);
        continue;
      }

      const exchangeRate = exchangeRates.get(quote.currency) || 1;

      const { error: updateError } = await supabase
        .from('current_prices')
        .upsert(
          {
            stock_id: holding.stock_id,
            price: quote.price,
            currency: quote.currency,
            exchange_rate_to_czk: exchangeRate,
            price_change: quote.change,
            price_change_percent: quote.changePercent,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'stock_id',
          }
        );

      if (updateError) {
        results.failed++;
        results.errors.push(
          `Update failed for ${holding.ticker}: ${updateError.message}`
        );
      } else {
        results.updated++;
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
