// Supabase Edge Function for updating signal prices
// This function is called by a cron job (GitHub Actions) to evaluate signal performance
// Deploy with: supabase functions deploy update-signal-prices

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// ============================================================================
// TYPES
// ============================================================================

interface UpdateResult {
  signalId: string;
  ticker: string;
  period: string;
  price: number;
  success: boolean;
  error?: string;
}

// ============================================================================
// YAHOO FINANCE PRICE FETCH
// ============================================================================

async function fetchCurrentPrice(ticker: string): Promise<number | null> {
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

    if (!result) {
      console.error(`No data for ${ticker}`);
      return null;
    }

    return result.meta?.regularMarketPrice ?? null;
  } catch (error) {
    console.error(`Error fetching ${ticker}:`, error);
    return null;
  }
}

// ============================================================================
// MAIN UPDATE LOGIC
// ============================================================================

async function updateSignalPrices(
  supabase: ReturnType<typeof createClient>
): Promise<{
  updated: UpdateResult[];
  errors: string[];
}> {
  const results: UpdateResult[] = [];
  const errors: string[] = [];
  const now = new Date();

  // Calculate cutoff dates
  const cutoff1d = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
  const cutoff1w = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
  const cutoff1m = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
  const cutoff3m = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days ago

  // Fetch signals needing 1-day update
  const { data: signals1d, error: err1d } = await supabase
    .from('signal_log')
    .select('id, ticker, created_at, price_1d')
    .is('price_1d', null)
    .lt('created_at', cutoff1d.toISOString())
    .limit(50);

  if (err1d) errors.push(`Error fetching 1d signals: ${err1d.message}`);

  // Fetch signals needing 1-week update
  const { data: signals1w, error: err1w } = await supabase
    .from('signal_log')
    .select('id, ticker, created_at, price_1w')
    .is('price_1w', null)
    .lt('created_at', cutoff1w.toISOString())
    .limit(50);

  if (err1w) errors.push(`Error fetching 1w signals: ${err1w.message}`);

  // Fetch signals needing 1-month update
  const { data: signals1m, error: err1m } = await supabase
    .from('signal_log')
    .select('id, ticker, created_at, price_1m')
    .is('price_1m', null)
    .lt('created_at', cutoff1m.toISOString())
    .limit(50);

  if (err1m) errors.push(`Error fetching 1m signals: ${err1m.message}`);

  // Fetch signals needing 3-month update
  const { data: signals3m, error: err3m } = await supabase
    .from('signal_log')
    .select('id, ticker, created_at, price_3m')
    .is('price_3m', null)
    .lt('created_at', cutoff3m.toISOString())
    .limit(50);

  if (err3m) errors.push(`Error fetching 3m signals: ${err3m.message}`);

  // Collect all unique tickers
  const allSignals = [
    ...(signals1d || []).map((s) => ({ ...s, period: '1d' })),
    ...(signals1w || []).map((s) => ({ ...s, period: '1w' })),
    ...(signals1m || []).map((s) => ({ ...s, period: '1m' })),
    ...(signals3m || []).map((s) => ({ ...s, period: '3m' })),
  ];

  const uniqueTickers = [...new Set(allSignals.map((s) => s.ticker))];
  console.log(
    `Found ${allSignals.length} signals to update for ${uniqueTickers.length} tickers`
  );

  // Fetch prices for all unique tickers
  const priceCache: Record<string, number | null> = {};
  for (const ticker of uniqueTickers) {
    // Add small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 200));
    priceCache[ticker] = await fetchCurrentPrice(ticker);
    console.log(`${ticker}: ${priceCache[ticker]}`);
  }

  // Update each signal
  for (const signal of allSignals) {
    const price = priceCache[signal.ticker];

    if (price === null) {
      results.push({
        signalId: signal.id,
        ticker: signal.ticker,
        period: signal.period,
        price: 0,
        success: false,
        error: 'Could not fetch price',
      });
      continue;
    }

    const updateField = `price_${signal.period}`;
    const evaluatedField = `evaluated_${signal.period}_at`;

    const { error: updateError } = await supabase
      .from('signal_log')
      .update({
        [updateField]: price,
        [evaluatedField]: now.toISOString(),
      })
      .eq('id', signal.id);

    if (updateError) {
      results.push({
        signalId: signal.id,
        ticker: signal.ticker,
        period: signal.period,
        price,
        success: false,
        error: updateError.message,
      });
    } else {
      results.push({
        signalId: signal.id,
        ticker: signal.ticker,
        period: signal.period,
        price,
        success: true,
      });
    }
  }

  return { updated: results, errors };
}

// ============================================================================
// HTTP HANDLER
// ============================================================================

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting signal price update...');
    const result = await updateSignalPrices(supabase);

    const successCount = result.updated.filter((r) => r.success).length;
    const failCount = result.updated.filter((r) => !r.success).length;

    console.log(`Completed: ${successCount} updated, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          updated: successCount,
          failed: failCount,
          errors: result.errors,
        },
        details: result.updated,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error('Error in update-signal-prices:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
