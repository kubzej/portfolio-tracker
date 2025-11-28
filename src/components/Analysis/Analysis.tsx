import { useState, useEffect, useMemo } from 'react';
import {
  fetchAnalystData,
  type FundamentalMetrics,
  type EarningsData,
} from '@/services/api/analysis';
import {
  fetchTechnicalData,
  type TechnicalData,
} from '@/services/api/technical';
import { fetchPortfolioNews, type NewsArticle } from '@/services/api/news';
import { TechnicalChart } from './TechnicalChart';
import { Recommendations as RecommendationsComponent } from './Recommendations';
import {
  InfoTooltip,
  Button,
  LoadingSpinner,
  EmptyState,
  ErrorState,
} from '@/components/shared';
import { Tabs } from '@/components/shared/Tabs';
import { holdingsApi } from '@/services/api';
import {
  BottomSheetSelect,
  type SelectOption,
} from '@/components/shared/BottomSheet';
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
import {
  generateAllRecommendations,
  getFilteredInsiderSentiment,
  type InsiderTimeRange,
  type EnrichedAnalystData,
  type StockRecommendation,
} from '@/utils/recommendations';
import { ColumnPicker } from './ColumnPicker';
import './Analysis.css';

interface AnalysisProps {
  portfolioId: string | null;
}

type SortKey =
  | 'ticker'
  | 'weight'
  | 'currentPrice'
  | 'priceChangePercent'
  | 'numberOfAnalysts'
  | 'consensusScore'
  | 'insiderMspr'
  | string; // Allow any string for dynamic fundamental columns

type TabType = 'analysts' | 'fundamentals' | 'technicals' | 'recommendations';

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

  // Technical analysis state
  const [technicalData, setTechnicalData] = useState<TechnicalData[]>([]);
  const [technicalLoading, setTechnicalLoading] = useState(false);
  const [selectedTechnicalStock, setSelectedTechnicalStock] = useState<
    string | null
  >(null);

  // Recommendations state
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [recommendations, setRecommendations] = useState<StockRecommendation[]>(
    []
  );
  const [recsLoading, setRecsLoading] = useState(false);

  // Mobile tooltip state
  const [mobileTooltip, setMobileTooltip] = useState<{
    text: string;
    title: string;
  } | null>(null);

  // Helper function to get indicator by key (defined early for useMemo)
  const getIndicatorByKey = (key: string): AnalysisIndicator | undefined => {
    return indicators.find((i) => i.key === key);
  };

  // Sort options for mobile BottomSheet
  const sortOptions = useMemo((): SelectOption[] => {
    const baseOptions: SelectOption[] = [
      { value: 'ticker', label: 'Name' },
      { value: 'weight', label: 'Weight' },
    ];
    const indicatorOptions: SelectOption[] = selectedColumns
      .map((key) => {
        const indicator = getIndicatorByKey(key);
        if (!indicator) return null;
        return { value: key, label: indicator.short_name };
      })
      .filter((opt): opt is SelectOption => opt !== null);
    return [...baseOptions, ...indicatorOptions];
  }, [selectedColumns, indicators]);

  useEffect(() => {
    loadData();
    loadIndicators();
  }, [portfolioId]);

  // Load technical data when switching to technicals or recommendations tab
  useEffect(() => {
    if (
      (activeTab === 'technicals' || activeTab === 'recommendations') &&
      portfolioId &&
      technicalData.length === 0 &&
      !technicalLoading
    ) {
      loadTechnicalData();
    }
  }, [activeTab, portfolioId]);

  // Load recommendations when switching to recommendations tab
  useEffect(() => {
    if (
      activeTab === 'recommendations' &&
      portfolioId &&
      analystData.length > 0
    ) {
      loadRecommendations();
    }
  }, [
    activeTab,
    portfolioId,
    analystData.length,
    technicalData.length,
    insiderTimeRange,
  ]);

  const loadRecommendations = async () => {
    if (!portfolioId || analystData.length === 0) return;

    setRecsLoading(true);
    try {
      // Load news if not already loaded
      let news = newsArticles;
      if (newsArticles.length === 0) {
        const newsResult = await fetchPortfolioNews(portfolioId);
        news = newsResult.articles || [];
        setNewsArticles(news);
      }

      // Generate recommendations
      const recs = generateAllRecommendations(
        analystData,
        technicalData,
        news,
        insiderTimeRange
      );
      setRecommendations(recs);
    } catch (err) {
      console.error('Failed to load recommendations:', err);
    } finally {
      setRecsLoading(false);
    }
  };

  const loadTechnicalData = async () => {
    if (!portfolioId) return;

    try {
      setTechnicalLoading(true);
      const result = await fetchTechnicalData(portfolioId);

      if (result.data && result.data.length > 0) {
        setTechnicalData(result.data);
        // Don't auto-select - let user click to open detail
      }
    } catch (err) {
      console.error('Failed to load technical data:', err);
    } finally {
      setTechnicalLoading(false);
    }
  };

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

          // Get target price from holding
          const targetPrice = holding.target_price ?? null;
          const distanceToTarget =
            targetPrice && analyst.currentPrice
              ? ((targetPrice - analyst.currentPrice) / analyst.currentPrice) *
                100
              : null;

          return {
            ...analyst,
            weight,
            currentValue,
            totalShares: holding.total_shares,
            avgBuyPrice: holding.avg_buy_price,
            totalInvested: holding.total_invested_czk,
            unrealizedGain: holding.unrealized_gain || 0,
            gainPercentage: holding.gain_percentage || 0,
            targetPrice,
            distanceToTarget,
          };
        })
        .filter((item): item is EnrichedAnalystData => item !== null);

      setAnalystData(enriched);
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
      case 'insiderMspr':
        return item.insiderSentiment?.mspr ?? 0;
      default:
        // Try to get value from fundamentals for dynamic columns
        if (item.fundamentals) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const value = (item.fundamentals as any)[key];
          if (typeof value === 'number') return value;
        }
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
        <EmptyState
          title="Select a portfolio"
          description="Analysis is not available for 'All Portfolios' view. Please select a specific portfolio."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="analysis">
        <LoadingSpinner text="Loading analyst data..." fullPage />
      </div>
    );
  }

  if (error) {
    return (
      <div className="analysis">
        <ErrorState message={error} onRetry={loadData} />
      </div>
    );
  }

  return (
    <div className="analysis">
      <div className="analysis-header">
        <h2>Analysis</h2>
        <Button variant="outline" onClick={loadData}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
            <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
            <path d="M16 21h5v-5" />
          </svg>
          Refresh
        </Button>
      </div>

      {/* Tab Navigation */}
      <Tabs
        value={activeTab}
        onChange={(value) => setActiveTab(value as TabType)}
        options={[
          { value: 'analysts', label: 'Analysts' },
          { value: 'fundamentals', label: 'Fundamentals' },
          { value: 'technicals', label: 'Technical' },
          { value: 'recommendations', label: 'Recommendations' },
        ]}
        className="analysis-tabs"
      />

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
                    >
                      Score{' '}
                      <InfoTooltip text="CO TO JE: Consensus Score = váž ené skóre doporučení analytiků. STUPNICE: -2 (Strong Sell) → 0 (Hold) → +2 (Strong Buy). JAK ČÍST: Kladné číslo (+) = analytici doporučují nákup. Záporné číslo (-) = analytici doporučují prodej. Blízko 0 = držet. IDEÁLNÍ: Nad +0.5 je dobré, nad +1 je výborné." />{' '}
                      <SortIcon column="consensusScore" />
                    </th>
                    <th className="center">Breakdown</th>
                    <th
                      className="center"
                      onClick={() => handleSort('numberOfAnalysts')}
                    >
                      Analysts <SortIcon column="numberOfAnalysts" />
                    </th>
                    <th className="center">Earnings (4Q)</th>
                    <th className="center">
                      Updated{' '}
                      <InfoTooltip text="CO TO JE: Datum poslední aktualizace dat od Finnhub. PROČ JE TO DŮLEŽITÉ: Starší data mohou být méně relevantní. Ideálně by měla být data aktualizována v posledních 1-2 měsících. Pokud je datum staré (více než 3 měsíce), berte doporučení s rezervou." />
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
                            {item.earnings
                              .slice(0, 4)
                              .map((e: EarningsData, i: number) => (
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

            {/* Mobile Cards */}
            <div className="analyst-cards">
              {sortedData.map((item) => (
                <div key={item.ticker} className="analyst-card">
                  <div className="analyst-card-header">
                    <div className="analyst-card-title">
                      <span className="ticker">{item.ticker}</span>
                      <span className="name">{item.stockName}</span>
                    </div>
                    <div className="analyst-card-rating">
                      <span
                        className={`recommendation-badge ${getRecommendationClass(
                          item.recommendationKey
                        )}`}
                      >
                        {getRecommendationLabel(item.recommendationKey)}
                      </span>
                    </div>
                  </div>
                  <div className="analyst-card-stats">
                    <div className="analyst-card-stat">
                      <span className="label">Price</span>
                      <span className="value">
                        {formatNumber(item.currentPrice)}
                      </span>
                    </div>
                    <div className="analyst-card-stat">
                      <span className="label">Change</span>
                      <span
                        className={`value ${
                          (item.priceChangePercent ?? 0) >= 0
                            ? 'positive'
                            : 'negative'
                        }`}
                      >
                        {formatPercent(item.priceChangePercent)}
                      </span>
                    </div>
                    <div className="analyst-card-stat">
                      <span className="label">Weight</span>
                      <span className="value">{item.weight.toFixed(1)}%</span>
                    </div>
                    <div className="analyst-card-stat">
                      <span className="label">Score</span>
                      <span
                        className={`value ${
                          item.consensusScore !== null
                            ? item.consensusScore > 0.5
                              ? 'positive'
                              : item.consensusScore < -0.5
                              ? 'negative'
                              : ''
                            : ''
                        }`}
                      >
                        {item.consensusScore !== null
                          ? `${
                              item.consensusScore > 0 ? '+' : ''
                            }${item.consensusScore.toFixed(2)}`
                          : '—'}
                      </span>
                    </div>
                    <div className="analyst-card-stat">
                      <span className="label">Analysts</span>
                      <span className="value">
                        {item.numberOfAnalysts || '—'}
                      </span>
                    </div>
                    <div className="analyst-card-stat">
                      <span className="label">Earnings</span>
                      <span className="value">
                        {item.earnings && item.earnings.length > 0 ? (
                          <span className="earnings-surprises">
                            {item.earnings
                              .slice(0, 4)
                              .map((e: EarningsData, i: number) => (
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
                          </span>
                        ) : (
                          '—'
                        )}
                      </span>
                    </div>
                    {item.numberOfAnalysts && (
                      <div className="analyst-card-breakdown">
                        <span className="label">Breakdown:</span>
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
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Analyst Summary */}
          <section className="analysis-section">
            <h3>Analyst Insights</h3>
            <div className="insights-grid">
              <div className="insight-card">
                <span className="insight-label">
                  Avg Consensus Score{' '}
                  <InfoTooltip text="CO TO JE: Průměrné skóre doporučení analytiků přes celé portfolio. STUPNICE: -2 (Strong Sell = silný prodej) → 0 (Hold = držet) → +2 (Strong Buy = silný nákup). JAK ČÍST: Nad 0 = analytici jsou celkově optimističtí. Pod 0 = analytici jsou celkově pesimističtí. IDEÁLNÍ: Nad +0.5 značí zdravé portfolio z pohledu analytiků." />
                </span>
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
                          onClick={() => handleSort(key)}
                        >
                          {indicator.short_name}
                          <InfoTooltip text={indicator.description} />
                          <SortIcon column={key} />
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

            {/* Mobile Fundamentals Cards */}
            <div className="fundamentals-mobile">
              {/* Mobile Sort Selector */}
              <div className="mobile-sort-row">
                <BottomSheetSelect
                  label="Sort by"
                  value={sortKey}
                  onChange={(value) => {
                    setSortKey(value);
                    setSortAsc(false);
                  }}
                  options={sortOptions}
                />
                <button
                  className="mobile-sort-dir"
                  onClick={() => setSortAsc(!sortAsc)}
                  title={sortAsc ? 'Ascending' : 'Descending'}
                >
                  {sortAsc ? '↑' : '↓'}
                </button>
              </div>

              {/* Mobile Cards */}
              <div className="fundamentals-cards">
                {sortedData.map((item) => {
                  const f = item.fundamentals;
                  return (
                    <div key={item.ticker} className="fundamentals-card">
                      <div className="fundamentals-card-header">
                        <div className="fundamentals-card-title">
                          <span className="ticker">{item.ticker}</span>
                          <span className="name">{item.stockName}</span>
                        </div>
                        <span className="fundamentals-card-weight">
                          {item.weight.toFixed(1)}%
                        </span>
                      </div>
                      <div className="fundamentals-card-metrics">
                        {selectedColumns.map((key) => {
                          const indicator = getIndicatorByKey(key);
                          if (!indicator) return null;
                          const value = getMetricValue(f, key);
                          return (
                            <div key={key} className="fundamentals-metric">
                              <span
                                className="metric-label"
                                onClick={() =>
                                  setMobileTooltip({
                                    title: indicator.name,
                                    text: indicator.description,
                                  })
                                }
                              >
                                {indicator.short_name}
                                <span className="metric-info-icon">ⓘ</span>
                              </span>
                              <span
                                className={`metric-value ${getValueClass(
                                  value,
                                  indicator
                                )}`}
                              >
                                {formatIndicatorValue(value, indicator)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Insider Sentiment Section */}
          <section className="analysis-section">
            <div className="insider-section-header">
              <div className="insider-title-row">
                <h3>Insider Sentiment</h3>
                <InfoTooltip text="CO TO JE: Insider Sentiment = nálada insiderů (vedení firmy). Sleduje nákupy a prodeje akcií managementem a řediteli (Form 4 filings). PROČ JE TO DŮLEŽITÉ: Vysoký nákup insiderů často signalizuje důvěru ve firmu. MSPR: Monthly Share Purchase Ratio (-100 až +100). Kladné = nákup, záporné = prodej. Net Shares: Celkový počet akcií nakoupených minus prodaných." />
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
            <h3>Fundamental Insights</h3>
            <p className="section-description">
              Portfolio-weighted averages and key metrics across your holdings.
            </p>

            {/* Valuation Row */}
            <div className="insights-category">
              <span className="category-label">Valuation</span>
              <div className="insights-grid">
                <div className="insight-card">
                  <span className="insight-label">
                    Avg P/E{' '}
                    <InfoTooltip text="CO TO JE: Price-to-Earnings = poměr ceny akcie k zisku na akcii. Udává, kolik let by trvalo, než se investice 'vrátí' ze zisků. JAK ČÍST: Nížší P/E = akcie může být levnější (podhodnocená). Vyšší P/E = investori očekávají růst. TYPICKÉ HODNOTY: Pod 15 = levné, 15-25 = normální, Nad 25 = drahé nebo růstové." />
                  </span>
                  <span className="insight-value">
                    {getWeightedAverage('peRatio').toFixed(1)}x
                  </span>
                </div>
                <div className="insight-card">
                  <span className="insight-label">
                    Avg Fwd P/E{' '}
                    <InfoTooltip text="CO TO JE: Forward P/E = P/E založené na ODHADOVANÝCH budoucích ziskách (následující rok). JAK ČÍST: Porovnejte s běžným P/E. Fwd P/E NIŽŠÍ než P/E = analytici očekávají růst zisků. Fwd P/E VYŠŠÍ než P/E = analytici očekávají pokles zisků." />
                  </span>
                  <span className="insight-value">
                    {getWeightedAverage('forwardPe').toFixed(1)}x
                  </span>
                </div>
                <div className="insight-card">
                  <span className="insight-label">
                    Avg P/B{' '}
                    <InfoTooltip text="CO TO JE: Price-to-Book = poměr ceny akcie k účetní hodnotě (aktiva - dluhy). JAK ČÍST: P/B pod 1 = akcie se obchoduje pod hodnotou majetku (potenciálně levná). P/B nad 3 = akcie je drahá nebo má velkou hodnotu značky/technologií. POZOR: Tech firmy mají běžně vysoké P/B." />
                  </span>
                  <span className="insight-value">
                    {getWeightedAverage('pbRatio').toFixed(2)}x
                  </span>
                </div>
                <div className="insight-card">
                  <span className="insight-label">
                    Avg EV/EBITDA{' '}
                    <InfoTooltip text="CO TO JE: Enterprise Value / EBITDA = hodnota firmy dělená provozním ziskem. Lepší než P/E pro porovnání firem s různým zadlužením. JAK ČÍST: Nižší = levnější. TYPICKÉ HODNOTY: Pod 10 = levné, 10-15 = normální, Nad 15 = drahé nebo růstové." />
                  </span>
                  <span className="insight-value">
                    {getWeightedAverage('evEbitda').toFixed(1)}x
                  </span>
                </div>
              </div>
            </div>

            {/* Profitability Row */}
            <div className="insights-category">
              <span className="category-label">Profitability</span>
              <div className="insights-grid">
                <div className="insight-card">
                  <span className="insight-label">
                    Avg ROE{' '}
                    <InfoTooltip text="CO TO JE: Return on Equity = návratnost vlastního kapitálu. Ukazuje, jak efektivně firma využívá peníze akcionářů k tvorbě zisku. JAK ČÍST: Vyšší = lepší. Nad 15% je obecně dobré. Nad 20% je výborné. Pod 10% je slabé. IDEÁLNÍ: Co nejvyšší ROE." />
                  </span>
                  <span
                    className={`insight-value ${
                      getWeightedAverage('roe') > 15 ? 'positive' : ''
                    }`}
                  >
                    {getWeightedAverage('roe').toFixed(1)}%
                  </span>
                </div>
                <div className="insight-card">
                  <span className="insight-label">
                    Avg Net Margin{' '}
                    <InfoTooltip text="CO TO JE: Net Profit Margin = čistá zisková marže. Kolik procent z tržeb zůstane jako čistý zisk. JAK ČÍST: Vyšší = lepší. Nad 10% je dobré. Nad 20% je výborné. Závisí na odvětví - tech firmy mají vyšší marže než maloobchod." />
                  </span>
                  <span
                    className={`insight-value ${
                      getWeightedAverage('netMargin') > 10 ? 'positive' : ''
                    }`}
                  >
                    {getWeightedAverage('netMargin').toFixed(1)}%
                  </span>
                </div>
                <div className="insight-card">
                  <span className="insight-label">
                    Avg Gross Margin{' '}
                    <InfoTooltip text="CO TO JE: Gross Margin = hrubá marže. Tržby minus náklady na výrobu/služby. JAK ČÍST: Vyšší = větší cenová síla a konkurenceschopnost. Nad 40% je dobré. Nad 60% značí silné konkurencenční výhody (jako Apple, Microsoft)." />
                  </span>
                  <span className="insight-value">
                    {getWeightedAverage('grossMargin').toFixed(1)}%
                  </span>
                </div>
                <div className="insight-card">
                  <span className="insight-label">
                    Dividend Payers{' '}
                    <InfoTooltip text="CO TO JE: Počet akcií ve vašem portfoliu, které vyplácejí dividendy. Dividendy = pravidelný příjem z drž ení akcií. JAK ČÍST: Více dividendových akcií = stabilnější příjem, ale možná nižší růst. Růstové firmy často dividendy nevyplácejí a raději reinvestují." />
                  </span>
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
                <div className="insight-card">
                  <span className="insight-label">
                    Avg Beta{' '}
                    <InfoTooltip text="CO TO JE: Beta = míra volatility (kolísavosti) ve srovnání s trhem (S&P 500). JAK ČÍST: Beta = 1 znamená pohyb s trhem. Beta > 1 = větší výkyvy než trh (riskantnější). Beta < 1 = menší výkyvy (stabilnější). Beta < 0 = pohyb opačně než trh. IDEÁLNÍ: Záleží na vaší toleranci k riziku. Konzervativní investori preferují Beta pod 1." />
                  </span>
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
                <div className="insight-card">
                  <span className="insight-label">
                    Avg D/E{' '}
                    <InfoTooltip text="CO TO JE: Debt-to-Equity = poměr dluhu k vlastnímu kapitálu. Ukazuje, jak moc je firma zadlužená. JAK ČÍST: Nižší = bezpečnější. Pod 0.5 = nízký dluh (výborné). 0.5-2 = normální. Nad 2 = vysoký dluh (rizikovejší). POZOR: Některá odvětví (banky, reality) mají přirozeně vyšší D/E." />
                  </span>
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
                <div className="insight-card">
                  <span className="insight-label">
                    Avg Revenue Growth{' '}
                    <InfoTooltip text="CO TO JE: Revenue Growth = růst tržeb za poslední rok. JAK ČÍST: Kladné číslo (+) = firma roste. Záporné číslo (-) = tržby klesají. TYPICKÉ HODNOTY: Růstové firmy: +15% a více. Stabilní firmy: 0-10%. Pokles tržeb: varovný signál. IDEÁLNÍ: Kladný růst, ideelně nad 10%." />
                  </span>
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
                <div className="insight-card">
                  <span className="insight-label">
                    Insider Buying ({insiderTimeRange}M){' '}
                    <InfoTooltip text="CO TO JE: Počet akcií, kde ředitelé a manažeři firmy NAKUPUJÍ vlastní akcie. PROČ JE TO DŮLEŽITÉ: Když insideri nakupují, věří v budoucnost firmy - to je pozitivní signál. Když prodávají, nemusí to být špatné (mohou potřebovat hotovost). JAK ČÍST: Více firem s insider buying = dobré znamení pro portfolio." />
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
            <p className="section-hint">Click row for chart detail</p>

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
                    <th className="center">
                      52W Range Position{' '}
                      <InfoTooltip text="CO TO JE: Pozice aktuální ceny v rámci 52týdenního (ročního) rozpětí. 0% = na ročním minimu, 100% = na ročním maximu. JAK ČÍST: Nad 80% = blízko maximům (silné momentum NEBO překoupená). Pod 20% = blízko minimům (slabé momentum NEBO příležitost k nákupu). 40-60% = střed rozpětí. POZOR: Vysoká pozice může znamenat buď sílu, nebo že je akcie drahá." />
                    </th>
                    <th className="left">
                      Peers{' '}
                      <InfoTooltip text="CO TO JE: Konkurenti a podobné firmy ve stejném odvětví. PROČ JE TO DŮLEŽITÉ: Můžete porovnat metriky vaší akcie s konkurenty. Pomáhá zjistit, zda je akcie lepší nebo horší než obdobné firmy." />
                    </th>
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
                    const hasTechnicalData = technicalData.some(
                      (d) => d.ticker === item.ticker
                    );
                    return (
                      <tr
                        key={item.ticker}
                        className={`clickable-row ${
                          hasTechnicalData ? '' : 'no-data'
                        }`}
                        onClick={() => {
                          if (hasTechnicalData) {
                            setSelectedTechnicalStock(item.ticker);
                          }
                        }}
                        title={
                          hasTechnicalData
                            ? 'Click to view technical chart'
                            : 'Loading technical data...'
                        }
                      >
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
                              {item.peers.map((peer: string, i: number) => (
                                <span key={i} className="peer-tag">
                                  {peer}
                                </span>
                              ))}
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

            {/* Mobile Technical Cards */}
            <div className="technicals-mobile">
              <div className="technicals-cards">
                {sortedData.map((item) => {
                  const rangePosition =
                    item.fiftyTwoWeekLow !== null &&
                    item.fiftyTwoWeekHigh !== null &&
                    item.currentPrice !== null
                      ? ((item.currentPrice - item.fiftyTwoWeekLow) /
                          (item.fiftyTwoWeekHigh - item.fiftyTwoWeekLow)) *
                        100
                      : null;
                  const hasTechnicalData = technicalData.some(
                    (d) => d.ticker === item.ticker
                  );
                  return (
                    <div
                      key={item.ticker}
                      className={`technicals-card ${
                        hasTechnicalData ? 'clickable' : 'no-data'
                      }`}
                      onClick={() => {
                        if (hasTechnicalData) {
                          setSelectedTechnicalStock(item.ticker);
                        }
                      }}
                    >
                      <div className="technicals-card-header">
                        <div className="technicals-card-title">
                          <span className="ticker">{item.ticker}</span>
                          <span className="name">{item.stockName}</span>
                        </div>
                        <span className="technicals-card-weight">
                          {item.weight.toFixed(1)}%
                        </span>
                      </div>

                      {/* 52W Range Visualization */}
                      {rangePosition !== null && (
                        <div className="technicals-range-section">
                          <div className="range-labels">
                            <span className="range-low">
                              {formatNumber(item.fiftyTwoWeekLow)}
                            </span>
                            <span className="range-current">
                              {formatNumber(item.currentPrice)}
                              <span
                                className={`range-change ${
                                  (item.priceChangePercent ?? 0) >= 0
                                    ? 'positive'
                                    : 'negative'
                                }`}
                              >
                                {formatPercent(item.priceChangePercent)}
                              </span>
                            </span>
                            <span className="range-high">
                              {formatNumber(item.fiftyTwoWeekHigh)}
                            </span>
                          </div>
                          <div className="range-bar-mobile">
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
                          <div className="range-position-label">
                            52W Position:{' '}
                            <strong>{rangePosition.toFixed(0)}%</strong>
                          </div>
                        </div>
                      )}

                      {/* Peers */}
                      {item.peers && item.peers.length > 0 && (
                        <div className="technicals-peers">
                          <span className="peers-label">Peers:</span>
                          <div className="peers-list">
                            {item.peers
                              .slice(0, 5)
                              .map((peer: string, i: number) => (
                                <span key={i} className="peer-tag">
                                  {peer}
                                </span>
                              ))}
                          </div>
                        </div>
                      )}

                      {hasTechnicalData && (
                        <div className="technicals-card-hint">
                          Tap for chart →
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Technical Chart Modal */}
            {selectedTechnicalStock &&
              technicalData.find(
                (d) => d.ticker === selectedTechnicalStock
              ) && (
                <TechnicalChart
                  data={
                    technicalData.find(
                      (d) => d.ticker === selectedTechnicalStock
                    )!
                  }
                  onClose={() => setSelectedTechnicalStock(null)}
                />
              )}

            {technicalLoading && (
              <div className="technical-loading-inline">
                <div className="spinner" />
                <span>Loading technical indicators...</span>
              </div>
            )}
          </section>

          {/* Technical Summary */}
          <section className="analysis-section">
            <h3>Technical Insights</h3>
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

      {/* Recommendations Tab */}
      {activeTab === 'recommendations' && (
        <RecommendationsComponent
          recommendations={recommendations}
          portfolioId={portfolioId}
          loading={recsLoading || technicalLoading}
        />
      )}

      {analystData.length === 0 && (
        <div className="no-data">No holdings in this portfolio.</div>
      )}

      {/* Mobile Tooltip Modal */}
      {mobileTooltip && (
        <div
          className="mobile-tooltip-overlay"
          onClick={() => setMobileTooltip(null)}
        >
          <div
            className="mobile-tooltip-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mobile-tooltip-header">
              <h4>{mobileTooltip.title}</h4>
              <button onClick={() => setMobileTooltip(null)}>×</button>
            </div>
            <p>{mobileTooltip.text}</p>
          </div>
        </div>
      )}
    </div>
  );
}
