/**
 * Signal Logging API
 *
 * Handles saving and retrieving recommendation signals for performance tracking.
 */

import { supabase } from '@/lib/supabase';
import type { SignalType, StockRecommendation } from '@/utils/recommendations';

// ============================================================================
// TYPES
// ============================================================================

export interface SignalLogEntry {
  id: string;
  created_at: string;
  portfolio_id: string;
  ticker: string;
  stock_name: string | null;
  signal_type: SignalType;
  signal_strength: number | null;
  composite_score: number | null;
  fundamental_score: number | null;
  technical_score: number | null;
  analyst_score: number | null;
  news_score: number | null;
  conviction_score: number | null;
  dip_score: number | null;
  price_at_signal: number;
  price_1d: number | null;
  price_1w: number | null;
  price_1m: number | null;
  price_3m: number | null;
  evaluated_1d_at: string | null;
  evaluated_1w_at: string | null;
  evaluated_1m_at: string | null;
  evaluated_3m_at: string | null;
  rsi_value: number | null;
  macd_histogram: number | null;
  metadata: Record<string, unknown>;
}

export interface SignalPerformance {
  portfolio_id: string;
  signal_type: SignalType;
  total_signals: number;
  evaluated_1d: number;
  winners_1d: number;
  avg_return_1d: number | null;
  evaluated_1w: number;
  winners_1w: number;
  avg_return_1w: number | null;
  evaluated_1m: number;
  winners_1m: number;
  avg_return_1m: number | null;
  avg_composite_score: number | null;
  avg_signal_strength: number | null;
}

export interface SignalLogInput {
  portfolioId: string;
  recommendation: StockRecommendation;
  signalType?: SignalType; // If not provided, uses primarySignal
}

// ============================================================================
// DEDUPLICATE CHECK
// ============================================================================

/**
 * Check if a similar signal already exists in the last N days
 */
export async function signalExists(
  portfolioId: string,
  ticker: string,
  signalType: SignalType,
  daysWindow: number = 7
): Promise<boolean> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysWindow);

  const { data, error } = await supabase
    .from('signal_log')
    .select('id')
    .eq('portfolio_id', portfolioId)
    .eq('ticker', ticker)
    .eq('signal_type', signalType)
    .gte('created_at', cutoffDate.toISOString())
    .limit(1);

  if (error) {
    console.error('Error checking signal existence:', error);
    return false; // Allow insert on error
  }

  return (data?.length ?? 0) > 0;
}

// ============================================================================
// LOG SIGNAL
// ============================================================================

/**
 * Log a new signal (with deduplication)
 * Returns the logged signal or null if duplicate
 */
export async function logSignal(
  input: SignalLogInput
): Promise<SignalLogEntry | null> {
  const { portfolioId, recommendation, signalType } = input;
  const type = signalType ?? recommendation.primarySignal.type;

  // Check for duplicates
  const exists = await signalExists(portfolioId, recommendation.ticker, type);
  if (exists) {
    console.log(
      `Signal ${type} for ${recommendation.ticker} already exists (deduplicated)`
    );
    return null;
  }

  const { data, error } = await supabase
    .from('signal_log')
    .insert({
      portfolio_id: portfolioId,
      ticker: recommendation.ticker,
      stock_name: recommendation.stockName,
      signal_type: type,
      signal_strength: recommendation.primarySignal.strength,
      composite_score: recommendation.compositeScore,
      fundamental_score: recommendation.fundamentalScore,
      technical_score: recommendation.technicalScore,
      analyst_score: recommendation.analystScore,
      news_score: recommendation.newsScore,
      conviction_score: recommendation.convictionScore,
      dip_score: recommendation.dipScore,
      price_at_signal: recommendation.currentPrice,
      rsi_value: recommendation.metadata.rsiValue,
      macd_histogram: recommendation.metadata.macdSignal
        ? parseFloat(recommendation.metadata.macdSignal)
        : null,
      metadata: {
        convictionLevel: recommendation.convictionLevel,
        isDip: recommendation.isDip,
        dipQualityCheck: recommendation.dipQualityCheck,
        technicalBias: recommendation.technicalBias,
        targetPrice: recommendation.targetPrice,
        targetUpside: recommendation.targetUpside,
        weight: recommendation.weight,
        gainPercentage: recommendation.gainPercentage,
      },
    })
    .select()
    .single();

  if (error) {
    console.error('Error logging signal:', error);
    throw error;
  }

  return data;
}

/**
 * Log multiple signals at once (with deduplication)
 */
export async function logMultipleSignals(
  portfolioId: string,
  recommendations: StockRecommendation[],
  signalTypes?: SignalType[] // Filter to specific types, or log primary signal for each
): Promise<{ logged: number; skipped: number }> {
  let logged = 0;
  let skipped = 0;

  for (const rec of recommendations) {
    // Determine which signals to log for this recommendation
    const typesToLog = signalTypes
      ? rec.signals
          .filter((s) => signalTypes.includes(s.type))
          .map((s) => s.type)
      : [rec.primarySignal.type];

    for (const type of typesToLog) {
      try {
        const result = await logSignal({
          portfolioId,
          recommendation: rec,
          signalType: type,
        });
        if (result) {
          logged++;
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(`Failed to log signal for ${rec.ticker}:`, err);
        skipped++;
      }
    }
  }

  return { logged, skipped };
}

// ============================================================================
// FETCH SIGNALS
// ============================================================================

/**
 * Get recent signals for a portfolio
 */
export async function getRecentSignals(
  portfolioId: string,
  limit: number = 50
): Promise<SignalLogEntry[]> {
  const { data, error } = await supabase
    .from('signal_log')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching signals:', error);
    throw error;
  }

  return data ?? [];
}

/**
 * Get signals for a specific ticker
 */
export async function getSignalsForTicker(
  portfolioId: string,
  ticker: string,
  limit: number = 20
): Promise<SignalLogEntry[]> {
  const { data, error } = await supabase
    .from('signal_log')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .eq('ticker', ticker)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching signals for ticker:', error);
    throw error;
  }

  return data ?? [];
}

/**
 * Get signals by type
 */
export async function getSignalsByType(
  portfolioId: string,
  signalType: SignalType,
  limit: number = 50
): Promise<SignalLogEntry[]> {
  const { data, error } = await supabase
    .from('signal_log')
    .select('*')
    .eq('portfolio_id', portfolioId)
    .eq('signal_type', signalType)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching signals by type:', error);
    throw error;
  }

  return data ?? [];
}

// ============================================================================
// PERFORMANCE STATS
// ============================================================================

/**
 * Get signal performance statistics
 */
export async function getSignalPerformance(
  portfolioId: string
): Promise<SignalPerformance[]> {
  const { data, error } = await supabase
    .from('signal_performance')
    .select('*')
    .eq('portfolio_id', portfolioId);

  if (error) {
    console.error('Error fetching signal performance:', error);
    throw error;
  }

  return data ?? [];
}

/**
 * Calculate win rate for a signal type
 */
export function calculateWinRate(
  perf: SignalPerformance,
  period: '1d' | '1w' | '1m'
): number | null {
  const evaluated = perf[`evaluated_${period}`];
  const winners = perf[`winners_${period}`];

  if (!evaluated || evaluated === 0) return null;
  return Math.round((winners / evaluated) * 100);
}

// ============================================================================
// DELETE SIGNALS
// ============================================================================

/**
 * Delete a specific signal
 */
export async function deleteSignal(signalId: string): Promise<void> {
  const { error } = await supabase
    .from('signal_log')
    .delete()
    .eq('id', signalId);

  if (error) {
    console.error('Error deleting signal:', error);
    throw error;
  }
}

/**
 * Delete all signals for a portfolio (use with caution)
 */
export async function clearAllSignals(portfolioId: string): Promise<void> {
  const { error } = await supabase
    .from('signal_log')
    .delete()
    .eq('portfolio_id', portfolioId);

  if (error) {
    console.error('Error clearing signals:', error);
    throw error;
  }
}
