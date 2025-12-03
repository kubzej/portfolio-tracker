import { supabase } from '@/lib/supabase';

// ============================================================================
// TYPES
// ============================================================================

export interface DailySnapshot {
  id: string;
  user_id: string;
  snapshot_date: string;
  portfolio_total_value: number | null;
  portfolio_total_value_czk: number | null;
  portfolio_total_gain: number | null;
  portfolio_total_gain_pct: number | null;
  portfolio_positions_count: number;
  research_tracked_count: number;
  created_at: string;
}

export interface SnapshotHolding {
  id: string;
  snapshot_id: string;
  ticker: string;
  stock_name: string | null;
  source: 'portfolio' | 'research';
  portfolio_id: string | null;
  portfolio_name: string | null;

  // Position data (portfolio only)
  shares: number | null;
  avg_price: number | null;
  weight: number | null;
  unrealized_gain: number | null;
  unrealized_gain_pct: number | null;

  // Price data
  current_price: number | null;
  current_value: number | null;

  // Scores
  composite_score: number | null;
  conviction_score: number | null;
  conviction_level: string | null;
  fundamental_score: number | null;
  technical_score: number | null;
  analyst_score: number | null;
  news_score: number | null;
  insider_score: number | null;
  dip_score: number | null;

  // Technical indicators
  rsi: number | null;
  macd_histogram: number | null;
  adx: number | null;

  // Signals
  primary_signal: string | null;
  quality_signal: string | null;

  // Change flags
  signal_changed: boolean;
  conviction_changed: boolean;
  score_changed: boolean;
  price_changed: boolean;

  // Research tracking
  tracked_since: string | null;
  price_at_tracking: number | null;
  gain_since_tracking_pct: number | null;

  created_at: string;
}

export interface ResearchTracked {
  id: string;
  user_id: string;
  ticker: string;
  stock_name: string | null;
  finnhub_ticker: string | null;
  added_at: string;
  added_price: number | null;
  added_signal: string | null;
  added_composite_score: number | null;
  added_conviction_level: string | null;
  current_price: number | null;
  current_signal: string | null;
  price_change_pct: number | null;
  last_updated: string | null;
  status: 'active' | 'bought' | 'dismissed';
  notes: string | null;
  status_changed_at: string | null;
  bought_price: number | null;
}

export interface SnapshotWithHoldings extends DailySnapshot {
  holdings: SnapshotHolding[];
}

export interface SnapshotChange {
  user_id: string;
  snapshot_date: string;
  holding: SnapshotHolding;
}

// ============================================================================
// DAILY SNAPSHOTS
// ============================================================================

/**
 * Get daily snapshots for date range
 */
export async function getSnapshots(
  startDate?: string,
  endDate?: string,
  limit = 30
): Promise<DailySnapshot[]> {
  let query = supabase
    .from('daily_snapshots')
    .select('*')
    .order('snapshot_date', { ascending: false })
    .limit(limit);

  if (startDate) {
    query = query.gte('snapshot_date', startDate);
  }
  if (endDate) {
    query = query.lte('snapshot_date', endDate);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching snapshots:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get latest snapshot
 */
export async function getLatestSnapshot(): Promise<DailySnapshot | null> {
  const { data, error } = await supabase
    .from('daily_snapshots')
    .select('*')
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    // Not found is OK
    console.error('Error fetching latest snapshot:', error);
    throw error;
  }

  return data;
}

/**
 * Get snapshot with holdings for a specific date
 */
export async function getSnapshotWithHoldings(
  snapshotDate: string
): Promise<SnapshotWithHoldings | null> {
  const { data: snapshot, error: snapshotError } = await supabase
    .from('daily_snapshots')
    .select('*')
    .eq('snapshot_date', snapshotDate)
    .single();

  if (snapshotError && snapshotError.code !== 'PGRST116') {
    console.error('Error fetching snapshot:', snapshotError);
    throw snapshotError;
  }

  if (!snapshot) return null;

  const { data: holdings, error: holdingsError } = await supabase
    .from('snapshot_holdings')
    .select(
      `
      *,
      portfolios:portfolio_id(name)
    `
    )
    .eq('snapshot_id', snapshot.id)
    .order('source')
    .order('ticker');

  if (holdingsError) {
    console.error('Error fetching holdings:', holdingsError);
    throw holdingsError;
  }

  // Transform data to flatten portfolio_name
  const transformedHoldings = (holdings || []).map(
    (h: SnapshotHolding & { portfolios?: { name: string } | null }) => ({
      ...h,
      portfolio_name: h.portfolios?.name || null,
      portfolios: undefined, // Remove nested object
    })
  );

  return {
    ...snapshot,
    holdings: transformedHoldings,
  };
}

// ============================================================================
// SNAPSHOT HOLDINGS
// ============================================================================

/**
 * Get holdings history for a specific ticker
 */
export async function getTickerHistory(
  ticker: string,
  source?: 'portfolio' | 'research',
  limit = 90
): Promise<Array<SnapshotHolding & { snapshot_date: string }>> {
  let query = supabase
    .from('snapshot_holdings')
    .select(
      `
      *,
      daily_snapshots!inner(snapshot_date)
    `
    )
    .eq('ticker', ticker)
    .order('daily_snapshots(snapshot_date)', { ascending: false })
    .limit(limit);

  if (source) {
    query = query.eq('source', source);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching ticker history:', error);
    throw error;
  }

  // Flatten the result
  return (data || []).map(
    (
      row: SnapshotHolding & { daily_snapshots: { snapshot_date: string } }
    ) => ({
      ...row,
      snapshot_date: row.daily_snapshots?.snapshot_date,
    })
  );
}

/**
 * Get holdings with changes (signal/conviction/score changed)
 */
export async function getChanges(
  startDate?: string,
  endDate?: string,
  source?: 'portfolio' | 'research'
): Promise<SnapshotChange[]> {
  let query = supabase
    .from('snapshot_changes')
    .select('*')
    .order('snapshot_date', { ascending: false });

  if (startDate) {
    query = query.gte('snapshot_date', startDate);
  }
  if (endDate) {
    query = query.lte('snapshot_date', endDate);
  }
  if (source) {
    query = query.eq('source', source);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching changes:', error);
    throw error;
  }

  return (data || []).map((row) => ({
    user_id: row.user_id,
    snapshot_date: row.snapshot_date,
    holding: row as SnapshotHolding,
  }));
}

/**
 * Get latest holdings (latest snapshot for each ticker)
 */
export async function getLatestHoldings(
  source?: 'portfolio' | 'research'
): Promise<SnapshotHolding[]> {
  let query = supabase.from('latest_snapshots').select('*');

  if (source) {
    query = query.eq('source', source);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching latest holdings:', error);
    throw error;
  }

  return data || [];
}

// ============================================================================
// RESEARCH TRACKED
// ============================================================================

/**
 * Get all tracked research stocks
 */
export async function getResearchTracked(
  status: 'active' | 'bought' | 'dismissed' | 'all' = 'active'
): Promise<ResearchTracked[]> {
  let query = supabase
    .from('research_tracked')
    .select('*')
    .order('added_at', { ascending: false });

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching research tracked:', error);
    throw error;
  }

  return data || [];
}

/**
 * Add stock to research tracking
 */
export async function addResearchTracked(
  ticker: string,
  stockName: string | null,
  finnhubTicker: string | null,
  currentPrice: number | null,
  currentSignal: string | null,
  compositeScore: number | null,
  convictionLevel: string | null
): Promise<ResearchTracked> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase
    .from('research_tracked')
    .insert({
      user_id: user.id,
      ticker,
      stock_name: stockName,
      finnhub_ticker: finnhubTicker,
      added_price: currentPrice,
      added_signal: currentSignal,
      added_composite_score: compositeScore,
      added_conviction_level: convictionLevel,
      current_price: currentPrice,
      current_signal: currentSignal,
    })
    .select()
    .single();

  if (error) {
    console.error('Error adding research tracked:', error);
    throw error;
  }

  return data;
}

/**
 * Update research tracked status
 */
export async function updateResearchTrackedStatus(
  id: string,
  status: 'active' | 'bought' | 'dismissed',
  boughtPrice?: number
): Promise<ResearchTracked> {
  const updateData: Partial<ResearchTracked> = {
    status,
    status_changed_at: new Date().toISOString(),
  };

  if (status === 'bought' && boughtPrice) {
    updateData.bought_price = boughtPrice;
  }

  const { data, error } = await supabase
    .from('research_tracked')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating research tracked:', error);
    throw error;
  }

  return data;
}

/**
 * Update research tracked notes
 */
export async function updateResearchTrackedNotes(
  id: string,
  notes: string
): Promise<ResearchTracked> {
  const { data, error } = await supabase
    .from('research_tracked')
    .update({ notes })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating notes:', error);
    throw error;
  }

  return data;
}

/**
 * Remove stock from research tracking
 */
export async function removeResearchTracked(id: string): Promise<void> {
  const { error } = await supabase
    .from('research_tracked')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error removing research tracked:', error);
    throw error;
  }
}

/**
 * Check if ticker is being tracked - returns ID if tracked, null otherwise
 */
export async function getTrackedId(ticker: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('research_tracked')
    .select('id')
    .eq('ticker', ticker)
    .eq('status', 'active')
    .maybeSingle();

  if (error) {
    console.error('Error checking if tracked:', error);
    throw error;
  }

  return data?.id ?? null;
}

/**
 * Check if ticker is being tracked (legacy - returns boolean)
 */
export async function isTickerTracked(ticker: string): Promise<boolean> {
  const id = await getTrackedId(ticker);
  return id !== null;
}

// ============================================================================
// SIGNAL HISTORY
// ============================================================================

/**
 * Get signal history for a ticker (from signal_log)
 */
export async function getSignalHistory(
  ticker?: string,
  source?: 'portfolio' | 'research',
  limit = 100
): Promise<
  Array<{
    id: string;
    ticker: string;
    stock_name: string | null;
    signal_type: string;
    price_at_signal: number;
    created_at: string;
    source: string | null;
    price_1d: number | null;
    price_1w: number | null;
    price_1m: number | null;
    price_3m: number | null;
  }>
> {
  let query = supabase
    .from('signal_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (ticker) {
    query = query.eq('ticker', ticker);
  }
  if (source) {
    query = query.eq('source', source);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching signal history:', error);
    throw error;
  }

  return data || [];
}

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * Get portfolio value history
 */
export async function getPortfolioValueHistory(
  days = 30
): Promise<Array<{ date: string; value: number }>> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const { data, error } = await supabase
    .from('daily_snapshots')
    .select('snapshot_date, portfolio_total_value')
    .gte('snapshot_date', startDate.toISOString().split('T')[0])
    .order('snapshot_date', { ascending: true });

  if (error) {
    console.error('Error fetching portfolio history:', error);
    throw error;
  }

  return (data || []).map((row) => ({
    date: row.snapshot_date,
    value: row.portfolio_total_value || 0,
  }));
}

/**
 * Get signal performance stats for tracker
 */
export async function getTrackerSignalPerformance(signalType?: string): Promise<
  Array<{
    signal_type: string;
    count: number;
    avg_1d_change: number | null;
    avg_1w_change: number | null;
    avg_1m_change: number | null;
    avg_3m_change: number | null;
    positive_1w_pct: number | null;
  }>
> {
  // This would ideally be a database view/function
  // For now, we calculate client-side
  let query = supabase
    .from('signal_log')
    .select('*')
    .not('price_1w', 'is', null);

  if (signalType) {
    query = query.eq('signal_type', signalType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching signal performance:', error);
    throw error;
  }

  if (!data || data.length === 0) return [];

  // Group by signal type
  const grouped: Record<string, typeof data> = {};
  for (const row of data) {
    if (!grouped[row.signal_type]) {
      grouped[row.signal_type] = [];
    }
    grouped[row.signal_type].push(row);
  }

  // Calculate stats for each group
  return Object.entries(grouped).map(([type, rows]) => {
    const count = rows.length;

    const calc1d = rows.filter((r) => r.price_1d != null);
    const calc1w = rows.filter((r) => r.price_1w != null);
    const calc1m = rows.filter((r) => r.price_1m != null);
    const calc3m = rows.filter((r) => r.price_3m != null);

    const avg = (
      arr: typeof rows,
      field: 'price_1d' | 'price_1w' | 'price_1m' | 'price_3m'
    ) => {
      if (arr.length === 0) return null;
      const changes = arr.map(
        (r) => ((r[field]! - r.signal_price) / r.signal_price) * 100
      );
      return changes.reduce((a, b) => a + b, 0) / changes.length;
    };

    const positive1w =
      calc1w.length > 0
        ? (calc1w.filter((r) => r.price_1w! > r.signal_price).length /
            calc1w.length) *
          100
        : null;

    return {
      signal_type: type,
      count,
      avg_1d_change: avg(calc1d, 'price_1d'),
      avg_1w_change: avg(calc1w, 'price_1w'),
      avg_1m_change: avg(calc1m, 'price_1m'),
      avg_3m_change: avg(calc3m, 'price_3m'),
      positive_1w_pct: positive1w,
    };
  });
}
