import { useState, useEffect, useCallback } from 'react';
import {
  fetchPortfolioNews,
  fetchMarketNews,
  fetchTickerNews,
  formatRelativeTime,
  getSentimentColor,
  getSentimentLabel,
  type NewsResponse,
  type NewsArticle,
} from '@/services/api/news';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { Button } from '@/components/shared/Button';
import { Tabs } from '@/components/shared/Tabs';
import { BottomSheetSelect } from '@/components/shared/BottomSheet';
import './News.css';

// Market topics - must match backend labels for proper filtering
// label = must exactly match backend topic.label
// keywords = fallback search terms when matchedTopics not available
const MARKET_TOPICS = [
  // Indexes
  {
    id: 'sp500',
    label: 'S&P 500',
    category: 'Indexes',
    keywords: ['s&p', 'sp500', 's&p 500'],
  },
  {
    id: 'nasdaq',
    label: 'NASDAQ',
    category: 'Indexes',
    keywords: ['nasdaq', 'tech stocks'],
  },
  {
    id: 'dow',
    label: 'Dow Jones',
    category: 'Indexes',
    keywords: ['dow', 'dow jones', 'djia'],
  },
  {
    id: 'russell',
    label: 'Russell 2000',
    category: 'Indexes',
    keywords: ['russell', 'small cap'],
  },

  // Macro
  {
    id: 'fed',
    label: 'Fed',
    category: 'Macro',
    keywords: ['fed', 'federal reserve', 'powell', 'fomc'],
  },
  {
    id: 'rates',
    label: 'Rates',
    category: 'Macro',
    keywords: ['interest rate', 'rate hike', 'rate cut', 'basis point'],
  },
  {
    id: 'inflation',
    label: 'Inflation',
    category: 'Macro',
    keywords: ['inflation', 'cpi', 'consumer price', 'pce'],
  },
  {
    id: 'jobs',
    label: 'Jobs',
    category: 'Macro',
    keywords: ['jobs', 'unemployment', 'payroll', 'labor', 'hiring'],
  },
  {
    id: 'gdp',
    label: 'GDP',
    category: 'Macro',
    keywords: ['gdp', 'economic growth', 'recession'],
  },
  {
    id: 'treasury',
    label: 'Treasury',
    category: 'Macro',
    keywords: ['treasury', 'bond yield', '10-year', 'yield'],
  },

  // Markets
  {
    id: 'earnings',
    label: 'Earnings',
    category: 'Markets',
    keywords: ['earnings', 'quarterly', 'eps', 'revenue', 'results'],
  },
  {
    id: 'ipo',
    label: 'IPO',
    category: 'Markets',
    keywords: ['ipo', 'initial public offering', 'debut'],
  },
  {
    id: 'ma',
    label: 'M&A',
    category: 'Markets',
    keywords: ['merger', 'acquisition', 'deal', 'buyout', 'takeover'],
  },
  {
    id: 'dividends',
    label: 'Dividends',
    category: 'Markets',
    keywords: ['dividend', 'payout', 'yield'],
  },
  {
    id: 'buyback',
    label: 'Buybacks',
    category: 'Markets',
    keywords: ['buyback', 'repurchase', 'share repurchase'],
  },

  // Sectors
  {
    id: 'ai',
    label: 'AI',
    category: 'Sectors',
    keywords: [
      'artificial intelligence',
      ' ai ',
      'chatgpt',
      'openai',
      'machine learning',
    ],
  },
  {
    id: 'tech',
    label: 'Tech',
    category: 'Sectors',
    keywords: ['technology', 'software', 'cloud', 'saas'],
  },
  {
    id: 'semis',
    label: 'Semis',
    category: 'Sectors',
    keywords: ['semiconductor', 'chip', 'nvidia', 'amd', 'intel', 'tsmc'],
  },
  {
    id: 'energy',
    label: 'Energy',
    category: 'Sectors',
    keywords: ['oil', 'crude', 'energy', 'gas', 'opec', 'exxon'],
  },
  {
    id: 'banks',
    label: 'Banks',
    category: 'Sectors',
    keywords: ['bank', 'financial', 'jpmorgan', 'goldman', 'wells fargo'],
  },
  {
    id: 'healthcare',
    label: 'Healthcare',
    category: 'Sectors',
    keywords: ['healthcare', 'pharma', 'biotech', 'drug', 'fda'],
  },
  {
    id: 'ev',
    label: 'EV',
    category: 'Sectors',
    keywords: [
      'electric vehicle',
      ' ev ',
      'tesla',
      'rivian',
      'lucid',
      'charging',
    ],
  },
  {
    id: 'retail',
    label: 'Retail',
    category: 'Sectors',
    keywords: ['retail', 'consumer', 'walmart', 'amazon', 'target', 'shopping'],
  },

  // Global
  {
    id: 'us',
    label: 'US',
    category: 'Global',
    keywords: ['wall street', 'u.s.', 'united states', 'american'],
  },
  {
    id: 'china',
    label: 'China',
    category: 'Global',
    keywords: ['china', 'chinese', 'beijing', 'shanghai', 'alibaba', 'tencent'],
  },
  {
    id: 'europe',
    label: 'Europe',
    category: 'Global',
    keywords: ['europe', 'european', 'ecb', 'germany', 'france', 'uk'],
  },
  {
    id: 'japan',
    label: 'Japan',
    category: 'Global',
    keywords: ['japan', 'japanese', 'nikkei', 'yen', 'tokyo'],
  },
  {
    id: 'emerging',
    label: 'Emerging',
    category: 'Global',
    keywords: ['emerging market', 'india', 'brazil', 'developing'],
  },

  // Assets
  {
    id: 'crypto',
    label: 'Crypto',
    category: 'Assets',
    keywords: [
      'bitcoin',
      'crypto',
      'ethereum',
      'btc',
      'eth',
      'blockchain',
      'coinbase',
    ],
  },
  {
    id: 'gold',
    label: 'Gold',
    category: 'Assets',
    keywords: ['gold', 'precious metal', 'silver', 'bullion'],
  },
  {
    id: 'commodities',
    label: 'Commodities',
    category: 'Assets',
    keywords: ['commodity', 'commodities', 'copper', 'wheat', 'corn'],
  },
];

// Get unique categories
const TOPIC_CATEGORIES = [...new Set(MARKET_TOPICS.map((t) => t.category))];

interface NewsProps {
  portfolioId?: string;
}

type NewsMode = 'portfolio' | 'market' | 'stock';

export function News({ portfolioId }: NewsProps) {
  const [newsData, setNewsData] = useState<NewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTicker, setFilterTicker] = useState<string>('all');
  const [filterSentiment, setFilterSentiment] = useState<string>('all');
  const [filterTopic, setFilterTopic] = useState<string>('all');
  const [newsMode, setNewsMode] = useState<NewsMode>('portfolio');
  const [showTopics, setShowTopics] = useState(false);
  // Stock search state
  const [searchTicker, setSearchTicker] = useState('');
  const [searchedTicker, setSearchedTicker] = useState<string | null>(null);

  const loadNews = useCallback(async () => {
    // For stock mode, don't auto-load - wait for user to search
    if (newsMode === 'stock' && !searchedTicker) {
      setLoading(false);
      setNewsData(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let data: NewsResponse;
      if (newsMode === 'market') {
        data = await fetchMarketNews();
      } else if (newsMode === 'stock' && searchedTicker) {
        // Fetch single ticker news
        const tickerData = await fetchTickerNews(searchedTicker);
        if (tickerData) {
          data = {
            articles: tickerData.articles.map((a) => ({
              ...a,
              ticker: tickerData.ticker,
              stockName: tickerData.stockName,
            })),
            byTicker: [tickerData],
            stats: {
              totalArticles: tickerData.articles.length,
              byTicker: [
                {
                  ticker: tickerData.ticker,
                  count: tickerData.articles.length,
                  avgSentiment:
                    tickerData.articles.length > 0
                      ? tickerData.articles.reduce(
                          (sum, a) => sum + (a.sentiment?.score || 0),
                          0
                        ) / tickerData.articles.length
                      : null,
                },
              ],
              overallSentiment:
                tickerData.articles.length > 0
                  ? tickerData.articles.reduce(
                      (sum, a) => sum + (a.sentiment?.score || 0),
                      0
                    ) / tickerData.articles.length
                  : null,
            },
            errors: tickerData.error ? [tickerData.error] : [],
          };
        } else {
          data = {
            articles: [],
            byTicker: [],
            stats: { totalArticles: 0, byTicker: [], overallSentiment: null },
            errors: ['No news found'],
          };
        }
      } else {
        data = await fetchPortfolioNews(portfolioId);
      }

      setNewsData(data);
      setFilterTicker('all');
      setFilterTopic('all');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load news');
    } finally {
      setLoading(false);
    }
  }, [portfolioId, newsMode, searchedTicker]);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

  // Handle stock ticker search
  const handleTickerSearch = () => {
    const ticker = searchTicker.trim().toUpperCase();
    if (ticker) {
      setSearchedTicker(ticker);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTickerSearch();
    }
  };

  // Filter articles
  const filteredArticles =
    newsData?.articles.filter((article) => {
      if (filterTicker !== 'all' && article.ticker !== filterTicker) {
        return false;
      }
      if (filterSentiment !== 'all') {
        const label = article.sentiment?.label || 'neutral';
        if (label !== filterSentiment) {
          return false;
        }
      }
      // Topic filter for market mode - use backend matchedTopics + keyword fallback
      if (newsMode === 'market' && filterTopic !== 'all') {
        const topic = MARKET_TOPICS.find((t) => t.id === filterTopic);
        if (topic) {
          // Primary: check if backend matched this topic
          if (article.matchedTopics?.includes(topic.label)) {
            return true;
          }
          // Fallback: keyword search in text using topic.keywords
          const text = `${article.title} ${article.summary}`.toLowerCase();
          if (topic.keywords.some((kw) => text.includes(kw.toLowerCase()))) {
            return true;
          }
          return false;
        }
      }
      return true;
    }) || [];

  // Get unique tickers for filter
  const uniqueTickers = newsData
    ? [
        ...new Set(
          newsData.articles.map((a) => a.ticker).filter((t) => t !== 'MARKET')
        ),
      ]
    : [];

  if (loading) {
    return (
      <div className="news-container">
        <div className="news-loading">
          <div className="loading-spinner"></div>
          <p>Loading news...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="news-container">
        <div className="news-error">
          <h3>❌ Error loading news</h3>
          <p>{error}</p>
          <Button variant="primary" onClick={loadNews}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="news-container">
      {/* Header */}
      <div className="news-header">
        <div className="news-title-section">
          <h2>
            {newsMode === 'market'
              ? 'Market News'
              : newsMode === 'stock'
              ? 'Stock News'
              : 'Portfolio News'}
            {newsMode === 'stock' && searchedTicker && ` - ${searchedTicker}`}
          </h2>
          <InfoTooltip text="Portfolio = zprávy o akciích ve vašem portfoliu. Market = obecné zprávy z trhu. Stock = vyhledej zprávy pro konkrétní ticker." />
        </div>
        <div className="news-header-actions">
          <Tabs
            value={newsMode}
            onChange={(value) => {
              setNewsMode(value as NewsMode);
              if (value !== 'stock') {
                setSearchedTicker(null);
                setSearchTicker('');
              }
            }}
            options={[
              { value: 'portfolio', label: 'Portfolio' },
              { value: 'market', label: 'Market' },
              { value: 'stock', label: 'Stock' },
            ]}
          />
          {newsMode !== 'stock' && (
            <Button variant="outline" onClick={loadNews} disabled={loading}>
              Refresh
            </Button>
          )}
        </div>
      </div>

      {/* Stock Search - only for stock mode */}
      {newsMode === 'stock' && (
        <div className="stock-search-section">
          <div className="stock-search-input-group">
            <input
              type="text"
              value={searchTicker}
              onChange={(e) => setSearchTicker(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="Enter ticker (e.g. AAPL, MSFT, TSLA)"
              className="stock-search-input"
              maxLength={10}
            />
            <Button
              variant="primary"
              onClick={handleTickerSearch}
              disabled={loading || !searchTicker.trim()}
            >
              {loading ? 'Loading...' : 'Search'}
            </Button>
          </div>
          {searchedTicker && newsData && (
            <div className="stock-search-result">
              Found {newsData.stats.totalArticles} articles for{' '}
              <strong>{searchedTicker}</strong>
            </div>
          )}
        </div>
      )}

      {/* Stats Overview - hidden on mobile */}
      {newsData && (
        <div className="news-stats desktop-only">
          <div className="stat-card">
            <span className="stat-value">{newsData.stats.totalArticles}</span>
            <span className="stat-label">Total Articles</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">
              {newsMode === 'market'
                ? MARKET_TOPICS.length
                : uniqueTickers.length}
            </span>
            <span className="stat-label">
              {newsMode === 'market' ? 'Topics Tracked' : 'Stocks Covered'}
            </span>
          </div>
          <div className="stat-card">
            <span
              className="stat-value"
              style={{
                color: getSentimentColor(newsData.stats.overallSentiment),
              }}
            >
              {newsData.stats.overallSentiment !== null
                ? (newsData.stats.overallSentiment > 0 ? '+' : '') +
                  (newsData.stats.overallSentiment * 100).toFixed(0) +
                  '%'
                : 'N/A'}
            </span>
            <span className="stat-label">Avg Sentiment</span>
          </div>
        </div>
      )}

      {/* Filters - shared between modes */}
      <div className="news-filters">
        {newsMode === 'portfolio' && uniqueTickers.length > 0 && (
          <BottomSheetSelect
            value={filterTicker}
            onChange={setFilterTicker}
            options={[
              { value: 'all', label: 'All Stocks' },
              ...uniqueTickers.map((ticker) => ({
                value: ticker,
                label: ticker,
              })),
            ]}
            label="Stock"
            title="Filter by Stock"
          />
        )}
        <BottomSheetSelect
          value={filterSentiment}
          onChange={setFilterSentiment}
          options={[
            { value: 'all', label: 'All Sentiment' },
            { value: 'positive', label: '📈 Positive' },
            { value: 'neutral', label: '➡️ Neutral' },
            { value: 'negative', label: '📉 Negative' },
          ]}
          label="Sentiment"
          title="Filter by Sentiment"
        />
        <div className="filter-results">
          {filteredArticles.length} / {newsData?.stats.totalArticles || 0}
        </div>
      </div>

      {/* Market Topics - only for market mode */}
      {newsMode === 'market' && newsData && (
        <div className="market-topics-compact">
          {TOPIC_CATEGORIES.map((category) => (
            <div key={category} className="topic-row">
              <span className="topic-row-label">{category}</span>
              <div className="topic-chips">
                {MARKET_TOPICS.filter((t) => t.category === category).map(
                  (topic) => {
                    // Count articles matching this topic (via backend matchedTopics + keyword fallback)
                    const count = newsData.articles.filter((a) => {
                      // Check backend matchedTopics first
                      if (a.matchedTopics?.includes(topic.label)) {
                        return true;
                      }
                      // Fallback: keyword search using topic.keywords
                      const text = `${a.title} ${a.summary}`.toLowerCase();
                      return topic.keywords.some((kw) =>
                        text.includes(kw.toLowerCase())
                      );
                    }).length;
                    const isActive = filterTopic === topic.id;
                    return (
                      <button
                        key={topic.id}
                        className={`topic-chip ${isActive ? 'active' : ''} ${
                          count === 0 ? 'empty' : ''
                        }`}
                        onClick={() =>
                          setFilterTopic(isActive ? 'all' : topic.id)
                        }
                      >
                        {topic.label}
                        {count > 0 && (
                          <span className="chip-count">{count}</span>
                        )}
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Ticker Sentiment Summary - only for portfolio mode */}
      {newsMode === 'portfolio' &&
        newsData &&
        newsData.stats.byTicker.length > 0 && (
          <div className="ticker-sentiment-section">
            <button
              className="topics-toggle mobile-only"
              onClick={() => setShowTopics(!showTopics)}
            >
              <span>
                Stocks (
                {newsData.stats.byTicker.filter((t) => t.count > 0).length})
              </span>
              <span className="toggle-icon">{showTopics ? '▲' : '▼'}</span>
            </button>
            <div
              className={`ticker-sentiment-grid ${
                showTopics ? 'expanded' : ''
              }`}
            >
              {newsData.stats.byTicker
                .filter((t) => t.count > 0)
                .sort((a, b) => (b.avgSentiment || 0) - (a.avgSentiment || 0))
                .map((ticker) => (
                  <div
                    key={ticker.ticker}
                    className="ticker-sentiment-card"
                    onClick={() => setFilterTicker(ticker.ticker)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="ticker-name">{ticker.ticker}</span>
                    <span
                      className="ticker-sentiment"
                      style={{ color: getSentimentColor(ticker.avgSentiment) }}
                    >
                      {ticker.avgSentiment !== null
                        ? (ticker.avgSentiment > 0 ? '+' : '') +
                          (ticker.avgSentiment * 100).toFixed(0) +
                          '%'
                        : 'N/A'}
                    </span>
                    <span className="ticker-count">
                      {ticker.count} articles
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

      {/* Articles List */}
      <div className="articles-list">
        {filteredArticles.length === 0 ? (
          <div className="no-articles">
            <p>No articles found matching your filters.</p>
          </div>
        ) : (
          filteredArticles.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))
        )}
      </div>
    </div>
  );
}

// Article Card Component
function ArticleCard({
  article,
}: {
  article: NewsArticle & { ticker?: string; stockName?: string };
}) {
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="article-card"
    >
      {article.thumbnail && (
        <div className="article-thumbnail">
          <img src={article.thumbnail} alt="" loading="lazy" />
        </div>
      )}
      <div className="article-content">
        <div className="article-meta">
          {article.ticker && (
            <span className="article-ticker">{article.ticker}</span>
          )}
          <span className="article-source">{article.source}</span>
          <span className="article-time">
            {formatRelativeTime(article.publishedAt)}
          </span>
          {article.sentiment && (
            <span
              className={`article-sentiment ${
                article.sentiment.label || 'neutral'
              }`}
              style={{ color: getSentimentColor(article.sentiment.score) }}
            >
              {getSentimentLabel(article.sentiment.label)}
            </span>
          )}
        </div>
        <h3 className="article-title">{article.title}</h3>
        {article.summary && (
          <p className="article-summary">{article.summary}</p>
        )}
        {article.sentiment?.keywords &&
          article.sentiment.keywords.length > 0 && (
            <div className="article-keywords">
              {article.sentiment.keywords.slice(0, 5).map((keyword, idx) => (
                <span key={idx} className="keyword-tag">
                  {keyword}
                </span>
              ))}
            </div>
          )}
      </div>
    </a>
  );
}

export default News;
