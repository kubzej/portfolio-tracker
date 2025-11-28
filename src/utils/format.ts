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

// ============================================================================
// EXCHANGE / DATA AVAILABILITY UTILITIES
// ============================================================================

/**
 * Exchanges where Finnhub FREE tier doesn't provide data
 * These exchanges will have limited data (only Yahoo price data available)
 */
const LIMITED_DATA_EXCHANGES = [
  '.HK', // Hong Kong
  '.SS', // Shanghai
  '.SZ', // Shenzhen
  '.T', // Tokyo
  '.KS', // Korea
  '.TW', // Taiwan
  '.SI', // Singapore
  '.AX', // Australia
  '.NZ', // New Zealand
  '.BO', // Bombay
  '.NS', // India NSE
  '.JK', // Jakarta
  '.KL', // Kuala Lumpur
  '.BK', // Bangkok
];

/**
 * Exchange info with display names
 */
const EXCHANGE_INFO: Record<string, { name: string; country: string }> = {
  '.HK': { name: 'Hong Kong Stock Exchange', country: 'Hong Kong' },
  '.SS': { name: 'Shanghai Stock Exchange', country: 'China' },
  '.SZ': { name: 'Shenzhen Stock Exchange', country: 'China' },
  '.T': { name: 'Tokyo Stock Exchange', country: 'Japan' },
  '.KS': { name: 'Korea Exchange', country: 'South Korea' },
  '.TW': { name: 'Taiwan Stock Exchange', country: 'Taiwan' },
  '.SI': { name: 'Singapore Exchange', country: 'Singapore' },
  '.AX': { name: 'Australian Securities Exchange', country: 'Australia' },
  '.NZ': { name: 'New Zealand Exchange', country: 'New Zealand' },
  '.BO': { name: 'Bombay Stock Exchange', country: 'India' },
  '.NS': { name: 'National Stock Exchange', country: 'India' },
  '.JK': { name: 'Indonesia Stock Exchange', country: 'Indonesia' },
  '.KL': { name: 'Bursa Malaysia', country: 'Malaysia' },
  '.BK': { name: 'Stock Exchange of Thailand', country: 'Thailand' },
  '.DE': { name: 'XETRA', country: 'Germany' },
  '.L': { name: 'London Stock Exchange', country: 'UK' },
  '.PA': { name: 'Euronext Paris', country: 'France' },
  '.AS': { name: 'Euronext Amsterdam', country: 'Netherlands' },
  '.SW': { name: 'SIX Swiss Exchange', country: 'Switzerland' },
  '.MI': { name: 'Borsa Italiana', country: 'Italy' },
  '.MC': { name: 'Bolsa de Madrid', country: 'Spain' },
  '.TO': { name: 'Toronto Stock Exchange', country: 'Canada' },
};

export interface ExchangeDataInfo {
  ticker: string;
  exchangeSuffix: string | null;
  exchangeName: string;
  country: string;
  hasLimitedData: boolean;
  isUSStock: boolean;
}

/**
 * Get exchange information and data availability for a ticker
 * @param ticker - The stock ticker (e.g., "AAPL", "1211.HK", "SAP.DE")
 */
export function getExchangeInfo(ticker: string): ExchangeDataInfo {
  // Find exchange suffix
  const suffixMatch = ticker.match(/(\.[A-Z]{1,2})$/);
  const exchangeSuffix = suffixMatch ? suffixMatch[1] : null;

  // Check if it's a US stock (no suffix)
  const isUSStock = !exchangeSuffix;

  // Get exchange details
  const exchangeDetails = exchangeSuffix ? EXCHANGE_INFO[exchangeSuffix] : null;

  // Check if this exchange has limited data
  const hasLimitedData = exchangeSuffix
    ? LIMITED_DATA_EXCHANGES.includes(exchangeSuffix)
    : false;

  return {
    ticker,
    exchangeSuffix,
    exchangeName:
      exchangeDetails?.name ?? (isUSStock ? 'US Markets' : 'Unknown Exchange'),
    country: exchangeDetails?.country ?? (isUSStock ? 'USA' : 'Unknown'),
    hasLimitedData,
    isUSStock,
  };
}

/**
 * Check if a ticker has limited data availability (non-supported exchange)
 * @param ticker - The stock ticker
 */
export function hasLimitedData(ticker: string): boolean {
  return getExchangeInfo(ticker).hasLimitedData;
}

/**
 * Get a user-friendly message about data limitations for a ticker
 * @param ticker - The stock ticker
 */
export function getLimitedDataMessage(ticker: string): string | null {
  const info = getExchangeInfo(ticker);
  if (!info.hasLimitedData) return null;

  return `Data for ${info.exchangeName} (${info.country}) stocks is limited. Only price data is available – analyst ratings, fundamentals, and insider data are not supported.`;
}
