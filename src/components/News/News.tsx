import { useState, useEffect, useCallback } from 'react';
import {
  fetchPortfolioNews,
  fetchMarketNews,
  formatRelativeTime,
  getSentimentColor,
  getSentimentLabel,
  type NewsResponse,
  type NewsArticle,
} from '@/services/api/news';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { Button } from '@/components/shared/Button';
import { Tabs } from '@/components/shared/Tabs';
import './News.css';

// Market topics organized by category
const MARKET_TOPICS = [
  // Main Indexes
  {
    id: 'sp500',
    label: 'S&P 500',
    keyword: 'S&P',
    icon: '📊',
    category: 'Indexes',
  },
  {
    id: 'nasdaq',
    label: 'NASDAQ',
    keyword: 'NASDAQ',
    icon: '💻',
    category: 'Indexes',
  },
  {
    id: 'dowjones',
    label: 'Dow Jones',
    keyword: 'Dow Jones',
    icon: '📈',
    category: 'Indexes',
  },

  // Macro
  {
    id: 'fed',
    label: 'Fed & Rates',
    keyword: 'Fed',
    icon: '🏛️',
    category: 'Macro',
  },
  {
    id: 'inflation',
    label: 'Inflation',
    keyword: 'inflation CPI',
    icon: '💹',
    category: 'Macro',
  },
  {
    id: 'gdp',
    label: 'GDP',
    keyword: 'GDP growth',
    icon: '📊',
    category: 'Macro',
  },
  {
    id: 'jobs',
    label: 'Jobs',
    keyword: 'jobs unemployment',
    icon: '💼',
    category: 'Macro',
  },

  // Markets
  {
    id: 'earnings',
    label: 'Earnings',
    keyword: 'earnings report',
    icon: '📈',
    category: 'Markets',
  },
  { id: 'ipo', label: 'IPO', keyword: 'IPO', icon: '📅', category: 'Markets' },
  {
    id: 'mergers',
    label: 'M&A',
    keyword: 'merger acquisition',
    icon: '🔀',
    category: 'Markets',
  },
  {
    id: 'dividends',
    label: 'Dividends',
    keyword: 'dividend',
    icon: '💰',
    category: 'Markets',
  },

  // Sectors
  {
    id: 'tech',
    label: 'AI & Tech',
    keyword: 'artificial intelligence tech',
    icon: '🤖',
    category: 'Sectors',
  },
  {
    id: 'energy',
    label: 'Oil & Energy',
    keyword: 'oil energy',
    icon: '🛢️',
    category: 'Sectors',
  },
  {
    id: 'banks',
    label: 'Banks',
    keyword: 'bank financial',
    icon: '🏦',
    category: 'Sectors',
  },
  {
    id: 'ev',
    label: 'EV & Clean',
    keyword: 'electric vehicle clean energy',
    icon: '🔋',
    category: 'Sectors',
  },

  // Global
  {
    id: 'china',
    label: 'China',
    keyword: 'China market',
    icon: '🇨🇳',
    category: 'Global',
  },
  {
    id: 'europe',
    label: 'Europe',
    keyword: 'Europe market',
    icon: '🇪🇺',
    category: 'Global',
  },
  {
    id: 'crypto',
    label: 'Crypto',
    keyword: 'bitcoin crypto',
    icon: '₿',
    category: 'Global',
  },
];

// Get unique categories
const TOPIC_CATEGORIES = [...new Set(MARKET_TOPICS.map((t) => t.category))];

interface NewsProps {
  portfolioId?: string;
}

type NewsMode = 'portfolio' | 'market';

export function News({ portfolioId }: NewsProps) {
  const [newsData, setNewsData] = useState<NewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTicker, setFilterTicker] = useState<string>('all');
  const [filterSentiment, setFilterSentiment] = useState<string>('all');
  const [filterTopic, setFilterTopic] = useState<string>('all');
  const [newsMode, setNewsMode] = useState<NewsMode>('portfolio');

  const loadNews = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data =
        newsMode === 'market'
          ? await fetchMarketNews()
          : await fetchPortfolioNews(portfolioId);
      setNewsData(data);
      setFilterTicker('all');
      setFilterTopic('all'); // Reset filters when switching modes
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load news');
    } finally {
      setLoading(false);
    }
  }, [portfolioId, newsMode]);

  useEffect(() => {
    loadNews();
  }, [loadNews]);

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
      // Topic filter for market mode
      if (newsMode === 'market' && filterTopic !== 'all') {
        const topic = MARKET_TOPICS.find((t) => t.id === filterTopic);
        if (topic) {
          const text = `${article.title} ${article.summary}`.toLowerCase();
          const keywords = topic.keyword.toLowerCase().split(' ');
          if (!keywords.some((kw) => text.includes(kw))) {
            return false;
          }
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
          <h2>{newsMode === 'market' ? 'Market News' : 'Portfolio News'}</h2>
          <InfoTooltip text="Aktuální zprávy o akciích. Portfolio News = zprávy o akciích ve vašem portfoliu. Market News = obecné zprávy z trhu (S&P 500, NASDAQ, Fed, earnings). Sentiment je analyzován pomocí klíčových slov." />
        </div>
        <div className="news-header-actions">
          <Tabs
            value={newsMode}
            onChange={(value) => setNewsMode(value as NewsMode)}
            options={[
              { value: 'portfolio', label: 'Portfolio' },
              { value: 'market', label: 'Market' },
            ]}
          />
          <Button variant="outline" onClick={loadNews} disabled={loading}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      {newsData && (
        <div className="news-stats">
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

      {/* Market Topics Overview - only for market mode */}
      {newsMode === 'market' && newsData && (
        <div className="market-topics-section">
          {TOPIC_CATEGORIES.map((category) => (
            <div key={category} className="topic-category">
              <h4 className="topic-category-title">{category}</h4>
              <div className="market-topics-grid">
                {MARKET_TOPICS.filter((t) => t.category === category).map(
                  (topic) => {
                    const keywords = topic.keyword.toLowerCase().split(' ');
                    const topicArticles = newsData.articles.filter((a) => {
                      const text = `${a.title} ${a.summary}`.toLowerCase();
                      return keywords.some((kw) => text.includes(kw));
                    });
                    const avgSentiment =
                      topicArticles.length > 0
                        ? topicArticles.reduce(
                            (sum, a) => sum + (a.sentiment?.score || 0),
                            0
                          ) / topicArticles.length
                        : null;
                    const isActive = filterTopic === topic.id;
                    return (
                      <div
                        key={topic.id}
                        className={`market-topic-card ${
                          isActive ? 'active' : ''
                        }`}
                        onClick={() =>
                          setFilterTopic(isActive ? 'all' : topic.id)
                        }
                        style={{ cursor: 'pointer' }}
                      >
                        <span className="topic-icon">{topic.icon}</span>
                        <span className="topic-name">{topic.label}</span>
                        <span
                          className="topic-sentiment"
                          style={{ color: getSentimentColor(avgSentiment) }}
                        >
                          {avgSentiment !== null
                            ? (avgSentiment > 0 ? '+' : '') +
                              (avgSentiment * 100).toFixed(0) +
                              '%'
                            : '—'}
                        </span>
                        <span className="topic-count">
                          {topicArticles.length}
                        </span>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          ))}
          {filterTopic !== 'all' && (
            <button
              className="clear-filter-btn"
              onClick={() => setFilterTopic('all')}
            >
              ✕ Clear filter:{' '}
              {MARKET_TOPICS.find((t) => t.id === filterTopic)?.label}
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="news-filters">
        {newsMode === 'portfolio' && uniqueTickers.length > 0 && (
          <div className="filter-group">
            <label>Stock:</label>
            <select
              value={filterTicker}
              onChange={(e) => setFilterTicker(e.target.value)}
            >
              <option value="all">All Stocks</option>
              {uniqueTickers.map((ticker) => (
                <option key={ticker} value={ticker}>
                  {ticker}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="filter-group">
          <label>Sentiment:</label>
          <select
            value={filterSentiment}
            onChange={(e) => setFilterSentiment(e.target.value)}
          >
            <option value="all">All</option>
            <option value="positive">📈 Positive</option>
            <option value="neutral">➡️ Neutral</option>
            <option value="negative">📉 Negative</option>
          </select>
        </div>
        <div className="filter-results">
          Showing {filteredArticles.length} of{' '}
          {newsData?.stats.totalArticles || 0} articles
        </div>
      </div>

      {/* Ticker Sentiment Summary - only for portfolio mode */}
      {newsMode === 'portfolio' &&
        newsData &&
        newsData.stats.byTicker.length > 0 && (
          <div className="ticker-sentiment-grid">
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
                  <span className="ticker-count">{ticker.count} articles</span>
                </div>
              ))}
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
