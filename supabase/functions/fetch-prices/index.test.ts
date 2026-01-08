// Tests for fetch-prices edge function helper functions
// Run with: deno test --allow-env --allow-net ./supabase/functions/fetch-prices/index.test.ts

import {
  assertEquals,
  assertAlmostEquals,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { parseYahooChartResponse, calculatePriceInCzk } from './index.ts';

// ============================================================================
// parseYahooChartResponse tests
// ============================================================================

Deno.test('parseYahooChartResponse returns null for null data', () => {
  const result = parseYahooChartResponse(null, 'AAPL');
  assertEquals(result, null);
});

Deno.test('parseYahooChartResponse returns null for empty result', () => {
  const result = parseYahooChartResponse({ chart: { result: [] } }, 'AAPL');
  assertEquals(result, null);
});

Deno.test('parseYahooChartResponse returns null for missing meta', () => {
  const result = parseYahooChartResponse({ chart: { result: [{}] } }, 'AAPL');
  assertEquals(result, null);
});

Deno.test('parseYahooChartResponse parses valid response', () => {
  const data = {
    chart: {
      result: [
        {
          meta: {
            symbol: 'AAPL',
            regularMarketPrice: 150.25,
            currency: 'USD',
            previousClose: 148.5,
          },
        },
      ],
    },
  };

  const result = parseYahooChartResponse(data, 'AAPL');
  assertEquals(result?.ticker, 'AAPL');
  assertEquals(result?.price, 150.25);
  assertEquals(result?.currency, 'USD');
  assertAlmostEquals(result?.change ?? 0, 1.75, 0.01);
  assertAlmostEquals(result?.changePercent ?? 0, 1.178, 0.01);
});

Deno.test('parseYahooChartResponse uses chartPreviousClose as fallback', () => {
  const data = {
    chart: {
      result: [
        {
          meta: {
            symbol: 'AAPL',
            regularMarketPrice: 150,
            currency: 'USD',
            chartPreviousClose: 145,
          },
        },
      ],
    },
  };

  const result = parseYahooChartResponse(data, 'AAPL');
  assertEquals(result?.change, 5);
  assertAlmostEquals(result?.changePercent ?? 0, 3.448, 0.01);
});

Deno.test('parseYahooChartResponse defaults currency to USD', () => {
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

  const result = parseYahooChartResponse(data, 'TEST');
  assertEquals(result?.currency, 'USD');
});

Deno.test(
  'parseYahooChartResponse uses provided ticker as fallback for symbol',
  () => {
    const data = {
      chart: {
        result: [
          {
            meta: {
              regularMarketPrice: 100,
              currency: 'EUR',
              previousClose: 100,
            },
          },
        ],
      },
    };

    const result = parseYahooChartResponse(data, 'BMW.DE');
    assertEquals(result?.ticker, 'BMW.DE');
  }
);

Deno.test(
  'parseYahooChartResponse calculates negative change correctly',
  () => {
    const data = {
      chart: {
        result: [
          {
            meta: {
              symbol: 'AAPL',
              regularMarketPrice: 145,
              currency: 'USD',
              previousClose: 150,
            },
          },
        ],
      },
    };

    const result = parseYahooChartResponse(data, 'AAPL');
    assertEquals(result?.change, -5);
    assertAlmostEquals(result?.changePercent ?? 0, -3.333, 0.01);
  }
);

Deno.test('parseYahooChartResponse returns null if price is missing', () => {
  const data = {
    chart: {
      result: [
        {
          meta: {
            symbol: 'AAPL',
            currency: 'USD',
            previousClose: 150,
          },
        },
      ],
    },
  };

  const result = parseYahooChartResponse(data, 'AAPL');
  assertEquals(result, null);
});

// ============================================================================
// calculatePriceInCzk tests
// ============================================================================

Deno.test('calculatePriceInCzk calculates USD to CZK', () => {
  // $100 at rate 23.5 = 2350 CZK
  const result = calculatePriceInCzk(100, 23.5);
  assertEquals(result, 2350);
});

Deno.test('calculatePriceInCzk returns same price for rate 1 (CZK)', () => {
  const result = calculatePriceInCzk(1000, 1);
  assertEquals(result, 1000);
});

Deno.test('calculatePriceInCzk handles EUR rate', () => {
  // €100 at rate 25.2 = 2520 CZK
  const result = calculatePriceInCzk(100, 25.2);
  assertEquals(result, 2520);
});

Deno.test('calculatePriceInCzk handles decimal prices', () => {
  const result = calculatePriceInCzk(150.75, 23.45);
  assertAlmostEquals(result, 3535.09, 0.01);
});

Deno.test('calculatePriceInCzk handles zero price', () => {
  const result = calculatePriceInCzk(0, 23.5);
  assertEquals(result, 0);
});

// ============================================================================
// GBp (pence) currency handling tests
// ============================================================================

Deno.test('parseYahooChartResponse returns GBp currency for LSE stocks', () => {
  // Yahoo returns GBp (pence) for LSE stocks, not GBP
  const data = {
    chart: {
      result: [
        {
          meta: {
            symbol: 'WIZZ.L',
            regularMarketPrice: 1295, // Price in pence
            currency: 'GBp', // Yahoo returns GBp, not GBP!
            previousClose: 1270,
          },
        },
      ],
    },
  };

  const result = parseYahooChartResponse(data, 'WIZZ.L');
  assertEquals(result?.ticker, 'WIZZ.L');
  assertEquals(result?.price, 1295);
  assertEquals(result?.currency, 'GBp'); // This is what Yahoo returns
  assertEquals(result?.change, 25);
});

Deno.test('calculatePriceInCzk with GBP rate and price_scale', () => {
  // WIZZ.L: Yahoo price 1295 GBp, price_scale 0.01, GBP/CZK rate ~30
  // Actual price per share: 1295 * 0.01 = 12.95 GBP
  // Value in CZK: 12.95 * 30 = 388.50 CZK per share

  const yahooPrice = 1295; // GBp (pence)
  const priceScale = 0.01;
  const gbpToCzkRate = 30;

  const actualPriceGbp = yahooPrice * priceScale; // 12.95 GBP
  const valueCzk = calculatePriceInCzk(actualPriceGbp, gbpToCzkRate);

  assertAlmostEquals(valueCzk, 388.5, 0.01);
});

Deno.test(
  'exchange rate lookup should use DB currency not Yahoo currency',
  () => {
    // This test documents the expected behavior:
    // - Yahoo returns currency: 'GBp' (pence)
    // - DB has currency: 'GBP'
    // - Exchange rate lookup should use 'GBP' from DB to find correct rate
    // - If we used 'GBp' from Yahoo, rate would be 1 (not found, defaulted)

    const exchangeRates = new Map<string, number>();
    exchangeRates.set('CZK', 1);
    exchangeRates.set('GBP', 30.5); // GBP rate exists
    exchangeRates.set('USD', 23.5);

    const yahooCurrency = 'GBp'; // What Yahoo returns
    const dbCurrency = 'GBP'; // What we have in stocks table

    // Wrong: using Yahoo currency
    const wrongRate = exchangeRates.get(yahooCurrency) || 1;
    assertEquals(wrongRate, 1); // Falls back to 1, WRONG!

    // Correct: using DB currency
    const correctRate = exchangeRates.get(dbCurrency) || 1;
    assertEquals(correctRate, 30.5); // Finds the correct rate
  }
);
