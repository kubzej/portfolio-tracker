import { supabase } from '@/lib/supabase';
import type { RateLimitInfo } from './analysis';

// Simplified peer data for comparison
export interface PeerData {
  ticker: string;
  name: string | null;
  // Price
  currentPrice: number | null;
  priceChangePercent: number | null;
  // Valuation
  peRatio: number | null;
  pbRatio: number | null;
  psRatio: number | null;
  evEbitda: number | null;
  // Profitability
  roe: number | null;
  netMargin: number | null;
  // Growth
  revenueGrowth: number | null;
  epsGrowth: number | null;
  // Analyst
  recommendationKey: string | null;
  consensusScore: number | null;
  analystTargetPrice: number | null;
  targetUpside: number | null;
  // Size
  marketCap: number | null;
  // Historical returns
  return1M: number | null;
  return3M: number | null;
  return6M: number | null;
  return1Y: number | null;
  // Error
  error?: string;
}

export interface PeersResult {
  mainStock: PeerData;
  peers: PeerData[];
  errors: string[];
  rateLimited?: RateLimitInfo;
}

/**
 * Fetch peers comparison data for a ticker
 */
export async function fetchPeersData(
  ticker: string,
  peers?: string[]
): Promise<PeersResult> {
  const { data, error } = await supabase.functions.invoke('fetch-peers-data', {
    body: { ticker, peers },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as PeersResult;
}
