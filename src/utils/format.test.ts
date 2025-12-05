/**
 * Tests for format.ts utility functions
 */

import { describe, it, expect } from 'vitest';
import {
  formatNumber,
  formatCurrency,
  formatPercent,
  formatShares,
  formatPrice,
  formatDate,
  formatDateTime,
  formatLargeNumber,
  formatIndicatorValue,
  getIndicatorValueClass,
  getInsiderSentimentLabel,
  formatDateShort,
  formatRelativeTime,
  formatReturn,
  getReturnClass,
  getExchangeInfo,
  getMarketStatus,
  hasLimitedData,
  getLimitedDataMessage,
} from './format';

// Helper to normalize spaces (Czech locale uses non-breaking space)
const normalizeSpaces = (str: string) => str.replace(/\s/g, ' ');

describe('formatNumber', () => {
  it('should format numbers with Czech locale', () => {
    expect(normalizeSpaces(formatNumber(1234.56))).toBe('1 234,56');
  });

  it('should handle whole numbers without decimals', () => {
    expect(normalizeSpaces(formatNumber(1000))).toBe('1 000');
  });

  it('should respect decimals parameter', () => {
    expect(normalizeSpaces(formatNumber(1234.5678, 4))).toBe('1 234,5678');
  });

  it('should force decimals when forceDecimals is true', () => {
    expect(normalizeSpaces(formatNumber(1000, 2, true))).toBe('1 000,00');
  });

  it('should return dash for null', () => {
    expect(formatNumber(null)).toBe('—');
  });

  it('should return dash for undefined', () => {
    expect(formatNumber(undefined)).toBe('—');
  });

  it('should handle zero', () => {
    expect(formatNumber(0)).toBe('0');
  });

  it('should handle negative numbers', () => {
    expect(normalizeSpaces(formatNumber(-1234.56))).toBe('-1 234,56');
  });
});

describe('formatCurrency', () => {
  it('should format currency with CZK symbol', () => {
    const result = formatCurrency(1234.56, 'CZK');
    expect(result).toContain('1');
    expect(result).toContain('234');
    expect(result).toContain('56');
  });

  it('should format currency with USD symbol', () => {
    const result = formatCurrency(100, 'USD');
    expect(result).toContain('100');
  });

  it('should format without symbol when showSymbol is false', () => {
    expect(normalizeSpaces(formatCurrency(1234.56, 'CZK', false))).toBe(
      '1 234,56'
    );
  });

  it('should return dash for null', () => {
    expect(formatCurrency(null)).toBe('—');
  });

  it('should return dash for undefined', () => {
    expect(formatCurrency(undefined)).toBe('—');
  });
});

describe('formatPercent', () => {
  it('should format positive percentage', () => {
    expect(formatPercent(12.5)).toBe('12,5%');
  });

  it('should format negative percentage', () => {
    expect(formatPercent(-5.3)).toBe('-5,3%');
  });

  it('should show sign for positive when showSign is true', () => {
    expect(formatPercent(12.5, 1, true)).toBe('+12,5%');
  });

  it('should show sign for negative when showSign is true', () => {
    expect(formatPercent(-5.3, 1, true)).toBe('-5,3%');
  });

  it('should respect decimals parameter', () => {
    expect(formatPercent(12.567, 2)).toBe('12,57%');
  });

  it('should return dash for null', () => {
    expect(formatPercent(null)).toBe('—');
  });

  it('should return dash for undefined', () => {
    expect(formatPercent(undefined)).toBe('—');
  });

  it('should handle zero', () => {
    expect(formatPercent(0)).toBe('0,0%');
  });
});

describe('formatShares', () => {
  it('should format whole number shares', () => {
    expect(formatShares(100)).toBe('100');
  });

  it('should format fractional shares', () => {
    const result = formatShares(10.5);
    expect(result).toContain('10');
    expect(result).toContain('5');
  });

  it('should handle up to 4 decimal places', () => {
    const result = formatShares(10.1234);
    expect(result).toContain('1234');
  });

  it('should return dash for null', () => {
    expect(formatShares(null)).toBe('—');
  });

  it('should return dash for undefined', () => {
    expect(formatShares(undefined)).toBe('—');
  });
});

describe('formatPrice', () => {
  it('should format price with currency', () => {
    const result = formatPrice(175.5, 'USD');
    expect(result).toContain('175');
    expect(result).toContain('USD');
  });

  it('should format price without currency when showCurrency is false', () => {
    const result = formatPrice(175.5, 'USD', false);
    expect(result).not.toContain('USD');
  });

  it('should handle whole number prices', () => {
    expect(formatPrice(100, 'CZK')).toBe('100 CZK');
  });

  it('should return dash for null', () => {
    expect(formatPrice(null)).toBe('—');
  });

  it('should return dash for undefined', () => {
    expect(formatPrice(undefined)).toBe('—');
  });
});

describe('formatDate', () => {
  it('should format date string', () => {
    const result = formatDate('2024-12-25');
    expect(result).toContain('25');
    expect(result).toContain('12');
    expect(result).toContain('2024');
  });

  it('should format Date object', () => {
    const date = new Date(2024, 11, 25); // December 25, 2024
    const result = formatDate(date);
    expect(result).toContain('25');
    expect(result).toContain('12');
    expect(result).toContain('2024');
  });

  it('should return dash for empty string', () => {
    expect(formatDate('')).toBe('—');
  });
});

describe('formatDateTime', () => {
  it('should format date with time', () => {
    const date = new Date(2024, 11, 25, 14, 30); // December 25, 2024 14:30
    const result = formatDateTime(date);
    expect(result).toContain('25');
    expect(result).toContain('12');
    expect(result).toContain('2024');
    expect(result).toContain('14');
    expect(result).toContain('30');
  });

  it('should return dash for empty string', () => {
    expect(formatDateTime('')).toBe('—');
  });
});

describe('formatLargeNumber', () => {
  it('should format trillions', () => {
    expect(formatLargeNumber(2_500_000_000_000)).toBe('2.5T');
  });

  it('should format billions', () => {
    expect(formatLargeNumber(1_500_000_000)).toBe('1.5B');
  });

  it('should format millions', () => {
    expect(formatLargeNumber(2_500_000)).toBe('2.5M');
  });

  it('should format thousands', () => {
    expect(formatLargeNumber(5_500)).toBe('5.5K');
  });

  it('should format small numbers normally', () => {
    expect(formatLargeNumber(500)).toBe('500');
  });

  it('should handle negative numbers', () => {
    expect(formatLargeNumber(-1_500_000_000)).toBe('-1.5B');
  });

  it('should return dash for null', () => {
    expect(formatLargeNumber(null)).toBe('—');
  });

  it('should return dash for undefined', () => {
    expect(formatLargeNumber(undefined)).toBe('—');
  });
});

// ============================================================================
// INDICATOR FORMATTING TESTS
// ============================================================================

describe('formatIndicatorValue', () => {
  const basicConfig = {
    format_decimals: 2,
    format_prefix: '',
    format_suffix: '%',
    good_threshold: null,
    bad_threshold: null,
    higher_is_better: true,
  };

  it('should format value with suffix', () => {
    const result = formatIndicatorValue(25.5, basicConfig);
    expect(result).toContain('25');
    expect(result).toContain('%');
  });

  it('should format value with prefix', () => {
    const config = { ...basicConfig, format_prefix: '$', format_suffix: '' };
    const result = formatIndicatorValue(100.5, config);
    expect(result).toContain('$');
    expect(result).toContain('100');
  });

  it('should handle market cap specially', () => {
    const config = { ...basicConfig, key: 'marketCap', format_suffix: '' };
    const result = formatIndicatorValue(2_500_000_000_000, config);
    expect(result).toBe('2.5T');
  });

  it('should return dash for null', () => {
    expect(formatIndicatorValue(null, basicConfig)).toBe('—');
  });

  it('should return dash for undefined', () => {
    expect(formatIndicatorValue(undefined, basicConfig)).toBe('—');
  });
});

describe('getIndicatorValueClass', () => {
  it('should return positive when value >= good_threshold (higher_is_better)', () => {
    const config = {
      format_decimals: 2,
      format_prefix: '',
      format_suffix: '%',
      good_threshold: 15,
      bad_threshold: 5,
      higher_is_better: true,
    };
    expect(getIndicatorValueClass(20, config)).toBe('positive');
  });

  it('should return negative when value <= bad_threshold (higher_is_better)', () => {
    const config = {
      format_decimals: 2,
      format_prefix: '',
      format_suffix: '%',
      good_threshold: 15,
      bad_threshold: 5,
      higher_is_better: true,
    };
    expect(getIndicatorValueClass(3, config)).toBe('negative');
  });

  it('should return positive when value <= good_threshold (!higher_is_better)', () => {
    const config = {
      format_decimals: 2,
      format_prefix: '',
      format_suffix: '',
      good_threshold: 1.0,
      bad_threshold: 2.0,
      higher_is_better: false, // Lower is better (e.g., P/E ratio)
    };
    expect(getIndicatorValueClass(0.8, config)).toBe('positive');
  });

  it('should return negative when value >= bad_threshold (!higher_is_better)', () => {
    const config = {
      format_decimals: 2,
      format_prefix: '',
      format_suffix: '',
      good_threshold: 1.0,
      bad_threshold: 2.0,
      higher_is_better: false,
    };
    expect(getIndicatorValueClass(2.5, config)).toBe('negative');
  });

  it('should return empty string for neutral value', () => {
    const config = {
      format_decimals: 2,
      format_prefix: '',
      format_suffix: '%',
      good_threshold: 20,
      bad_threshold: 5,
      higher_is_better: true,
    };
    expect(getIndicatorValueClass(10, config)).toBe('');
  });

  it('should return empty string when no thresholds', () => {
    const config = {
      format_decimals: 2,
      format_prefix: '',
      format_suffix: '%',
      good_threshold: null,
      bad_threshold: null,
      higher_is_better: true,
    };
    expect(getIndicatorValueClass(50, config)).toBe('');
  });

  it('should return empty string for null value', () => {
    const config = {
      format_decimals: 2,
      format_prefix: '',
      format_suffix: '%',
      good_threshold: 15,
      bad_threshold: 5,
      higher_is_better: true,
    };
    expect(getIndicatorValueClass(null, config)).toBe('');
  });
});

// ============================================================================
// SENTIMENT FORMATTING TESTS
// ============================================================================

describe('getInsiderSentimentLabel', () => {
  it('should return "Silný nákup" for MSPR > 25', () => {
    const result = getInsiderSentimentLabel(30);
    expect(result.label).toBe('Silný nákup');
    expect(result.class).toBe('positive');
  });

  it('should return "Nákup" for MSPR > 0 and <= 25', () => {
    const result = getInsiderSentimentLabel(10);
    expect(result.label).toBe('Nákup');
    expect(result.class).toBe('positive');
  });

  it('should return "Prodej" for MSPR > -25 and <= 0', () => {
    const result = getInsiderSentimentLabel(-10);
    expect(result.label).toBe('Prodej');
    expect(result.class).toBe('negative');
  });

  it('should return "Silný prodej" for MSPR <= -25', () => {
    const result = getInsiderSentimentLabel(-30);
    expect(result.label).toBe('Silný prodej');
    expect(result.class).toBe('negative');
  });

  it('should return dash for null', () => {
    const result = getInsiderSentimentLabel(null);
    expect(result.label).toBe('—');
    expect(result.class).toBe('');
  });
});

// ============================================================================
// DATE FORMATTING EXTENDED TESTS
// ============================================================================

describe('formatDateShort', () => {
  it('should format date in short format', () => {
    const result = formatDateShort('2024-11-17');
    expect(result).toContain('17');
  });

  it('should return dash for empty string', () => {
    expect(formatDateShort('')).toBe('—');
  });
});

describe('formatRelativeTime', () => {
  it('should format minutes ago', () => {
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);
    const result = formatRelativeTime(tenMinsAgo);
    expect(result).toContain('m ago');
  });

  it('should format hours ago', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const result = formatRelativeTime(twoHoursAgo);
    expect(result).toContain('h ago');
  });

  it('should format days ago', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(threeDaysAgo);
    expect(result).toContain('d ago');
  });

  it('should format older dates as month/day', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const result = formatRelativeTime(twoWeeksAgo);
    // Should not contain "ago" for older dates
    expect(result).not.toContain('ago');
  });

  it('should return dash for empty string', () => {
    expect(formatRelativeTime('')).toBe('—');
  });
});

// ============================================================================
// RETURN FORMATTING TESTS
// ============================================================================

describe('formatReturn', () => {
  it('should format positive return', () => {
    expect(formatReturn(100, 110)).toBe('+10.0%');
  });

  it('should format negative return', () => {
    expect(formatReturn(100, 90)).toBe('-10.0%');
  });

  it('should return dash for null priceNow', () => {
    expect(formatReturn(100, null)).toBe('—');
  });
});

describe('getReturnClass', () => {
  it('should return positive for gain', () => {
    expect(getReturnClass(100, 110)).toBe('positive');
  });

  it('should return negative for loss', () => {
    expect(getReturnClass(100, 90)).toBe('negative');
  });

  it('should return empty string for null', () => {
    expect(getReturnClass(100, null)).toBe('');
  });
});

// ============================================================================
// EXCHANGE INFO TESTS
// ============================================================================

describe('getExchangeInfo', () => {
  it('should identify US stock without suffix', () => {
    const info = getExchangeInfo('AAPL');
    expect(info.isUSStock).toBe(true);
    expect(info.exchangeSuffix).toBeNull();
    expect(info.hasLimitedData).toBe(false);
    expect(info.country).toBe('USA');
  });

  it('should identify Hong Kong stock', () => {
    const info = getExchangeInfo('1211.HK');
    expect(info.isUSStock).toBe(false);
    expect(info.exchangeSuffix).toBe('.HK');
    expect(info.hasLimitedData).toBe(true);
    expect(info.country).toBe('Hong Kong');
  });

  it('should identify German stock', () => {
    const info = getExchangeInfo('SAP.DE');
    expect(info.isUSStock).toBe(false);
    expect(info.exchangeSuffix).toBe('.DE');
    expect(info.hasLimitedData).toBe(false);
    expect(info.country).toBe('Germany');
  });

  it('should identify Tokyo stock', () => {
    const info = getExchangeInfo('7203.T');
    expect(info.isUSStock).toBe(false);
    expect(info.exchangeSuffix).toBe('.T');
    expect(info.hasLimitedData).toBe(true);
    expect(info.country).toBe('Japan');
  });
});

describe('getMarketStatus', () => {
  it('should return market status object', () => {
    const status = getMarketStatus('AAPL');
    expect(status).toHaveProperty('isOpen');
    expect(status).toHaveProperty('statusText');
    expect(status).toHaveProperty('localTime');
    expect(typeof status.isOpen).toBe('boolean');
  });

  it('should handle unknown exchange', () => {
    const status = getMarketStatus('TEST.XX');
    expect(status.statusText).toBe('Neznámý');
  });
});

describe('hasLimitedData', () => {
  it('should return false for US stocks', () => {
    expect(hasLimitedData('AAPL')).toBe(false);
    expect(hasLimitedData('MSFT')).toBe(false);
  });

  it('should return true for Hong Kong stocks', () => {
    expect(hasLimitedData('1211.HK')).toBe(true);
  });

  it('should return true for Tokyo stocks', () => {
    expect(hasLimitedData('7203.T')).toBe(true);
  });

  it('should return false for European stocks', () => {
    expect(hasLimitedData('SAP.DE')).toBe(false);
    expect(hasLimitedData('ASML.AS')).toBe(false);
  });
});

describe('getLimitedDataMessage', () => {
  it('should return null for US stocks', () => {
    expect(getLimitedDataMessage('AAPL')).toBeNull();
  });

  it('should return message for Hong Kong stocks', () => {
    const message = getLimitedDataMessage('1211.HK');
    expect(message).not.toBeNull();
    expect(message).toContain('Hong Kong');
    expect(message).toContain('omezená');
  });

  it('should return null for European stocks', () => {
    expect(getLimitedDataMessage('SAP.DE')).toBeNull();
  });
});
