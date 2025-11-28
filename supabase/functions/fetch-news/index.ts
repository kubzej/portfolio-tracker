// Supabase Edge Function for fetching news articles
// Fetches news from Yahoo Finance for portfolio stocks
// Deploy with: supabase functions deploy fetch-news

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

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

// Fetch news for a single ticker from Yahoo Finance
async function fetchTickerNews(
  ticker: string,
  stockName: string
): Promise<TickerNews> {
  try {
    // Yahoo Finance news endpoint
    const yahooUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      ticker
    )}&newsCount=10&quotesCount=0`;

    const response = await fetch(yahooUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`Yahoo Finance API error: ${response.status}`);
    }

    const data = await response.json();
    const news = data?.news || [];

    const articles: NewsArticle[] = news.map((item: any, index: number) => ({
      id: `${ticker}-${index}-${Date.now()}`,
      title: item.title || 'No title',
      summary: item.summary || '',
      source: item.publisher || 'Unknown',
      url: item.link || '',
      publishedAt: item.providerPublishTime
        ? new Date(item.providerPublishTime * 1000).toISOString()
        : new Date().toISOString(),
      relatedTickers: item.relatedTickers || [ticker],
      thumbnail: item.thumbnail?.resolutions?.[0]?.url || null,
      // Placeholder for future sentiment analysis
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

// Fetch general market news
async function fetchMarketNews(): Promise<NewsArticle[]> {
  // Market topics with search queries and labels for tagging
  const marketTopics = [
    // Main Indexes - priority
    { query: 'S&P 500 index stock market', label: 'S&P 500', priority: 1 },
    { query: 'nasdaq composite tech stocks', label: 'NASDAQ', priority: 1 },
    { query: 'dow jones industrial average', label: 'Dow Jones', priority: 1 },
    { query: 'russell 2000 small cap', label: 'Russell 2000', priority: 2 },

    // Macro - high priority
    {
      query: 'federal reserve interest rate decision',
      label: 'Fed',
      priority: 1,
    },
    { query: 'interest rate hike cut fed', label: 'Rates', priority: 1 },
    { query: 'inflation CPI consumer prices', label: 'Inflation', priority: 1 },
    { query: 'jobs unemployment nonfarm payroll', label: 'Jobs', priority: 1 },
    { query: 'GDP economic growth recession', label: 'GDP', priority: 2 },
    { query: 'treasury bond yield 10 year', label: 'Treasury', priority: 2 },

    // Markets events
    {
      query: 'earnings report quarterly results',
      label: 'Earnings',
      priority: 1,
    },
    { query: 'IPO initial public offering', label: 'IPO', priority: 2 },
    { query: 'merger acquisition deal buyout', label: 'M&A', priority: 2 },
    {
      query: 'dividend yield payout increase',
      label: 'Dividends',
      priority: 2,
    },
    { query: 'stock buyback share repurchase', label: 'Buybacks', priority: 2 },

    // Sectors - hot topics
    { query: 'artificial intelligence AI stocks', label: 'AI', priority: 1 },
    { query: 'technology sector software cloud', label: 'Tech', priority: 1 },
    {
      query: 'semiconductor chip nvidia amd intel',
      label: 'Semis',
      priority: 1,
    },
    { query: 'oil crude energy prices opec', label: 'Energy', priority: 2 },
    { query: 'bank financial sector earnings', label: 'Banks', priority: 2 },
    {
      query: 'healthcare pharma biotech stocks',
      label: 'Healthcare',
      priority: 2,
    },
    { query: 'electric vehicle EV tesla rivian', label: 'EV', priority: 2 },
    {
      query: 'retail consumer spending earnings',
      label: 'Retail',
      priority: 2,
    },

    // Global markets
    { query: 'US stock market wall street', label: 'US', priority: 1 },
    { query: 'China stocks market economy', label: 'China', priority: 2 },
    { query: 'Europe stocks market economy', label: 'Europe', priority: 2 },
    { query: 'Japan stocks nikkei yen', label: 'Japan', priority: 2 },
    { query: 'emerging market stocks india', label: 'Emerging', priority: 2 },

    // Assets
    {
      query: 'bitcoin crypto cryptocurrency ethereum',
      label: 'Crypto',
      priority: 2,
    },
    { query: 'gold price precious metals', label: 'Gold', priority: 2 },
    { query: 'commodity prices copper oil', label: 'Commodities', priority: 2 },
  ];

  const allArticles: NewsArticle[] = [];
  const seenUrls = new Set<string>();
  const articleTopics = new Map<string, string[]>(); // URL -> topics

  // Sort by priority - fetch priority 1 first with more articles
  const sortedTopics = [...marketTopics].sort(
    (a, b) => (a.priority || 2) - (b.priority || 2)
  );

  for (const topic of sortedTopics) {
    try {
      // Priority 1 topics get more articles
      const newsCount = topic.priority === 1 ? 8 : 5;
      const yahooUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
        topic.query
      )}&newsCount=${newsCount}&quotesCount=0`;

      const response = await fetch(yahooUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });

      if (!response.ok) continue;

      const data = await response.json();
      const news = data?.news || [];

      for (const item of news) {
        const url = item.link || '';

        // Track which topics this article matches
        if (seenUrls.has(url)) {
          // Article already exists - add this topic to its list
          const existing = articleTopics.get(url);
          if (existing && !existing.includes(topic.label)) {
            existing.push(topic.label);
          }
          continue;
        }

        seenUrls.add(url);
        articleTopics.set(url, [topic.label]);

        allArticles.push({
          id: `market-${topic.label}-${allArticles.length}-${Date.now()}`,
          title: item.title || 'No title',
          summary: item.summary || '',
          source: item.publisher || 'Unknown',
          url,
          publishedAt: item.providerPublishTime
            ? new Date(item.providerPublishTime * 1000).toISOString()
            : new Date().toISOString(),
          relatedTickers: item.relatedTickers || [],
          thumbnail: item.thumbnail?.resolutions?.[0]?.url || null,
          sentiment: {
            score: null,
            label: null,
            keywords: [],
          },
          // Store matched topics from backend search
          matchedTopics: [topic.label],
        });
      }

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error fetching ${topic.label} news:`, error);
    }
  }

  // Update articles with all matched topics
  for (const article of allArticles) {
    const topics = articleTopics.get(article.url);
    if (topics) {
      (article as any).matchedTopics = topics;
    }
  }

  // Sort by date
  allArticles.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return allArticles.slice(0, 100); // Return top 100 for more coverage
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

      // Apply basic sentiment if requested
      if (includeBasicSentiment) {
        result.articles = result.articles.map((article) => ({
          ...article,
          sentiment: analyzeBasicSentiment(article.title, article.summary),
        }));
      }

      return new Response(JSON.stringify({ data: [result], errors: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get holdings for the portfolio
    let holdingsQuery = supabase
      .from('holdings')
      .select('stock_id, ticker, stock_name');

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

    // Deduplicate by ticker
    const uniqueHoldings = [
      ...new Map(holdings.map((h: any) => [h.ticker, h])).values(),
    ] as { ticker: string; stock_name: string }[];

    // Fetch news for all tickers in parallel
    const results: TickerNews[] = [];
    const errors: string[] = [];

    // Process in batches of 5 to avoid rate limiting
    const batchSize = 5;
    for (let i = 0; i < uniqueHoldings.length; i += batchSize) {
      const batch = uniqueHoldings.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((holding) =>
          fetchTickerNews(holding.ticker, holding.stock_name)
        )
      );

      for (const result of batchResults) {
        // Apply basic sentiment if requested
        if (includeBasicSentiment) {
          result.articles = result.articles.map((article) => ({
            ...article,
            sentiment: analyzeBasicSentiment(article.title, article.summary),
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
