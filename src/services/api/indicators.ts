import { supabase } from '@/lib/supabase';

// Indicator definition from database
export interface AnalysisIndicator {
  id: string;
  key: string;
  name: string;
  short_name: string;
  description: string;
  category:
    | 'valuation'
    | 'profitability'
    | 'growth'
    | 'risk'
    | 'dividend'
    | 'performance'
    | 'size';
  data_type: 'number' | 'percent' | 'currency' | 'ratio';
  format_decimals: number;
  format_prefix: string;
  format_suffix: string;
  good_threshold: number | null;
  bad_threshold: number | null;
  higher_is_better: boolean;
  source: string;
  source_key: string;
  is_premium: boolean;
  sort_order: number;
}

// User's custom view configuration
export interface UserAnalysisView {
  id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  indicator_keys: string[];
  created_at: string;
  updated_at: string;
}

// Default indicators for new users (in order)
export const DEFAULT_INDICATOR_KEYS = [
  'peRatio',
  'pbRatio',
  'roe',
  'netMargin',
  'beta',
  'dividendYield',
  'debtToEquity',
  'marketCap',
];

/**
 * Get all available indicators from the catalog
 */
export async function getAllIndicators(): Promise<AnalysisIndicator[]> {
  const { data, error } = await supabase
    .from('analysis_indicators')
    .select('*')
    .order('category')
    .order('sort_order');

  if (error) {
    console.error('Failed to fetch indicators:', error);
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Get user's saved analysis views
 */
export async function getUserViews(): Promise<UserAnalysisView[]> {
  const { data, error } = await supabase
    .from('user_analysis_views')
    .select('*')
    .order('created_at');

  if (error) {
    console.error('Failed to fetch user views:', error);
    throw new Error(error.message);
  }

  return data || [];
}

/**
 * Create a new view
 */
export async function createView(
  name: string,
  indicatorKeys: string[],
  isDefault = false
): Promise<UserAnalysisView> {
  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // If setting as default, unset other defaults first
  if (isDefault) {
    await supabase
      .from('user_analysis_views')
      .update({ is_default: false })
      .eq('user_id', user.id)
      .eq('is_default', true);
  }

  const { data, error } = await supabase
    .from('user_analysis_views')
    .insert({
      user_id: user.id,
      name,
      indicator_keys: indicatorKeys,
      is_default: isDefault,
    })
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Update an existing view
 */
export async function updateView(
  viewId: string,
  updates: Partial<
    Pick<UserAnalysisView, 'name' | 'indicator_keys' | 'is_default'>
  >
): Promise<UserAnalysisView> {
  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // If setting as default, unset other defaults first
  if (updates.is_default) {
    await supabase
      .from('user_analysis_views')
      .update({ is_default: false })
      .eq('user_id', user.id)
      .eq('is_default', true)
      .neq('id', viewId);
  }

  const { data, error } = await supabase
    .from('user_analysis_views')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', viewId)
    .select()
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/**
 * Delete a view
 */
export async function deleteView(viewId: string): Promise<void> {
  const { error } = await supabase
    .from('user_analysis_views')
    .delete()
    .eq('id', viewId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Quick update just the column order for a view
 */
export async function updateViewColumns(
  viewId: string,
  indicatorKeys: string[]
): Promise<void> {
  const { error } = await supabase
    .from('user_analysis_views')
    .update({
      indicator_keys: indicatorKeys,
      updated_at: new Date().toISOString(),
    })
    .eq('id', viewId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Format market cap / enterprise value with B/T suffix
 */
export function formatLargeNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}T`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}B`;
  if (value >= 1) return `${value.toFixed(0)}M`;
  return `${(value * 1000).toFixed(0)}K`;
}
