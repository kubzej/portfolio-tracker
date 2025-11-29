import { useState, useEffect, useCallback } from 'react';
import { holdingsApi } from '@/services/api';
import type { PortfolioSummary, PortfolioTotals } from '@/types/database';
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  formatPrice,
} from '@/utils/format';
import { cn } from '@/utils/cn';
import { useSortable } from '@/hooks';
import {
  BottomSheetSelect,
  type SelectOption,
} from '@/components/shared/BottomSheet';
import { LoadingSpinner, ErrorState, EmptyState } from '@/components/shared';
import {
  SectionTitle,
  Ticker,
  StockName,
  MetricLabel,
  MetricValue,
  Text,
} from '@/components/shared/Typography';
import './Dashboard.css';

type SortKey =
  | 'ticker'
  | 'sector'
  | 'shares'
  | 'avgPrice'
  | 'currentPrice'
  | 'invested'
  | 'current'
  | 'plCzk'
  | 'plPercent'
  | 'portfolio'
  | 'targetPrice'
  | 'distanceToTarget';

const SORT_OPTIONS: SelectOption[] = [
  { value: 'ticker-asc', label: 'Ticker (A-Z)' },
  { value: 'ticker-desc', label: 'Ticker (Z-A)' },
  { value: 'plPercent-desc', label: 'P&L % (Best)' },
  { value: 'plPercent-asc', label: 'P&L % (Worst)' },
  { value: 'plCzk-desc', label: 'P&L CZK (Best)' },
  { value: 'plCzk-asc', label: 'P&L CZK (Worst)' },
  { value: 'current-desc', label: 'Value (High-Low)' },
  { value: 'current-asc', label: 'Value (Low-High)' },
  { value: 'portfolio-desc', label: 'Weight (High-Low)' },
  { value: 'portfolio-asc', label: 'Weight (Low-High)' },
  { value: 'distanceToTarget-asc', label: 'Target (Closest)' },
  { value: 'distanceToTarget-desc', label: 'Target (Farthest)' },
  { value: 'sector-asc', label: 'Sector (A-Z)' },
];

interface DashboardProps {
  portfolioId?: string | null;
  onStockClick?: (stockId: string) => void;
}

export function Dashboard({ portfolioId, onStockClick }: DashboardProps) {
  const [holdings, setHoldings] = useState<PortfolioSummary[]>([]);
  const [totals, setTotals] = useState<PortfolioTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const {
    sortedData: sortedHoldings,
    sortValue,
    handleSort,
    setSortFromValue,
    getSortIndicator,
    isSorted,
  } = useSortable<PortfolioSummary, SortKey>(holdings, getHoldingValue, {
    defaultField: 'ticker',
    ascendingFields: ['ticker', 'sector'],
  });

  useEffect(() => {
    loadData();
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
      setError(err instanceof Error ? err.message : 'Failed to load portfolio');
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
  }) => (
    <th
      className={cn('sortable', className, isSorted(sortKeyName) && 'sorted')}
      onClick={() => handleSort(sortKeyName)}
    >
      {label}
      {getSortIndicator(sortKeyName)}
    </th>
  );

  if (loading) {
    return <LoadingSpinner text="Loading portfolio..." />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  return (
    <div className="dashboard">
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <SectionTitle>Portfolio Overview</SectionTitle>
      </div>

      {/* Portfolio Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <MetricLabel>Total Invested</MetricLabel>
          <MetricValue size="lg">
            {formatCurrency(totals?.totalInvestedCzk || 0)}
          </MetricValue>
        </div>

        <div className="summary-card">
          <MetricLabel>Current Value</MetricLabel>
          <MetricValue size="lg">
            {formatCurrency(totals?.totalCurrentValueCzk || 0)}
          </MetricValue>
        </div>

        <div className="summary-card">
          <MetricLabel>Unrealized P&L</MetricLabel>
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
          <MetricLabel>Stocks</MetricLabel>
          <MetricValue size="lg">{totals?.stockCount || 0}</MetricValue>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="holdings-section">
        <SectionTitle>Holdings</SectionTitle>

        {holdings.length === 0 ? (
          <EmptyState
            title="No holdings yet"
            description="Add a stock and transaction to get started!"
          />
        ) : (
          <>
            {/* Mobile Sort Controls */}
            <div className="mobile-sort-controls">
              <BottomSheetSelect
                label="Sort by"
                options={SORT_OPTIONS}
                value={sortValue}
                onChange={setSortFromValue}
              />
            </div>

            {/* Mobile Cards View */}
            <div className="holdings-cards">
              {sortedHoldings.map((holding) => {
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
                    key={holding.stock_id}
                    className="holding-card"
                    onClick={() => onStockClick?.(holding.stock_id)}
                  >
                    <div className="holding-card-header">
                      <div className="holding-card-title">
                        <Ticker>{holding.ticker}</Ticker>
                        <StockName truncate>{holding.stock_name}</StockName>
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
                    <div className="holding-card-stats">
                      <div className="holding-card-stat">
                        <MetricLabel>Shares</MetricLabel>
                        <MetricValue>
                          {formatNumber(holding.total_shares, 4)}
                        </MetricValue>
                      </div>
                      <div className="holding-card-stat">
                        <MetricLabel>Avg Price</MetricLabel>
                        <MetricValue>
                          {formatPrice(holding.avg_buy_price)}
                        </MetricValue>
                      </div>
                      <div className="holding-card-stat">
                        <MetricLabel>Current Price</MetricLabel>
                        <MetricValue>
                          {formatPrice(holding.current_price)}
                        </MetricValue>
                      </div>
                      <div className="holding-card-stat">
                        <MetricLabel>Invested</MetricLabel>
                        <MetricValue>
                          {formatCurrency(holding.total_invested_czk)}
                        </MetricValue>
                      </div>
                      <div className="holding-card-stat">
                        <MetricLabel>Current</MetricLabel>
                        <MetricValue>
                          {formatCurrency(holding.current_value_czk)}
                        </MetricValue>
                      </div>
                      <div className="holding-card-stat">
                        <MetricLabel>Weight</MetricLabel>
                        <MetricValue>
                          {portfolioPercentage !== null
                            ? formatPercent(portfolioPercentage, 1)
                            : '—'}
                        </MetricValue>
                      </div>
                      <div className="holding-card-stat">
                        <MetricLabel>Target</MetricLabel>
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
                        <MetricLabel>To Target</MetricLabel>
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
                      {holding.sector_name && (
                        <div className="holding-card-stat">
                          <MetricLabel>Sector</MetricLabel>
                          <MetricValue>{holding.sector_name}</MetricValue>
                        </div>
                      )}
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
                    <SortHeader label="Stock" sortKeyName="ticker" />
                    <SortHeader
                      label="Shares"
                      sortKeyName="shares"
                      className="right"
                    />
                    <SortHeader
                      label="Avg Price"
                      sortKeyName="avgPrice"
                      className="right"
                    />
                    <SortHeader
                      label="Current Price"
                      sortKeyName="currentPrice"
                      className="right"
                    />
                    <SortHeader
                      label="Value (CZK)"
                      sortKeyName="current"
                      className="right"
                    />
                    <SortHeader
                      label="P&L"
                      sortKeyName="plPercent"
                      className="right"
                    />
                    <SortHeader
                      label="Weight"
                      sortKeyName="portfolio"
                      className="right"
                    />
                    <SortHeader
                      label="Target"
                      sortKeyName="distanceToTarget"
                      className="right"
                    />
                    <SortHeader label="Sector" sortKeyName="sector" />
                  </tr>
                </thead>
                <tbody>
                  {sortedHoldings.map((holding) => {
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
                    const isPositive = (holding.gain_percentage || 0) >= 0;
                    const isTargetReached =
                      holding.distance_to_target_pct !== null &&
                      holding.distance_to_target_pct <= 0;

                    return (
                      <tr
                        key={holding.stock_id}
                        className={onStockClick ? 'clickable' : ''}
                        onClick={() => onStockClick?.(holding.stock_id)}
                      >
                        <td>
                          <div className="stock-cell">
                            <Ticker>{holding.ticker}</Ticker>
                            <StockName truncate>{holding.stock_name}</StockName>
                          </div>
                        </td>
                        <td className="right">
                          <MetricValue>
                            {formatNumber(holding.total_shares, 4)}
                          </MetricValue>
                        </td>
                        <td className="right">
                          <MetricValue>
                            {formatPrice(holding.avg_buy_price)}
                          </MetricValue>
                        </td>
                        <td className="right">
                          <MetricValue>
                            {formatPrice(holding.current_price)}
                          </MetricValue>
                        </td>
                        <td className="right">
                          <div className="dual-value">
                            <MetricValue>
                              {formatCurrency(holding.current_value_czk)}
                            </MetricValue>
                            <Text size="xs" color="muted">
                              inv: {formatCurrency(holding.total_invested_czk)}
                            </Text>
                          </div>
                        </td>
                        <td className="right">
                          <div className="dual-value">
                            <MetricValue
                              sentiment={isPositive ? 'positive' : 'negative'}
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
                                color={isTargetReached ? 'success' : 'danger'}
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

      {/* Sector Distribution */}
      {totals && totals.sectorDistribution.length > 0 && (
        <div className="sector-section">
          <SectionTitle>Sector Distribution</SectionTitle>
          <div className="sector-bars">
            {totals.sectorDistribution.map((sector) => (
              <div key={sector.sector} className="sector-row">
                <Text size="sm" color="secondary">
                  {sector.sector}
                </Text>
                <div className="sector-bar-wrapper">
                  <div
                    className="sector-bar"
                    style={{ width: `${sector.percentage}%` }}
                  />
                </div>
                <MetricValue>{formatPercent(sector.percentage, 1)}</MetricValue>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
