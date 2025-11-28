/**
 * Sentiment utilities
 *
 * Functions for handling news/article sentiment display
 */

export type SentimentLabel = 'positive' | 'negative' | 'neutral';

/**
 * Get color for sentiment score
 * @param score - Sentiment score (-1 to 1)
 * @returns CSS color value
 */
export function getSentimentColor(score: number | null): string {
  if (score === null) return 'var(--text-secondary)';
  if (score > 0.2) return '#22c55e'; // positive - green
  if (score < -0.2) return '#ef4444'; // negative - red
  return '#f59e0b'; // neutral - yellow
}

/**
 * Get display label for sentiment
 * @param label - Sentiment label from API
 * @returns Human-readable label
 */
export function getSentimentLabel(label: SentimentLabel | null): string {
  switch (label) {
    case 'positive':
      return 'Positive';
    case 'negative':
      return 'Negative';
    case 'neutral':
      return 'Neutral';
    default:
      return 'Unknown';
  }
}

/**
 * Get CSS class for sentiment
 * @param label - Sentiment label
 * @returns CSS class name
 */
export function getSentimentClass(
  label: SentimentLabel | null
): 'positive' | 'negative' | 'neutral' | '' {
  if (!label) return '';
  return label;
}
