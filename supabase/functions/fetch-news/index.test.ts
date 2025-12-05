import {
  assertEquals,
  assertMatch,
} from 'https://deno.land/std@0.168.0/testing/asserts.ts';
import { getDateString, analyzeBasicSentiment, detectTopics } from './index.ts';

// ============================================================================
// getDateString
// ============================================================================

Deno.test('getDateString returns ISO date format', () => {
  const result = getDateString();
  assertMatch(result, /^\d{4}-\d{2}-\d{2}$/);
});

Deno.test('getDateString with 0 returns today', () => {
  const result = getDateString(0);
  const expected = new Date().toISOString().split('T')[0];
  assertEquals(result, expected);
});

Deno.test('getDateString with days ago returns past date', () => {
  const result = getDateString(7);
  const resultDate = new Date(result);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  resultDate.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - resultDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  // Allow for timezone differences
  assertEquals(diffDays >= 6 && diffDays <= 8, true);
});

// ============================================================================
// analyzeBasicSentiment
// ============================================================================

Deno.test('analyzeBasicSentiment returns positive for bullish news', () => {
  const result = analyzeBasicSentiment(
    'Stock surges to record high after earnings beat',
    'Company reported strong growth and outperformed expectations'
  );
  assertEquals(result.label, 'positive');
  assertEquals(result.score > 0, true);
});

Deno.test('analyzeBasicSentiment returns negative for bearish news', () => {
  const result = analyzeBasicSentiment(
    'Stock plunges on bankruptcy fears',
    'Company faces investigation amid fraud allegations and massive layoffs'
  );
  assertEquals(result.label, 'negative');
  assertEquals(result.score < 0, true);
});

Deno.test('analyzeBasicSentiment returns neutral for neutral news', () => {
  const result = analyzeBasicSentiment(
    'Company announces new product',
    'The product will be available next month'
  );
  assertEquals(result.label, 'neutral');
});

Deno.test('analyzeBasicSentiment detects keywords', () => {
  const result = analyzeBasicSentiment(
    'Stock rally continues',
    'Bullish momentum drives gains'
  );
  assertEquals(result.keywords.includes('rally'), true);
  assertEquals(result.keywords.includes('bullish'), true);
});

Deno.test('analyzeBasicSentiment weights title higher', () => {
  // Same word in title vs summary should have different impact
  const titleResult = analyzeBasicSentiment(
    'surge in stock price',
    'normal trading day'
  );
  const summaryResult = analyzeBasicSentiment(
    'normal trading day',
    'there was a surge'
  );

  // Both should be positive since "surge" is detected
  assertEquals(titleResult.label, 'positive');
  // Title match should give higher or equal score
  assertEquals(titleResult.score >= summaryResult.score, true);
});

// ============================================================================
// detectTopics
// ============================================================================

Deno.test('detectTopics detects Fed mentions', () => {
  const topics = detectTopics(
    'Federal Reserve announces rate decision',
    'Jerome Powell speaks about interest rates',
    'general',
    'SPY'
  );
  assertEquals(topics.includes('Fed'), true);
  assertEquals(topics.includes('Rates'), true);
});

Deno.test('detectTopics detects index mentions', () => {
  const topics = detectTopics(
    'S&P 500 hits new record',
    'NASDAQ tech stocks lead rally',
    'general',
    ''
  );
  assertEquals(topics.includes('S&P 500'), true);
  assertEquals(topics.includes('NASDAQ'), true);
});

Deno.test('detectTopics detects earnings', () => {
  const topics = detectTopics(
    'Apple earnings beat estimates',
    'Quarterly results exceed expectations',
    'general',
    'AAPL'
  );
  assertEquals(topics.includes('Earnings'), true);
});

Deno.test('detectTopics detects inflation', () => {
  const topics = detectTopics(
    'CPI report shows inflation cooling',
    'Consumer price index data',
    'general',
    ''
  );
  assertEquals(topics.includes('Inflation'), true);
});

Deno.test('detectTopics detects M&A from category', () => {
  const topics = detectTopics(
    'Company acquisition announced',
    'Merger deal details',
    'merger',
    ''
  );
  assertEquals(topics.includes('M&A'), true);
});

Deno.test('detectTopics returns empty for generic news', () => {
  const topics = detectTopics(
    'Company releases new product',
    'Product available soon',
    'general',
    'AAPL'
  );
  // Should have no specific topics
  assertEquals(topics.length, 0);
});
