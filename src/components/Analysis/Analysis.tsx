import { useState, useEffect } from 'react';
import {
  fetchAnalystData,
  type AnalystData,
  type FundamentalMetrics,
} from '@/services/api/analysis';
import { holdingsApi } from '@/services/api';
import {
  getAllIndicators,
  getUserViews,
  createView,
  updateViewColumns,
  deleteView,
  updateView,
  DEFAULT_INDICATOR_KEYS,
  formatLargeNumber,
  type AnalysisIndicator,
  type UserAnalysisView,
} from '@/services/api/indicators';
import { ColumnPicker } from './ColumnPicker';
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
  | 'consensusScore'
  | 'peRatio'
  | 'beta'
  | 'roe'
  | 'dividendYield'
  | 'insiderMspr';

type TabType = 'analysts' | 'fundamentals' | 'technicals';

// Insider sentiment time range options (in months)
// Note: Finnhub provides monthly data, so minimum granularity is 1 month
type InsiderTimeRange = 1 | 2 | 3 | 6 | 12;

const INSIDER_TIME_RANGES: { value: InsiderTimeRange; label: string }[] = [
  { value: 1, label: '1M' },
  { value: 2, label: '2M' },
  { value: 3, label: '3M' },
  { value: 6, label: '6M' },
  { value: 12, label: '1Y' },
];

export function Analysis({ portfolioId }: AnalysisProps) {
  const [analystData, setAnalystData] = useState<EnrichedAnalystData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('weight');
  const [sortAsc, setSortAsc] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('analysts');

  // Customizable indicators state
  const [indicators, setIndicators] = useState<AnalysisIndicator[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    DEFAULT_INDICATOR_KEYS
  );
  const [userViews, setUserViews] = useState<UserAnalysisView[]>([]);
  const [currentView, setCurrentView] = useState<UserAnalysisView | null>(null);
  const [indicatorsLoading, setIndicatorsLoading] = useState(true);
  const [insiderTimeRange, setInsiderTimeRange] = useState<InsiderTimeRange>(3);

  useEffect(() => {
    loadData();
    loadIndicators();
  }, [portfolioId]);

  const loadIndicators = async () => {
    try {
      setIndicatorsLoading(true);
      const [allIndicators, views] = await Promise.all([
        getAllIndicators(),
        getUserViews(),
      ]);
      setIndicators(allIndicators);
      setUserViews(views);

      // Find default view or use defaults
      const defaultView = views.find((v) => v.is_default);
      if (defaultView) {
        setCurrentView(defaultView);
        setSelectedColumns(defaultView.indicator_keys);
      }
    } catch (err) {
      console.error('Failed to load indicators:', err);
    } finally {
      setIndicatorsLoading(false);
    }
  };

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
      case 'consensusScore':
        return item.consensusScore ?? 0;
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

  // Column customization handlers
  const handleColumnChange = async (keys: string[]) => {
    setSelectedColumns(keys);
    // If there's a current view, update it automatically
    if (currentView) {
      try {
        await updateViewColumns(currentView.id, keys);
      } catch (err) {
        console.error('Failed to save column order:', err);
      }
    }
  };

  const handleSaveView = async (name: string) => {
    try {
      const newView = await createView(
        name,
        selectedColumns,
        userViews.length === 0
      );
      setUserViews([...userViews, newView]);
      setCurrentView(newView);
    } catch (err) {
      console.error('Failed to save view:', err);
    }
  };

  const handleDeleteView = async (viewId: string) => {
    try {
      await deleteView(viewId);
      const updatedViews = userViews.filter((v) => v.id !== viewId);
      setUserViews(updatedViews);

      // If we deleted the current view, switch to default or first view
      if (currentView?.id === viewId) {
        const newCurrent =
          updatedViews.find((v) => v.is_default) || updatedViews[0] || null;
        setCurrentView(newCurrent);
        if (newCurrent) {
          setSelectedColumns(newCurrent.indicator_keys);
        } else {
          setSelectedColumns(DEFAULT_INDICATOR_KEYS);
        }
      }
    } catch (err) {
      console.error('Failed to delete view:', err);
    }
  };

  const handleSelectView = (view: UserAnalysisView) => {
    setCurrentView(view);
    setSelectedColumns(view.indicator_keys);
  };

  const handleSetDefaultView = async (viewId: string) => {
    try {
      await updateView(viewId, { is_default: true });
      // Update local state - set this view as default, unset others
      setUserViews(
        userViews.map((v) => ({
          ...v,
          is_default: v.id === viewId,
        }))
      );
    } catch (err) {
      console.error('Failed to set default view:', err);
    }
  };

  // Get indicator by key helper
  const getIndicatorByKey = (key: string): AnalysisIndicator | undefined => {
    return indicators.find((i) => i.key === key);
  };

  // Get metric value from fundamentals by indicator key
  const getMetricValue = (
    fundamentals: FundamentalMetrics | null | undefined,
    key: string
  ): number | null => {
    if (!fundamentals) return null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (fundamentals as any)[key];
    return typeof value === 'number' ? value : null;
  };

  // Format value based on indicator definition
  const formatIndicatorValue = (
    value: number | null | undefined,
    indicator: AnalysisIndicator
  ): string => {
    if (value === null || value === undefined) return '—';

    // Special handling for market cap and enterprise value
    if (indicator.key === 'marketCap' || indicator.key === 'enterpriseValue') {
      return formatLargeNumber(value);
    }

    const formatted = value.toLocaleString('cs-CZ', {
      minimumFractionDigits: indicator.format_decimals,
      maximumFractionDigits: indicator.format_decimals,
    });

    return `${indicator.format_prefix}${formatted}${indicator.format_suffix}`;
  };

  // Get CSS class based on indicator thresholds
  const getValueClass = (
    value: number | null | undefined,
    indicator: AnalysisIndicator
  ): string => {
    if (value === null || value === undefined) return '';
    if (indicator.good_threshold === null && indicator.bad_threshold === null)
      return '';

    const { good_threshold, bad_threshold, higher_is_better } = indicator;

    if (higher_is_better) {
      if (good_threshold !== null && value >= good_threshold) return 'positive';
      if (bad_threshold !== null && value <= bad_threshold) return 'negative';
    } else {
      if (good_threshold !== null && value <= good_threshold) return 'positive';
      if (bad_threshold !== null && value >= bad_threshold) return 'negative';
    }

    return '';
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

  // Filter insider sentiment by time range (client-side - no API call needed)
  const getFilteredInsiderSentiment = (
    item: EnrichedAnalystData,
    months: InsiderTimeRange
  ): { mspr: number | null; change: number | null } => {
    // Check for monthlyData array first
    const monthlyData = item.insiderSentiment?.monthlyData;

    // If no monthlyData but we have aggregated values, use those (backward compatibility)
    if (!monthlyData || monthlyData.length === 0) {
      // Fall back to pre-aggregated values if available
      if (
        item.insiderSentiment?.mspr !== null &&
        item.insiderSentiment?.mspr !== undefined
      ) {
        return {
          mspr: item.insiderSentiment.mspr,
          change: item.insiderSentiment.change ?? null,
        };
      }
      return { mspr: null, change: null };
    }

    // Calculate the cutoff date
    const now = new Date();
    const cutoffYear = now.getFullYear();
    const cutoffMonth = now.getMonth() + 1; // 1-indexed

    // Filter to only include months within the range
    // Include data from the last N months (e.g., for 3M: current month and 2 previous)
    const filtered = monthlyData.filter((d) => {
      const monthsDiff = (cutoffYear - d.year) * 12 + (cutoffMonth - d.month);
      return monthsDiff >= 0 && monthsDiff < months;
    });

    // If no data in selected range, try using all available data
    const dataToUse =
      filtered.length > 0 ? filtered : monthlyData.slice(0, months);

    if (dataToUse.length === 0) {
      return { mspr: null, change: null };
    }

    // Calculate aggregates
    const avgMspr =
      dataToUse.reduce((sum, d) => sum + d.mspr, 0) / dataToUse.length;
    const totalChange = dataToUse.reduce((sum, d) => sum + d.change, 0);

    return {
      mspr: Math.round(avgMspr * 100) / 100,
      change: totalChange,
    };
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
                    <th
                      className="center"
                      onClick={() => handleSort('consensusScore')}
                      title="Weighted consensus: -2 (Strong Sell) to +2 (Strong Buy). 0 = Hold."
                    >
                      Score ⓘ <SortIcon column="consensusScore" />
                    </th>
                    <th className="center">Breakdown</th>
                    <th
                      className="center"
                      onClick={() => handleSort('numberOfAnalysts')}
                    >
                      Analysts <SortIcon column="numberOfAnalysts" />
                    </th>
                    <th className="center">Earnings (4Q)</th>
                    <th
                      className="center"
                      title="When Finnhub last updated consensus data for this stock (all analysts aggregated)."
                    >
                      Updated ⓘ
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((item) => (
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
                        {item.consensusScore !== null ? (
                          <span
                            className={`consensus-score ${
                              item.consensusScore > 0.5
                                ? 'positive'
                                : item.consensusScore < -0.5
                                ? 'negative'
                                : 'neutral'
                            }`}
                            title="Score from -2 (Strong Sell) to +2 (Strong Buy)"
                          >
                            {item.consensusScore > 0 ? '+' : ''}
                            {item.consensusScore.toFixed(2)}
                          </span>
                        ) : (
                          <span className="muted">—</span>
                        )}
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
                      <td className="center muted">
                        {item.recommendationPeriod
                          ? new Date(
                              item.recommendationPeriod
                            ).toLocaleDateString('cs-CZ', {
                              month: 'short',
                              year: '2-digit',
                            })
                          : '—'}
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
              <div
                className="insight-card"
                title="Weighted average across all stocks. Scale: -2 (Strong Sell) → 0 (Hold) → +2 (Strong Buy)"
              >
                <span className="insight-label">Avg Consensus Score ⓘ</span>
                <span
                  className={`insight-value ${
                    analystData.filter((d) => d.consensusScore !== null)
                      .length > 0
                      ? analystData.reduce(
                          (sum, d) => sum + (d.consensusScore ?? 0),
                          0
                        ) /
                          analystData.filter((d) => d.consensusScore !== null)
                            .length >
                        0.5
                        ? 'positive'
                        : analystData.reduce(
                            (sum, d) => sum + (d.consensusScore ?? 0),
                            0
                          ) /
                            analystData.filter((d) => d.consensusScore !== null)
                              .length <
                          -0.5
                        ? 'negative'
                        : ''
                      : ''
                  }`}
                >
                  {analystData.filter((d) => d.consensusScore !== null).length >
                  0
                    ? (
                        analystData.reduce(
                          (sum, d) => sum + (d.consensusScore ?? 0),
                          0
                        ) /
                        analystData.filter((d) => d.consensusScore !== null)
                          .length
                      ).toFixed(2)
                    : '—'}
                  <span className="insight-subtext"> / 2.00</span>
                </span>
              </div>
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
            <div className="section-header-row">
              <div>
                <h3>Fundamental Metrics</h3>
                <p className="section-description">
                  Customize columns to show the metrics you care about. Data
                  from Finnhub (FREE tier).
                </p>
              </div>
              {currentView && (
                <div className="current-view-badge">📋 {currentView.name}</div>
              )}
            </div>

            {/* Column Picker */}
            {!indicatorsLoading && (
              <ColumnPicker
                indicators={indicators}
                selectedKeys={selectedColumns}
                onSelectionChange={handleColumnChange}
                onSaveView={handleSaveView}
                views={userViews}
                currentViewId={currentView?.id}
                onSelectView={handleSelectView}
                onDeleteView={handleDeleteView}
                onSetDefaultView={handleSetDefaultView}
              />
            )}

            <div className="analysis-table-wrapper">
              <table className="analysis-table fundamentals-table dynamic-columns">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('ticker')}>
                      Stock <SortIcon column="ticker" />
                    </th>
                    <th className="right" onClick={() => handleSort('weight')}>
                      Weight <SortIcon column="weight" />
                    </th>
                    {selectedColumns.map((key) => {
                      const indicator = getIndicatorByKey(key);
                      if (!indicator) return null;
                      return (
                        <th
                          key={key}
                          className="right"
                          title={indicator.description}
                        >
                          {indicator.short_name}
                          <span className="tooltip-icon">ⓘ</span>
                        </th>
                      );
                    })}
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
                        {selectedColumns.map((key) => {
                          const indicator = getIndicatorByKey(key);
                          if (!indicator) return null;
                          const value = getMetricValue(f, key);
                          return (
                            <td
                              key={key}
                              className={`right ${getValueClass(
                                value,
                                indicator
                              )}`}
                              title={indicator.description}
                            >
                              {formatIndicatorValue(value, indicator)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Insider Sentiment Section */}
          <section className="analysis-section">
            <div className="insider-section-header">
              <div className="insider-title-row">
                <h3>🕵️ Insider Sentiment</h3>
                <div className="tooltip-wrapper">
                  <span className="info-tooltip-trigger">ⓘ</span>
                  <div className="tooltip-content">
                    <strong>What is Insider Sentiment?</strong>
                    <p>
                      Tracks buying/selling by company executives and directors
                      (Form 4 filings). High insider buying often signals
                      confidence in the company's future.
                    </p>
                    <p>
                      <strong>MSPR</strong>: Monthly Share Purchase Ratio (-100
                      to +100)
                    </p>
                    <p>
                      <strong>Net Shares</strong>: Total shares bought minus
                      sold
                    </p>
                  </div>
                </div>
              </div>
              <div className="insider-time-filter">
                {INSIDER_TIME_RANGES.map((range) => (
                  <button
                    key={range.value}
                    className={`time-range-btn ${
                      insiderTimeRange === range.value ? 'active' : ''
                    }`}
                    onClick={() => setInsiderTimeRange(range.value)}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
            <p className="section-description">
              Bars show monthly MSPR trend.{' '}
              <span className="positive-text">Green</span> = buying,{' '}
              <span className="negative-text">Red</span> = selling.
            </p>

            <div className="insider-grid">
              {sortedData.map((item) => {
                const filteredSentiment = getFilteredInsiderSentiment(
                  item,
                  insiderTimeRange
                );
                const sentiment = getInsiderSentimentLabel(
                  filteredSentiment.mspr
                );
                const hasData = filteredSentiment.mspr !== null;
                const monthlyData = item.insiderSentiment?.monthlyData ?? [];

                // Get the last N months of data for the mini chart (reversed for left-to-right display)
                const chartData = [...monthlyData]
                  .slice(0, insiderTimeRange)
                  .reverse();

                return (
                  <div
                    key={item.ticker}
                    className={`insider-card ${!hasData ? 'no-data' : ''}`}
                  >
                    <div className="insider-header">
                      <span className="ticker">{item.ticker}</span>
                      <span className={`insider-badge ${sentiment.class}`}>
                        {sentiment.label}
                      </span>
                    </div>
                    {hasData ? (
                      <>
                        <div className="insider-details">
                          <div className="insider-stat">
                            <span className="stat-label">MSPR</span>
                            <span
                              className={`stat-value ${
                                (filteredSentiment.mspr ?? 0) >= 0
                                  ? 'positive'
                                  : 'negative'
                              }`}
                            >
                              {(filteredSentiment.mspr ?? 0) >= 0 ? '+' : ''}
                              {filteredSentiment.mspr?.toFixed(1)}
                            </span>
                          </div>
                          <div className="insider-stat">
                            <span className="stat-label">Net Shares</span>
                            <span
                              className={`stat-value ${
                                (filteredSentiment.change ?? 0) >= 0
                                  ? 'positive'
                                  : 'negative'
                              }`}
                            >
                              {(filteredSentiment.change ?? 0) >= 0 ? '+' : ''}
                              {filteredSentiment.change?.toLocaleString()}
                            </span>
                          </div>
                        </div>
                        {/* Mini MSPR Chart - Left=Oldest, Right=Newest */}
                        {chartData.length > 1 && (
                          <div className="insider-chart">
                            <div className="chart-labels">
                              <span className="chart-label-old">Older</span>
                              <span className="chart-label-new">Recent</span>
                            </div>
                            <div className="chart-bars">
                              {chartData.map((d, i) => {
                                const maxAbsMspr = Math.max(
                                  ...chartData.map((x) => Math.abs(x.mspr)),
                                  1
                                );
                                const height = Math.abs(d.mspr) / maxAbsMspr;
                                const isPositive = d.mspr >= 0;
                                const monthNames = [
                                  'Jan',
                                  'Feb',
                                  'Mar',
                                  'Apr',
                                  'May',
                                  'Jun',
                                  'Jul',
                                  'Aug',
                                  'Sep',
                                  'Oct',
                                  'Nov',
                                  'Dec',
                                ];
                                const monthLabel =
                                  monthNames[d.month - 1] || d.month;
                                return (
                                  <div
                                    key={i}
                                    className="chart-bar-wrapper"
                                    title={`${monthLabel} ${d.year}: MSPR ${
                                      d.mspr >= 0 ? '+' : ''
                                    }${d.mspr.toFixed(1)}, Shares ${
                                      d.change >= 0 ? '+' : ''
                                    }${d.change.toLocaleString()}`}
                                  >
                                    <div
                                      className={`chart-bar ${
                                        isPositive ? 'positive' : 'negative'
                                      }`}
                                      style={{
                                        height: `${Math.max(height * 100, 5)}%`,
                                      }}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                            <div className="chart-zero-line" />
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="insider-no-data">
                        <span>No insider data</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Fundamental Summary */}
          <section className="analysis-section">
            <h3>💹 Fundamental Insights</h3>
            <p className="section-description">
              Portfolio-weighted averages and key metrics across your holdings.
            </p>

            {/* Valuation Row */}
            <div className="insights-category">
              <span className="category-label">Valuation</span>
              <div className="insights-grid">
                <div
                  className="insight-card"
                  title="Portfolio-weighted average P/E ratio. Lower may indicate undervaluation, higher may indicate growth expectations."
                >
                  <span className="insight-label">Avg P/E ⓘ</span>
                  <span className="insight-value">
                    {getWeightedAverage('peRatio').toFixed(1)}x
                  </span>
                </div>
                <div
                  className="insight-card"
                  title="Portfolio-weighted average Forward P/E (based on estimated earnings). Compare with trailing P/E to gauge growth expectations."
                >
                  <span className="insight-label">Avg Fwd P/E ⓘ</span>
                  <span className="insight-value">
                    {getWeightedAverage('forwardPe').toFixed(1)}x
                  </span>
                </div>
                <div
                  className="insight-card"
                  title="Portfolio-weighted average Price-to-Book ratio. <1 may indicate undervaluation, >3 may indicate overvaluation."
                >
                  <span className="insight-label">Avg P/B ⓘ</span>
                  <span className="insight-value">
                    {getWeightedAverage('pbRatio').toFixed(2)}x
                  </span>
                </div>
                <div
                  className="insight-card"
                  title="Portfolio-weighted average EV/EBITDA. Lower values may indicate better value. Useful for comparing companies with different capital structures."
                >
                  <span className="insight-label">Avg EV/EBITDA ⓘ</span>
                  <span className="insight-value">
                    {getWeightedAverage('evToEbitda').toFixed(1)}x
                  </span>
                </div>
              </div>
            </div>

            {/* Profitability Row */}
            <div className="insights-category">
              <span className="category-label">Profitability</span>
              <div className="insights-grid">
                <div
                  className="insight-card"
                  title="Portfolio-weighted average Return on Equity. Measures how effectively the company uses shareholder equity. >15% is generally good."
                >
                  <span className="insight-label">Avg ROE ⓘ</span>
                  <span
                    className={`insight-value ${
                      getWeightedAverage('roe') > 15 ? 'positive' : ''
                    }`}
                  >
                    {getWeightedAverage('roe').toFixed(1)}%
                  </span>
                </div>
                <div
                  className="insight-card"
                  title="Portfolio-weighted average Net Profit Margin. The percentage of revenue that becomes profit. Higher is better."
                >
                  <span className="insight-label">Avg Net Margin ⓘ</span>
                  <span
                    className={`insight-value ${
                      getWeightedAverage('netMargin') > 10 ? 'positive' : ''
                    }`}
                  >
                    {getWeightedAverage('netMargin').toFixed(1)}%
                  </span>
                </div>
                <div
                  className="insight-card"
                  title="Portfolio-weighted average Gross Margin. Revenue minus cost of goods sold. Higher indicates pricing power."
                >
                  <span className="insight-label">Avg Gross Margin ⓘ</span>
                  <span className="insight-value">
                    {getWeightedAverage('grossMargin').toFixed(1)}%
                  </span>
                </div>
                <div
                  className="insight-card"
                  title="Stocks with dividend yield > 0%"
                >
                  <span className="insight-label">Dividend Payers ⓘ</span>
                  <span className="insight-value">
                    {
                      analystData.filter(
                        (d) => (d.fundamentals?.dividendYield ?? 0) > 0
                      ).length
                    }
                    <span className="insight-subtext">
                      / {analystData.length}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Risk & Growth Row */}
            <div className="insights-category">
              <span className="category-label">Risk & Growth</span>
              <div className="insights-grid">
                <div
                  className="insight-card"
                  title="Portfolio-weighted average Beta. >1 = more volatile than market, <1 = less volatile. 1 = moves with market."
                >
                  <span className="insight-label">Avg Beta ⓘ</span>
                  <span
                    className={`insight-value ${
                      getWeightedAverage('beta') > 1.3
                        ? 'negative'
                        : getWeightedAverage('beta') < 0.8
                        ? 'positive'
                        : ''
                    }`}
                  >
                    {getWeightedAverage('beta').toFixed(2)}
                  </span>
                </div>
                <div
                  className="insight-card"
                  title="Portfolio-weighted average Debt-to-Equity ratio. Lower is generally safer. >2 may indicate high leverage risk."
                >
                  <span className="insight-label">Avg D/E ⓘ</span>
                  <span
                    className={`insight-value ${
                      getWeightedAverage('debtToEquity') > 2
                        ? 'negative'
                        : getWeightedAverage('debtToEquity') < 0.5
                        ? 'positive'
                        : ''
                    }`}
                  >
                    {getWeightedAverage('debtToEquity').toFixed(2)}
                  </span>
                </div>
                <div
                  className="insight-card"
                  title="Portfolio-weighted average revenue growth (TTM). Positive indicates growing companies."
                >
                  <span className="insight-label">Avg Revenue Growth ⓘ</span>
                  <span
                    className={`insight-value ${
                      getWeightedAverage('revenueGrowth') > 0
                        ? 'positive'
                        : getWeightedAverage('revenueGrowth') < 0
                        ? 'negative'
                        : ''
                    }`}
                  >
                    {getWeightedAverage('revenueGrowth') >= 0 ? '+' : ''}
                    {getWeightedAverage('revenueGrowth').toFixed(1)}%
                  </span>
                </div>
                <div
                  className="insight-card"
                  title="Stocks where insiders are net buyers in the selected time range"
                >
                  <span className="insight-label">
                    Insider Buying ({insiderTimeRange}M) ⓘ
                  </span>
                  <span className="insight-value positive">
                    {
                      analystData.filter(
                        (d) =>
                          getFilteredInsiderSentiment(d, insiderTimeRange)
                            .mspr !== null &&
                          (getFilteredInsiderSentiment(d, insiderTimeRange)
                            .mspr ?? 0) > 0
                      ).length
                    }
                    <span className="insight-subtext">
                      /{' '}
                      {
                        analystData.filter(
                          (d) =>
                            getFilteredInsiderSentiment(d, insiderTimeRange)
                              .mspr !== null
                        ).length
                      }
                    </span>
                  </span>
                </div>
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
