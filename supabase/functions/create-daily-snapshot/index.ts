// Supabase Edge Function for creating daily portfolio/research snapshots
// This function is called by a cron job (GitHub Actions) to capture daily state
// Deploy with: supabase functions deploy create-daily-snapshot

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

interface Portfolio {
  id: string;
  user_id: string;
  name: string;
}

interface Holding {
  stock_id: string;
  portfolio_id: string;
  ticker: string;
  stock_name: string | null;
  total_shares: number;
  avg_buy_price: number;
  target_price: number | null;
  currency: string;
}

interface PortfolioSummaryRow {
  stock_id: string;
  portfolio_id: string;
  portfolio_name: string;
  ticker: string;
  stock_name: string | null;
  total_shares: number;
  avg_buy_price: number;
  target_price: number | null;
  currency: string;
  current_price: number | null;
  total_invested_czk: number;
  current_value_czk: number | null;
  gain_czk: number | null;
  gain_percentage: number | null;
}

interface ResearchTracked {
  id: string;
  user_id: string;
  ticker: string;
  stock_name: string;
  finnhub_ticker: string | null;
  added_at: string;
  added_price: number;
  added_signal: string | null;
  added_composite_score: number | null;
  added_conviction_level: string | null;
}

interface SignalLogEntry {
  id: string;
  ticker: string;
  signal_type: string;
  quality_signal: string | null;
  conviction_level: string | null;
  composite_score: number | null;
  conviction_score: number | null;
  fundamental_score: number | null;
  technical_score: number | null;
  analyst_score: number | null;
  news_score: number | null;
  insider_score: number | null;
  dip_score: number | null;
  rsi_value: number | null;
  created_at: string;
}

interface SnapshotHolding {
  snapshot_id: string;
  ticker: string;
  stock_name: string | null;
  source: 'portfolio' | 'research';
  portfolio_id: string | null;
  shares: number | null;
  avg_price: number | null;
  weight: number | null;
  unrealized_gain: number | null;
  unrealized_gain_pct: number | null;
  current_price: number | null;
  current_value: number | null;
  composite_score: number | null;
  conviction_score: number | null;
  conviction_level: string | null;
  fundamental_score: number | null;
  technical_score: number | null;
  analyst_score: number | null;
  news_score: number | null;
  insider_score: number | null;
  dip_score: number | null;
  rsi: number | null;
  macd_histogram: number | null;
  adx: number | null;
  primary_signal: string | null;
  quality_signal: string | null;
  tracked_since: string | null;
  price_at_tracking: number | null;
  gain_since_tracking_pct: number | null;
}

interface SnapshotResult {
  userId: string;
  snapshotId: string;
  portfolioHoldings: number;
  researchTracked: number;
  totalValue: number;
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
      console.error(`Failed to fetch price for ${ticker}: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const result = data?.chart?.result?.[0];
    return result?.meta?.regularMarketPrice ?? null;
  } catch (error) {
    console.error(`Error fetching price for ${ticker}:`, error);
    return null;
  }
}

// ============================================================================
// FETCH LATEST SIGNALS FROM signal_log
// ============================================================================

async function fetchLatestSignals(
  supabase: ReturnType<typeof createClient>,
  tickers: string[]
): Promise<Map<string, SignalLogEntry>> {
  const signalMap = new Map<string, SignalLogEntry>();

  if (tickers.length === 0) return signalMap;

  // Fetch latest signal for each ticker
  // We need to get the most recent entry for each ticker
  const { data, error } = await supabase
    .from('signal_log')
    .select('*')
    .in('ticker', tickers)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching signals from signal_log:', error);
    return signalMap;
  }

  // Keep only the latest signal for each ticker
  for (const entry of data || []) {
    if (!signalMap.has(entry.ticker)) {
      signalMap.set(entry.ticker, entry as SignalLogEntry);
    }
  }

  console.log(`Fetched signals for ${signalMap.size} tickers from signal_log`);
  return signalMap;
}

function getConvictionLevel(score: number | null): string | null {
  if (score === null) return null;
  if (score >= 70) return 'HIGH';
  if (score >= 45) return 'MEDIUM';
  return 'LOW';
}

// ============================================================================
// MAIN SNAPSHOT LOGIC
// ============================================================================

async function createSnapshotForUser(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  snapshotDate: string,
  priceCache: Map<string, number | null>
): Promise<SnapshotResult> {
  try {
    // 1. Check if snapshot already exists for this date
    const { data: existingSnapshot } = await supabase
      .from('daily_snapshots')
      .select('id')
      .eq('user_id', userId)
      .eq('snapshot_date', snapshotDate)
      .single();

    if (existingSnapshot) {
      console.log(
        `Snapshot already exists for user ${userId} on ${snapshotDate}`
      );
      return {
        userId,
        snapshotId: existingSnapshot.id,
        portfolioHoldings: 0,
        researchTracked: 0,
        totalValue: 0,
        success: true,
        error: 'Snapshot already exists',
      };
    }

    // 2. Fetch user's portfolios
    const { data: portfolios } = await supabase
      .from('portfolios')
      .select('id, user_id, name')
      .eq('user_id', userId);

    const portfolioIds = (portfolios || []).map((p: Portfolio) => p.id);

    // 2b. Fetch portfolio_summary view for CZK values (uses current_prices with exchange rates)
    let portfolioSummary: PortfolioSummaryRow[] = [];
    if (portfolioIds.length > 0) {
      const { data: summaryData, error: summaryError } = await supabase
        .from('portfolio_summary')
        .select('*')
        .in('portfolio_id', portfolioIds);

      if (summaryError) {
        console.error(
          `Failed to fetch portfolio_summary: ${summaryError.message}`
        );
      }
      portfolioSummary = summaryData || [];
      console.log(
        `Fetched ${portfolioSummary.length} holdings from portfolio_summary`
      );
    }

    // Calculate total CZK value from portfolio_summary
    const totalValueCzk = portfolioSummary.reduce(
      (sum, row) => sum + (row.current_value_czk || 0),
      0
    );
    const totalGainCzk = portfolioSummary.reduce(
      (sum, row) => sum + (row.gain_czk || 0),
      0
    );
    const totalInvestedCzk = portfolioSummary.reduce(
      (sum, row) => sum + (row.total_invested_czk || 0),
      0
    );
    const totalGainPct =
      totalInvestedCzk > 0 ? (totalGainCzk / totalInvestedCzk) * 100 : 0;

    // Also fetch raw holdings for USD values and ticker info
    let holdings: Holding[] = [];
    if (portfolioIds.length > 0) {
      const { data: holdingsData, error: holdingsError } = await supabase
        .from('holdings')
        .select(
          'stock_id, portfolio_id, ticker, stock_name, total_shares, avg_buy_price, target_price, currency'
        )
        .in('portfolio_id', portfolioIds);

      if (holdingsError) {
        console.error(`Failed to fetch holdings: ${holdingsError.message}`);
      }
      console.log(
        `Fetched ${
          holdingsData?.length || 0
        } holdings for portfolios ${portfolioIds.join(', ')}`
      );
      holdings = holdingsData || [];
    }

    // 3. Fetch research tracked
    const { data: researchTracked } = await supabase
      .from('research_tracked')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active');

    // 4. Calculate portfolio totals (USD values for snapshot_holdings)
    let totalValue = 0;
    const holdingsWithValues: Array<{
      holding: Holding;
      currentPrice: number | null;
      currentValue: number;
      weight: number;
      unrealizedGain: number;
      unrealizedGainPct: number;
    }> = [];

    for (const holding of holdings) {
      const ticker = holding.ticker;

      // Get price from cache or fetch
      if (!priceCache.has(ticker)) {
        const price = await fetchCurrentPrice(ticker);
        priceCache.set(ticker, price);
        await new Promise((resolve) => setTimeout(resolve, 100)); // Rate limit
      }

      const currentPrice = priceCache.get(ticker) ?? null;
      const currentValue = currentPrice
        ? holding.total_shares * currentPrice
        : 0;
      const costBasis = holding.total_shares * holding.avg_buy_price;
      const unrealizedGain = currentValue - costBasis;
      const unrealizedGainPct =
        costBasis > 0 ? (unrealizedGain / costBasis) * 100 : 0;

      totalValue += currentValue;

      holdingsWithValues.push({
        holding,
        currentPrice,
        currentValue,
        weight: 0, // Calculate after total
        unrealizedGain,
        unrealizedGainPct,
      });
    }

    // Calculate weights
    for (const h of holdingsWithValues) {
      h.weight = totalValue > 0 ? (h.currentValue / totalValue) * 100 : 0;
    }

    // 5. Create snapshot record with both USD and CZK values
    const { data: snapshot, error: snapshotError } = await supabase
      .from('daily_snapshots')
      .insert({
        user_id: userId,
        snapshot_date: snapshotDate,
        portfolio_total_value: totalValue,
        portfolio_total_value_czk: Math.round(totalValueCzk * 100) / 100,
        portfolio_total_gain: Math.round(totalGainCzk * 100) / 100,
        portfolio_total_gain_pct: Math.round(totalGainPct * 100) / 100,
        portfolio_positions_count: holdings.length,
        research_tracked_count: (researchTracked || []).length,
      })
      .select()
      .single();

    if (snapshotError || !snapshot) {
      throw new Error(`Failed to create snapshot: ${snapshotError?.message}`);
    }

    // 6. Fetch latest signals from signal_log for all tickers
    const allTickers = [
      ...holdingsWithValues.map((h) => h.holding.ticker),
      ...(researchTracked || []).map((rt: ResearchTracked) => rt.ticker),
    ];
    const signalsMap = await fetchLatestSignals(supabase, allTickers);

    // 7. Create snapshot holdings for portfolio positions
    const snapshotHoldings: SnapshotHolding[] = [];

    for (const h of holdingsWithValues) {
      const ticker = h.holding.ticker;
      const signal = signalsMap.get(ticker);

      snapshotHoldings.push({
        snapshot_id: snapshot.id,
        ticker: ticker,
        stock_name: h.holding.stock_name,
        source: 'portfolio',
        portfolio_id: h.holding.portfolio_id,
        shares: h.holding.total_shares,
        avg_price: h.holding.avg_buy_price,
        weight: Math.round(h.weight * 100) / 100,
        unrealized_gain: Math.round(h.unrealizedGain * 100) / 100,
        unrealized_gain_pct: Math.round(h.unrealizedGainPct * 100) / 100,
        current_price: h.currentPrice,
        current_value: Math.round(h.currentValue * 100) / 100,
        // Use scores from signal_log
        composite_score: signal?.composite_score ?? null,
        conviction_score: signal?.composite_score ?? null,
        conviction_level:
          signal?.conviction_level ??
          getConvictionLevel(signal?.composite_score ?? null),
        fundamental_score: signal?.fundamental_score ?? null,
        technical_score: signal?.technical_score ?? null,
        analyst_score: signal?.analyst_score ?? null,
        news_score: signal?.news_score ?? null,
        insider_score: signal?.insider_score ?? null,
        dip_score: signal?.dip_score ?? null,
        rsi: signal?.rsi_value ?? null,
        macd_histogram: null,
        adx: null,
        // Use signals from signal_log
        primary_signal: signal?.signal_type ?? null,
        quality_signal: signal?.quality_signal ?? null,
        tracked_since: null,
        price_at_tracking: null,
        gain_since_tracking_pct: null,
      });
    }

    // 8. Create snapshot holdings for research tracked
    for (const rt of (researchTracked || []) as ResearchTracked[]) {
      const ticker = rt.ticker;

      // Get price from cache or fetch
      if (!priceCache.has(ticker)) {
        const price = await fetchCurrentPrice(ticker);
        priceCache.set(ticker, price);
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const currentPrice = priceCache.get(ticker) ?? null;
      const gainSinceTracking =
        rt.added_price && currentPrice
          ? ((currentPrice - rt.added_price) / rt.added_price) * 100
          : null;

      const signal = signalsMap.get(ticker);

      snapshotHoldings.push({
        snapshot_id: snapshot.id,
        ticker: ticker,
        stock_name: rt.stock_name || null,
        source: 'research',
        portfolio_id: null,
        shares: null,
        avg_price: null,
        weight: null,
        unrealized_gain: null,
        unrealized_gain_pct: null,
        current_price: currentPrice,
        current_value: null,
        // Use scores from signal_log
        composite_score: signal?.composite_score ?? null,
        conviction_score: signal?.composite_score ?? null,
        conviction_level:
          signal?.conviction_level ??
          getConvictionLevel(signal?.composite_score ?? null),
        fundamental_score: signal?.fundamental_score ?? null,
        technical_score: signal?.technical_score ?? null,
        analyst_score: signal?.analyst_score ?? null,
        news_score: signal?.news_score ?? null,
        insider_score: signal?.insider_score ?? null,
        dip_score: signal?.dip_score ?? null,
        rsi: signal?.rsi_value ?? null,
        macd_histogram: null,
        adx: null,
        // Use signals from signal_log
        primary_signal: signal?.signal_type ?? null,
        quality_signal: signal?.quality_signal ?? null,
        tracked_since: rt.added_at.split('T')[0],
        price_at_tracking: rt.added_price,
        gain_since_tracking_pct: gainSinceTracking
          ? Math.round(gainSinceTracking * 100) / 100
          : null,
      });

      // Also update research_tracked with current data
      await supabase
        .from('research_tracked')
        .update({
          current_price: currentPrice,
          current_signal: signal?.signal_type ?? null,
          price_change_pct: gainSinceTracking
            ? Math.round(gainSinceTracking * 100) / 100
            : null,
          last_updated: new Date().toISOString(),
        })
        .eq('id', rt.id);
    }

    // 9. Insert all snapshot holdings
    console.log(`Inserting ${snapshotHoldings.length} snapshot holdings...`);
    if (snapshotHoldings.length > 0) {
      const { data: insertedHoldings, error: holdingsError } = await supabase
        .from('snapshot_holdings')
        .insert(snapshotHoldings)
        .select('id');

      if (holdingsError) {
        console.error(`Failed to insert holdings: ${holdingsError.message}`);
        console.error(`Holdings error details:`, JSON.stringify(holdingsError));
      } else {
        console.log(
          `Successfully inserted ${insertedHoldings?.length || 0} holdings`
        );
      }
    }

    return {
      userId,
      snapshotId: snapshot.id,
      portfolioHoldings: holdingsWithValues.length,
      researchTracked: (researchTracked || []).length,
      totalValue,
      success: true,
    };
  } catch (error) {
    console.error(`Error creating snapshot for user ${userId}:`, error);
    return {
      userId,
      snapshotId: '',
      portfolioHoldings: 0,
      researchTracked: 0,
      totalValue: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function createDailySnapshots(
  supabase: ReturnType<typeof createClient>
): Promise<{
  results: SnapshotResult[];
  errors: string[];
}> {
  const results: SnapshotResult[] = [];
  const errors: string[] = [];

  // Get today's date in UTC
  const today = new Date();
  const snapshotDate = today.toISOString().split('T')[0];

  console.log(`Creating snapshots for date: ${snapshotDate}`);

  // Fetch all users with portfolios or research tracked
  const { data: usersWithPortfolios } = await supabase
    .from('portfolios')
    .select('user_id')
    .limit(1000);

  const { data: usersWithResearch } = await supabase
    .from('research_tracked')
    .select('user_id')
    .eq('status', 'active')
    .limit(1000);

  // Combine unique user IDs
  const userIds = new Set<string>();
  (usersWithPortfolios || []).forEach((p: { user_id: string }) =>
    userIds.add(p.user_id)
  );
  (usersWithResearch || []).forEach((r: { user_id: string }) =>
    userIds.add(r.user_id)
  );

  console.log(`Found ${userIds.size} users to process`);

  // Shared price cache to avoid duplicate fetches
  const priceCache = new Map<string, number | null>();

  // Process each user
  for (const userId of userIds) {
    console.log(`Processing user: ${userId}`);
    const result = await createSnapshotForUser(
      supabase,
      userId,
      snapshotDate,
      priceCache
    );
    results.push(result);

    // Add delay between users
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return { results, errors };
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

    console.log('Starting daily snapshot creation...');
    const result = await createDailySnapshots(supabase);

    const successCount = result.results.filter((r) => r.success).length;
    const failCount = result.results.filter((r) => !r.success).length;

    console.log(
      `Completed: ${successCount} users processed, ${failCount} failed`
    );

    return new Response(
      JSON.stringify({
        success: true,
        summary: {
          usersProcessed: successCount,
          usersFailed: failCount,
          errors: result.errors,
        },
        details: result.results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error('Error in create-daily-snapshot:', error);

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
