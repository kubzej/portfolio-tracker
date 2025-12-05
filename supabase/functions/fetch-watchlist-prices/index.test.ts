// Tests for fetch-watchlist-prices edge function helper functions
// Run with: deno test --allow-env --allow-net ./supabase/functions/fetch-watchlist-prices/index.test.ts

import {
  assertEquals,
  assertAlmostEquals,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { parseYahooWatchlistQuote, buildTickerMap } from './index.ts';

// ============================================================================
// parseYahooWatchlistQuote tests
// ============================================================================

Deno.test('parseYahooWatchlistQuote returns null for null data', () => {
  const result = parseYahooWatchlistQuote(null, 'AAPL');
  assertEquals(result, null);
});

Deno.test('parseYahooWatchlistQuote returns null for empty result', () => {
  const result = parseYahooWatchlistQuote({ chart: { result: [] } }, 'AAPL');
  assertEquals(result, null);
});

Deno.test('parseYahooWatchlistQuote returns null for missing meta', () => {
  const result = parseYahooWatchlistQuote({ chart: { result: [{}] } }, 'AAPL');
  assertEquals(result, null);
});

Deno.test('parseYahooWatchlistQuote parses valid response', () => {
  const data = {
    chart: {
      result: [
        {
          meta: {
            symbol: 'MSFT',
            regularMarketPrice: 420.5,
            currency: 'USD',
            previousClose: 415.25,
          },
        },
      ],
    },
  };

  const result = parseYahooWatchlistQuote(data, 'MSFT');
  assertEquals(result?.ticker, 'MSFT');
  assertEquals(result?.price, 420.5);
  assertEquals(result?.currency, 'USD');
  assertAlmostEquals(result?.change ?? 0, 5.25, 0.01);
  assertAlmostEquals(result?.changePercent ?? 0, 1.264, 0.01);
});

Deno.test('parseYahooWatchlistQuote uses chartPreviousClose fallback', () => {
  const data = {
    chart: {
      result: [
        {
          meta: {
            symbol: 'GOOGL',
            regularMarketPrice: 180,
            currency: 'USD',
            chartPreviousClose: 175,
          },
        },
      ],
    },
  };

  const result = parseYahooWatchlistQuote(data, 'GOOGL');
  assertEquals(result?.change, 5);
  assertAlmostEquals(result?.changePercent ?? 0, 2.857, 0.01);
});

Deno.test('parseYahooWatchlistQuote defaults currency to USD', () => {
  const data = {
    chart: {
      result: [
        {
          meta: {
            symbol: 'TEST',
            regularMarketPrice: 100,
            previousClose: 100,
          },
        },
      ],
    },
  };

  const result = parseYahooWatchlistQuote(data, 'TEST');
  assertEquals(result?.currency, 'USD');
});

Deno.test('parseYahooWatchlistQuote uses fallback ticker', () => {
  const data = {
    chart: {
      result: [
        {
          meta: {
            regularMarketPrice: 50,
            currency: 'EUR',
            previousClose: 48,
          },
        },
      ],
    },
  };

  const result = parseYahooWatchlistQuote(data, 'SAP.DE');
  assertEquals(result?.ticker, 'SAP.DE');
});

Deno.test('parseYahooWatchlistQuote calculates negative change', () => {
  const data = {
    chart: {
      result: [
        {
          meta: {
            symbol: 'NVDA',
            regularMarketPrice: 480,
            currency: 'USD',
            previousClose: 500,
          },
        },
      ],
    },
  };

  const result = parseYahooWatchlistQuote(data, 'NVDA');
  assertEquals(result?.change, -20);
  assertEquals(result?.changePercent, -4);
});

// ============================================================================
// buildTickerMap tests
// ============================================================================

Deno.test('buildTickerMap returns empty map for empty array', () => {
  const result = buildTickerMap([]);
  assertEquals(result.size, 0);
});

Deno.test('buildTickerMap creates map with unique tickers', () => {
  const items = [
    { id: '1', ticker: 'AAPL' },
    { id: '2', ticker: 'MSFT' },
    { id: '3', ticker: 'GOOGL' },
  ];

  const result = buildTickerMap(items);
  assertEquals(result.size, 3);
  assertEquals(result.get('AAPL'), ['1']);
  assertEquals(result.get('MSFT'), ['2']);
  assertEquals(result.get('GOOGL'), ['3']);
});

Deno.test('buildTickerMap groups duplicate tickers', () => {
  const items = [
    { id: '1', ticker: 'AAPL' },
    { id: '2', ticker: 'AAPL' },
    { id: '3', ticker: 'MSFT' },
    { id: '4', ticker: 'AAPL' },
  ];

  const result = buildTickerMap(items);
  assertEquals(result.size, 2);
  assertEquals(result.get('AAPL'), ['1', '2', '4']);
  assertEquals(result.get('MSFT'), ['3']);
});

Deno.test('buildTickerMap handles single item', () => {
  const items = [{ id: 'abc-123', ticker: 'TSLA' }];

  const result = buildTickerMap(items);
  assertEquals(result.size, 1);
  assertEquals(result.get('TSLA'), ['abc-123']);
});

Deno.test('buildTickerMap preserves ID order', () => {
  const items = [
    { id: 'first', ticker: 'NVDA' },
    { id: 'second', ticker: 'NVDA' },
    { id: 'third', ticker: 'NVDA' },
  ];

  const result = buildTickerMap(items);
  const ids = result.get('NVDA');
  assertEquals(ids?.[0], 'first');
  assertEquals(ids?.[1], 'second');
  assertEquals(ids?.[2], 'third');
});
