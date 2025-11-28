// Supabase Edge Function for fetching watchlist stock prices
// Deploy with: supabase functions deploy fetch-watchlist-prices

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
  change: number;
  changePercent: number;
  currency: string;
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
      change: price - previousClose,
      changePercent: ((price - previousClose) / previousClose) * 100,
      currency: meta.currency || 'USD',
    };
  } catch (error) {
    console.error(`Error fetching ${ticker}:`, error);
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

    // Parse request body for optional watchlist_id filter
    let watchlistId: string | null = null;
    try {
      const body = await req.json();
      watchlistId = body?.watchlist_id || null;
    } catch {
      // No body or invalid JSON - fetch all watchlist items
    }

    // Get watchlist items to update
    let query = supabase.from('watchlist_items').select('id, ticker');

    if (watchlistId) {
      query = query.eq('watchlist_id', watchlistId);
    }

    const { data: items, error: itemsError } = await query;

    if (itemsError) {
      throw itemsError;
    }

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No watchlist items to update', updated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get unique tickers to avoid duplicate API calls
    const tickerMap = new Map<string, string[]>(); // ticker -> item ids
    for (const item of items) {
      const ids = tickerMap.get(item.ticker) || [];
      ids.push(item.id);
      tickerMap.set(item.ticker, ids);
    }

    const results = {
      updated: 0,
      failed: 0,
      errors: [] as string[],
    };

    const now = new Date().toISOString();

    // Fetch and update prices for each unique ticker
    for (const [ticker, itemIds] of tickerMap) {
      const quote = await fetchYahooQuote(ticker);

      if (!quote) {
        results.failed += itemIds.length;
        results.errors.push(`No quote for ${ticker}`);
        continue;
      }

      // Update all items with this ticker
      const { error: updateError } = await supabase
        .from('watchlist_items')
        .update({
          last_price: quote.price,
          last_price_change: quote.change,
          last_price_change_percent: quote.changePercent,
          last_price_updated_at: now,
          currency: quote.currency,
        })
        .in('id', itemIds);

      if (updateError) {
        results.failed += itemIds.length;
        results.errors.push(
          `Update failed for ${ticker}: ${updateError.message}`
        );
      } else {
        results.updated += itemIds.length;
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
