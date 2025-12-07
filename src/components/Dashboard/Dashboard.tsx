import { useState, useEffect, useCallback } from 'react';
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
  TransactionsList,
  Tabs,
  type SortField,
} from '@/components/shared';
import { OptionsList } from '@/components/Options';
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

type SortKey =
  | 'ticker'
  | 'sector'
  | 'shares'
  | 'avgPrice'
  | 'currentPrice'
  | 'dailyChange'
  | 'invested'
  | 'current'
  | 'plCzk'
  | 'plPercent'
  | 'portfolio'
  | 'portfolioName'
  | 'targetPrice'
  | 'distanceToTarget';

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

export function Dashboard({
  portfolioId,
  onStockClick,
  onEditOptionTransaction,
}: DashboardProps) {
  const [holdings, setHoldings] = useState<PortfolioSummary[]>([]);
  const [totals, setTotals] = useState<PortfolioTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<DashboardTab>('stocks');

  // Show portfolio column when viewing "All Portfolios"
  const showPortfolioColumn = portfolioId === null;
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
        case 'dailyChange':
          return item.price_change_percent ?? -Infinity;
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
                selectedField={sortField}
                direction={sortDirection}
                onFieldChange={(field) => {
                  const fieldConfig = SORT_FIELDS.find(
                    (f) => f.value === field
                  );
                  setSort(
                    field as SortKey,
                    fieldConfig?.defaultDirection || 'desc'
                  );
                }}
                onDirectionChange={(dir) => setSort(sortField, dir)}
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
                          {formatPrice(holding.current_price)}
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
                        <MetricLabel>Investováno</MetricLabel>
                        <MetricValue>
                          {formatCurrency(holding.total_invested_czk)}
                        </MetricValue>
                      </div>
                      <div className="holding-card-stat">
                        <MetricLabel>Prům. cena</MetricLabel>
                        <MetricValue>
                          {formatPrice(holding.avg_buy_price)}
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
                    {showPortfolioColumn && (
                      <SortHeader
                        label="Portfolio"
                        sortKeyName="portfolioName"
                      />
                    )}
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
                      label="Denní"
                      sortKeyName="dailyChange"
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
                        key={`${holding.portfolio_id}-${holding.stock_id}`}
                        className={onStockClick ? 'clickable' : ''}
                        onClick={() => onStockClick?.(holding.stock_id)}
                      >
                        <td>
                          <div className="stock-cell">
                            <Ticker>{holding.ticker}</Ticker>
                            <StockName truncate>{holding.stock_name}</StockName>
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
                            {formatPrice(holding.current_price)}
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
                            {formatCurrency(holding.total_invested_czk)}
                          </MetricValue>
                        </td>
                        <td className="right">
                          <MetricValue>
                            {formatPrice(holding.avg_buy_price)}
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
          <SectionTitle>Rozložení podle sektorů</SectionTitle>
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

      {/* Transactions History */}
      <div className="transactions-history-section">
        <TransactionsList
          portfolioId={portfolioId}
          showStockColumn={true}
          showFilters={true}
          showHeader={true}
          headerTitle="Historie transakcí"
          showAddButton={false}
          editable={false}
          onStockClick={onStockClick}
          defaultToCurrentMonth={true}
        />
      </div>
    </div>
  );
}
