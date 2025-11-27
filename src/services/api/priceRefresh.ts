import { supabase } from '@/lib/supabase';

export interface PriceRefreshResult {
  updated: number;
  failed: number;
  errors: string[];
}

/**
 * Call the Supabase Edge Function to refresh all stock prices
 */
export async function refreshAllPrices(): Promise<PriceRefreshResult> {
  const { data, error } = await supabase.functions.invoke('fetch-prices');

  if (error) {
    throw new Error(error.message);
  }

  return data as PriceRefreshResult;
}
