import { useState, useEffect, useMemo } from 'react';
import {
  fetchAnalystData,
  type FundamentalMetrics,
  type EarningsData,
  type RateLimitInfo,
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
  MobileSortControl,
  MetricCard,
  type SortField,
} from '@/components/shared';
import {
  SectionTitle,
  CardTitle,
  Description,
  Ticker,
  StockName,
  MetricLabel,
  MetricValue,
  Muted,
  Text,
  RecItem,
  Badge,
  SortIcon,
  Tag,
} from '@/components/shared/Typography';
import { Tabs } from '@/components/shared/Tabs';
import { holdingsApi } from '@/services/api';
import { type SelectOption } from '@/components/shared/BottomSheet';
import {
  getAllIndicators,
  getUserViews,
  createView,
  updateViewColumns,
  deleteView,
  updateView,
  DEFAULT_INDICATOR_KEYS,
  type AnalysisIndicator,
  type UserAnalysisView,
} from '@/services/api/indicators';
import {
  formatIndicatorValue,
  getIndicatorValueClass,
  getInsiderSentimentLabel,
} from '@/utils/format';
import {
  generateAllRecommendations,
  getFilteredInsiderSentiment,
  type InsiderTimeRange,
  type EnrichedAnalystData,
  type StockRecommendation,
} from '@/utils/recommendations';
import { ColumnPicker } from './ColumnPicker';
import './Analysis.css';

// Debug info for tracking data load status per stock
interface StockDataStatus {
  ticker: string;
  hasAnalyst: boolean;
  hasFundamentals: boolean;
  hasTechnical: boolean;
  hasNews: boolean;
  isValid: boolean; // Has minimum required data for recommendation
}

// Overall data load status
interface DataLoadStatus {
  stocks: StockDataStatus[];
  rateLimited?: { finnhub: boolean; yahoo: boolean };
  totalStocks: number;
  validStocks: number;
  errors: string[];
}

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
  const [selectedTechnicalStock, setSelectedTechnicalStock] = useState<
    string | null
  >(null);

  // Recommendations state (prefetched with initial load)
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [recommendations, setRecommendations] = useState<StockRecommendation[]>(
    []
  );

  // Data load status for debug panel
  const [dataLoadStatus, setDataLoadStatus] = useState<DataLoadStatus>({
    stocks: [],
    totalStocks: 0,
    validStocks: 0,
    errors: [],
  });
  const [showDebugPanel, setShowDebugPanel] = useState(false);

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

  // Sort fields for MobileSortControl
  const sortFields = useMemo((): SortField[] => {
    return sortOptions.map((opt) => ({
      value: opt.value,
      label: opt.label,
      defaultDirection: 'desc' as const,
    }));
  }, [sortOptions]);

  useEffect(() => {
    loadData();
    loadIndicators();
  }, [portfolioId]);

  // Regenerate recommendations when insider time range changes
  useEffect(() => {
    if (analystData.length > 0 && dataLoadStatus.stocks.length > 0) {
      // Filter to only stocks with valid data
      const validEnriched = analystData.filter((stock) => {
        const status = dataLoadStatus.stocks.find(
          (s) => s.ticker === stock.ticker
        );
        return status?.isValid ?? false;
      });

      const recs = generateAllRecommendations(
        validEnriched,
        technicalData,
        newsArticles,
        insiderTimeRange
      );
      setRecommendations(recs);
    }
  }, [
    insiderTimeRange,
    analystData,
    technicalData,
    newsArticles,
    dataLoadStatus.stocks,
  ]);

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
      setError('Vyberte portfolio pro zobrazení analýzy');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setDataLoadStatus({
        stocks: [],
        totalStocks: 0,
        validStocks: 0,
        errors: [],
      });

      // Fetch ALL data in parallel: analyst, holdings, technical, and news
      const [analysisResult, holdings, technicalResult, newsResult] =
        await Promise.all([
          fetchAnalystData(portfolioId),
          holdingsApi.getPortfolioSummary(portfolioId),
          fetchTechnicalData(portfolioId).catch(() => ({
            data: [],
            rateLimited: undefined,
          })),
          fetchPortfolioNews(portfolioId).catch(() => ({ articles: [] })),
        ]);

      // Store technical and news data
      const techData = technicalResult.data || [];
      const news = newsResult.articles || [];
      setTechnicalData(techData);
      setNewsArticles(news);

      // Track rate limiting - combine from all sources
      const rateLimited: RateLimitInfo | undefined =
        analysisResult.rateLimited || technicalResult.rateLimited
          ? {
              finnhub: analysisResult.rateLimited?.finnhub ?? false,
              yahoo:
                analysisResult.rateLimited?.yahoo ??
                technicalResult.rateLimited?.yahoo ??
                false,
            }
          : undefined;

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

      // Build data load status for each stock
      const stockStatuses: StockDataStatus[] = enriched.map((stock) => {
        const techForStock = techData.find((t) => t.ticker === stock.ticker);

        // Technical: need RSI or MACD with actual values
        const hasTech = !!(
          techForStock &&
          (typeof techForStock.rsi14 === 'number' ||
            typeof techForStock.macd === 'number')
        );

        const hasStockNews = news.some((n) => n.ticker === stock.ticker);

        // Fundamentals: need at least 2 actual metric values
        const f = stock.fundamentals;
        const fundamentalValues = f
          ? [
              f.peRatio,
              f.roe,
              f.netMargin,
              f.grossMargin,
              f.revenueGrowth,
              f.debtToEquity,
              f.pbRatio,
            ].filter((v) => typeof v === 'number')
          : [];
        const hasFundamentals = fundamentalValues.length >= 2;

        // Analyst: need price AND (recommendation data OR consensus score)
        const hasPrice =
          typeof stock.currentPrice === 'number' && stock.currentPrice > 0;
        const hasRecommendation = !!(
          stock.recommendationKey ||
          typeof stock.consensusScore === 'number' ||
          typeof stock.numberOfAnalysts === 'number'
        );
        const hasAnalyst = hasPrice && hasRecommendation;

        // Stock is valid for recommendation only if it has ALL required data:
        // - Price (required for any calculation)
        // - Analyst data (recommendations/consensus)
        // - Fundamentals (at least 2 metrics)
        // - Technical data (RSI or MACD)
        const isValid = hasPrice && hasAnalyst && hasFundamentals && hasTech;

        return {
          ticker: stock.ticker,
          hasAnalyst,
          hasFundamentals,
          hasTechnical: hasTech,
          hasNews: hasStockNews,
          isValid,
        };
      });

      const validStocks = stockStatuses.filter((s) => s.isValid).length;

      setDataLoadStatus({
        stocks: stockStatuses,
        rateLimited,
        totalStocks: enriched.length,
        validStocks,
        errors: analysisResult.errors || [],
      });

      setAnalystData(enriched);

      // Generate recommendations only for valid stocks
      if (enriched.length > 0) {
        // Filter to only stocks with valid data
        const validEnriched = enriched.filter((stock) => {
          const status = stockStatuses.find((s) => s.ticker === stock.ticker);
          return status?.isValid ?? false;
        });

        const recs = generateAllRecommendations(
          validEnriched,
          techData,
          news,
          insiderTimeRange
        );
        setRecommendations(recs);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Nepodařilo se načíst data analýzy'
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

  const SortIconComponent = ({ column }: { column: SortKey }) => {
    if (sortKey !== column) return <SortIcon direction="none" />;
    return <SortIcon direction={sortAsc ? 'asc' : 'desc'} active />;
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
          title="Vyberte portfolio"
          description="Analýza není dostupná pro 'Všechna portfolia'. Vyberte konkrétní portfolio."
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="analysis">
        <LoadingSpinner text="Načítám data..." fullPage />
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

  // Compute debug status colors
  const allValid = dataLoadStatus.validStocks === dataLoadStatus.totalStocks;
  const hasRateLimited = !!(
    dataLoadStatus.rateLimited?.finnhub || dataLoadStatus.rateLimited?.yahoo
  );
  const debugBgColor = hasRateLimited
    ? '#f8d7da' // red - rate limited
    : allValid
    ? '#d4edda' // green - all OK
    : dataLoadStatus.validStocks > 0
    ? '#fff3cd' // yellow - partial
    : '#f5f5f5'; // neutral

  return (
    <div className="analysis">
      {/* Debug Panel Header */}
      <div
        style={{
          fontSize: '9px',
          fontFamily: 'monospace',
          color: '#333',
          padding: '4px 8px',
          background: debugBgColor,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
        onClick={() => setShowDebugPanel(!showDebugPanel)}
      >
        <span>
          stocks: {dataLoadStatus.totalStocks} | valid:{' '}
          {dataLoadStatus.validStocks} | tech: {technicalData.length} | news:{' '}
          {newsArticles.length} | recs: {recommendations.length}
          {hasRateLimited && (
            <span
              style={{ color: '#c00', fontWeight: 'bold', marginLeft: '8px' }}
            >
              RATE LIMITED: {dataLoadStatus.rateLimited?.finnhub && 'Finnhub '}
              {dataLoadStatus.rateLimited?.yahoo && 'Yahoo'}
            </span>
          )}
        </span>
        <span style={{ color: '#666' }}>
          {showDebugPanel ? '▼ hide' : '▶ show details'}
        </span>
      </div>

      {/* Expanded Debug Panel */}
      {showDebugPanel && dataLoadStatus.stocks.length > 0 && (
        <div
          style={{
            fontSize: '9px',
            fontFamily: 'monospace',
            padding: '8px',
            background: '#fafafa',
            border: '1px solid #ddd',
            borderTop: 'none',
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ccc' }}>
                <th style={{ textAlign: 'left', padding: '2px 4px' }}>
                  Ticker
                </th>
                <th style={{ textAlign: 'center', padding: '2px 4px' }}>
                  Analyst
                </th>
                <th style={{ textAlign: 'center', padding: '2px 4px' }}>
                  Fund.
                </th>
                <th style={{ textAlign: 'center', padding: '2px 4px' }}>
                  Tech
                </th>
                <th style={{ textAlign: 'center', padding: '2px 4px' }}>
                  News
                </th>
                <th style={{ textAlign: 'center', padding: '2px 4px' }}>
                  Valid
                </th>
              </tr>
            </thead>
            <tbody>
              {dataLoadStatus.stocks.map((stock) => (
                <tr
                  key={stock.ticker}
                  style={{
                    background: stock.isValid ? 'transparent' : '#fee',
                  }}
                >
                  <td style={{ padding: '2px 4px', fontWeight: 'bold' }}>
                    {stock.ticker}
                  </td>
                  <td
                    style={{
                      textAlign: 'center',
                      color: stock.hasAnalyst ? '#28a745' : '#dc3545',
                    }}
                  >
                    {stock.hasAnalyst ? '✓' : '✗'}
                  </td>
                  <td
                    style={{
                      textAlign: 'center',
                      color: stock.hasFundamentals ? '#28a745' : '#dc3545',
                    }}
                  >
                    {stock.hasFundamentals ? '✓' : '✗'}
                  </td>
                  <td
                    style={{
                      textAlign: 'center',
                      color: stock.hasTechnical ? '#28a745' : '#ffc107',
                    }}
                  >
                    {stock.hasTechnical ? '✓' : '○'}
                  </td>
                  <td
                    style={{
                      textAlign: 'center',
                      color: stock.hasNews ? '#28a745' : '#999',
                    }}
                  >
                    {stock.hasNews ? '✓' : '○'}
                  </td>
                  <td
                    style={{
                      textAlign: 'center',
                      fontWeight: 'bold',
                      color: stock.isValid ? '#28a745' : '#dc3545',
                    }}
                  >
                    {stock.isValid ? '✓' : '✗'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {dataLoadStatus.errors.length > 0 && (
            <div style={{ marginTop: '8px', color: '#c00' }}>
              Errors: {dataLoadStatus.errors.join(', ')}
            </div>
          )}
          <div style={{ marginTop: '8px', color: '#666' }}>
            Legend: ✓ = OK, ✗ = missing (required), ○ = missing (optional)
          </div>
        </div>
      )}

      <div className="analysis-header">
        <SectionTitle>Analýza portfolia</SectionTitle>
        <Button variant="outline" size="sm" onClick={loadData}>
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
          Obnovit
        </Button>
      </div>

      {/* Tab Navigation */}
      <Tabs
        value={activeTab}
        onChange={(value) => setActiveTab(value as TabType)}
        options={[
          { value: 'analysts', label: 'Analytici' },
          { value: 'fundamentals', label: 'Fundamenty' },
          { value: 'technicals', label: 'Technika' },
          { value: 'recommendations', label: 'Doporučení' },
        ]}
        className="analysis-tabs"
      />

      {/* Analysts Tab */}
      {activeTab === 'analysts' && (
        <>
          <section className="analysis-section">
            <SectionTitle>Doporučení analytiků</SectionTitle>
            <Description>
              Hodnocení analytiků a překvapení ve výsledcích z Finnhub (FREE
              tier).
            </Description>

            <div className="analysis-table-wrapper">
              <table className="analysis-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('ticker')}>
                      Akcie <SortIconComponent column="ticker" />
                    </th>
                    <th className="right" onClick={() => handleSort('weight')}>
                      Váha <SortIconComponent column="weight" />
                    </th>
                    <th
                      className="right"
                      onClick={() => handleSort('currentPrice')}
                    >
                      Cena <SortIconComponent column="currentPrice" />
                    </th>
                    <th
                      className="right"
                      onClick={() => handleSort('priceChangePercent')}
                    >
                      Změna <SortIconComponent column="priceChangePercent" />
                    </th>
                    <th className="center">Hodnocení</th>
                    <th
                      className="center"
                      onClick={() => handleSort('consensusScore')}
                    >
                      Skóre{' '}
                      <InfoTooltip text="**Consensus Score** | Vážené skóre doporučení analytiků na stupnici -2 až +2. | • -2 = Strong Sell (silný prodej) | • 0 = Hold (držet) | • +2 = Strong Buy (silný nákup) | Nad +0.5 je dobré, nad +1 výborné." />{' '}
                      <SortIconComponent column="consensusScore" />
                    </th>
                    <th className="center">Rozložení</th>
                    <th
                      className="center"
                      onClick={() => handleSort('numberOfAnalysts')}
                    >
                      Analytici <SortIconComponent column="numberOfAnalysts" />
                    </th>
                    <th className="center">Výsledky (4Q)</th>
                    <th className="center">
                      Aktualizováno{' '}
                      <InfoTooltip text="**Datum aktualizace** | Poslední aktualizace dat od Finnhub. | • Data starší než 3 měsíce berte s rezervou | • Ideálně aktualizováno v posledních 1-2 měsících" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedData.map((item) => (
                    <tr key={item.ticker}>
                      <td>
                        <div className="stock-cell">
                          <Ticker>{item.ticker}</Ticker>
                          <StockName truncate>{item.stockName}</StockName>
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
                          <Text size="sm">{item.weight.toFixed(1)}%</Text>
                        </span>
                      </td>
                      <td className="right">
                        <Text size="sm">{formatNumber(item.currentPrice)}</Text>
                      </td>
                      <td className="right">
                        <MetricValue
                          sentiment={
                            (item.priceChangePercent ?? 0) >= 0
                              ? 'positive'
                              : 'negative'
                          }
                        >
                          {formatPercent(item.priceChangePercent)}
                        </MetricValue>
                      </td>
                      <td className="center">
                        <Badge
                          variant={
                            item.recommendationKey === 'strong_buy' ||
                            item.recommendationKey === 'buy'
                              ? 'buy'
                              : item.recommendationKey === 'sell' ||
                                item.recommendationKey === 'underperform'
                              ? 'sell'
                              : 'hold'
                          }
                        >
                          {getRecommendationLabel(item.recommendationKey)}
                        </Badge>
                      </td>
                      <td className="center">
                        {item.consensusScore !== null ? (
                          <MetricValue
                            sentiment={
                              item.consensusScore > 0.5
                                ? 'positive'
                                : item.consensusScore < -0.5
                                ? 'negative'
                                : 'neutral'
                            }
                          >
                            {item.consensusScore > 0 ? '+' : ''}
                            {item.consensusScore.toFixed(2)}
                          </MetricValue>
                        ) : (
                          <Muted>—</Muted>
                        )}
                      </td>
                      <td className="center">
                        {item.numberOfAnalysts ? (
                          <div className="recommendations-breakdown">
                            <RecItem variant="strong-buy" title="Strong Buy">
                              {item.strongBuy || 0}
                            </RecItem>
                            <RecItem variant="buy" title="Buy">
                              {item.buy || 0}
                            </RecItem>
                            <RecItem variant="hold" title="Hold">
                              {item.hold || 0}
                            </RecItem>
                            <RecItem variant="sell" title="Sell">
                              {item.sell || 0}
                            </RecItem>
                            <RecItem variant="strong-sell" title="Strong Sell">
                              {item.strongSell || 0}
                            </RecItem>
                          </div>
                        ) : (
                          <Muted>—</Muted>
                        )}
                      </td>
                      <td className="center">
                        <Text size="sm">{item.numberOfAnalysts || '—'}</Text>
                      </td>
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
                          <Muted>—</Muted>
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
                      <Ticker>{item.ticker}</Ticker>
                      <StockName truncate>{item.stockName}</StockName>
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
                      <MetricLabel>Cena</MetricLabel>
                      <Text size="sm" weight="medium">
                        {formatNumber(item.currentPrice)}
                      </Text>
                    </div>
                    <div className="analyst-card-stat">
                      <MetricLabel>Změna</MetricLabel>
                      <MetricValue
                        sentiment={
                          (item.priceChangePercent ?? 0) >= 0
                            ? 'positive'
                            : 'negative'
                        }
                      >
                        {formatPercent(item.priceChangePercent)}
                      </MetricValue>
                    </div>
                    <div className="analyst-card-stat">
                      <MetricLabel>Váha</MetricLabel>
                      <Text size="sm" weight="medium">
                        {item.weight.toFixed(1)}%
                      </Text>
                    </div>
                    <div className="analyst-card-stat">
                      <MetricLabel>Skóre</MetricLabel>
                      <MetricValue
                        sentiment={
                          item.consensusScore !== null
                            ? item.consensusScore > 0.5
                              ? 'positive'
                              : item.consensusScore < -0.5
                              ? 'negative'
                              : 'neutral'
                            : 'neutral'
                        }
                      >
                        {item.consensusScore !== null
                          ? `${
                              item.consensusScore > 0 ? '+' : ''
                            }${item.consensusScore.toFixed(2)}`
                          : '—'}
                      </MetricValue>
                    </div>
                    <div className="analyst-card-stat">
                      <MetricLabel>Analytici</MetricLabel>
                      <Text size="sm" weight="medium">
                        {item.numberOfAnalysts || '—'}
                      </Text>
                    </div>
                    <div className="analyst-card-stat">
                      <MetricLabel>Výsledky</MetricLabel>
                      <Text size="sm" weight="medium">
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
                      </Text>
                    </div>
                    {item.numberOfAnalysts && (
                      <div className="analyst-card-breakdown">
                        <MetricLabel>Rozložení:</MetricLabel>
                        <div className="recommendations-breakdown">
                          <RecItem variant="strong-buy" title="Strong Buy">
                            {item.strongBuy || 0}
                          </RecItem>
                          <RecItem variant="buy" title="Buy">
                            {item.buy || 0}
                          </RecItem>
                          <RecItem variant="hold" title="Hold">
                            {item.hold || 0}
                          </RecItem>
                          <RecItem variant="sell" title="Sell">
                            {item.sell || 0}
                          </RecItem>
                          <RecItem variant="strong-sell" title="Strong Sell">
                            {item.strongSell || 0}
                          </RecItem>
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
            <SectionTitle>Souhrn analytiků</SectionTitle>
            <div className="insights-grid">
              <MetricCard
                label="Prům. Consensus Score"
                value={
                  analystData.filter((d) => d.consensusScore !== null).length >
                  0
                    ? (
                        analystData.reduce(
                          (sum, d) => sum + (d.consensusScore ?? 0),
                          0
                        ) /
                        analystData.filter((d) => d.consensusScore !== null)
                          .length
                      ).toFixed(2)
                    : null
                }
                subtext="/ 2.00"
                size="lg"
                sentiment={(() => {
                  const validData = analystData.filter(
                    (d) => d.consensusScore !== null
                  );
                  if (validData.length === 0) return undefined;
                  const avg =
                    analystData.reduce(
                      (sum, d) => sum + (d.consensusScore ?? 0),
                      0
                    ) / validData.length;
                  if (avg > 0.5) return 'positive';
                  if (avg < -0.5) return 'negative';
                  return 'neutral';
                })()}
                tooltip={
                  <InfoTooltip text="**Průměrné skóre analytiků** | Průměr consensus scores všech akcií v portfoliu. | • Nad 0 = analytici jsou optimističtí | • Pod 0 = analytici jsou pesimističtí | Nad +0.5 značí zdravé portfolio." />
                }
              />
              <MetricCard
                label="Akcie s Buy hodnocením"
                value={
                  analystData.filter(
                    (d) =>
                      d.recommendationKey === 'buy' ||
                      d.recommendationKey === 'strong_buy'
                  ).length
                }
                subValue={analystData.length}
                size="lg"
                sentiment="positive"
              />
              <MetricCard
                label="Akcie se Sell hodnocením"
                value={
                  analystData.filter(
                    (d) =>
                      d.recommendationKey === 'sell' ||
                      d.recommendationKey === 'underperform'
                  ).length
                }
                subValue={analystData.length}
                size="lg"
                sentiment="negative"
              />
              <MetricCard
                label="Celkové pokrytí analytiky"
                value={analystData.reduce(
                  (sum, d) => sum + (d.numberOfAnalysts || 0),
                  0
                )}
                subtext="analytiků"
                size="lg"
              />
              <MetricCard
                label="Překonaly výsledky (poslední Q)"
                value={
                  analystData.filter(
                    (d) =>
                      d.earnings?.length > 0 &&
                      (d.earnings[0]?.surprisePercent ?? 0) > 0
                  ).length
                }
                subValue={
                  analystData.filter(
                    (d) =>
                      d.earnings?.length > 0 &&
                      d.earnings[0]?.surprisePercent !== null &&
                      d.earnings[0]?.surprisePercent !== undefined
                  ).length
                }
                size="lg"
                sentiment="positive"
              />
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
                <SectionTitle>Fundamentální metriky</SectionTitle>
                <Description>
                  Přizpůsobte sloupce pro zobrazení metrik, které vás zajímají.
                  Data z Finnhub (FREE tier).
                </Description>
              </div>
              {currentView && <Badge variant="info">{currentView.name}</Badge>}
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
                      Akcie <SortIconComponent column="ticker" />
                    </th>
                    <th className="right" onClick={() => handleSort('weight')}>
                      Váha <SortIconComponent column="weight" />
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
                          <SortIconComponent column={key} />
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
                            <Ticker>{item.ticker}</Ticker>
                            <StockName truncate>{item.stockName}</StockName>
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
                              className={`right ${getIndicatorValueClass(
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
              <MobileSortControl
                fields={sortFields}
                selectedField={sortKey}
                direction={sortAsc ? 'asc' : 'desc'}
                onFieldChange={(field) => {
                  setSortKey(field);
                  setSortAsc(false);
                }}
                onDirectionChange={(dir) => setSortAsc(dir === 'asc')}
              />

              {/* Mobile Cards */}
              <div className="fundamentals-cards">
                {sortedData.map((item) => {
                  const f = item.fundamentals;
                  return (
                    <div key={item.ticker} className="fundamentals-card">
                      <div className="fundamentals-card-header">
                        <div className="fundamentals-card-title">
                          <Ticker>{item.ticker}</Ticker>
                          <StockName truncate>{item.stockName}</StockName>
                        </div>
                        <Text size="sm" weight="semibold">
                          {item.weight.toFixed(1)}%
                        </Text>
                      </div>
                      <div className="fundamentals-card-metrics">
                        {selectedColumns.map((key) => {
                          const indicator = getIndicatorByKey(key);
                          if (!indicator) return null;
                          const value = getMetricValue(f, key);
                          const valueClass = getIndicatorValueClass(
                            value,
                            indicator
                          );
                          const sentiment =
                            valueClass === 'positive'
                              ? 'positive'
                              : valueClass === 'negative'
                              ? 'negative'
                              : 'neutral';
                          return (
                            <div key={key} className="fundamentals-metric">
                              <MetricLabel
                                onClick={() =>
                                  setMobileTooltip({
                                    title: indicator.name,
                                    text: indicator.description,
                                  })
                                }
                              >
                                {indicator.short_name}
                                <span className="metric-info-icon">ⓘ</span>
                              </MetricLabel>
                              <MetricValue sentiment={sentiment}>
                                {formatIndicatorValue(value, indicator)}
                              </MetricValue>
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
                <SectionTitle>Insider Sentiment</SectionTitle>
                <InfoTooltip text="**Insider Sentiment** | Nálada insiderů (vedení firmy) - nákupy a prodeje akcií managementem. | • **MSPR** = Monthly Share Purchase Ratio (-100 až +100) | • Kladné = nákup, záporné = prodej | • Vysoký nákup insiderů signalizuje důvěru ve firmu" />
              </div>
              <div className="insider-time-filter">
                {INSIDER_TIME_RANGES.map((range) => (
                  <Button
                    key={range.value}
                    variant="ghost"
                    size="sm"
                    isActive={insiderTimeRange === range.value}
                    onClick={() => setInsiderTimeRange(range.value)}
                  >
                    {range.label}
                  </Button>
                ))}
              </div>
            </div>

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
                      <Ticker>{item.ticker}</Ticker>
                      {sentiment.label && (
                        <Badge
                          variant={
                            sentiment.class === 'positive'
                              ? 'buy'
                              : sentiment.class === 'negative'
                              ? 'sell'
                              : 'hold'
                          }
                        >
                          {sentiment.label}
                        </Badge>
                      )}
                    </div>
                    {hasData ? (
                      <>
                        <div className="insider-details">
                          <div className="insider-stat">
                            <MetricLabel>MSPR</MetricLabel>
                            <MetricValue
                              sentiment={
                                (filteredSentiment.mspr ?? 0) >= 0
                                  ? 'positive'
                                  : 'negative'
                              }
                            >
                              {(filteredSentiment.mspr ?? 0) >= 0 ? '+' : ''}
                              {filteredSentiment.mspr?.toFixed(1)}
                            </MetricValue>
                          </div>
                          <div className="insider-stat">
                            <MetricLabel>Net akcie</MetricLabel>
                            <MetricValue
                              sentiment={
                                (filteredSentiment.change ?? 0) >= 0
                                  ? 'positive'
                                  : 'negative'
                              }
                            >
                              {(filteredSentiment.change ?? 0) >= 0 ? '+' : ''}
                              {filteredSentiment.change?.toLocaleString()}
                            </MetricValue>
                          </div>
                        </div>
                        {/* Mini MSPR Chart - Left=Oldest, Right=Newest */}
                        {chartData.length > 1 && (
                          <div className="insider-chart">
                            <div className="chart-labels">
                              <MetricLabel>Starší</MetricLabel>
                              <MetricLabel>Novější</MetricLabel>
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
                        <Muted>Žádná insider data</Muted>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Fundamental Summary */}
          <section className="analysis-section">
            <SectionTitle>Fundamentální souhrn</SectionTitle>
            <Description>
              Vážené průměry portfolia a klíčové metriky vašich pozic.
            </Description>

            {/* Valuation Row */}
            <div className="insights-category">
              <Text weight="medium">Valuace</Text>
              <div className="insights-grid">
                <MetricCard
                  label="Avg P/E"
                  value={getWeightedAverage('peRatio').toFixed(1)}
                  suffix="x"
                  tooltip={
                    <InfoTooltip text="**Price-to-Earnings (P/E)** | Poměr ceny akcie k zisku na akcii. | • Pod 15 = levné | • 15-25 = normální | • Nad 25 = drahé nebo růstové | Nižší P/E může znamenat podhodnocenou akcii." />
                  }
                />
                <MetricCard
                  label="Avg Fwd P/E"
                  value={getWeightedAverage('forwardPe').toFixed(1)}
                  suffix="x"
                  tooltip={
                    <InfoTooltip text="**Forward P/E** | P/E založené na očekávaných budoucích ziscích. | • Fwd P/E < P/E = očekává se růst zisků | • Fwd P/E > P/E = očekává se pokles zisků" />
                  }
                />
                <MetricCard
                  label="Avg P/B"
                  value={getWeightedAverage('pbRatio').toFixed(2)}
                  suffix="x"
                  tooltip={
                    <InfoTooltip text="**Price-to-Book (P/B)** | Poměr ceny akcie k účetní hodnotě. | • Pod 1 = akcie pod hodnotou majetku | • Nad 3 = drahá nebo velká hodnota značky | Tech firmy mají běžně vysoké P/B." />
                  }
                />
                <MetricCard
                  label="Avg EV/EBITDA"
                  value={getWeightedAverage('evEbitda').toFixed(1)}
                  suffix="x"
                  tooltip={
                    <InfoTooltip text="**EV/EBITDA** | Hodnota firmy dělená provozním ziskem. | • Pod 10 = levné | • 10-15 = normální | • Nad 15 = drahé | Lepší pro srovnání firem s různým zadlužením." />
                  }
                />
              </div>
            </div>

            {/* Profitability Row */}
            <div className="insights-category">
              <Text weight="medium">Ziskovost</Text>
              <div className="insights-grid">
                <MetricCard
                  label="Avg ROE"
                  value={getWeightedAverage('roe').toFixed(1)}
                  suffix="%"
                  sentiment={
                    getWeightedAverage('roe') > 15 ? 'positive' : undefined
                  }
                  tooltip={
                    <InfoTooltip text="**Return on Equity (ROE)** | Návratnost vlastního kapitálu. | • Nad 15% = dobré | • Nad 20% = výborné | • Pod 10% = slabé | Ukazuje efektivitu využití peněz akcionářů." />
                  }
                />
                <MetricCard
                  label="Avg Net Margin"
                  value={getWeightedAverage('netMargin').toFixed(1)}
                  suffix="%"
                  sentiment={
                    getWeightedAverage('netMargin') > 10
                      ? 'positive'
                      : undefined
                  }
                  tooltip={
                    <InfoTooltip text="**Čistá zisková marže** | Kolik procent tržeb zůstane jako čistý zisk. | • Nad 10% = dobré | • Nad 20% = výborné | Závisí na odvětví - tech firmy mají vyšší marže." />
                  }
                />
                <MetricCard
                  label="Avg Gross Margin"
                  value={getWeightedAverage('grossMargin').toFixed(1)}
                  suffix="%"
                  tooltip={
                    <InfoTooltip text="**Hrubá marže** | Tržby minus náklady na výrobu/služby. | • Nad 40% = dobré | • Nad 60% = silné konkurenční výhody | Vyšší = větší cenová síla." />
                  }
                />
                <MetricCard
                  label="Dividendové akcie"
                  value={
                    analystData.filter(
                      (d) => (d.fundamentals?.dividendYield ?? 0) > 0
                    ).length
                  }
                  subValue={analystData.length}
                  tooltip={
                    <InfoTooltip text="**Dividendové akcie** | Počet akcií v portfoliu, které vyplácejí dividendy. | • Více dividend = stabilnější příjem | • Růstové firmy často dividendy nevyplácejí" />
                  }
                />
              </div>
            </div>

            {/* Risk & Growth Row */}
            <div className="insights-category">
              <Text weight="medium">Riziko a růst</Text>
              <div className="insights-grid">
                <MetricCard
                  label="Avg Beta"
                  value={getWeightedAverage('beta').toFixed(2)}
                  sentiment={
                    getWeightedAverage('beta') > 1.3
                      ? 'negative'
                      : getWeightedAverage('beta') < 0.8
                      ? 'positive'
                      : undefined
                  }
                  tooltip={
                    <InfoTooltip text="**Beta** | Míra volatility ve srovnání s trhem (S&P 500). | • Beta = 1 = pohyb s trhem | • Beta > 1 = větší výkyvy (riskantnejší) | • Beta < 1 = menší výkyvy (stabilnější)" />
                  }
                />
                <MetricCard
                  label="Avg D/E"
                  value={getWeightedAverage('debtToEquity').toFixed(2)}
                  sentiment={
                    getWeightedAverage('debtToEquity') > 2
                      ? 'negative'
                      : getWeightedAverage('debtToEquity') < 0.5
                      ? 'positive'
                      : undefined
                  }
                  tooltip={
                    <InfoTooltip text="**Debt-to-Equity (D/E)** | Poměr dluhu k vlastnímu kapitálu. | • Pod 0.5 = nízký dluh (výborné) | • 0.5-2 = normální | • Nad 2 = vysoký dluh (rizikovější)" />
                  }
                />
                <MetricCard
                  label="Avg Revenue Growth"
                  value={`${
                    getWeightedAverage('revenueGrowth') >= 0 ? '+' : ''
                  }${getWeightedAverage('revenueGrowth').toFixed(1)}`}
                  suffix="%"
                  sentiment={
                    getWeightedAverage('revenueGrowth') > 0
                      ? 'positive'
                      : getWeightedAverage('revenueGrowth') < 0
                      ? 'negative'
                      : undefined
                  }
                  tooltip={
                    <InfoTooltip text="**Růst tržeb** | Meziroční změna tržeb. | • Kladné = firma roste | • Záporné = tržby klesají | Růstové firmy: +15% a více. Pokles = varovný signál." />
                  }
                />
                <MetricCard
                  label={`Insider Buying (${insiderTimeRange}M)`}
                  value={
                    analystData.filter(
                      (d) =>
                        getFilteredInsiderSentiment(d, insiderTimeRange)
                          .mspr !== null &&
                        (getFilteredInsiderSentiment(d, insiderTimeRange)
                          .mspr ?? 0) > 0
                    ).length
                  }
                  subValue={
                    analystData.filter(
                      (d) =>
                        getFilteredInsiderSentiment(d, insiderTimeRange)
                          .mspr !== null
                    ).length
                  }
                  sentiment="positive"
                  tooltip={
                    <InfoTooltip text="**Insider nákupy** | Počet akcií, kde vedenie nakupuje vlastní akcie. | • Nákup insiderů = pozitivní signál | • Prodej nemusí být negativní (potřeba hotovosti) | Více firem s insider buying = dobré znamení." />
                  }
                />
              </div>
            </div>
          </section>
        </>
      )}

      {/* Technical Tab */}
      {activeTab === 'technicals' && (
        <>
          <section className="analysis-section">
            <SectionTitle>Cenová analýza</SectionTitle>
            <Description>Klikněte na řádek pro detail grafu</Description>

            <div className="analysis-table-wrapper">
              <table className="analysis-table technicals-table">
                <thead>
                  <tr>
                    <th onClick={() => handleSort('ticker')}>
                      Akcie <SortIconComponent column="ticker" />
                    </th>
                    <th className="right" onClick={() => handleSort('weight')}>
                      Váha <SortIconComponent column="weight" />
                    </th>
                    <th
                      className="right"
                      onClick={() => handleSort('currentPrice')}
                    >
                      Cena <SortIconComponent column="currentPrice" />
                    </th>
                    <th
                      className="right"
                      onClick={() => handleSort('priceChangePercent')}
                    >
                      Změna <SortIconComponent column="priceChangePercent" />
                    </th>
                    <th className="right">52W Min</th>
                    <th className="right">52W Max</th>
                    <th className="center">
                      Pozice v 52W rozmezí{' '}
                      <InfoTooltip text="**52W Range Position** | Pozice ceny v rámci ročního rozpětí. | • 0% = roční minimum | • 100% = roční maximum | • Nad 80% = silné momentum nebo překoupená | • Pod 20% = slabé momentum nebo příležitost" />
                    </th>
                    <th className="left">
                      Konkurenti{' '}
                      <InfoTooltip text="**Peers** | Konkurenti ve stejném odvětví. | Můžete porovnat metriky s konkurenty a zjistit, zda je akcie lepší nebo horší." />
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
                            ? 'Klikněte pro technický graf'
                            : 'Načítám technická data...'
                        }
                      >
                        <td>
                          <div className="stock-cell">
                            <Ticker>{item.ticker}</Ticker>
                            <StockName truncate>{item.stockName}</StockName>
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
                              <Text size="sm" color="muted">
                                {rangePosition.toFixed(0)}%
                              </Text>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="left">
                          {item.peers && item.peers.length > 0 ? (
                            <div className="peers-list">
                              {item.peers.map((peer: string, i: number) => (
                                <Tag key={i}>{peer}</Tag>
                              ))}
                            </div>
                          ) : (
                            <Muted>—</Muted>
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
                          <Ticker>{item.ticker}</Ticker>
                          <StockName truncate>{item.stockName}</StockName>
                        </div>
                        <Text weight="semibold">{item.weight.toFixed(1)}%</Text>
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
                            Pozice v 52W:{' '}
                            <strong>{rangePosition.toFixed(0)}%</strong>
                          </div>
                        </div>
                      )}

                      {/* Peers */}
                      {item.peers && item.peers.length > 0 && (
                        <div className="technicals-peers">
                          <span className="peers-label">Konkurenti:</span>
                          <div className="peers-list">
                            {item.peers
                              .slice(0, 5)
                              .map((peer: string, i: number) => (
                                <Tag key={i}>{peer}</Tag>
                              ))}
                          </div>
                        </div>
                      )}

                      {hasTechnicalData && (
                        <div className="technicals-card-hint">
                          <Muted>Ťukněte pro graf →</Muted>
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
          </section>

          {/* Technical Summary */}
          <section className="analysis-section">
            <SectionTitle>Technický souhrn</SectionTitle>
            <div className="insights-grid">
              <MetricCard
                label="Blízko 52W Max (>80%)"
                value={countNear52WeekHigh()}
                subValue={analystData.length}
              />
              <MetricCard
                label="Blízko 52W Min (<20%)"
                value={countNear52WeekLow()}
                subValue={analystData.length}
              />
              <MetricCard
                label="Dnes v plusu"
                value={
                  analystData.filter((d) => (d.priceChangePercent ?? 0) > 0)
                    .length
                }
                subValue={analystData.length}
                sentiment="positive"
              />
              <MetricCard
                label="Dnes v mínusu"
                value={
                  analystData.filter((d) => (d.priceChangePercent ?? 0) < 0)
                    .length
                }
                subValue={analystData.length}
                sentiment="negative"
              />
            </div>
          </section>
        </>
      )}

      {/* Recommendations Tab */}
      {activeTab === 'recommendations' && (
        <RecommendationsComponent
          recommendations={recommendations}
          portfolioId={portfolioId}
          loading={false}
        />
      )}

      {analystData.length === 0 && (
        <div className="no-data">Žádné akcie v tomto portfoliu.</div>
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
              <CardTitle>{mobileTooltip.title}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileTooltip(null)}
              >
                ×
              </Button>
            </div>
            <Description>{mobileTooltip.text}</Description>
          </div>
        </div>
      )}
    </div>
  );
}
