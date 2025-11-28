/**
 * Formatting utilities for the application
 * Uses Czech locale (cs-CZ) for number formatting:
 * - Decimal separator: ,
 * - Thousands separator: (space)
 */

/**
 * Format a number with Czech locale
 * @param value - The number to format
 * @param decimals - Maximum decimal places (default: 2)
 * @param forceDecimals - If true, always show decimal places even for whole numbers
 */
export function formatNumber(
  value: number | null | undefined,
  decimals: number = 2,
  forceDecimals: boolean = false
): string {
  if (value === null || value === undefined) return '—';

  const hasDecimals = value % 1 !== 0;
  return new Intl.NumberFormat('cs-CZ', {
    minimumFractionDigits: forceDecimals
      ? decimals
      : hasDecimals
      ? Math.min(decimals, 2)
      : 0,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a currency value with Czech locale
 * @param value - The amount to format
 * @param currency - Currency code (CZK, USD, EUR)
 * @param showSymbol - If true, show currency symbol; if false, just format the number
 */
export function formatCurrency(
  value: number | null | undefined,
  currency: string = 'CZK',
  showSymbol: boolean = true
): string {
  if (value === null || value === undefined) return '—';

  if (showSymbol) {
    // Use Intl for full currency formatting
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  // Just format number with 2 decimals
  return new Intl.NumberFormat('cs-CZ', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a percentage value
 * @param value - The percentage value (e.g., 12.5 for 12.5%)
 * @param decimals - Decimal places (default: 1)
 * @param showSign - If true, show + for positive values
 */
export function formatPercent(
  value: number | null | undefined,
  decimals: number = 1,
  showSign: boolean = false
): string {
  if (value === null || value === undefined) return '—';

  const formatted = new Intl.NumberFormat('cs-CZ', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(value));

  if (showSign) {
    return value >= 0 ? `+${formatted}%` : `-${formatted}%`;
  }

  return value >= 0 ? `${formatted}%` : `-${formatted}%`;
}

/**
 * Format shares/quantity - shows up to 4 decimal places but trims trailing zeros
 * @param value - The quantity to format
 */
export function formatShares(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';

  // Check if it's a whole number
  if (Number.isInteger(value)) {
    return formatNumber(value, 0);
  }

  // Format with up to 4 decimals, trimming trailing zeros
  const formatted = new Intl.NumberFormat('cs-CZ', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(value);

  return formatted;
}

/**
 * Format a price (stock price, target price, etc.)
 * @param value - The price to format
 * @param currency - Currency code
 * @param showCurrency - Whether to append currency code
 */
export function formatPrice(
  value: number | null | undefined,
  currency?: string,
  showCurrency: boolean = true
): string {
  if (value === null || value === undefined) return '—';

  // For prices, show 2 decimals only if needed
  const hasDecimals = value % 1 !== 0;
  const formatted = new Intl.NumberFormat('cs-CZ', {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(value);

  if (showCurrency && currency) {
    return `${formatted} ${currency}`;
  }

  return formatted;
}

/**
 * Format a date in Czech locale
 * @param date - Date string or Date object
 */
export function formatDate(date: string | Date): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('cs-CZ');
}

/**
 * Format a date with time in Czech locale
 * @param date - Date string or Date object
 */
export function formatDateTime(date: string | Date): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('cs-CZ');
}

// ============================================================================
// LARGE NUMBER FORMATTING
// ============================================================================

/**
 * Format large numbers (billions, millions, thousands) for display
 * @param value - The number to format
 */
export function formatLargeNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= 1_000_000_000_000) {
    return `${sign}${(absValue / 1_000_000_000_000).toFixed(1)}T`;
  }
  if (absValue >= 1_000_000_000) {
    return `${sign}${(absValue / 1_000_000_000).toFixed(1)}B`;
  }
  if (absValue >= 1_000_000) {
    return `${sign}${(absValue / 1_000_000).toFixed(1)}M`;
  }
  if (absValue >= 1_000) {
    return `${sign}${(absValue / 1_000).toFixed(1)}K`;
  }

  return formatNumber(value, 0);
}

// ============================================================================
// INDICATOR VALUE FORMATTING
// ============================================================================

/**
 * Indicator definition interface for formatting
 */
export interface IndicatorFormatConfig {
  key?: string;
  format_decimals: number;
  format_prefix: string;
  format_suffix: string;
  good_threshold: number | null;
  bad_threshold: number | null;
  higher_is_better: boolean;
}

/**
 * Format an indicator value based on its configuration
 * Handles special cases like market cap, and applies prefix/suffix
 *
 * @param value - The value to format
 * @param config - The indicator configuration
 */
export function formatIndicatorValue(
  value: number | null | undefined,
  config: IndicatorFormatConfig
): string {
  if (value === null || value === undefined) return '—';

  // Special handling for market cap and enterprise value
  if (config.key === 'marketCap' || config.key === 'enterpriseValue') {
    return formatLargeNumber(value);
  }

  const formatted = value.toLocaleString('cs-CZ', {
    minimumFractionDigits: config.format_decimals,
    maximumFractionDigits: config.format_decimals,
  });

  return `${config.format_prefix}${formatted}${config.format_suffix}`;
}

/**
 * Get CSS class for indicator value based on thresholds
 *
 * @param value - The value to evaluate
 * @param config - The indicator configuration with thresholds
 * @returns 'positive' | 'negative' | '' (neutral)
 */
export function getIndicatorValueClass(
  value: number | null | undefined,
  config: IndicatorFormatConfig
): 'positive' | 'negative' | '' {
  if (value === null || value === undefined) return '';
  if (config.good_threshold === null && config.bad_threshold === null)
    return '';

  const { good_threshold, bad_threshold, higher_is_better } = config;

  if (higher_is_better) {
    if (good_threshold !== null && value >= good_threshold) return 'positive';
    if (bad_threshold !== null && value <= bad_threshold) return 'negative';
  } else {
    if (good_threshold !== null && value <= good_threshold) return 'positive';
    if (bad_threshold !== null && value >= bad_threshold) return 'negative';
  }

  return '';
}

// ============================================================================
// SENTIMENT FORMATTING
// ============================================================================

/**
 * Get insider sentiment label and CSS class based on MSPR score
 * MSPR (Market Sentiment Purchase Ratio) ranges from -100 to +100
 *
 * @param mspr - The MSPR value
 */
export function getInsiderSentimentLabel(mspr: number | null): {
  label: string;
  class: 'positive' | 'negative' | '';
} {
  if (mspr === null) return { label: '—', class: '' };
  if (mspr > 25) return { label: 'Strong Buying', class: 'positive' };
  if (mspr > 0) return { label: 'Buying', class: 'positive' };
  if (mspr > -25) return { label: 'Selling', class: 'negative' };
  return { label: 'Strong Selling', class: 'negative' };
}

// ============================================================================
// DATE FORMATTING - EXTENDED
// ============================================================================

/**
 * Format a date in short format (17. Nov 24)
 * @param date - Date string or Date object
 */
export function formatDateShort(date: string | Date): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('cs-CZ', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  });
}

/**
 * Format relative time (e.g., "2h ago", "3d ago")
 * @param date - Date string or Date object
 */
export function formatRelativeTime(date: string | Date): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

// ============================================================================
// RETURN/CHANGE FORMATTING
// ============================================================================

/**
 * Format a return/change percentage
 * @param priceAt - Original price
 * @param priceNow - Current price (null = no data)
 * @returns Formatted return string (e.g., "+5.2%", "-3.1%")
 */
export function formatReturn(priceAt: number, priceNow: number | null): string {
  if (priceNow === null) return '—';
  const ret = ((priceNow - priceAt) / priceAt) * 100;
  return `${ret >= 0 ? '+' : ''}${ret.toFixed(1)}%`;
}

/**
 * Get CSS class for return/change value
 * @param priceAt - Original price
 * @param priceNow - Current price (null = no data)
 * @returns 'positive' | 'negative' | ''
 */
export function getReturnClass(
  priceAt: number,
  priceNow: number | null
): 'positive' | 'negative' | '' {
  if (priceNow === null) return '';
  return priceNow > priceAt ? 'positive' : 'negative';
}
