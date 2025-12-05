import {
  assertEquals,
  assertMatch,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  getTodayDate,
  getDateMonthsAgo,
  isNonUsTicker,
  yahooToAlphaVantageTicker,
} from './index.ts';

// ============================================================================
// getTodayDate
// ============================================================================

Deno.test('getTodayDate returns ISO date format', () => {
  const result = getTodayDate();
  // Should match YYYY-MM-DD format
  assertMatch(result, /^\d{4}-\d{2}-\d{2}$/);
});

Deno.test('getTodayDate returns current date', () => {
  const result = getTodayDate();
  const expected = new Date().toISOString().split('T')[0];
  assertEquals(result, expected);
});

// ============================================================================
// getDateMonthsAgo
// ============================================================================

Deno.test('getDateMonthsAgo returns ISO date format', () => {
  const result = getDateMonthsAgo(3);
  assertMatch(result, /^\d{4}-\d{2}-\d{2}$/);
});

Deno.test('getDateMonthsAgo returns date in the past', () => {
  const result = getDateMonthsAgo(1);
  const today = new Date();
  const resultDate = new Date(result);
  assertEquals(resultDate < today, true);
});

Deno.test('getDateMonthsAgo 12 months returns approximately 1 year ago', () => {
  const result = getDateMonthsAgo(12);
  const resultDate = new Date(result);
  const today = new Date();
  const diffMs = today.getTime() - resultDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  // Should be roughly 365 days (allow some variance for month lengths)
  assertEquals(diffDays > 350 && diffDays < 380, true);
});

// ============================================================================
// isNonUsTicker
// ============================================================================

Deno.test('isNonUsTicker returns false for US tickers', () => {
  assertEquals(isNonUsTicker('AAPL'), false);
  assertEquals(isNonUsTicker('MSFT'), false);
  assertEquals(isNonUsTicker('GOOGL'), false);
  assertEquals(isNonUsTicker('BRK-B'), false);
});

Deno.test('isNonUsTicker returns true for German tickers', () => {
  assertEquals(isNonUsTicker('SAP.DE'), true);
  assertEquals(isNonUsTicker('ZAL.DE'), true);
});

Deno.test('isNonUsTicker returns true for UK tickers', () => {
  assertEquals(isNonUsTicker('LLOY.L'), true);
  assertEquals(isNonUsTicker('HSBA.L'), true);
});

Deno.test('isNonUsTicker returns true for other exchanges', () => {
  assertEquals(isNonUsTicker('ASML.AS'), true); // Amsterdam
  assertEquals(isNonUsTicker('BNP.PA'), true); // Paris
  assertEquals(isNonUsTicker('9988.HK'), true); // Hong Kong
});

// ============================================================================
// yahooToAlphaVantageTicker
// ============================================================================

Deno.test('yahooToAlphaVantageTicker converts German tickers', () => {
  assertEquals(yahooToAlphaVantageTicker('ZAL.DE'), 'ZAL.FRK');
  assertEquals(yahooToAlphaVantageTicker('SAP.DE'), 'SAP.FRK');
});

Deno.test('yahooToAlphaVantageTicker converts UK tickers', () => {
  assertEquals(yahooToAlphaVantageTicker('LLOY.L'), 'LLOY.LON');
  assertEquals(yahooToAlphaVantageTicker('HSBA.L'), 'HSBA.LON');
});

Deno.test('yahooToAlphaVantageTicker converts Paris tickers', () => {
  assertEquals(yahooToAlphaVantageTicker('BNP.PA'), 'BNP.PAR');
});

Deno.test('yahooToAlphaVantageTicker converts Amsterdam tickers', () => {
  assertEquals(yahooToAlphaVantageTicker('ASML.AS'), 'ASML.AMS');
});

Deno.test('yahooToAlphaVantageTicker keeps US tickers unchanged', () => {
  assertEquals(yahooToAlphaVantageTicker('AAPL'), 'AAPL');
  assertEquals(yahooToAlphaVantageTicker('MSFT'), 'MSFT');
});
