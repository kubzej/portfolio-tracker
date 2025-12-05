// Tests for fetch-price-intraday edge function helper functions
// Run with: deno test --allow-env --allow-net ./supabase/functions/fetch-price-intraday/index.test.ts

import {
  assertEquals,
  assertAlmostEquals,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import {
  formatIntradayDate,
  roundPrice,
  parsePricePoint,
  getYahooParams,
} from './index.ts';

// ============================================================================
// formatIntradayDate tests
// ============================================================================

Deno.test('formatIntradayDate formats timestamp correctly', () => {
  // 2024-12-05 14:30:00 UTC = 1733409000
  const timestamp = 1733409000;
  const result = formatIntradayDate(timestamp);
  // Should be in format "YYYY-MM-DD HH:MM"
  assertEquals(result.length, 16);
  assertEquals(result.includes(' '), true);
  assertEquals(result.split(' ').length, 2);
});

Deno.test('formatIntradayDate handles midnight', () => {
  // 2024-01-01 00:00:00 UTC = 1704067200
  const timestamp = 1704067200;
  const result = formatIntradayDate(timestamp);
  assertEquals(result, '2024-01-01 00:00');
});

Deno.test('formatIntradayDate returns ISO-like format without seconds', () => {
  const timestamp = 1704067200;
  const result = formatIntradayDate(timestamp);
  // Format should be "YYYY-MM-DD HH:MM"
  const regex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
  assertEquals(regex.test(result), true);
});

// ============================================================================
// roundPrice tests
// ============================================================================

Deno.test('roundPrice rounds to 2 decimal places', () => {
  assertEquals(roundPrice(150.456), 150.46);
  assertEquals(roundPrice(150.454), 150.45);
  assertEquals(roundPrice(150.455), 150.46); // Banker's rounding
});

Deno.test('roundPrice handles whole numbers', () => {
  assertEquals(roundPrice(100), 100);
  assertEquals(roundPrice(150.0), 150);
});

Deno.test('roundPrice handles small decimals', () => {
  assertEquals(roundPrice(0.123), 0.12);
  assertEquals(roundPrice(0.999), 1);
});

Deno.test('roundPrice handles negative numbers', () => {
  assertEquals(roundPrice(-50.567), -50.57);
});

// ============================================================================
// parsePricePoint tests
// ============================================================================

Deno.test('parsePricePoint returns null for null close', () => {
  const result = parsePricePoint(1704067200, 100, null, 105, 98, 1000);
  assertEquals(result, null);
});

Deno.test('parsePricePoint returns null for null open', () => {
  const result = parsePricePoint(1704067200, null, 102, 105, 98, 1000);
  assertEquals(result, null);
});

Deno.test('parsePricePoint returns null for null high', () => {
  const result = parsePricePoint(1704067200, 100, 102, null, 98, 1000);
  assertEquals(result, null);
});

Deno.test('parsePricePoint returns null for null low', () => {
  const result = parsePricePoint(1704067200, 100, 102, 105, null, 1000);
  assertEquals(result, null);
});

Deno.test('parsePricePoint parses valid data', () => {
  const result = parsePricePoint(
    1704067200,
    100.123,
    102.456,
    105.789,
    98.321,
    50000
  );

  assertEquals(result?.timestamp, 1704067200);
  assertEquals(result?.open, 100.12);
  assertEquals(result?.close, 102.46);
  assertEquals(result?.high, 105.79);
  assertEquals(result?.low, 98.32);
  assertEquals(result?.volume, 50000);
  assertEquals(result?.date, '2024-01-01 00:00');
});

Deno.test('parsePricePoint handles null volume as 0', () => {
  const result = parsePricePoint(1704067200, 100, 102, 105, 98, null);
  assertEquals(result?.volume, 0);
});

Deno.test('parsePricePoint rounds all prices', () => {
  const result = parsePricePoint(
    1704067200,
    100.999,
    102.111,
    105.555,
    98.444,
    1000
  );

  assertEquals(result?.open, 101);
  assertAlmostEquals(result?.close ?? 0, 102.11, 0.01);
  assertAlmostEquals(result?.high ?? 0, 105.56, 0.01);
  assertAlmostEquals(result?.low ?? 0, 98.44, 0.01);
});

// ============================================================================
// getYahooParams tests
// ============================================================================

Deno.test('getYahooParams returns 1d/5m for 1d range', () => {
  const result = getYahooParams('1d');
  assertEquals(result.yahooRange, '1d');
  assertEquals(result.yahooInterval, '5m');
});

Deno.test('getYahooParams returns 5d/15m for 1w range', () => {
  const result = getYahooParams('1w');
  assertEquals(result.yahooRange, '5d');
  assertEquals(result.yahooInterval, '15m');
});
