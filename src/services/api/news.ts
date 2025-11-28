import { supabase } from '@/lib/supabase';

// Sentiment analysis result
export interface SentimentResult {
  score: number | null; // -1 to 1
  label: 'positive' | 'negative' | 'neutral' | null;
  keywords: string[];
}

// Single news article
export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  relatedTickers: string[];
  thumbnail: string | null;
  sentiment?: SentimentResult;
  // Added when aggregating
  ticker?: string;
  stockName?: string;
  // Backend-matched topics (for market news)
  matchedTopics?: string[];
}

// News for a single ticker
export interface TickerNews {
  ticker: string;
  stockName: string;
  articles: NewsArticle[];
  error?: string;
}

// Aggregate stats for scoring
export interface NewsStats {
  totalArticles: number;
  byTicker: {
    ticker: string;
    count: number;
    avgSentiment: number | null;
  }[];
  overallSentiment: number | null;
}

// Full news response
export interface NewsResponse {
  articles: (NewsArticle & { ticker: string; stockName: string })[];
  byTicker: TickerNews[];
  stats: NewsStats;
  errors: string[];
}

/**
 * Fetch news for all portfolio holdings
 */
export async function fetchPortfolioNews(
  portfolioId?: string
): Promise<NewsResponse> {
  const { data, error } = await supabase.functions.invoke('fetch-news', {
    body: { portfolioId, includeBasicSentiment: true },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as NewsResponse;
}

/**
 * Fetch general market news
 */
export async function fetchMarketNews(): Promise<NewsResponse> {
  const { data, error } = await supabase.functions.invoke('fetch-news', {
    body: { marketNews: true, includeBasicSentiment: true },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as NewsResponse;
}

/**
 * Fetch news for a single ticker
 */
export async function fetchTickerNews(
  ticker: string
): Promise<TickerNews | null> {
  const { data, error } = await supabase.functions.invoke('fetch-news', {
    body: { ticker, includeBasicSentiment: true },
  });

  if (error) {
    throw new Error(error.message);
  }

  return data?.data?.[0] || null;
}

/**
 * Helper to format relative time
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) {
    return `${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `${diffHours}h ago`;
  } else if (diffDays < 7) {
    return `${diffDays}d ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}

/**
 * Get sentiment color based on score
 */
export function getSentimentColor(score: number | null): string {
  if (score === null) return 'var(--text-secondary)';
  if (score > 0.2) return '#22c55e'; // positive - green
  if (score < -0.2) return '#ef4444'; // negative - red
  return '#f59e0b'; // neutral - yellow
}

/**
 * Get sentiment label
 */
export function getSentimentLabel(
  label: 'positive' | 'negative' | 'neutral' | null
): string {
  switch (label) {
    case 'positive':
      return '📈 Positive';
    case 'negative':
      return '📉 Negative';
    case 'neutral':
      return '➡️ Neutral';
    default:
      return '❓ Unknown';
  }
}
