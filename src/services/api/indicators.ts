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

// Category display info
export const INDICATOR_CATEGORIES = {
  valuation: { name: 'Valuation', icon: '💰', color: '#3b82f6' },
  profitability: { name: 'Profitability', icon: '📈', color: '#10b981' },
  growth: { name: 'Growth', icon: '🚀', color: '#8b5cf6' },
  risk: { name: 'Risk', icon: '⚠️', color: '#f59e0b' },
  dividend: { name: 'Dividend', icon: '💵', color: '#06b6d4' },
  performance: { name: 'Performance', icon: '📊', color: '#ec4899' },
  size: { name: 'Size', icon: '🏢', color: '#6b7280' },
} as const;

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
 * Get indicators grouped by category
 */
export async function getIndicatorsByCategory(): Promise<
  Record<string, AnalysisIndicator[]>
> {
  const indicators = await getAllIndicators();

  return indicators.reduce((acc, indicator) => {
    if (!acc[indicator.category]) {
      acc[indicator.category] = [];
    }
    acc[indicator.category].push(indicator);
    return acc;
  }, {} as Record<string, AnalysisIndicator[]>);
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
 * Get user's default view or create one if none exists
 */
export async function getDefaultView(): Promise<UserAnalysisView | null> {
  const { data, error } = await supabase
    .from('user_analysis_views')
    .select('*')
    .eq('is_default', true)
    .single();

  if (error && error.code !== 'PGRST116') {
    // PGRST116 = no rows returned
    console.error('Failed to fetch default view:', error);
  }

  return data;
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
 * Format a metric value based on indicator definition
 */
export function formatMetricValue(
  value: number | null | undefined,
  indicator: AnalysisIndicator
): string {
  if (value === null || value === undefined) return '—';

  const formatted = value.toLocaleString('cs-CZ', {
    minimumFractionDigits: indicator.format_decimals,
    maximumFractionDigits: indicator.format_decimals,
  });

  return `${indicator.format_prefix}${formatted}${indicator.format_suffix}`;
}

/**
 * Get CSS class for metric value based on thresholds
 */
export function getMetricClass(
  value: number | null | undefined,
  indicator: AnalysisIndicator
): string {
  if (value === null || value === undefined) return '';
  if (indicator.good_threshold === null && indicator.bad_threshold === null)
    return '';

  const { good_threshold, bad_threshold, higher_is_better } = indicator;

  if (higher_is_better) {
    if (good_threshold !== null && value >= good_threshold) return 'positive';
    if (bad_threshold !== null && value <= bad_threshold) return 'negative';
  } else {
    if (good_threshold !== null && value <= good_threshold) return 'positive';
    if (bad_threshold !== null && value >= bad_threshold) return 'negative';
  }

  return '';
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
