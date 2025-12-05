// Supabase Edge Function for fetching news articles
// Fetches news from Finnhub API and Polygon.io
// Deploy with: supabase functions deploy fetch-news

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

// API keys from environment
const FINNHUB_API_KEY = Deno.env.get('FINNHUB_API_KEY') || '';
const POLYGON_API_KEY = Deno.env.get('POLYGON_API_KEY') || '';

// News article interface
interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  relatedTickers: string[];
  thumbnail: string | null;
  matchedTopics?: string[];
  // Prepared for future sentiment analysis
  sentiment?: {
    score: number | null; // -1 to 1
    label: 'positive' | 'negative' | 'neutral' | null;
    keywords: string[];
  };
}

// Response for a single ticker
interface TickerNews {
  ticker: string;
  stockName: string;
  articles: NewsArticle[];
  error?: string;
}

// Finnhub article interface
interface FinnhubArticle {
  id: number;
  headline: string;
  summary: string;
  source: string;
  url: string;
  datetime: number;
  related: string;
  image: string;
  category: string;
}

// Polygon article interface
interface PolygonArticle {
  id: string;
  title: string;
  author: string;
  published_utc: string;
  article_url: string;
  tickers: string[];
  image_url?: string;
  description?: string;
  keywords?: string[];
  publisher: {
    name: string;
    homepage_url: string;
    logo_url?: string;
  };
  insights?: Array<{
    ticker: string;
    sentiment: 'positive' | 'negative' | 'neutral';
    sentiment_reasoning: string;
  }>;
}

interface PolygonResponse {
  results: PolygonArticle[];
  status: string;
  count?: number;
}

// Get date string in YYYY-MM-DD format
function getDateString(daysAgo: number = 0): string {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}

// Fetch news for a single ticker from Finnhub
async function fetchTickerNews(
  ticker: string,
  stockName: string,
  finnhubTicker?: string
): Promise<TickerNews> {
  try {
    const fromDate = getDateString(7); // 7 days ago
    const toDate = getDateString(0); // Today

    // Use finnhub_ticker if available, otherwise use original ticker
    const searchTicker = finnhubTicker || ticker;

    const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(
      searchTicker
    )}&from=${fromDate}&to=${toDate}&token=${FINNHUB_API_KEY}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Finnhub API error: ${response.status}`);
    }

    const data: FinnhubArticle[] = await response.json();

    const articles: NewsArticle[] = data.slice(0, 15).map((item, index) => ({
      id: `${ticker}-${item.id || index}-${Date.now()}`,
      title: item.headline || 'No title',
      summary: item.summary || '',
      source: item.source || 'Unknown',
      url: item.url || '',
      publishedAt: item.datetime
        ? new Date(item.datetime * 1000).toISOString()
        : new Date().toISOString(),
      relatedTickers: item.related
        ? item.related.split(',').map((t) => t.trim())
        : [ticker],
      thumbnail: item.image || null,
      sentiment: {
        score: null,
        label: null,
        keywords: [],
      },
    }));

    return {
      ticker,
      stockName,
      articles,
    };
  } catch (error) {
    console.error(`Error fetching news for ${ticker}:`, error);
    return {
      ticker,
      stockName,
      articles: [],
      error: String(error),
    };
  }
}

// Fetch news from Polygon.io (has built-in sentiment)
async function fetchPolygonNews(
  ticker: string,
  stockName: string,
  finnhubTicker?: string
): Promise<NewsArticle[]> {
  if (!POLYGON_API_KEY) {
    console.log('Polygon API key not configured, skipping');
    return [];
  }

  try {
    // Use finnhub_ticker if available (for US tickers)
    const searchTicker = finnhubTicker || ticker;

    // Skip non-US tickers (Polygon only supports US)
    if (searchTicker.includes('.')) {
      console.log(`Skipping Polygon for non-US ticker: ${searchTicker}`);
      return [];
    }

    const url = `https://api.polygon.io/v2/reference/news?ticker=${encodeURIComponent(
      searchTicker
    )}&limit=10&apiKey=${POLYGON_API_KEY}`;

    const response = await fetch(url);

    if (!response.ok) {
      console.error(`Polygon API error: ${response.status}`);
      return [];
    }

    const data: PolygonResponse = await response.json();

    if (!data.results || data.results.length === 0) {
      return [];
    }

    return data.results.map((item, index) => {
      // Find sentiment for this specific ticker from insights
      const tickerInsight = item.insights?.find(
        (i) => i.ticker.toUpperCase() === searchTicker.toUpperCase()
      );

      // Convert Polygon sentiment to our format
      let sentimentScore: number | null = null;
      let sentimentLabel: 'positive' | 'negative' | 'neutral' | null = null;

      if (tickerInsight) {
        sentimentLabel = tickerInsight.sentiment;
        sentimentScore =
          tickerInsight.sentiment === 'positive'
            ? 0.6
            : tickerInsight.sentiment === 'negative'
            ? -0.6
            : 0;
      }

      return {
        id: `polygon-${ticker}-${item.id || index}-${Date.now()}`,
        title: item.title || 'No title',
        summary: item.description || '',
        source: `${item.publisher.name} (via Polygon)`,
        url: item.article_url || '',
        publishedAt: item.published_utc || new Date().toISOString(),
        relatedTickers: item.tickers || [ticker],
        thumbnail: item.image_url || null,
        sentiment: {
          score: sentimentScore,
          label: sentimentLabel,
          keywords: item.keywords || [],
        },
      };
    });
  } catch (error) {
    console.error(`Error fetching Polygon news for ${ticker}:`, error);
    return [];
  }
}

// Enhanced keyword-based sentiment with weighted scoring
function analyzeBasicSentiment(
  title: string,
  summary: string
): {
  score: number;
  label: 'positive' | 'negative' | 'neutral';
  keywords: string[];
} {
  const text = `${title} ${summary}`.toLowerCase();

  // Weighted positive words (weight: impact on score)
  const positiveWords: { word: string; weight: number }[] = [
    // Strong positive signals (weight 2)
    { word: 'surge', weight: 2 },
    { word: 'soar', weight: 2 },
    { word: 'rally', weight: 2 },
    { word: 'record high', weight: 2 },
    { word: 'outperform', weight: 2 },
    { word: 'beat expectations', weight: 2 },
    { word: 'upgrade', weight: 2 },
    { word: 'breakthrough', weight: 2 },
    { word: 'all-time high', weight: 2 },
    // Standard positive (weight 1)
    { word: 'jump', weight: 1 },
    { word: 'gain', weight: 1 },
    { word: 'rise', weight: 1 },
    { word: 'profit', weight: 1 },
    { word: 'growth', weight: 1 },
    { word: 'beat', weight: 1 },
    { word: 'exceed', weight: 1 },
    { word: 'buy', weight: 1 },
    { word: 'bullish', weight: 1 },
    { word: 'success', weight: 1 },
    { word: 'strong', weight: 1 },
    { word: 'boost', weight: 1 },
    { word: 'win', weight: 1 },
    { word: 'positive', weight: 1 },
    { word: 'optimistic', weight: 1 },
    { word: 'momentum', weight: 1 },
    { word: 'recovery', weight: 1 },
    { word: 'expand', weight: 1 },
    { word: 'opportunity', weight: 1 },
  ];

  // Weighted negative words
  const negativeWords: { word: string; weight: number }[] = [
    // Strong negative signals (weight 2)
    { word: 'plunge', weight: 2 },
    { word: 'crash', weight: 2 },
    { word: 'collapse', weight: 2 },
    { word: 'recession', weight: 2 },
    { word: 'bankruptcy', weight: 2 },
    { word: 'fraud', weight: 2 },
    { word: 'investigation', weight: 2 },
    { word: 'default', weight: 2 },
    { word: 'layoffs', weight: 2 },
    // Standard negative (weight 1)
    { word: 'fall', weight: 1 },
    { word: 'drop', weight: 1 },
    { word: 'decline', weight: 1 },
    { word: 'loss', weight: 1 },
    { word: 'miss', weight: 1 },
    { word: 'cut', weight: 1 },
    { word: 'downgrade', weight: 1 },
    { word: 'sell', weight: 1 },
    { word: 'bearish', weight: 1 },
    { word: 'weak', weight: 1 },
    { word: 'fail', weight: 1 },
    { word: 'warning', weight: 1 },
    { word: 'concern', weight: 1 },
    { word: 'risk', weight: 1 },
    { word: 'trouble', weight: 1 },
    { word: 'lawsuit', weight: 1 },
    { word: 'negative', weight: 1 },
    { word: 'slump', weight: 1 },
    { word: 'volatility', weight: 1 },
    { word: 'uncertainty', weight: 1 },
  ];

  const foundPositive: string[] = [];
  const foundNegative: string[] = [];
  let positiveScore = 0;
  let negativeScore = 0;

  // Check title separately (title matches are more important)
  const titleLower = title.toLowerCase();

  positiveWords.forEach(({ word, weight }) => {
    if (text.includes(word)) {
      foundPositive.push(word);
      // Double weight if in title
      positiveScore += titleLower.includes(word) ? weight * 2 : weight;
    }
  });

  negativeWords.forEach(({ word, weight }) => {
    if (text.includes(word)) {
      foundNegative.push(word);
      // Double weight if in title
      negativeScore += titleLower.includes(word) ? weight * 2 : weight;
    }
  });

  // Calculate normalized score (-1 to 1)
  const totalWeight = positiveScore + negativeScore;
  let score = 0;
  if (totalWeight > 0) {
    score = (positiveScore - negativeScore) / totalWeight;
  }

  // Determine label with adjusted thresholds
  let label: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (score > 0.15) label = 'positive';
  else if (score < -0.15) label = 'negative';

  return {
    score: Math.round(score * 100) / 100,
    label,
    keywords: [...foundPositive, ...foundNegative],
  };
}

// Fetch general market news from Finnhub
async function fetchMarketNews(): Promise<NewsArticle[]> {
  const allArticles: NewsArticle[] = [];
  const seenUrls = new Set<string>();

  // Fetch from multiple categories for diverse coverage
  const categories = ['general', 'forex', 'crypto', 'merger'];

  // Get timestamp for 24 hours ago
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

  for (const category of categories) {
    try {
      const url = `https://finnhub.io/api/v1/news?category=${category}&token=${FINNHUB_API_KEY}`;

      const response = await fetch(url);

      if (!response.ok) {
        console.error(`Finnhub API error for ${category}: ${response.status}`);
        continue;
      }

      const data: FinnhubArticle[] = await response.json();

      for (const item of data) {
        // Skip if older than 24 hours
        if (item.datetime * 1000 < oneDayAgo) continue;

        const articleUrl = item.url || '';

        // Skip duplicates
        if (seenUrls.has(articleUrl)) continue;
        seenUrls.add(articleUrl);

        // Detect topic from content
        const matchedTopics = detectTopics(
          item.headline,
          item.summary,
          item.category,
          item.related
        );

        allArticles.push({
          id: `market-${category}-${
            item.id || allArticles.length
          }-${Date.now()}`,
          title: item.headline || 'No title',
          summary: item.summary || '',
          source: item.source || 'Unknown',
          url: articleUrl,
          publishedAt: item.datetime
            ? new Date(item.datetime * 1000).toISOString()
            : new Date().toISOString(),
          relatedTickers: item.related
            ? item.related
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean)
            : [],
          thumbnail: item.image || null,
          sentiment: {
            score: null,
            label: null,
            keywords: [],
          },
          matchedTopics,
        });
      }

      // Small delay between requests to respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error fetching ${category} news:`, error);
    }
  }

  // Sort by date (newest first)
  allArticles.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return allArticles.slice(0, 100); // Return top 100
}

// Detect topics from article content
function detectTopics(
  headline: string,
  summary: string,
  category: string,
  related: string
): string[] {
  const topics: string[] = [];
  const text = `${headline} ${summary}`.toLowerCase();
  const tickers = related ? related.toLowerCase() : '';

  // Category-based topics
  if (category === 'forex') topics.push('Forex');
  if (category === 'crypto') topics.push('Crypto');
  if (category === 'merger') topics.push('M&A');

  // Index detection
  if (text.includes('s&p 500') || text.includes('s&p500'))
    topics.push('S&P 500');
  if (text.includes('nasdaq') || text.includes('tech stocks'))
    topics.push('NASDAQ');
  if (text.includes('dow jones') || text.includes('dow '))
    topics.push('Dow Jones');
  if (text.includes('russell 2000') || text.includes('small cap'))
    topics.push('Russell 2000');

  // Macro
  if (
    text.includes('federal reserve') ||
    text.includes(' fed ') ||
    text.includes('jerome powell')
  )
    topics.push('Fed');
  if (
    text.includes('interest rate') ||
    text.includes('rate hike') ||
    text.includes('rate cut')
  )
    topics.push('Rates');
  if (
    text.includes('inflation') ||
    text.includes(' cpi ') ||
    text.includes('consumer price')
  )
    topics.push('Inflation');
  if (
    text.includes('unemployment') ||
    text.includes('jobs report') ||
    text.includes('nonfarm')
  )
    topics.push('Jobs');
  if (
    text.includes(' gdp ') ||
    text.includes('economic growth') ||
    text.includes('recession')
  )
    topics.push('GDP');
  if (text.includes('treasury') || text.includes('bond yield'))
    topics.push('Treasury');

  // Market events
  if (
    text.includes('earnings') ||
    text.includes('quarterly results') ||
    text.includes('beat estimates')
  )
    topics.push('Earnings');
  if (
    text.includes(' ipo ') ||
    text.includes('initial public offering') ||
    text.includes('goes public')
  )
    topics.push('IPO');
  if (
    text.includes('merger') ||
    text.includes('acquisition') ||
    text.includes('buyout')
  )
    topics.push('M&A');
  if (text.includes('dividend')) topics.push('Dividends');
  if (text.includes('buyback') || text.includes('repurchase'))
    topics.push('Buybacks');

  // Sectors
  if (
    text.includes('artificial intelligence') ||
    text.includes(' ai ') ||
    text.includes('chatgpt') ||
    text.includes('openai')
  )
    topics.push('AI');
  if (
    text.includes('technology') ||
    text.includes('software') ||
    text.includes('cloud computing')
  )
    topics.push('Tech');
  if (
    text.includes('semiconductor') ||
    text.includes('chip') ||
    tickers.includes('nvda') ||
    tickers.includes('amd')
  )
    topics.push('Semis');
  if (
    text.includes('oil') ||
    text.includes('crude') ||
    text.includes('opec') ||
    text.includes('energy')
  )
    topics.push('Energy');
  if (text.includes('bank') || text.includes('financial')) topics.push('Banks');
  if (
    text.includes('healthcare') ||
    text.includes('pharma') ||
    text.includes('biotech')
  )
    topics.push('Healthcare');
  if (
    text.includes('electric vehicle') ||
    text.includes(' ev ') ||
    tickers.includes('tsla')
  )
    topics.push('EV');
  if (text.includes('retail') || text.includes('consumer spending'))
    topics.push('Retail');

  // Global
  if (
    text.includes('wall street') ||
    text.includes('u.s. market') ||
    text.includes('american stocks')
  )
    topics.push('US');
  if (text.includes('china') || text.includes('chinese')) topics.push('China');
  if (text.includes('europe') || text.includes('european'))
    topics.push('Europe');
  if (
    text.includes('japan') ||
    text.includes('nikkei') ||
    text.includes('japanese')
  )
    topics.push('Japan');
  if (text.includes('emerging market') || text.includes('india'))
    topics.push('Emerging');

  // Assets
  if (
    text.includes('bitcoin') ||
    text.includes('crypto') ||
    text.includes('ethereum')
  )
    topics.push('Crypto');
  if (text.includes('gold') || text.includes('precious metal'))
    topics.push('Gold');
  if (
    text.includes('commodity') ||
    text.includes('commodities') ||
    text.includes('copper')
  )
    topics.push('Commodities');

  // Deduplicate
  return [...new Set(topics)];
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get portfolio ID and optional single ticker from request body
    const {
      portfolioId,
      ticker: singleTicker,
      marketNews = false,
      includeBasicSentiment = true,
    } = await req.json().catch(() => ({}));

    // If market news requested, fetch general market news
    if (marketNews) {
      let articles = await fetchMarketNews();

      // Apply basic sentiment if requested
      if (includeBasicSentiment) {
        articles = articles.map((article) => ({
          ...article,
          sentiment: analyzeBasicSentiment(article.title, article.summary),
        }));
      }

      // Calculate stats
      const stats = {
        totalArticles: articles.length,
        byTicker: [] as {
          ticker: string;
          count: number;
          avgSentiment: number | null;
        }[],
        overallSentiment:
          articles.length > 0
            ? articles.reduce((sum, a) => sum + (a.sentiment?.score || 0), 0) /
              articles.length
            : null,
      };

      return new Response(
        JSON.stringify({
          articles: articles.map((a) => ({
            ...a,
            ticker: 'MARKET',
            stockName: 'Market News',
          })),
          byTicker: [],
          stats,
          errors: [],
          isMarketNews: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If single ticker requested, fetch just that
    if (singleTicker) {
      const result = await fetchTickerNews(singleTicker, singleTicker);

      // Also fetch from Polygon (for US tickers)
      const polygonArticles = await fetchPolygonNews(
        singleTicker,
        singleTicker
      );

      // Merge articles, avoiding duplicates by title
      const existingTitles = new Set(
        result.articles.map((a) => a.title.toLowerCase())
      );
      const newPolygonArticles = polygonArticles.filter(
        (a) => !existingTitles.has(a.title.toLowerCase())
      );
      result.articles = [...result.articles, ...newPolygonArticles];

      // Apply basic sentiment if requested (only for articles without Polygon sentiment)
      if (includeBasicSentiment) {
        result.articles = result.articles.map((article) => ({
          ...article,
          sentiment: article.sentiment?.label
            ? article.sentiment // Keep Polygon sentiment if available
            : analyzeBasicSentiment(article.title, article.summary),
        }));
      }

      // Sort by date (newest first)
      result.articles.sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );

      return new Response(JSON.stringify({ data: [result], errors: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get holdings for the portfolio with finnhub_ticker from stocks table
    let holdingsQuery = supabase
      .from('holdings')
      .select('stock_id, ticker, stock_name, stocks(finnhub_ticker)');

    if (portfolioId) {
      holdingsQuery = holdingsQuery.eq('portfolio_id', portfolioId);
    }

    const { data: holdings, error: holdingsError } = await holdingsQuery;

    if (holdingsError) {
      throw new Error(`Failed to fetch holdings: ${holdingsError.message}`);
    }

    if (!holdings || holdings.length === 0) {
      return new Response(
        JSON.stringify({ data: [], errors: ['No holdings found'] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduplicate by ticker and extract finnhub_ticker
    const uniqueHoldings = [
      ...new Map(
        holdings.map((h: any) => [
          h.ticker,
          {
            ticker: h.ticker,
            stock_name: h.stock_name,
            finnhub_ticker: h.stocks?.finnhub_ticker || null,
          },
        ])
      ).values(),
    ] as {
      ticker: string;
      stock_name: string;
      finnhub_ticker: string | null;
    }[];

    // Fetch news for all tickers in parallel
    const results: TickerNews[] = [];
    const errors: string[] = [];

    // Process in batches of 5 to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < uniqueHoldings.length; i += batchSize) {
      const batch = uniqueHoldings.slice(i, i + batchSize);

      // Fetch from both Finnhub and Polygon in parallel
      const batchResults = await Promise.all(
        batch.map(async (holding) => {
          const finnhubResult = await fetchTickerNews(
            holding.ticker,
            holding.stock_name,
            holding.finnhub_ticker || undefined
          );

          // Also fetch from Polygon (for US tickers)
          const polygonArticles = await fetchPolygonNews(
            holding.ticker,
            holding.stock_name,
            holding.finnhub_ticker || undefined
          );

          // Merge articles, avoiding duplicates by title
          const existingTitles = new Set(
            finnhubResult.articles.map((a) => a.title.toLowerCase())
          );
          const newPolygonArticles = polygonArticles.filter(
            (a) => !existingTitles.has(a.title.toLowerCase())
          );
          finnhubResult.articles = [
            ...finnhubResult.articles,
            ...newPolygonArticles,
          ];

          return finnhubResult;
        })
      );

      for (const result of batchResults) {
        // Apply basic sentiment if requested (only for articles without Polygon sentiment)
        if (includeBasicSentiment) {
          result.articles = result.articles.map((article) => ({
            ...article,
            sentiment: article.sentiment?.label
              ? article.sentiment // Keep Polygon sentiment if available
              : analyzeBasicSentiment(article.title, article.summary),
          }));
        }

        results.push(result);
        if (result.error) {
          errors.push(`${result.ticker}: ${result.error}`);
        }
      }

      // Small delay between batches
      if (i + batchSize < uniqueHoldings.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    // Aggregate all articles and sort by date
    const allArticles: (NewsArticle & { ticker: string; stockName: string })[] =
      [];

    for (const result of results) {
      for (const article of result.articles) {
        allArticles.push({
          ...article,
          ticker: result.ticker,
          stockName: result.stockName,
        });
      }
    }

    // Sort by publish date (newest first)
    allArticles.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    // Calculate aggregate stats for future scoring
    const stats = {
      totalArticles: allArticles.length,
      byTicker: results.map((r) => ({
        ticker: r.ticker,
        count: r.articles.length,
        avgSentiment:
          r.articles.length > 0
            ? r.articles.reduce(
                (sum, a) => sum + (a.sentiment?.score || 0),
                0
              ) / r.articles.length
            : null,
      })),
      overallSentiment:
        allArticles.length > 0
          ? allArticles.reduce((sum, a) => sum + (a.sentiment?.score || 0), 0) /
            allArticles.length
          : null,
    };

    return new Response(
      JSON.stringify({
        articles: allArticles,
        byTicker: results,
        stats,
        errors,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in fetch-news function:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
