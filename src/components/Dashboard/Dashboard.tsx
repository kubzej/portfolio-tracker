import { useState, useEffect, useMemo } from 'react';
import { holdingsApi } from '@/services/api';
import type { PortfolioSummary, PortfolioTotals } from '@/types/database';
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
  | 'distanceToTarget';

type SortDirection = 'asc' | 'desc';

interface DashboardProps {
  portfolioId?: string | null;
  onStockClick?: (stockId: string) => void;
}

export function Dashboard({ portfolioId, onStockClick }: DashboardProps) {
  const [holdings, setHoldings] = useState<PortfolioSummary[]>([]);
  const [totals, setTotals] = useState<PortfolioTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('ticker');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

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

  const formatCurrency = (value: number | null, currency = 'CZK') => {
    if (value === null) return '—';
    return new Intl.NumberFormat('cs-CZ', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number | null) => {
    if (value === null) return '—';
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(2)}%`;
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  const sortedHoldings = useMemo(() => {
    const totalValue = totals?.totalCurrentValueCzk || 0;

    return [...holdings].sort((a, b) => {
      let aVal: number | string | null = null;
      let bVal: number | string | null = null;

      switch (sortKey) {
        case 'ticker':
          aVal = a.ticker.toLowerCase();
          bVal = b.ticker.toLowerCase();
          break;
        case 'sector':
          aVal = (a.sector_name || '').toLowerCase();
          bVal = (b.sector_name || '').toLowerCase();
          break;
        case 'shares':
          aVal = a.total_shares;
          bVal = b.total_shares;
          break;
        case 'avgPrice':
          aVal = a.avg_buy_price;
          bVal = b.avg_buy_price;
          break;
        case 'currentPrice':
          aVal = a.current_price ?? -Infinity;
          bVal = b.current_price ?? -Infinity;
          break;
        case 'invested':
          aVal = a.total_invested_czk;
          bVal = b.total_invested_czk;
          break;
        case 'current':
          aVal = a.current_value_czk ?? -Infinity;
          bVal = b.current_value_czk ?? -Infinity;
          break;
        case 'plCzk':
          aVal =
            a.current_value_czk !== null
              ? a.current_value_czk - a.total_invested_czk
              : -Infinity;
          bVal =
            b.current_value_czk !== null
              ? b.current_value_czk - b.total_invested_czk
              : -Infinity;
          break;
        case 'plPercent':
          aVal = a.gain_percentage ?? -Infinity;
          bVal = b.gain_percentage ?? -Infinity;
          break;
        case 'portfolio':
          aVal =
            totalValue && a.current_value_czk
              ? a.current_value_czk / totalValue
              : -Infinity;
          bVal =
            totalValue && b.current_value_czk
              ? b.current_value_czk / totalValue
              : -Infinity;
          break;
        case 'distanceToTarget':
          aVal = a.distance_to_target_pct ?? -Infinity;
          bVal = b.distance_to_target_pct ?? -Infinity;
          break;
      }

      if (aVal === null || bVal === null) return 0;
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [holdings, sortKey, sortDirection, totals]);

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
      className={`sortable ${className || ''} ${
        sortKey === sortKeyName ? 'sorted' : ''
      }`}
      onClick={() => handleSort(sortKeyName)}
    >
      {label}
      {sortKey === sortKeyName && (
        <span className="sort-indicator">
          {sortDirection === 'asc' ? ' ▲' : ' ▼'}
        </span>
      )}
    </th>
  );

  if (loading) {
    return <div className="dashboard-loading">Loading portfolio...</div>;
  }

  if (error) {
    return <div className="dashboard-error">{error}</div>;
  }

  return (
    <div className="dashboard">
      {/* Dashboard Header */}
      <div className="dashboard-header">
        <h2>Portfolio Overview</h2>
      </div>

      {/* Portfolio Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card">
          <span className="card-label">Total Invested</span>
          <span className="card-value">
            {formatCurrency(totals?.totalInvestedCzk || 0)}
          </span>
        </div>

        <div className="summary-card">
          <span className="card-label">Current Value</span>
          <span className="card-value">
            {formatCurrency(totals?.totalCurrentValueCzk || 0)}
          </span>
        </div>

        <div className="summary-card">
          <span className="card-label">Unrealized P&L</span>
          <span
            className={`card-value ${
              (totals?.totalUnrealizedGain || 0) >= 0 ? 'positive' : 'negative'
            }`}
          >
            {formatCurrency(totals?.totalUnrealizedGain || 0)}
            <small>
              {formatPercent(totals?.totalUnrealizedGainPercentage || 0)}
            </small>
          </span>
        </div>

        <div className="summary-card">
          <span className="card-label">Stocks</span>
          <span className="card-value">{totals?.stockCount || 0}</span>
        </div>
      </div>

      {/* Holdings Table */}
      <div className="holdings-section">
        <h2>Holdings</h2>

        {holdings.length === 0 ? (
          <div className="empty-state">
            <p>No holdings yet. Add a stock and transaction to get started!</p>
          </div>
        ) : (
          <>
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
                        <span className="ticker">{holding.ticker}</span>
                        <span className="name">{holding.stock_name}</span>
                      </div>
                      <div className="holding-card-pl">
                        <div
                          className={`value ${
                            (plCzk || 0) >= 0 ? 'positive' : 'negative'
                          }`}
                        >
                          {plCzk !== null ? formatCurrency(plCzk) : '—'}
                        </div>
                        <div
                          className={`percent ${
                            (holding.gain_percentage || 0) >= 0
                              ? 'positive'
                              : 'negative'
                          }`}
                        >
                          {formatPercent(holding.gain_percentage)}
                        </div>
                      </div>
                    </div>
                    <div className="holding-card-stats">
                      <div className="holding-card-stat">
                        <span className="label">Shares</span>
                        <span className="value">{holding.total_shares}</span>
                      </div>
                      <div className="holding-card-stat">
                        <span className="label">Invested</span>
                        <span className="value">
                          {formatCurrency(holding.total_invested_czk)}
                        </span>
                      </div>
                      <div className="holding-card-stat">
                        <span className="label">Current</span>
                        <span className="value">
                          {formatCurrency(holding.current_value_czk)}
                        </span>
                      </div>
                      <div className="holding-card-stat">
                        <span className="label">% of PTF</span>
                        <span className="value">
                          {portfolioPercentage !== null
                            ? `${portfolioPercentage.toFixed(1)}%`
                            : '—'}
                        </span>
                      </div>
                      <div className="holding-card-stat">
                        <span className="label">To Target</span>
                        <span
                          className={`value ${
                            holding.distance_to_target_pct !== null
                              ? holding.distance_to_target_pct <= 0
                                ? 'positive'
                                : 'negative'
                              : ''
                          }`}
                        >
                          {holding.distance_to_target_pct !== null
                            ? `${
                                holding.distance_to_target_pct <= 0 ? '+' : '-'
                              }${Math.abs(
                                holding.distance_to_target_pct
                              ).toFixed(1)}%`
                            : '—'}
                        </span>
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
                      label="Invested (CZK)"
                      sortKeyName="invested"
                      className="right"
                    />
                    <SortHeader
                      label="Current (CZK)"
                      sortKeyName="current"
                      className="right"
                    />
                    <SortHeader
                      label="P&L (CZK)"
                      sortKeyName="plCzk"
                      className="right"
                    />
                    <SortHeader
                      label="P&L %"
                      sortKeyName="plPercent"
                      className="right"
                    />
                    <SortHeader
                      label="% of PTF"
                      sortKeyName="portfolio"
                      className="right"
                    />
                    <SortHeader
                      label="To Target"
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

                    return (
                      <tr
                        key={holding.stock_id}
                        className={onStockClick ? 'clickable' : ''}
                        onClick={() => onStockClick?.(holding.stock_id)}
                      >
                        <td>
                          <div className="stock-cell">
                            <span className="ticker">{holding.ticker}</span>
                            <span className="name">{holding.stock_name}</span>
                          </div>
                        </td>
                        <td className="right">{holding.total_shares}</td>
                        <td className="right">
                          {holding.avg_buy_price?.toFixed(2) || '—'}
                        </td>
                        <td className="right">
                          {holding.current_price?.toFixed(2) || '—'}
                        </td>
                        <td className="right">
                          {formatCurrency(holding.total_invested_czk)}
                        </td>
                        <td className="right">
                          {formatCurrency(holding.current_value_czk)}
                        </td>
                        <td
                          className={`right ${
                            (plCzk || 0) >= 0 ? 'positive' : 'negative'
                          }`}
                        >
                          {plCzk !== null ? formatCurrency(plCzk) : '—'}
                        </td>
                        <td
                          className={`right ${
                            (holding.gain_percentage || 0) >= 0
                              ? 'positive'
                              : 'negative'
                          }`}
                        >
                          {formatPercent(holding.gain_percentage)}
                        </td>
                        <td className="right">
                          {portfolioPercentage !== null
                            ? `${portfolioPercentage.toFixed(1)}%`
                            : '—'}
                        </td>
                        <td
                          className={`right ${
                            holding.distance_to_target_pct !== null
                              ? holding.distance_to_target_pct <= 0
                                ? 'positive'
                                : 'negative'
                              : ''
                          }`}
                        >
                          {holding.distance_to_target_pct !== null
                            ? `${
                                holding.distance_to_target_pct <= 0 ? '+' : '-'
                              }${Math.abs(
                                holding.distance_to_target_pct
                              ).toFixed(1)}%`
                            : '—'}
                        </td>
                        <td>{holding.sector_name || '—'}</td>
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
          <h2>Sector Distribution</h2>
          <div className="sector-bars">
            {totals.sectorDistribution.map((sector) => (
              <div key={sector.sector} className="sector-row">
                <span className="sector-name">{sector.sector}</span>
                <div className="sector-bar-wrapper">
                  <div
                    className="sector-bar"
                    style={{ width: `${sector.percentage}%` }}
                  />
                </div>
                <span className="sector-pct">
                  {sector.percentage.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
