import {
  assertEquals,
  assertAlmostEquals,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import {
  calculateSMA,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateBollingerBands,
  calculateStochastic,
  calculateATR,
} from './index.ts';

// ============================================================================
// calculateSMA
// ============================================================================

Deno.test('calculateSMA returns null for insufficient data', () => {
  assertEquals(calculateSMA([1, 2, 3], 5), null);
  assertEquals(calculateSMA([], 5), null);
});

Deno.test('calculateSMA calculates correct average', () => {
  // SMA of [10, 20, 30, 40, 50] with period 5 = 30
  const result = calculateSMA([10, 20, 30, 40, 50], 5);
  assertEquals(result, 30);
});

Deno.test('calculateSMA uses only first N prices', () => {
  // SMA uses first 3 prices: [10, 20, 30] = 20
  const result = calculateSMA([10, 20, 30, 100, 200], 3);
  assertEquals(result, 20);
});

// ============================================================================
// calculateEMA
// ============================================================================

Deno.test('calculateEMA returns empty for insufficient data', () => {
  assertEquals(calculateEMA([1, 2, 3], 5), []);
});

Deno.test('calculateEMA returns correct number of values', () => {
  const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
  const result = calculateEMA(prices, 5);
  // EMA starts at period, so length = prices.length - period + 1
  assertEquals(result.length, 7);
});

Deno.test('calculateEMA first value equals SMA', () => {
  const prices = [10, 20, 30, 40, 50, 60];
  const result = calculateEMA(prices, 5);
  // First EMA = SMA of first 5 = (10+20+30+40+50)/5 = 30
  assertEquals(result[0], 30);
});

// ============================================================================
// calculateMACD
// ============================================================================

Deno.test('calculateMACD returns empty for insufficient data', () => {
  const prices = Array(30).fill(100);
  const result = calculateMACD(prices);
  assertEquals(result.macd.length, 0);
});

Deno.test('calculateMACD returns aligned arrays', () => {
  // Need 34+ prices for MACD
  const prices = Array(50)
    .fill(0)
    .map((_, i) => 100 + i);
  const result = calculateMACD(prices);

  assertEquals(result.macd.length, result.signal.length);
  assertEquals(result.signal.length, result.histogram.length);
});

Deno.test('calculateMACD histogram equals macd minus signal', () => {
  const prices = Array(50)
    .fill(0)
    .map((_, i) => 100 + Math.sin(i * 0.3) * 10);
  const result = calculateMACD(prices);

  if (result.histogram.length > 0) {
    const expectedHistogram = result.macd[0] - result.signal[0];
    assertAlmostEquals(result.histogram[0], expectedHistogram, 0.0001);
  }
});

// ============================================================================
// calculateRSI
// ============================================================================

Deno.test('calculateRSI returns null for insufficient data', () => {
  assertEquals(calculateRSI([1, 2, 3], 14), null);
});

Deno.test('calculateRSI returns 100 for only gains', () => {
  // Prices going up consistently (most recent first)
  const prices = [
    150, 140, 130, 120, 110, 100, 90, 80, 70, 60, 50, 40, 30, 20, 10,
  ];
  const result = calculateRSI(prices, 14);
  assertEquals(result, 100);
});

Deno.test('calculateRSI returns value between 0 and 100', () => {
  const prices = [
    100, 102, 98, 103, 97, 105, 95, 106, 94, 107, 93, 108, 92, 109, 91,
  ];
  const result = calculateRSI(prices, 14);
  assertEquals(result !== null && result >= 0 && result <= 100, true);
});

// ============================================================================
// calculateBollingerBands
// ============================================================================

Deno.test('calculateBollingerBands returns empty for insufficient data', () => {
  const result = calculateBollingerBands([1, 2, 3], 20);
  assertEquals(result.upper.length, 0);
  assertEquals(result.middle.length, 0);
  assertEquals(result.lower.length, 0);
});

Deno.test('calculateBollingerBands middle equals SMA', () => {
  const prices = Array(25)
    .fill(0)
    .map((_, i) => 100 + i);
  const result = calculateBollingerBands(prices, 20, 2);

  // Middle band should be SMA
  const expectedSMA = prices.slice(0, 20).reduce((a, b) => a + b, 0) / 20;
  assertAlmostEquals(result.middle[0], expectedSMA, 0.0001);
});

Deno.test('calculateBollingerBands upper > middle > lower', () => {
  const prices = Array(25)
    .fill(0)
    .map((_, i) => 100 + Math.random() * 10);
  const result = calculateBollingerBands(prices, 20, 2);

  for (let i = 0; i < result.middle.length; i++) {
    assertEquals(result.upper[i] > result.middle[i], true);
    assertEquals(result.middle[i] > result.lower[i], true);
  }
});

// ============================================================================
// calculateStochastic
// ============================================================================

Deno.test('calculateStochastic returns empty for insufficient data', () => {
  const result = calculateStochastic([1, 2, 3], [1, 2, 3], [1, 2, 3]);
  assertEquals(result.k.length, 0);
  assertEquals(result.d.length, 0);
});

Deno.test('calculateStochastic K and D are aligned', () => {
  const closes = Array(20)
    .fill(0)
    .map((_, i) => 100 + i);
  const highs = closes.map((c) => c + 2);
  const lows = closes.map((c) => c - 2);

  const result = calculateStochastic(closes, highs, lows);
  assertEquals(result.k.length, result.d.length);
});

Deno.test('calculateStochastic values are between 0 and 100', () => {
  const closes = Array(20)
    .fill(0)
    .map((_, i) => 100 + Math.sin(i) * 10);
  const highs = closes.map((c) => c + 5);
  const lows = closes.map((c) => c - 5);

  const result = calculateStochastic(closes, highs, lows);

  for (const k of result.k) {
    assertEquals(k >= 0 && k <= 100, true);
  }
  for (const d of result.d) {
    assertEquals(d >= 0 && d <= 100, true);
  }
});

// ============================================================================
// calculateATR
// ============================================================================

Deno.test('calculateATR returns empty for insufficient data', () => {
  const result = calculateATR([1, 2, 3], [1, 2, 3], [1, 2, 3]);
  assertEquals(result.atr.length, 0);
});

Deno.test('calculateATR returns positive values', () => {
  const closes = Array(20)
    .fill(0)
    .map((_, i) => 100 + i);
  const highs = closes.map((c) => c + 3);
  const lows = closes.map((c) => c - 2);

  const result = calculateATR(closes, highs, lows);

  for (const atr of result.atr) {
    assertEquals(atr > 0, true);
  }
});

Deno.test('calculateATR reflects volatility', () => {
  // Low volatility prices
  const lowVolCloses = Array(20).fill(100);
  const lowVolHighs = lowVolCloses.map((c) => c + 1);
  const lowVolLows = lowVolCloses.map((c) => c - 1);

  // High volatility prices
  const highVolCloses = Array(20)
    .fill(0)
    .map((_, i) => 100 + (i % 2 === 0 ? 10 : -10));
  const highVolHighs = highVolCloses.map((c) => c + 5);
  const highVolLows = highVolCloses.map((c) => c - 5);

  const lowATR = calculateATR(lowVolCloses, lowVolHighs, lowVolLows);
  const highATR = calculateATR(highVolCloses, highVolHighs, highVolLows);

  // High volatility should have higher ATR
  if (lowATR.atr.length > 0 && highATR.atr.length > 0) {
    assertEquals(
      highATR.atr[highATR.atr.length - 1] > lowATR.atr[lowATR.atr.length - 1],
      true
    );
  }
});
