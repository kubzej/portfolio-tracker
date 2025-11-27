import { useState, useEffect } from 'react';
import {
  fetchAnalystData,
  type AnalystData,
  type FundamentalMetrics,
} from '@/services/api/analysis';
import { holdingsApi } from '@/services/api';
import './Analysis.css';

interface AnalysisProps {
  portfolioId: string | null;
}

interface EnrichedAnalystData extends AnalystData {
  weight: number;
  currentValue: number;
  totalShares: number;
  avgBuyPrice: number;
  totalInvested: number;
  unrealizedGain: number;
  gainPercentage: number;
}

type SortKey =
  | 'ticker'
  | 'weight'
  | 'currentPrice'
  | 'priceChangePercent'
  | 'numberOfAnalysts'
  | 'peRatio'
  | 'beta'
  | 'roe'
  | 'dividendYield'
  | 'insiderMspr';

type TabType = 'analysts' | 'fundamentals' | 'technicals';

export function Analysis({ portfolioId }: AnalysisProps) {
  const [analystData, setAnalystData] = useState<EnrichedAnalystData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('weight');
  const [sortAsc, setSortAsc] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('analysts');

  useEffect(() => {
    loadData();
  }, [portfolioId]);

  const loadData = async () => {
    if (!portfolioId) {
      setError('Please select a portfolio to view analysis');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch both analyst data and portfolio summary in parallel
      const [analysisResult, holdings] = await Promise.all([
        fetchAnalystData(portfolioId),
        holdingsApi.getPortfolioSummary(portfolioId),
      ]);

      // Calculate total portfolio value
      const totalValue = holdings.reduce(
        (sum, h) => sum + (h.current_value_czk || h.total_invested_czk || 0),
        0
      );

      // Merge analyst data with holdings data
      const enriched: EnrichedAnalystData[] = analysisResult.data
        .map((analyst) => {
          const holding = holdings.find((h) => h.ticker === analyst.ticker);
          if (!holding) return null;

          const currentValue =
            holding.current_value_czk || holding.total_invested_czk || 0;
          const weight = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;

          return {
            ...analyst,
            weight,
            currentValue,
            totalShares: holding.total_shares,
            avgBuyPrice: holding.avg_buy_price,
            totalInvested: holding.total_invested_czk,
            unrealizedGain: holding.unrealized_gain || 0,
            gainPercentage: holding.gain_percentage || 0,
          };
        })
        .filter((item): item is EnrichedAnalystData => item !== null);

      setAnalystData(enriched);

      if (analysisResult.errors.length > 0) {
        console.warn('Analysis errors:', analysisResult.errors);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load analysis data'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const getSortValue = (
    item: EnrichedAnalystData,
    key: SortKey
  ): string | number => {
    switch (key) {
      case 'ticker':
        return item.ticker;
      case 'weight':
        return item.weight;
      case 'currentPrice':
        return item.currentPrice ?? 0;
      case 'priceChangePercent':
        return item.priceChangePercent ?? 0;
      case 'numberOfAnalysts':
        return item.numberOfAnalysts ?? 0;
      case 'peRatio':
        return item.fundamentals?.peRatio ?? 0;
      case 'beta':
        return item.fundamentals?.beta ?? 0;
      case 'roe':
        return item.fundamentals?.roe ?? 0;
      case 'dividendYield':
        return item.fundamentals?.dividendYield ?? 0;
      case 'insiderMspr':
        return item.insiderSentiment?.mspr ?? 0;
      default:
        return 0;
    }
  };

  const sortedData = [...analystData].sort((a, b) => {
    const aVal = getSortValue(a, sortKey);
    const bVal = getSortValue(b, sortKey);
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortAsc
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number);
  });

  const getRecommendationLabel = (key: string | null): string => {
    if (!key) return '—';
    const labels: Record<string, string> = {
      strong_buy: 'Strong Buy',
      buy: 'Buy',
      hold: 'Hold',
      underperform: 'Underperform',
      sell: 'Sell',
    };
    return labels[key] || key;
  };

  const getRecommendationClass = (key: string | null): string => {
    if (!key) return '';
    if (key === 'strong_buy' || key === 'buy') return 'positive';
    if (key === 'sell' || key === 'underperform') return 'negative';
    return 'neutral';
  };

  const formatNumber = (
    value: number | null | undefined,
    decimals = 2
  ): string => {
    if (value === null || value === undefined) return '—';
    return value.toLocaleString('cs-CZ', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const formatPercent = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '—';
    const prefix = value >= 0 ? '+' : '';
    return `${prefix}${value.toFixed(2)}%`;
  };

  const formatMarketCap = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return '—';
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}T`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}B`;
    return `${value.toFixed(0)}M`;
  };

  const SortIcon = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <span className="sort-icon">↕</span>;
    return <span className="sort-icon active">{sortAsc ? '↑' : '↓'}</span>;
  };

  const getInsiderSentimentLabel = (
    mspr: number | null
  ): { label: string; class: string } => {
    if (mspr === null) return { label: '—', class: '' };
    if (mspr > 25) return { label: 'Strong Buying', class: 'positive' };
    if (mspr > 0) return { label: 'Buying', class: 'positive' };
    if (mspr > -25) return { label: 'Selling', class: 'negative' };
    return { label: 'Strong Selling', class: 'negative' };
  };

  // Helper functions - must be defined before any returns that use them
  const getWeightedAverage = (metric: keyof FundamentalMetrics): number => {
    const withMetric = analystData.filter(
      (d) =>
        d.fundamentals?.[metric] !== null &&
        d.fundamentals?.[metric] !== undefined
    );
    if (withMetric.length === 0) return 0;
    const weightedSum = withMetric.reduce(
      (sum, d) => sum + ((d.fundamentals?.[metric] as number) ?? 0) * d.weight,
      0
    );
    const totalWeight = withMetric.reduce((sum, d) => sum + d.weight, 0);
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  };

  const countNear52WeekHigh = (): number => {
    return analystData.filter((d) => {
      if (
        d.fiftyTwoWeekLow === null ||
        d.fiftyTwoWeekHigh === null ||
        d.currentPrice === null
      )
        return false;
      const position =
        ((d.currentPrice - d.fiftyTwoWeekLow) /
          (d.fiftyTwoWeekHigh - d.fiftyTwoWeekLow)) *
        100;
      return position > 80;
    }).length;
  };

  const countNear52WeekLow = (): number => {
    return analystData.filter((d) => {
      if (
        d.fiftyTwoWeekLow === null ||
        d.fiftyTwoWeekHigh === null ||
        d.currentPrice === null
      )
        return false;
      const position =
        ((d.currentPrice - d.fiftyTwoWeekLow) /
          (d.fiftyTwoWeekHigh - d.fiftyTwoWeekLow)) *
        100;
      return position < 20;
    }).length;
  };

  if (!portfolioId) {
    return (
      <div className="analysis">
        <div className="analysis-empty">
          <p>Please select a specific portfolio to view analysis.</p>
          <p className="hint">
            Analysis is not available for "All Portfolios" view.
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="analysis">
        <div className="analysis-loading">
          <div className="loading-spinner" />
          <p>Loading analyst data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="analysis">
        <div className="analysis-error">
          <p>{error}</p>
          <button onClick={loadData}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="analysis">
      <div className="analysis-header">
        <h2>Analysis</h2>
        <button className="refresh-btn" onClick={loadData}>
          ↻ Refresh
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="analysis-tabs">
        <button
          className={`tab-btn ${activeTab === 'analysts' ? 'active' : ''}`}
          onClick={() => setActiveTab('analysts')}
        >
          📊 Analysts
        </button>
        <button
          className={`tab-btn ${activeTab === 'fundamentals' ? 'active' : ''}`}
          onClick={() => setActiveTab('fundamentals')}
        >
          💰 Fundamentals
        </button>
        <button
          className={`tab-btn ${activeTab === 'technicals' ? 'active' : ''}`}
          onClick={() => setActiveTab('technicals')}
        >
          📈 Technical
        </button>
      </div>

      {/* Analysts Tab */}
      {activeTab === 'analysts' && (
        <>
          <section className="analysis-section">
            <h3>Analyst Recommendations</h3>
            <p className="section-description">
              Analyst ratings and earnings surprises from Finnhub (FREE tier).
            </p>

            <div className="analysis-table-wrapper">
              <table className="analysis-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('ticker')}>
                      Stock <SortIcon column="ticker" />
                    </th>
                    <th className="right" onClick={() => handleSort('weight')}>
                      Weight <SortIcon column="weight" />
                    </th>
                    <th
                      className="right"
                      onClick={() => handleSort('currentPrice')}
                    >
                      Price <SortIcon column="currentPrice" />
                    </th>
                    <th
                      className="right"
                      onClick={() => handleSort('priceChangePercent')}
                    >
                      Change <SortIcon column="priceChangePercent" />
                    </th>
                    <th className="center">Rating</th>
                    <th className="center">Recommendations</th>
                    <th
                      className="center"
                      onClick={() => handleSort('numberOfAnalysts')}
                    >
                      Analysts <SortIcon column="numberOfAnalysts" />
                    </th>
                    <th className="center">Earnings (Last 4Q)</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((item) => (
                    <tr key={item.ticker}>
                      <td>
                        <div className="stock-cell">
                          <span className="ticker">{item.ticker}</span>
                          <span className="name">{item.stockName}</span>
                          {item.industry && (
                            <span className="industry">{item.industry}</span>
                          )}
                        </div>
                      </td>
                      <td className="right">
                        <span
                          className="weight-bar"
                          style={
                            {
                              '--weight': `${item.weight}%`,
                            } as React.CSSProperties
                          }
                        >
                          {item.weight.toFixed(1)}%
                        </span>
                      </td>
                      <td className="right">
                        {formatNumber(item.currentPrice)}
                      </td>
                      <td
                        className={`right ${
                          (item.priceChangePercent ?? 0) >= 0
                            ? 'positive'
                            : 'negative'
                        }`}
                      >
                        {formatPercent(item.priceChangePercent)}
                      </td>
                      <td className="center">
                        <span
                          className={`recommendation-badge ${getRecommendationClass(
                            item.recommendationKey
                          )}`}
                        >
                          {getRecommendationLabel(item.recommendationKey)}
                        </span>
                      </td>
                      <td className="center">
                        {item.numberOfAnalysts ? (
                          <div className="recommendations-breakdown">
                            <span
                              className="rec-item strong-buy"
                              title="Strong Buy"
                            >
                              {item.strongBuy || 0}
                            </span>
                            <span className="rec-item buy" title="Buy">
                              {item.buy || 0}
                            </span>
                            <span className="rec-item hold" title="Hold">
                              {item.hold || 0}
                            </span>
                            <span className="rec-item sell" title="Sell">
                              {item.sell || 0}
                            </span>
                            <span
                              className="rec-item strong-sell"
                              title="Strong Sell"
                            >
                              {item.strongSell || 0}
                            </span>
                          </div>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td className="center">{item.numberOfAnalysts || '—'}</td>
                      <td className="center">
                        {item.earnings && item.earnings.length > 0 ? (
                          <div className="earnings-surprises">
                            {item.earnings.slice(0, 4).map((e, i) => (
                              <span
                                key={i}
                                className={`earnings-dot ${
                                  (e.surprisePercent ?? 0) >= 0
                                    ? 'beat'
                                    : 'miss'
                                }`}
                                title={
                                  e.period
                                    ? `${e.period}: ${
                                        e.surprisePercent !== null
                                          ? (e.surprisePercent >= 0
                                              ? '+'
                                              : '') +
                                            e.surprisePercent.toFixed(1) +
                                            '%'
                                          : 'N/A'
                                      }`
                                    : 'N/A'
                                }
                              >
                                {(e.surprisePercent ?? 0) >= 0 ? '✓' : '✗'}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Analyst Summary */}
          <section className="analysis-section">
            <h3>📈 Analyst Insights</h3>
            <div className="insights-grid">
              <div className="insight-card">
                <span className="insight-label">Stocks with Buy Rating</span>
                <span className="insight-value positive">
                  {
                    analystData.filter(
                      (d) =>
                        d.recommendationKey === 'buy' ||
                        d.recommendationKey === 'strong_buy'
                    ).length
                  }
                  <span className="insight-subtext">
                    / {analystData.length}
                  </span>
                </span>
              </div>
              <div className="insight-card">
                <span className="insight-label">Stocks with Sell Rating</span>
                <span className="insight-value negative">
                  {
                    analystData.filter(
                      (d) =>
                        d.recommendationKey === 'sell' ||
                        d.recommendationKey === 'underperform'
                    ).length
                  }
                  <span className="insight-subtext">
                    / {analystData.length}
                  </span>
                </span>
              </div>
              <div className="insight-card">
                <span className="insight-label">Total Analyst Coverage</span>
                <span className="insight-value">
                  {analystData.reduce(
                    (sum, d) => sum + (d.numberOfAnalysts || 0),
                    0
                  )}
                  <span className="insight-subtext"> analysts</span>
                </span>
              </div>
              <div className="insight-card">
                <span className="insight-label">Beat Earnings (Last Q)</span>
                <span className="insight-value positive">
                  {
                    analystData.filter(
                      (d) =>
                        d.earnings &&
                        d.earnings.length > 0 &&
                        d.earnings[0]?.surprisePercent !== null &&
                        d.earnings[0]?.surprisePercent !== undefined &&
                        d.earnings[0].surprisePercent > 0
                    ).length
                  }
                  <span className="insight-subtext">
                    /{' '}
                    {
                      analystData.filter(
                        (d) =>
                          d.earnings &&
                          d.earnings.length > 0 &&
                          d.earnings[0]?.surprisePercent !== null &&
                          d.earnings[0]?.surprisePercent !== undefined
                      ).length
                    }
                  </span>
                </span>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Fundamentals Tab */}
      {activeTab === 'fundamentals' && (
        <>
          <section className="analysis-section">
            <h3>Fundamental Metrics</h3>
            <p className="section-description">
              Key financial ratios and metrics. Data from Finnhub Basic
              Financials (FREE).
            </p>

            <div className="analysis-table-wrapper">
              <table className="analysis-table fundamentals-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('ticker')}>
                      Stock <SortIcon column="ticker" />
                    </th>
                    <th className="right" onClick={() => handleSort('weight')}>
                      Weight <SortIcon column="weight" />
                    </th>
                    <th className="right" onClick={() => handleSort('peRatio')}>
                      P/E <SortIcon column="peRatio" />
                    </th>
                    <th className="right">P/B</th>
                    <th className="right" onClick={() => handleSort('roe')}>
                      ROE <SortIcon column="roe" />
                    </th>
                    <th className="right">Net Margin</th>
                    <th className="right" onClick={() => handleSort('beta')}>
                      Beta <SortIcon column="beta" />
                    </th>
                    <th
                      className="right"
                      onClick={() => handleSort('dividendYield')}
                    >
                      Div Yield <SortIcon column="dividendYield" />
                    </th>
                    <th className="right">Debt/Equity</th>
                    <th className="right">Mkt Cap</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((item) => {
                    const f = item.fundamentals;
                    return (
                      <tr key={item.ticker}>
                        <td>
                          <div className="stock-cell">
                            <span className="ticker">{item.ticker}</span>
                            <span className="name">{item.stockName}</span>
                          </div>
                        </td>
                        <td className="right">
                          <span
                            className="weight-bar"
                            style={
                              {
                                '--weight': `${item.weight}%`,
                              } as React.CSSProperties
                            }
                          >
                            {item.weight.toFixed(1)}%
                          </span>
                        </td>
                        <td
                          className={`right ${
                            f?.peRatio !== null &&
                            f?.peRatio !== undefined &&
                            f.peRatio < 15
                              ? 'positive'
                              : f?.peRatio !== null && f.peRatio > 30
                              ? 'negative'
                              : ''
                          }`}
                        >
                          {formatNumber(f?.peRatio, 1)}
                        </td>
                        <td className="right">{formatNumber(f?.pbRatio, 1)}</td>
                        <td
                          className={`right ${
                            f?.roe !== null &&
                            f?.roe !== undefined &&
                            f.roe > 15
                              ? 'positive'
                              : f?.roe !== null && f.roe < 5
                              ? 'negative'
                              : ''
                          }`}
                        >
                          {f?.roe !== null && f?.roe !== undefined
                            ? `${f.roe.toFixed(1)}%`
                            : '—'}
                        </td>
                        <td
                          className={`right ${
                            f?.netMargin !== null &&
                            f?.netMargin !== undefined &&
                            f.netMargin > 15
                              ? 'positive'
                              : f?.netMargin !== null && f.netMargin < 5
                              ? 'negative'
                              : ''
                          }`}
                        >
                          {f?.netMargin !== null && f?.netMargin !== undefined
                            ? `${f.netMargin.toFixed(1)}%`
                            : '—'}
                        </td>
                        <td
                          className={`right ${
                            f?.beta !== null &&
                            f?.beta !== undefined &&
                            f.beta > 1.3
                              ? 'negative'
                              : f?.beta !== null && f.beta < 0.8
                              ? 'positive'
                              : ''
                          }`}
                        >
                          {formatNumber(f?.beta, 2)}
                        </td>
                        <td
                          className={`right ${
                            f?.dividendYield !== null &&
                            f?.dividendYield !== undefined &&
                            f.dividendYield > 2
                              ? 'positive'
                              : ''
                          }`}
                        >
                          {f?.dividendYield !== null &&
                          f?.dividendYield !== undefined
                            ? `${f.dividendYield.toFixed(2)}%`
                            : '—'}
                        </td>
                        <td
                          className={`right ${
                            f?.debtToEquity !== null &&
                            f?.debtToEquity !== undefined &&
                            f.debtToEquity > 100
                              ? 'negative'
                              : ''
                          }`}
                        >
                          {formatNumber(f?.debtToEquity, 1)}
                        </td>
                        <td className="right">
                          {formatMarketCap(f?.marketCap)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Insider Sentiment Section */}
          <section className="analysis-section">
            <h3>🕵️ Insider Sentiment</h3>
            <p className="section-description">
              Monthly Share Purchase Ratio (MSPR) - measures insider buying vs
              selling activity. Range: -100 (heavy selling) to +100 (heavy
              buying).
            </p>

            <div className="insider-grid">
              {sortedData.map((item) => {
                const sentiment = getInsiderSentimentLabel(
                  item.insiderSentiment?.mspr ?? null
                );
                return (
                  <div key={item.ticker} className="insider-card">
                    <div className="insider-header">
                      <span className="ticker">{item.ticker}</span>
                      <span className={`insider-badge ${sentiment.class}`}>
                        {sentiment.label}
                      </span>
                    </div>
                    <div className="insider-details">
                      <div className="insider-stat">
                        <span className="stat-label">MSPR</span>
                        <span
                          className={`stat-value ${
                            (item.insiderSentiment?.mspr ?? 0) >= 0
                              ? 'positive'
                              : 'negative'
                          }`}
                        >
                          {item.insiderSentiment?.mspr !== null &&
                          item.insiderSentiment?.mspr !== undefined
                            ? (item.insiderSentiment.mspr >= 0 ? '+' : '') +
                              item.insiderSentiment.mspr.toFixed(1)
                            : '—'}
                        </span>
                      </div>
                      <div className="insider-stat">
                        <span className="stat-label">Net Shares</span>
                        <span
                          className={`stat-value ${
                            (item.insiderSentiment?.change ?? 0) >= 0
                              ? 'positive'
                              : 'negative'
                          }`}
                        >
                          {item.insiderSentiment?.change !== null &&
                          item.insiderSentiment?.change !== undefined
                            ? (item.insiderSentiment.change >= 0 ? '+' : '') +
                              item.insiderSentiment.change.toLocaleString()
                            : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Fundamental Summary */}
          <section className="analysis-section">
            <h3>💹 Fundamental Insights</h3>
            <div className="insights-grid">
              <div className="insight-card">
                <span className="insight-label">Avg Portfolio P/E</span>
                <span className="insight-value">
                  {getWeightedAverage('peRatio').toFixed(1)}
                </span>
              </div>
              <div className="insight-card">
                <span className="insight-label">Avg Portfolio Beta</span>
                <span
                  className={`insight-value ${
                    getWeightedAverage('beta') > 1.2
                      ? 'negative'
                      : getWeightedAverage('beta') < 0.9
                      ? 'positive'
                      : ''
                  }`}
                >
                  {getWeightedAverage('beta').toFixed(2)}
                </span>
              </div>
              <div className="insight-card">
                <span className="insight-label">Avg ROE</span>
                <span
                  className={`insight-value ${
                    getWeightedAverage('roe') > 15 ? 'positive' : ''
                  }`}
                >
                  {getWeightedAverage('roe').toFixed(1)}%
                </span>
              </div>
              <div className="insight-card">
                <span className="insight-label">Insider Buying</span>
                <span className="insight-value positive">
                  {
                    analystData.filter(
                      (d) => (d.insiderSentiment?.mspr ?? 0) > 0
                    ).length
                  }
                  <span className="insight-subtext">
                    /{' '}
                    {
                      analystData.filter(
                        (d) => d.insiderSentiment?.mspr !== null
                      ).length
                    }
                  </span>
                </span>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Technical Tab */}
      {activeTab === 'technicals' && (
        <>
          <section className="analysis-section">
            <h3>Price Analysis</h3>
            <p className="section-description">
              52-week ranges and price position. Technical indicators require
              Finnhub Premium.
            </p>

            <div className="analysis-table-wrapper">
              <table className="analysis-table technicals-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('ticker')}>
                      Stock <SortIcon column="ticker" />
                    </th>
                    <th className="right" onClick={() => handleSort('weight')}>
                      Weight <SortIcon column="weight" />
                    </th>
                    <th
                      className="right"
                      onClick={() => handleSort('currentPrice')}
                    >
                      Price <SortIcon column="currentPrice" />
                    </th>
                    <th
                      className="right"
                      onClick={() => handleSort('priceChangePercent')}
                    >
                      Change <SortIcon column="priceChangePercent" />
                    </th>
                    <th className="right">52W Low</th>
                    <th className="right">52W High</th>
                    <th className="center">52W Range Position</th>
                    <th className="left">Peers</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((item) => {
                    const rangePosition =
                      item.fiftyTwoWeekLow !== null &&
                      item.fiftyTwoWeekHigh !== null &&
                      item.currentPrice !== null
                        ? ((item.currentPrice - item.fiftyTwoWeekLow) /
                            (item.fiftyTwoWeekHigh - item.fiftyTwoWeekLow)) *
                          100
                        : null;
                    return (
                      <tr key={item.ticker}>
                        <td>
                          <div className="stock-cell">
                            <span className="ticker">{item.ticker}</span>
                            <span className="name">{item.stockName}</span>
                          </div>
                        </td>
                        <td className="right">
                          <span
                            className="weight-bar"
                            style={
                              {
                                '--weight': `${item.weight}%`,
                              } as React.CSSProperties
                            }
                          >
                            {item.weight.toFixed(1)}%
                          </span>
                        </td>
                        <td className="right">
                          {formatNumber(item.currentPrice)}
                        </td>
                        <td
                          className={`right ${
                            (item.priceChangePercent ?? 0) >= 0
                              ? 'positive'
                              : 'negative'
                          }`}
                        >
                          {formatPercent(item.priceChangePercent)}
                        </td>
                        <td className="right muted">
                          {formatNumber(item.fiftyTwoWeekLow)}
                        </td>
                        <td className="right muted">
                          {formatNumber(item.fiftyTwoWeekHigh)}
                        </td>
                        <td className="center">
                          {rangePosition !== null ? (
                            <div className="range-bar-container">
                              <div className="range-bar">
                                <div
                                  className={`range-indicator ${
                                    rangePosition > 80
                                      ? 'high'
                                      : rangePosition < 20
                                      ? 'low'
                                      : ''
                                  }`}
                                  style={{ left: `${rangePosition}%` }}
                                />
                              </div>
                              <span className="range-percent">
                                {rangePosition.toFixed(0)}%
                              </span>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="left">
                          {item.peers && item.peers.length > 0 ? (
                            <div className="peers-list">
                              {item.peers.slice(0, 3).map((peer, i) => (
                                <span key={i} className="peer-tag">
                                  {peer}
                                </span>
                              ))}
                              {item.peers.length > 3 && (
                                <span className="peer-more">
                                  +{item.peers.length - 3}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="muted">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Technical Premium Notice */}
          <section className="analysis-section premium-notice">
            <h3>🔒 Premium Technical Indicators</h3>
            <p className="section-description">
              The following technical analysis features require Finnhub Premium
              subscription:
            </p>
            <div className="premium-features">
              <div className="premium-feature">
                <span className="feature-icon">📊</span>
                <span className="feature-name">Technical Indicators</span>
                <span className="feature-desc">
                  SMA, EMA, RSI, MACD, Bollinger Bands, etc.
                </span>
              </div>
              <div className="premium-feature">
                <span className="feature-icon">🎯</span>
                <span className="feature-name">Support/Resistance</span>
                <span className="feature-desc">
                  Key price levels for each stock
                </span>
              </div>
              <div className="premium-feature">
                <span className="feature-icon">📈</span>
                <span className="feature-name">Pattern Recognition</span>
                <span className="feature-desc">
                  Chart patterns (Head & Shoulders, Triangles, etc.)
                </span>
              </div>
              <div className="premium-feature">
                <span className="feature-icon">🔮</span>
                <span className="feature-name">Aggregate Signals</span>
                <span className="feature-desc">
                  Buy/Sell/Neutral signals based on multiple indicators
                </span>
              </div>
            </div>
          </section>

          {/* Technical Summary */}
          <section className="analysis-section">
            <h3>📉 Technical Insights</h3>
            <div className="insights-grid">
              <div className="insight-card">
                <span className="insight-label">Near 52W High (&gt;80%)</span>
                <span className="insight-value">
                  {countNear52WeekHigh()}
                  <span className="insight-subtext">
                    / {analystData.length}
                  </span>
                </span>
              </div>
              <div className="insight-card">
                <span className="insight-label">Near 52W Low (&lt;20%)</span>
                <span className="insight-value">
                  {countNear52WeekLow()}
                  <span className="insight-subtext">
                    / {analystData.length}
                  </span>
                </span>
              </div>
              <div className="insight-card">
                <span className="insight-label">Positive Today</span>
                <span className="insight-value positive">
                  {
                    analystData.filter((d) => (d.priceChangePercent ?? 0) > 0)
                      .length
                  }
                  <span className="insight-subtext">
                    / {analystData.length}
                  </span>
                </span>
              </div>
              <div className="insight-card">
                <span className="insight-label">Negative Today</span>
                <span className="insight-value negative">
                  {
                    analystData.filter((d) => (d.priceChangePercent ?? 0) < 0)
                      .length
                  }
                  <span className="insight-subtext">
                    / {analystData.length}
                  </span>
                </span>
              </div>
            </div>
          </section>
        </>
      )}

      {analystData.length === 0 && (
        <div className="no-data">No holdings in this portfolio.</div>
      )}
    </div>
  );
}
