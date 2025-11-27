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

// Simple keyword-based sentiment (placeholder - can be enhanced with AI later)
function analyzeBasicSentiment(
  title: string,
  summary: string
): {
  score: number;
  label: 'positive' | 'negative' | 'neutral';
  keywords: string[];
} {
  const text = `${title} ${summary}`.toLowerCase();

  const positiveWords = [
    'surge',
    'jump',
    'soar',
    'rally',
    'gain',
    'rise',
    'profit',
    'growth',
    'beat',
    'exceed',
    'upgrade',
    'buy',
    'bullish',
    'record',
    'high',
    'success',
    'strong',
    'boost',
    'win',
    'outperform',
    'positive',
  ];

  const negativeWords = [
    'fall',
    'drop',
    'plunge',
    'crash',
    'decline',
    'loss',
    'miss',
    'cut',
    'downgrade',
    'sell',
    'bearish',
    'low',
    'weak',
    'fail',
    'warning',
    'concern',
    'risk',
    'trouble',
    'layoff',
    'lawsuit',
    'negative',
  ];

  const foundPositive: string[] = [];
  const foundNegative: string[] = [];

  positiveWords.forEach((word) => {
    if (text.includes(word)) foundPositive.push(word);
  });

  negativeWords.forEach((word) => {
    if (text.includes(word)) foundNegative.push(word);
  });

  const score =
    (foundPositive.length - foundNegative.length) /
    Math.max(foundPositive.length + foundNegative.length, 1);

  let label: 'positive' | 'negative' | 'neutral' = 'neutral';
  if (score > 0.2) label = 'positive';
  else if (score < -0.2) label = 'negative';

  return {
    score: Math.round(score * 100) / 100,
    label,
    keywords: [...foundPositive, ...foundNegative],
  };
}

// Fetch general market news
async function fetchMarketNews(): Promise<NewsArticle[]> {
  const marketTopics = [
    // Indexes
    { query: 'S&P 500 stock market', label: 'S&P 500' },
    { query: 'nasdaq composite', label: 'NASDAQ' },
    { query: 'dow jones industrial', label: 'Dow Jones' },
    // Macro
    { query: 'federal reserve interest rates', label: 'Fed' },
    { query: 'inflation CPI consumer prices', label: 'Inflation' },
    { query: 'GDP economic growth', label: 'GDP' },
    { query: 'jobs unemployment employment', label: 'Jobs' },
    // Markets
    { query: 'earnings report quarterly', label: 'Earnings' },
    { query: 'IPO initial public offering', label: 'IPO' },
    { query: 'merger acquisition M&A', label: 'M&A' },
    { query: 'dividend yield payout', label: 'Dividends' },
    // Sectors
    { query: 'artificial intelligence AI tech stocks', label: 'AI & Tech' },
    { query: 'oil crude energy prices', label: 'Oil & Energy' },
    { query: 'bank financial sector', label: 'Banks' },
    { query: 'electric vehicle EV clean energy', label: 'EV & Clean' },
    // Global
    { query: 'China market stocks', label: 'China' },
    { query: 'Europe market stocks', label: 'Europe' },
    { query: 'bitcoin crypto cryptocurrency', label: 'Crypto' },
  ];

  const allArticles: NewsArticle[] = [];
  const seenUrls = new Set<string>();

  for (const topic of marketTopics) {
    try {
      const yahooUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
        topic.query
      )}&newsCount=5&quotesCount=0`;

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
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);

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
        });
      }

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`Error fetching ${topic.label} news:`, error);
    }
  }

  // Sort by date
  allArticles.sort(
    (a, b) =>
      new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return allArticles.slice(0, 50); // Return top 50 (more topics = more articles)
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
