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
  fetchedTickers?: string[]; // Tickers where news fetch was attempted (even if 0 articles)
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

// Re-export utilities from centralized locations for backward compatibility
export { formatRelativeTime } from '@/utils/format';
export { getSentimentColor, getSentimentLabel } from '@/utils/sentiment';
