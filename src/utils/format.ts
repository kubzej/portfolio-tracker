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
