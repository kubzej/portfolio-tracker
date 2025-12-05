// Tests for fetch-peers-data edge function helper functions
// Run with: deno test --allow-env --allow-net ./supabase/functions/fetch-peers-data/index.test.ts

import {
  assertEquals,
  assertAlmostEquals,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';

import { calculateConsensusScore, calculateTargetUpside } from './index.ts';

// ============================================================================
// calculateConsensusScore tests
// ============================================================================

Deno.test('calculateConsensusScore returns null for null input', () => {
  const result = calculateConsensusScore(null);
  assertEquals(result.recommendationKey, null);
  assertEquals(result.consensusScore, null);
});

Deno.test('calculateConsensusScore returns null for zero total', () => {
  const result = calculateConsensusScore({
    strongBuy: 0,
    buy: 0,
    hold: 0,
    sell: 0,
    strongSell: 0,
  });
  assertEquals(result.recommendationKey, null);
  assertEquals(result.consensusScore, null);
});

Deno.test(
  'calculateConsensusScore returns strong_buy for dominant strong buys',
  () => {
    const result = calculateConsensusScore({
      strongBuy: 10,
      buy: 5,
      hold: 2,
      sell: 0,
      strongSell: 0,
    });
    assertEquals(result.recommendationKey, 'strong_buy');
    // Score: (10*2 + 5*1 + 2*0) / 17 = 25/17 ≈ 1.47
    assertAlmostEquals(result.consensusScore!, 1.47, 0.01);
  }
);

Deno.test('calculateConsensusScore returns buy when buy > strongBuy', () => {
  const result = calculateConsensusScore({
    strongBuy: 3,
    buy: 10,
    hold: 2,
    sell: 0,
    strongSell: 0,
  });
  assertEquals(result.recommendationKey, 'buy');
});

Deno.test(
  'calculateConsensusScore returns hold for balanced recommendations',
  () => {
    const result = calculateConsensusScore({
      strongBuy: 2,
      buy: 3,
      hold: 10,
      sell: 3,
      strongSell: 2,
    });
    assertEquals(result.recommendationKey, 'hold');
    // Score: (2*2 + 3*1 + 10*0 + 3*(-1) + 2*(-2)) / 20 = (4+3+0-3-4)/20 = 0/20 = 0
    assertEquals(result.consensusScore, 0);
  }
);

Deno.test('calculateConsensusScore returns sell for dominant sells', () => {
  const result = calculateConsensusScore({
    strongBuy: 0,
    buy: 2,
    hold: 3,
    sell: 10,
    strongSell: 3,
  });
  assertEquals(result.recommendationKey, 'sell');
});

Deno.test(
  'calculateConsensusScore returns strong_sell when strongSell > sell',
  () => {
    const result = calculateConsensusScore({
      strongBuy: 0,
      buy: 1,
      hold: 2,
      sell: 3,
      strongSell: 10,
    });
    assertEquals(result.recommendationKey, 'strong_sell');
    // Score should be negative
    assertEquals(result.consensusScore! < 0, true);
  }
);

Deno.test('calculateConsensusScore handles missing properties', () => {
  const result = calculateConsensusScore({
    strongBuy: 5,
    buy: 5,
    // Other properties undefined
  });
  assertEquals(result.recommendationKey, 'buy');
  // Score: (5*2 + 5*1) / 10 = 15/10 = 1.5
  assertEquals(result.consensusScore, 1.5);
});

Deno.test('calculateConsensusScore rounds to 2 decimal places', () => {
  const result = calculateConsensusScore({
    strongBuy: 1,
    buy: 1,
    hold: 1,
    sell: 0,
    strongSell: 0,
  });
  // Score: (1*2 + 1*1 + 1*0) / 3 = 3/3 = 1.0
  assertEquals(result.consensusScore, 1);
});

// ============================================================================
// calculateTargetUpside tests
// ============================================================================

Deno.test('calculateTargetUpside returns null for null currentPrice', () => {
  const result = calculateTargetUpside(null, 150);
  assertEquals(result, null);
});

Deno.test('calculateTargetUpside returns null for null targetPrice', () => {
  const result = calculateTargetUpside(100, null);
  assertEquals(result, null);
});

Deno.test('calculateTargetUpside returns null for both null', () => {
  const result = calculateTargetUpside(null, null);
  assertEquals(result, null);
});

Deno.test('calculateTargetUpside calculates positive upside', () => {
  // Target 150, current 100 = 50% upside
  const result = calculateTargetUpside(100, 150);
  assertEquals(result, 50);
});

Deno.test('calculateTargetUpside calculates negative upside (downside)', () => {
  // Target 80, current 100 = -20% upside
  const result = calculateTargetUpside(100, 80);
  assertEquals(result, -20);
});

Deno.test('calculateTargetUpside returns 0 for equal prices', () => {
  const result = calculateTargetUpside(100, 100);
  assertEquals(result, 0);
});

Deno.test('calculateTargetUpside rounds to 1 decimal place', () => {
  // Target 133, current 100 = 33% upside
  const result = calculateTargetUpside(100, 133);
  assertEquals(result, 33);

  // Target 133.33, current 100 = 33.33% -> rounds to 33.3
  const result2 = calculateTargetUpside(100, 133.33);
  assertEquals(result2, 33.3);
});

Deno.test('calculateTargetUpside handles decimal prices', () => {
  // Target 175.50, current 150.25
  const result = calculateTargetUpside(150.25, 175.5);
  // (175.50 - 150.25) / 150.25 * 100 = 16.8...
  assertAlmostEquals(result!, 16.8, 0.1);
});
