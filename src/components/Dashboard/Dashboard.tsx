import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { holdingsApi } from '@/services/api';
import type {
  PortfolioSummary,
  PortfolioTotals,
  OptionTransaction,
} from '@/types/database';
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  formatPrice,
} from '@/utils/format';
import { cn } from '@/utils/cn';
import { useSortable } from '@/hooks';
import {
  LoadingSpinner,
  ErrorState,
  EmptyState,
  MobileSortControl,
  Tabs,
  ToggleGroup,
  type SortField,
} from '@/components/shared';
import { OptionsList } from '@/components/Options';
import { TransactionReport } from './TransactionReport';
import {
  SectionTitle,
  Ticker,
  StockName,
  MetricLabel,
  MetricValue,
  Text,
} from '@/components/shared/Typography';
import './Dashboard.css';

type DashboardTab = 'stocks' | 'options';

// Aggregated holding type - combines multiple portfolio positions
interface AggregatedHolding {
  stock_id: string;
  ticker: string;
  stock_name: string;
  sector_name: string | null;
  // Aggregated values
  total_shares: number;
  total_invested_czk: number;
  current_value_czk: number | null;
  // Weighted average price (actual/scaled price)
  avg_buy_price: number;
  // From the stock (same across portfolios)
  current_price: number | null;
  price_change_percent: number | null;
  daily_volume: number | null;
  avg_volume_20: number | null;
  // Price scale for display conversion
  price_scale: number;
  // Calculated
  gain_percentage: number | null;
  // Array of individual holdings from different portfolios
  holdings: PortfolioSummary[];
  // Aggregated target (weighted average or null if any is null)
  target_price: number | null;
  distance_to_target_pct: number | null;
}

type SortKey =
  | 'ticker'
  | 'sector'
  | 'shares'
  | 'avgPrice'
  | 'currentPrice'
  | 'dailyChange'
  | 'volumeRatio'
  | 'invested'
  | 'current'
  | 'plCzk'
  | 'plPercent'
  | 'portfolio'
  | 'portfolioName'
  | 'targetPrice'
  | 'distanceToTarget';

/**
 * Convert scaled price back to raw/quoted price for display.
 * E.g., 12.90 GBP (actual) with scale 0.01 -> 1290 (quoted on LSE)
 */
function toDisplayPrice(
  scaledPrice: number | null | undefined,
  priceScale: number
): number | null {
  if (scaledPrice === null || scaledPrice === undefined) return null;
  if (priceScale === 0) return scaledPrice;
  return scaledPrice / priceScale;
}

// Helper function to aggregate holdings by stock
function aggregateHoldings(holdings: PortfolioSummary[]): AggregatedHolding[] {
  const byStock = new Map<string, PortfolioSummary[]>();

  for (const holding of holdings) {
    const existing = byStock.get(holding.stock_id) || [];
    existing.push(holding);
    byStock.set(holding.stock_id, existing);
  }

  return Array.from(byStock.entries()).map(([stockId, stockHoldings]) => {
    const first = stockHoldings[0];
    const totalShares = stockHoldings.reduce(
      (sum, h) => sum + h.total_shares,
      0
    );
    const totalInvestedCzk = stockHoldings.reduce(
      (sum, h) => sum + h.total_invested_czk,
      0
    );
    const currentValueCzk = stockHoldings.every(
      (h) => h.current_value_czk !== null
    )
      ? stockHoldings.reduce((sum, h) => sum + (h.current_value_czk || 0), 0)
      : null;

    // Weighted average buy price (in original currency)
    const avgBuyPrice =
      totalShares > 0
        ? stockHoldings.reduce(
            (sum, h) => sum + h.avg_buy_price * h.total_shares,
            0
          ) / totalShares
        : 0;

    // Calculate gain percentage
    const gainPercentage =
      currentValueCzk !== null && totalInvestedCzk > 0
        ? ((currentValueCzk - totalInvestedCzk) / totalInvestedCzk) * 100
        : null;

    // Weighted average target price (only if all have targets)
    const allHaveTarget = stockHoldings.every((h) => h.target_price !== null);
    const targetPrice = allHaveTarget
      ? stockHoldings.reduce(
          (sum, h) => sum + (h.target_price || 0) * h.total_shares,
          0
        ) / totalShares
      : null;

    // Distance to target
    const distanceToTargetPct =
      targetPrice !== null && first.current_price !== null
        ? ((targetPrice - first.current_price) / first.current_price) * 100
        : null;

    const dailyVolume =
      stockHoldings.find((h) => (h.daily_volume ?? null) !== null)
        ?.daily_volume ?? null;
    const avgVolume20 =
      stockHoldings.find((h) => (h.avg_volume_20 ?? null) !== null)
        ?.avg_volume_20 ?? null;

    return {
      stock_id: stockId,
      ticker: first.ticker,
      stock_name: first.stock_name,
      sector_name: first.sector_name,
      total_shares: totalShares,
      total_invested_czk: totalInvestedCzk,
      current_value_czk: currentValueCzk,
      avg_buy_price: avgBuyPrice,
      current_price: first.current_price,
      price_change_percent: first.price_change_percent,
      daily_volume: dailyVolume,
      avg_volume_20: avgVolume20,
      price_scale: first.price_scale ?? 1,
      gain_percentage: gainPercentage,
      holdings: stockHoldings,
      target_price: targetPrice,
      distance_to_target_pct: distanceToTargetPct,
    };
  });
}

const SORT_FIELDS: SortField[] = [
  { value: 'ticker', label: 'Ticker', defaultDirection: 'asc' },
  { value: 'dailyChange', label: 'Denní %', defaultDirection: 'desc' },
  { value: 'plPercent', label: 'P&L %', defaultDirection: 'desc' },
  { value: 'plCzk', label: 'P&L CZK', defaultDirection: 'desc' },
  { value: 'current', label: 'Hodnota', defaultDirection: 'desc' },
  { value: 'portfolio', label: 'Váha', defaultDirection: 'desc' },
  { value: 'distanceToTarget', label: 'K cíli', defaultDirection: 'asc' },
  { value: 'sector', label: 'Sektor', defaultDirection: 'asc' },
];

interface DashboardProps {
  portfolioId?: string | null;
  onStockClick?: (stockId: string) => void;
  onEditOptionTransaction?: (transaction: OptionTransaction) => void;
}

const TAB_OPTIONS = [
  { value: 'stocks', label: 'Akcie' },
  { value: 'options', label: 'Opce' },
];

type DistributionView = 'sector' | 'exchange' | 'country';

const DISTRIBUTION_OPTIONS = [
  { value: 'sector', label: 'Sektor' },
  { value: 'exchange', label: 'Burza' },
  { value: 'country', label: 'Země' },
];

// ISO country code to name mapping
const COUNTRY_NAMES: Record<string, string> = {
  US: 'USA',
  CN: 'Čína',
  HK: 'Hong Kong',
  DE: 'Německo',
  NL: 'Nizozemsko',
  DK: 'Dánsko',
  SE: 'Švédsko',
  GB: 'Velká Británie',
  FR: 'Francie',
  JP: 'Japonsko',
  KR: 'Jižní Korea',
  TW: 'Tchaj-wan',
  IN: 'Indie',
  BR: 'Brazílie',
  IL: 'Izrael',
  CA: 'Kanada',
  AU: 'Austrálie',
  CH: 'Švýcarsko',
  IE: 'Irsko',
  KZ: 'Kazachstán',
  SG: 'Singapur',
  ES: 'Španělsko',
  IT: 'Itálie',
  NO: 'Norsko',
  FI: 'Finsko',
  BE: 'Belgie',
  AT: 'Rakousko',
  PL: 'Polsko',
  CZ: 'Česko',
};

export function Dashboard({
  portfolioId,
  onStockClick,
  onEditOptionTransaction,
}: DashboardProps) {
  const [holdings, setHoldings] = useState<PortfolioSummary[]>([]);
  const [totals, setTotals] = useState<PortfolioTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>('stocks');
  const [expandedStocks, setExpandedStocks] = useState<Set<string>>(new Set());
  const [distributionView, setDistributionView] =
    useState<DistributionView>('sector');

  // Show portfolio column when viewing "All Portfolios"
  const showPortfolioColumn = portfolioId === null;
  const [error, setError] = useState<string | null>(null);

  // Aggregate holdings when viewing all portfolios
  const aggregatedHoldings = useMemo(() => {
    if (!showPortfolioColumn) return null;
    return aggregateHoldings(holdings);
  }, [holdings, showPortfolioColumn]);

  // Calculate exchange distribution
  const exchangeDistribution = useMemo(() => {
    if (!totals || holdings.length === 0) return [];

    const byExchange = new Map<string, number>();
    for (const holding of holdings) {
      const exchange = holding.exchange || 'Neznámá';
      const currentValue = holding.current_value_czk || 0;
      byExchange.set(exchange, (byExchange.get(exchange) || 0) + currentValue);
    }

    const totalValue = totals.totalCurrentValueCzk || 1;
    return Array.from(byExchange.entries())
      .map(([exchange, value]) => ({
        exchange,
        value,
        percentage: (value / totalValue) * 100,
      }))
      .sort((a, b) => b.percentage - a.percentage);
  }, [holdings, totals]);

  // Calculate country distribution
  const countryDistribution = useMemo(() => {
    if (!totals || holdings.length === 0) return [];

    const byCountry = new Map<string, number>();
    for (const holding of holdings) {
      const countryCode = holding.country;
      const countryName = countryCode
        ? COUNTRY_NAMES[countryCode] || countryCode
        : 'Neznámá';
      const currentValue = holding.current_value_czk || 0;
      byCountry.set(
        countryName,
        (byCountry.get(countryName) || 0) + currentValue
      );
    }

    const totalValue = totals.totalCurrentValueCzk || 1;
    return Array.from(byCountry.entries())
      .map(([country, value]) => ({
        country,
        value,
        percentage: (value / totalValue) * 100,
      }))
      .sort((a, b) => b.percentage - a.percentage);
  }, [holdings, totals]);

  // Toggle expand/collapse for a stock
  const toggleExpanded = useCallback((stockId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedStocks((prev) => {
      const next = new Set(prev);
      if (next.has(stockId)) {
        next.delete(stockId);
      } else {
        next.add(stockId);
      }
      return next;
    });
  }, []);

  // Value extractor for sorting aggregated holdings
  const getAggregatedValue = useCallback(
    (item: AggregatedHolding, field: SortKey): string | number | null => {
      const totalValue = totals?.totalCurrentValueCzk || 0;

      switch (field) {
        case 'ticker':
          return item.ticker.toLowerCase();
        case 'sector':
          return (item.sector_name || '').toLowerCase();
        case 'shares':
          return item.total_shares;
        case 'avgPrice':
          return item.avg_buy_price;
        case 'currentPrice':
          return item.current_price ?? -Infinity;
        case 'dailyChange':
          return item.price_change_percent ?? -Infinity;
        case 'volumeRatio':
          return item.daily_volume !== null &&
            item.avg_volume_20 !== null &&
            item.avg_volume_20 > 0
            ? item.daily_volume / item.avg_volume_20
            : -Infinity;
        case 'invested':
          return item.total_invested_czk;
        case 'current':
          return item.current_value_czk ?? -Infinity;
        case 'plCzk':
          return item.current_value_czk !== null
            ? item.current_value_czk - item.total_invested_czk
            : -Infinity;
        case 'plPercent':
          return item.gain_percentage ?? -Infinity;
        case 'portfolio':
          return totalValue && item.current_value_czk
            ? item.current_value_czk / totalValue
            : -Infinity;
        case 'portfolioName':
          return ''; // N/A for aggregated
        case 'targetPrice':
          return item.target_price ?? -Infinity;
        case 'distanceToTarget':
          return item.distance_to_target_pct ?? -Infinity;
        default:
          return null;
      }
    },
    [totals]
  );

  // Value extractor for sorting - needs totals for portfolio percentage calculation
  const getHoldingValue = useCallback(
    (item: PortfolioSummary, field: SortKey): string | number | null => {
      const totalValue = totals?.totalCurrentValueCzk || 0;

      switch (field) {
        case 'ticker':
          return item.ticker.toLowerCase();
        case 'sector':
          return (item.sector_name || '').toLowerCase();
        case 'shares':
          return item.total_shares;
        case 'avgPrice':
          return item.avg_buy_price;
        case 'currentPrice':
          return item.current_price ?? -Infinity;
        case 'dailyChange':
          return item.price_change_percent ?? -Infinity;
        case 'volumeRatio':
          return item.daily_volume !== null &&
            item.avg_volume_20 !== null &&
            item.avg_volume_20 > 0
            ? item.daily_volume / item.avg_volume_20
            : -Infinity;
        case 'invested':
          return item.total_invested_czk;
        case 'current':
          return item.current_value_czk ?? -Infinity;
        case 'plCzk':
          return item.current_value_czk !== null
            ? item.current_value_czk - item.total_invested_czk
            : -Infinity;
        case 'plPercent':
          return item.gain_percentage ?? -Infinity;
        case 'portfolio':
          return totalValue && item.current_value_czk
            ? item.current_value_czk / totalValue
            : -Infinity;
        case 'portfolioName':
          return item.portfolio_name.toLowerCase();
        case 'targetPrice':
          return item.target_price ?? -Infinity;
        case 'distanceToTarget':
          return item.distance_to_target_pct ?? -Infinity;
        default:
          return null;
      }
    },
    [totals]
  );

  // Sortable hook for regular (non-aggregated) view
  const {
    sortedData: sortedHoldings,
    sortField,
    sortDirection,
    handleSort,
    setSort,
    getSortIndicator,
    isSorted,
  } = useSortable<PortfolioSummary, SortKey>(holdings, getHoldingValue, {
    defaultField: 'ticker',
    ascendingFields: ['ticker', 'sector'],
  });

  // Sortable hook for aggregated view
  const {
    sortedData: sortedAggregated,
    sortField: aggSortField,
    sortDirection: aggSortDirection,
    handleSort: aggHandleSort,
    setSort: aggSetSort,
    getSortIndicator: aggGetSortIndicator,
    isSorted: aggIsSorted,
  } = useSortable<AggregatedHolding, SortKey>(
    aggregatedHoldings || [],
    getAggregatedValue,
    {
      defaultField: 'ticker',
      ascendingFields: ['ticker', 'sector'],
    }
  );

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [holdingsData, totalsData] = await Promise.all([
        holdingsApi.getPortfolioSummary(portfolioId ?? undefined),
        holdingsApi.getPortfolioTotals(portfolioId ?? undefined),
      ]);
      setHoldings(holdingsData);
      setTotals(totalsData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Nepodařilo se načíst portfolio'
      );
    } finally {
      setLoading(false);
    }
  };

  const SortHeader = ({
    label,
    sortKeyName,
    className,
  }: {
    label: string;
    sortKeyName: SortKey;
    className?: string;
  }) => {
    // Use aggregated sort when in "All Portfolios" view
    const sortFn = showPortfolioColumn ? aggHandleSort : handleSort;
    const isSortedFn = showPortfolioColumn ? aggIsSorted : isSorted;
    const getIndicator = showPortfolioColumn
      ? aggGetSortIndicator
      : getSortIndicator;

    return (
      <th
        className={cn(
          'sortable',
          className,
          isSortedFn(sortKeyName) && 'sorted'
        )}
        onClick={() => sortFn(sortKeyName)}
      >
        {label}
        {getIndicator(sortKeyName)}
      </th>
    );
  };

  if (loading) {
    return <LoadingSpinner text="Načítám portfolio..." />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  return (
    <div className="dashboard">
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <SectionTitle>Přehled portfolia</SectionTitle>
      </div>

      {/* Portfolio Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <MetricLabel>Investováno</MetricLabel>
          <MetricValue size="lg">
            {formatCurrency(totals?.totalInvestedCzk || 0)}
          </MetricValue>
        </div>

        <div className="summary-card">
          <MetricLabel>Aktuální hodnota</MetricLabel>
          <MetricValue size="lg">
            {formatCurrency(totals?.totalCurrentValueCzk || 0)}
          </MetricValue>
        </div>

        <div className="summary-card">
          <MetricLabel>Nerealizovaný P&L</MetricLabel>
          <div className="card-value-with-percent">
            <MetricValue
              size="lg"
              sentiment={
                (totals?.totalUnrealizedGain || 0) >= 0
                  ? 'positive'
                  : 'negative'
              }
            >
              {formatCurrency(totals?.totalUnrealizedGain || 0)}
            </MetricValue>
            <Text
              size="sm"
              color={
                (totals?.totalUnrealizedGain || 0) >= 0 ? 'success' : 'danger'
              }
            >
              {formatPercent(totals?.totalUnrealizedGainPercentage || 0)}
            </Text>
          </div>
        </div>

        <div className="summary-card">
          <MetricLabel>Počet akcií</MetricLabel>
          <div className="card-value-with-percent">
            <MetricValue size="lg">{totals?.stockCount || 0}</MetricValue>
          </div>
        </div>
      </div>

      {/* Holdings Section with Tabs */}
      <div className="holdings-section">
        <div className="holdings-header">
          <SectionTitle>Pozice</SectionTitle>
          <Tabs
            value={activeTab}
            onChange={(val) => setActiveTab(val as DashboardTab)}
            options={TAB_OPTIONS}
          />
        </div>

        {activeTab === 'options' ? (
          <OptionsList
            portfolioId={portfolioId ?? ''}
            onEditTransaction={onEditOptionTransaction}
          />
        ) : holdings.length === 0 ? (
          <EmptyState
            title="Žádné pozice"
            description="Přidejte akcii a transakci pro začátek!"
          />
        ) : (
          <>
            {/* Mobile Sort Controls */}
            <div className="mobile-sort-controls">
              <MobileSortControl
                fields={SORT_FIELDS}
                selectedField={showPortfolioColumn ? aggSortField : sortField}
                direction={
                  showPortfolioColumn ? aggSortDirection : sortDirection
                }
                onFieldChange={(field) => {
                  const fieldConfig = SORT_FIELDS.find(
                    (f) => f.value === field
                  );
                  const setSortFn = showPortfolioColumn ? aggSetSort : setSort;
                  setSortFn(
                    field as SortKey,
                    fieldConfig?.defaultDirection || 'desc'
                  );
                }}
                onDirectionChange={(dir) => {
                  const setSortFn = showPortfolioColumn ? aggSetSort : setSort;
                  const currentField = showPortfolioColumn
                    ? aggSortField
                    : sortField;
                  setSortFn(currentField, dir);
                }}
              />
            </div>

            {/* Mobile Cards View - Aggregated when viewing all portfolios */}
            <div className="holdings-cards">
              {showPortfolioColumn
                ? // Aggregated view - simple cards without expand on mobile
                  sortedAggregated.map((agg) => {
                    const plCzk =
                      agg.current_value_czk !== null
                        ? agg.current_value_czk - agg.total_invested_czk
                        : null;
                    const portfolioPercentage =
                      totals?.totalCurrentValueCzk && agg.current_value_czk
                        ? (agg.current_value_czk /
                            totals.totalCurrentValueCzk) *
                          100
                        : null;
                    const hasMultiple = agg.holdings.length > 1;

                    return (
                      <div
                        key={agg.stock_id}
                        className="holding-card"
                        onClick={() => onStockClick?.(agg.stock_id)}
                      >
                        <div className="holding-card-header">
                          <div className="holding-card-title">
                            <Ticker>{agg.ticker}</Ticker>
                            <StockName truncate>{agg.stock_name}</StockName>
                            {hasMultiple && (
                              <Text size="xs" color="muted">
                                {agg.holdings.length} portfolia
                              </Text>
                            )}
                          </div>
                          <div className="holding-card-pl">
                            <MetricValue
                              sentiment={
                                (plCzk || 0) >= 0 ? 'positive' : 'negative'
                              }
                            >
                              {plCzk !== null ? formatCurrency(plCzk) : '—'}
                            </MetricValue>
                            <Text
                              size="sm"
                              color={
                                (agg.gain_percentage || 0) >= 0
                                  ? 'success'
                                  : 'danger'
                              }
                            >
                              {formatPercent(agg.gain_percentage)}
                            </Text>
                          </div>
                        </div>
                        {agg.sector_name && (
                          <div className="holding-card-sector">
                            <Text size="xs" color="muted">
                              {agg.sector_name}
                            </Text>
                          </div>
                        )}
                        <div className="holding-card-stats">
                          <div className="holding-card-stat">
                            <MetricLabel>Počet</MetricLabel>
                            <MetricValue>
                              {formatNumber(agg.total_shares, 4)}
                            </MetricValue>
                          </div>
                          <div className="holding-card-stat">
                            <MetricLabel>Aktuální cena</MetricLabel>
                            <MetricValue>
                              {formatPrice(
                                toDisplayPrice(
                                  agg.current_price,
                                  agg.price_scale
                                )
                              )}
                            </MetricValue>
                          </div>
                          <div className="holding-card-stat">
                            <MetricLabel>Denní změna</MetricLabel>
                            <MetricValue
                              sentiment={
                                agg.price_change_percent !== null
                                  ? agg.price_change_percent >= 0
                                    ? 'positive'
                                    : 'negative'
                                  : undefined
                              }
                            >
                              {agg.price_change_percent !== null
                                ? formatPercent(
                                    agg.price_change_percent,
                                    2,
                                    true
                                  )
                                : '—'}
                            </MetricValue>
                          </div>
                          <div className="holding-card-stat">
                            <MetricLabel>Objem</MetricLabel>
                            <MetricValue>
                              {agg.daily_volume !== null &&
                              agg.avg_volume_20 !== null &&
                              agg.avg_volume_20 > 0
                                ? formatNumber(
                                    agg.daily_volume / agg.avg_volume_20,
                                    2,
                                    true
                                  )
                                : '—'}
                            </MetricValue>
                          </div>
                          <div className="holding-card-stat">
                            <MetricLabel>Investováno</MetricLabel>
                            <MetricValue>
                              {formatCurrency(agg.total_invested_czk)}
                            </MetricValue>
                          </div>
                          <div className="holding-card-stat">
                            <MetricLabel>Prům. cena</MetricLabel>
                            <MetricValue>
                              {formatPrice(
                                toDisplayPrice(
                                  agg.avg_buy_price,
                                  agg.price_scale
                                )
                              )}
                            </MetricValue>
                          </div>
                          <div className="holding-card-stat">
                            <MetricLabel>Hodnota</MetricLabel>
                            <MetricValue>
                              {formatCurrency(agg.current_value_czk)}
                            </MetricValue>
                          </div>
                          <div className="holding-card-stat">
                            <MetricLabel>Váha</MetricLabel>
                            <MetricValue>
                              {portfolioPercentage !== null
                                ? formatPercent(portfolioPercentage, 1)
                                : '—'}
                            </MetricValue>
                          </div>
                          <div className="holding-card-stat">
                            <MetricLabel>Cílová cena</MetricLabel>
                            <MetricValue>
                              {agg.target_price !== null
                                ? `$${formatPrice(
                                    agg.target_price,
                                    undefined,
                                    false
                                  )}`
                                : '—'}
                            </MetricValue>
                          </div>
                          <div className="holding-card-stat">
                            <MetricLabel>K cíli</MetricLabel>
                            <MetricValue
                              sentiment={
                                agg.distance_to_target_pct !== null
                                  ? agg.distance_to_target_pct <= 0
                                    ? 'positive'
                                    : 'negative'
                                  : undefined
                              }
                            >
                              {agg.distance_to_target_pct !== null
                                ? formatPercent(
                                    agg.distance_to_target_pct,
                                    1,
                                    true
                                  )
                                : '—'}
                            </MetricValue>
                          </div>
                        </div>
                      </div>
                    );
                  })
                : // Regular non-aggregated view
                  sortedHoldings.map((holding) => {
                    const plCzk =
                      holding.current_value_czk !== null
                        ? holding.current_value_czk - holding.total_invested_czk
                        : null;
                    const portfolioPercentage =
                      totals?.totalCurrentValueCzk && holding.current_value_czk
                        ? (holding.current_value_czk /
                            totals.totalCurrentValueCzk) *
                          100
                        : null;

                    return (
                      <div
                        key={`${holding.portfolio_id}-${holding.stock_id}`}
                        className="holding-card"
                        onClick={() => onStockClick?.(holding.stock_id)}
                      >
                        <div className="holding-card-header">
                          <div className="holding-card-title">
                            <Ticker>{holding.ticker}</Ticker>
                            <StockName truncate>{holding.stock_name}</StockName>
                            {showPortfolioColumn && (
                              <Text size="xs" color="muted">
                                {holding.portfolio_name}
                              </Text>
                            )}
                          </div>
                          <div className="holding-card-pl">
                            <MetricValue
                              sentiment={
                                (plCzk || 0) >= 0 ? 'positive' : 'negative'
                              }
                            >
                              {plCzk !== null ? formatCurrency(plCzk) : '—'}
                            </MetricValue>
                            <Text
                              size="sm"
                              color={
                                (holding.gain_percentage || 0) >= 0
                                  ? 'success'
                                  : 'danger'
                              }
                            >
                              {formatPercent(holding.gain_percentage)}
                            </Text>
                          </div>
                        </div>
                        {holding.sector_name && (
                          <div className="holding-card-sector">
                            <Text size="xs" color="muted">
                              {holding.sector_name}
                            </Text>
                          </div>
                        )}
                        <div className="holding-card-stats">
                          <div className="holding-card-stat">
                            <MetricLabel>Počet</MetricLabel>
                            <MetricValue>
                              {formatNumber(holding.total_shares, 4)}
                            </MetricValue>
                          </div>
                          <div className="holding-card-stat">
                            <MetricLabel>Aktuální cena</MetricLabel>
                            <MetricValue>
                              {formatPrice(
                                toDisplayPrice(
                                  holding.current_price,
                                  holding.price_scale ?? 1
                                )
                              )}
                            </MetricValue>
                          </div>
                          <div className="holding-card-stat">
                            <MetricLabel>Denní změna</MetricLabel>
                            <MetricValue
                              sentiment={
                                holding.price_change_percent !== null
                                  ? holding.price_change_percent >= 0
                                    ? 'positive'
                                    : 'negative'
                                  : undefined
                              }
                            >
                              {holding.price_change_percent !== null
                                ? formatPercent(
                                    holding.price_change_percent,
                                    2,
                                    true
                                  )
                                : '—'}
                            </MetricValue>
                          </div>
                          <div className="holding-card-stat">
                            <MetricLabel>Objem</MetricLabel>
                            <MetricValue>
                              {holding.daily_volume !== null &&
                              holding.avg_volume_20 !== null &&
                              holding.avg_volume_20 > 0
                                ? formatNumber(
                                    holding.daily_volume /
                                      holding.avg_volume_20,
                                    2,
                                    true
                                  )
                                : '—'}
                            </MetricValue>
                          </div>
                          <div className="holding-card-stat">
                            <MetricLabel>Investováno</MetricLabel>
                            <MetricValue>
                              {formatCurrency(holding.total_invested_czk)}
                            </MetricValue>
                          </div>
                          <div className="holding-card-stat">
                            <MetricLabel>Prům. cena</MetricLabel>
                            <MetricValue>
                              {formatPrice(
                                toDisplayPrice(
                                  holding.avg_buy_price,
                                  holding.price_scale ?? 1
                                )
                              )}
                            </MetricValue>
                          </div>
                          <div className="holding-card-stat">
                            <MetricLabel>Hodnota</MetricLabel>
                            <MetricValue>
                              {formatCurrency(holding.current_value_czk)}
                            </MetricValue>
                          </div>
                          <div className="holding-card-stat">
                            <MetricLabel>Váha</MetricLabel>
                            <MetricValue>
                              {portfolioPercentage !== null
                                ? formatPercent(portfolioPercentage, 1)
                                : '—'}
                            </MetricValue>
                          </div>
                          <div className="holding-card-stat">
                            <MetricLabel>Cílová cena</MetricLabel>
                            <MetricValue>
                              {holding.target_price !== null
                                ? `$${formatPrice(
                                    holding.target_price,
                                    undefined,
                                    false
                                  )}`
                                : '—'}
                            </MetricValue>
                          </div>
                          <div className="holding-card-stat">
                            <MetricLabel>K cíli</MetricLabel>
                            <MetricValue
                              sentiment={
                                holding.distance_to_target_pct !== null
                                  ? holding.distance_to_target_pct <= 0
                                    ? 'positive'
                                    : 'negative'
                                  : undefined
                              }
                            >
                              {holding.distance_to_target_pct !== null
                                ? formatPercent(
                                    holding.distance_to_target_pct,
                                    1,
                                    true
                                  )
                                : '—'}
                            </MetricValue>
                          </div>
                        </div>
                      </div>
                    );
                  })}
            </div>

            {/* Desktop Table View */}
            <div className="holdings-table-wrapper">
              <table className="holdings-table sortable-table">
                <thead>
                  <tr>
                    <SortHeader label="Akcie" sortKeyName="ticker" />
                    <SortHeader
                      label="Počet"
                      sortKeyName="shares"
                      className="right"
                    />
                    <SortHeader
                      label="Cena"
                      sortKeyName="currentPrice"
                      className="right"
                    />
                    <SortHeader
                      label="Denní %"
                      sortKeyName="dailyChange"
                      className="right"
                    />
                    <SortHeader
                      label="Objem"
                      sortKeyName="volumeRatio"
                      className="right"
                    />
                    <SortHeader
                      label="Investováno"
                      sortKeyName="invested"
                      className="right"
                    />
                    <SortHeader
                      label="Prům. cena"
                      sortKeyName="avgPrice"
                      className="right"
                    />
                    <SortHeader
                      label="Hodnota"
                      sortKeyName="current"
                      className="right"
                    />
                    <SortHeader
                      label="P&L"
                      sortKeyName="plPercent"
                      className="right"
                    />
                    <SortHeader
                      label="Váha"
                      sortKeyName="portfolio"
                      className="right"
                    />
                    <SortHeader
                      label="Cíl"
                      sortKeyName="distanceToTarget"
                      className="right"
                    />
                    <SortHeader label="Sektor" sortKeyName="sector" />
                  </tr>
                </thead>
                <tbody>
                  {showPortfolioColumn
                    ? // Aggregated table view with expandable rows
                      sortedAggregated.map((agg) => {
                        const plCzk =
                          agg.current_value_czk !== null
                            ? agg.current_value_czk - agg.total_invested_czk
                            : null;
                        const portfolioPercentage =
                          totals?.totalCurrentValueCzk && agg.current_value_czk
                            ? (agg.current_value_czk /
                                totals.totalCurrentValueCzk) *
                              100
                            : null;
                        const isPositive = (agg.gain_percentage || 0) >= 0;
                        const isTargetReached =
                          agg.distance_to_target_pct !== null &&
                          agg.distance_to_target_pct <= 0;
                        const isExpanded = expandedStocks.has(agg.stock_id);
                        const hasMultiple = agg.holdings.length > 1;

                        return (
                          <React.Fragment key={agg.stock_id}>
                            <tr
                              className={cn(
                                onStockClick && 'clickable',
                                hasMultiple && 'expandable-row',
                                isExpanded && 'expanded'
                              )}
                              onClick={() => onStockClick?.(agg.stock_id)}
                            >
                              <td>
                                <div className="stock-cell with-expand">
                                  {hasMultiple && (
                                    <button
                                      className="expand-toggle-table"
                                      onClick={(e) =>
                                        toggleExpanded(agg.stock_id, e)
                                      }
                                      aria-label={
                                        isExpanded ? 'Sbalit' : 'Rozbalit'
                                      }
                                    >
                                      <svg
                                        className={cn(
                                          'expand-chevron',
                                          isExpanded && 'expanded'
                                        )}
                                        width="12"
                                        height="12"
                                        viewBox="0 0 12 12"
                                        fill="none"
                                      >
                                        <path
                                          d="M4.5 2.5L8 6L4.5 9.5"
                                          stroke="currentColor"
                                          strokeWidth="1.5"
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                        />
                                      </svg>
                                    </button>
                                  )}
                                  <div className="stock-info">
                                    <Ticker>{agg.ticker}</Ticker>
                                    <StockName truncate>
                                      {agg.stock_name}
                                    </StockName>
                                    {hasMultiple && (
                                      <Text size="xs" color="muted">
                                        {agg.holdings.length} portfolia
                                      </Text>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="right">
                                <MetricValue>
                                  {formatNumber(agg.total_shares, 4)}
                                </MetricValue>
                              </td>
                              <td className="right">
                                <MetricValue>
                                  {formatPrice(
                                    toDisplayPrice(
                                      agg.current_price,
                                      agg.price_scale
                                    )
                                  )}
                                </MetricValue>
                              </td>
                              <td className="right">
                                <MetricValue
                                  sentiment={
                                    agg.price_change_percent !== null
                                      ? agg.price_change_percent >= 0
                                        ? 'positive'
                                        : 'negative'
                                      : undefined
                                  }
                                >
                                  {agg.price_change_percent !== null
                                    ? formatPercent(
                                        agg.price_change_percent,
                                        2,
                                        true
                                      )
                                    : '—'}
                                </MetricValue>
                              </td>
                              <td className="right">
                                <MetricValue>
                                  {agg.daily_volume !== null &&
                                  agg.avg_volume_20 !== null &&
                                  agg.avg_volume_20 > 0
                                    ? formatNumber(
                                        agg.daily_volume / agg.avg_volume_20,
                                        2,
                                        true
                                      )
                                    : '—'}
                                </MetricValue>
                              </td>
                              <td className="right">
                                <MetricValue>
                                  {formatCurrency(agg.total_invested_czk)}
                                </MetricValue>
                              </td>
                              <td className="right">
                                <MetricValue>
                                  {formatPrice(
                                    toDisplayPrice(
                                      agg.avg_buy_price,
                                      agg.price_scale
                                    )
                                  )}
                                </MetricValue>
                              </td>
                              <td className="right">
                                <MetricValue>
                                  {formatCurrency(agg.current_value_czk)}
                                </MetricValue>
                              </td>
                              <td className="right">
                                <div className="dual-value">
                                  <MetricValue
                                    sentiment={
                                      isPositive ? 'positive' : 'negative'
                                    }
                                  >
                                    {formatPercent(agg.gain_percentage)}
                                  </MetricValue>
                                  <Text
                                    size="xs"
                                    color={isPositive ? 'success' : 'danger'}
                                  >
                                    {plCzk !== null
                                      ? formatCurrency(plCzk)
                                      : '—'}
                                  </Text>
                                </div>
                              </td>
                              <td className="right">
                                <MetricValue>
                                  {portfolioPercentage !== null
                                    ? formatPercent(portfolioPercentage, 1)
                                    : '—'}
                                </MetricValue>
                              </td>
                              <td className="right">
                                <div className="dual-value">
                                  <MetricValue>
                                    {agg.target_price !== null
                                      ? `$${formatPrice(
                                          agg.target_price,
                                          undefined,
                                          false
                                        )}`
                                      : '—'}
                                  </MetricValue>
                                  {agg.distance_to_target_pct !== null && (
                                    <Text
                                      size="xs"
                                      color={
                                        isTargetReached ? 'success' : 'danger'
                                      }
                                    >
                                      {formatPercent(
                                        agg.distance_to_target_pct,
                                        1,
                                        true
                                      )}
                                    </Text>
                                  )}
                                </div>
                              </td>
                              <td>
                                <Text color="secondary">
                                  {agg.sector_name || '—'}
                                </Text>
                              </td>
                            </tr>

                            {/* Sub-rows for individual portfolio positions */}
                            {isExpanded &&
                              agg.holdings.map((holding) => {
                                const subPlCzk =
                                  holding.current_value_czk !== null
                                    ? holding.current_value_czk -
                                      holding.total_invested_czk
                                    : null;
                                const subPortfolioPercentage =
                                  totals?.totalCurrentValueCzk &&
                                  holding.current_value_czk
                                    ? (holding.current_value_czk /
                                        totals.totalCurrentValueCzk) *
                                      100
                                    : null;
                                const subIsPositive =
                                  (holding.gain_percentage || 0) >= 0;
                                const subIsTargetReached =
                                  holding.distance_to_target_pct !== null &&
                                  holding.distance_to_target_pct <= 0;

                                return (
                                  <tr
                                    key={`${holding.portfolio_id}-${holding.stock_id}`}
                                    className={cn(
                                      'sub-row',
                                      onStockClick && 'clickable'
                                    )}
                                    onClick={() =>
                                      onStockClick?.(holding.stock_id)
                                    }
                                  >
                                    <td>
                                      <div className="stock-cell sub-cell">
                                        <Text size="sm" color="secondary">
                                          {holding.portfolio_name}
                                        </Text>
                                      </div>
                                    </td>
                                    <td className="right">
                                      <MetricValue>
                                        {formatNumber(holding.total_shares, 4)}
                                      </MetricValue>
                                    </td>
                                    <td className="right sub-dimmed">
                                      <Text size="sm" color="muted">
                                        {formatPrice(
                                          toDisplayPrice(
                                            holding.current_price,
                                            holding.price_scale ?? 1
                                          )
                                        )}
                                      </Text>
                                    </td>
                                    <td className="right sub-dimmed">
                                      <Text
                                        size="sm"
                                        color={
                                          holding.price_change_percent !== null
                                            ? holding.price_change_percent >= 0
                                              ? 'success'
                                              : 'danger'
                                            : 'muted'
                                        }
                                      >
                                        {holding.price_change_percent !== null
                                          ? formatPercent(
                                              holding.price_change_percent,
                                              2,
                                              true
                                            )
                                          : '—'}
                                      </Text>
                                    </td>
                                    <td className="right sub-dimmed">
                                      <Text size="sm" color="muted">
                                        {holding.daily_volume !== null &&
                                        holding.avg_volume_20 !== null &&
                                        holding.avg_volume_20 > 0
                                          ? formatNumber(
                                              holding.daily_volume /
                                                holding.avg_volume_20,
                                              2,
                                              true
                                            )
                                          : '—'}
                                      </Text>
                                    </td>
                                    <td className="right">
                                      <MetricValue>
                                        {formatCurrency(
                                          holding.total_invested_czk
                                        )}
                                      </MetricValue>
                                    </td>
                                    <td className="right">
                                      <MetricValue>
                                        {formatPrice(
                                          toDisplayPrice(
                                            holding.avg_buy_price,
                                            holding.price_scale ?? 1
                                          )
                                        )}
                                      </MetricValue>
                                    </td>
                                    <td className="right">
                                      <MetricValue>
                                        {formatCurrency(
                                          holding.current_value_czk
                                        )}
                                      </MetricValue>
                                    </td>
                                    <td className="right">
                                      <div className="dual-value">
                                        <MetricValue
                                          sentiment={
                                            subIsPositive
                                              ? 'positive'
                                              : 'negative'
                                          }
                                        >
                                          {formatPercent(
                                            holding.gain_percentage
                                          )}
                                        </MetricValue>
                                        <Text
                                          size="xs"
                                          color={
                                            subIsPositive ? 'success' : 'danger'
                                          }
                                        >
                                          {subPlCzk !== null
                                            ? formatCurrency(subPlCzk)
                                            : '—'}
                                        </Text>
                                      </div>
                                    </td>
                                    <td className="right">
                                      <MetricValue>
                                        {subPortfolioPercentage !== null
                                          ? formatPercent(
                                              subPortfolioPercentage,
                                              1
                                            )
                                          : '—'}
                                      </MetricValue>
                                    </td>
                                    <td className="right">
                                      <div className="dual-value">
                                        <MetricValue>
                                          {holding.target_price !== null
                                            ? `$${formatPrice(
                                                holding.target_price,
                                                undefined,
                                                false
                                              )}`
                                            : '—'}
                                        </MetricValue>
                                        {holding.distance_to_target_pct !==
                                          null && (
                                          <Text
                                            size="xs"
                                            color={
                                              subIsTargetReached
                                                ? 'success'
                                                : 'danger'
                                            }
                                          >
                                            {formatPercent(
                                              holding.distance_to_target_pct,
                                              1,
                                              true
                                            )}
                                          </Text>
                                        )}
                                      </div>
                                    </td>
                                    <td>
                                      <Text color="muted">—</Text>
                                    </td>
                                  </tr>
                                );
                              })}
                          </React.Fragment>
                        );
                      })
                    : // Regular non-aggregated table view
                      sortedHoldings.map((holding) => {
                        const plCzk =
                          holding.current_value_czk !== null
                            ? holding.current_value_czk -
                              holding.total_invested_czk
                            : null;
                        const portfolioPercentage =
                          totals?.totalCurrentValueCzk &&
                          holding.current_value_czk
                            ? (holding.current_value_czk /
                                totals.totalCurrentValueCzk) *
                              100
                            : null;
                        const isPositive = (holding.gain_percentage || 0) >= 0;
                        const isTargetReached =
                          holding.distance_to_target_pct !== null &&
                          holding.distance_to_target_pct <= 0;

                        return (
                          <tr
                            key={`${holding.portfolio_id}-${holding.stock_id}`}
                            className={onStockClick ? 'clickable' : ''}
                            onClick={() => onStockClick?.(holding.stock_id)}
                          >
                            <td>
                              <div className="stock-cell">
                                <Ticker>{holding.ticker}</Ticker>
                                <StockName truncate>
                                  {holding.stock_name}
                                </StockName>
                              </div>
                            </td>
                            {showPortfolioColumn && (
                              <td>
                                <Text color="secondary">
                                  {holding.portfolio_name}
                                </Text>
                              </td>
                            )}
                            <td className="right">
                              <MetricValue>
                                {formatNumber(holding.total_shares, 4)}
                              </MetricValue>
                            </td>
                            <td className="right">
                              <MetricValue>
                                {formatPrice(
                                  toDisplayPrice(
                                    holding.current_price,
                                    holding.price_scale ?? 1
                                  )
                                )}
                              </MetricValue>
                            </td>
                            <td className="right">
                              <MetricValue
                                sentiment={
                                  holding.price_change_percent !== null
                                    ? holding.price_change_percent >= 0
                                      ? 'positive'
                                      : 'negative'
                                    : undefined
                                }
                              >
                                {holding.price_change_percent !== null
                                  ? formatPercent(
                                      holding.price_change_percent,
                                      2,
                                      true
                                    )
                                  : '—'}
                              </MetricValue>
                            </td>
                            <td className="right">
                              <MetricValue>
                                {holding.daily_volume !== null &&
                                holding.avg_volume_20 !== null &&
                                holding.avg_volume_20 > 0
                                  ? formatNumber(
                                      holding.daily_volume /
                                        holding.avg_volume_20,
                                      2,
                                      true
                                    )
                                  : '—'}
                              </MetricValue>
                            </td>
                            <td className="right">
                              <MetricValue>
                                {formatCurrency(holding.total_invested_czk)}
                              </MetricValue>
                            </td>
                            <td className="right">
                              <MetricValue>
                                {formatPrice(
                                  toDisplayPrice(
                                    holding.avg_buy_price,
                                    holding.price_scale ?? 1
                                  )
                                )}
                              </MetricValue>
                            </td>
                            <td className="right">
                              <MetricValue>
                                {formatCurrency(holding.current_value_czk)}
                              </MetricValue>
                            </td>
                            <td className="right">
                              <div className="dual-value">
                                <MetricValue
                                  sentiment={
                                    isPositive ? 'positive' : 'negative'
                                  }
                                >
                                  {formatPercent(holding.gain_percentage)}
                                </MetricValue>
                                <Text
                                  size="xs"
                                  color={isPositive ? 'success' : 'danger'}
                                >
                                  {plCzk !== null ? formatCurrency(plCzk) : '—'}
                                </Text>
                              </div>
                            </td>
                            <td className="right">
                              <MetricValue>
                                {portfolioPercentage !== null
                                  ? formatPercent(portfolioPercentage, 1)
                                  : '—'}
                              </MetricValue>
                            </td>
                            <td className="right">
                              <div className="dual-value">
                                <MetricValue>
                                  {holding.target_price !== null
                                    ? `$${formatPrice(
                                        holding.target_price,
                                        undefined,
                                        false
                                      )}`
                                    : '—'}
                                </MetricValue>
                                {holding.distance_to_target_pct !== null && (
                                  <Text
                                    size="xs"
                                    color={
                                      isTargetReached ? 'success' : 'danger'
                                    }
                                  >
                                    {formatPercent(
                                      holding.distance_to_target_pct,
                                      1,
                                      true
                                    )}
                                  </Text>
                                )}
                              </div>
                            </td>
                            <td>
                              <Text color="secondary">
                                {holding.sector_name || '—'}
                              </Text>
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Distribution Section (Sector / Exchange / Country) */}
      {totals &&
        (totals.sectorDistribution.length > 0 ||
          exchangeDistribution.length > 0 ||
          countryDistribution.length > 0) && (
          <div className="distribution-section">
            <div className="distribution-header">
              <SectionTitle>Rozložení portfolia</SectionTitle>
              <ToggleGroup
                value={distributionView}
                onChange={(v) => setDistributionView(v as DistributionView)}
                options={DISTRIBUTION_OPTIONS}
                size="sm"
              />
            </div>
            <div className="distribution-bars">
              {distributionView === 'sector' &&
                totals.sectorDistribution.map((sector) => (
                  <div key={sector.sector} className="distribution-row">
                    <Text size="sm" color="secondary">
                      {sector.sector}
                    </Text>
                    <div className="distribution-bar-wrapper">
                      <div
                        className="distribution-bar"
                        style={{ width: `${sector.percentage}%` }}
                      />
                    </div>
                    <MetricValue>
                      {formatPercent(sector.percentage, 1)}
                    </MetricValue>
                  </div>
                ))}
              {distributionView === 'exchange' &&
                exchangeDistribution.map((item) => (
                  <div key={item.exchange} className="distribution-row">
                    <Text size="sm" color="secondary">
                      {item.exchange}
                    </Text>
                    <div className="distribution-bar-wrapper">
                      <div
                        className="distribution-bar"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <MetricValue>
                      {formatPercent(item.percentage, 1)}
                    </MetricValue>
                  </div>
                ))}
              {distributionView === 'country' &&
                countryDistribution.map((item) => (
                  <div key={item.country} className="distribution-row">
                    <Text size="sm" color="secondary">
                      {item.country}
                    </Text>
                    <div className="distribution-bar-wrapper">
                      <div
                        className="distribution-bar"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                    <MetricValue>
                      {formatPercent(item.percentage, 1)}
                    </MetricValue>
                  </div>
                ))}
            </div>
          </div>
        )}

      {/* Transactions History */}
      <div className="transactions-history-section">
        <TransactionReport
          portfolioId={portfolioId}
          onStockClick={onStockClick}
        />
      </div>
    </div>
  );
}
