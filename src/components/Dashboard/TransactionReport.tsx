import { useState, useEffect, useMemo, useCallback } from 'react';
import { transactionsApi, optionsApi, portfoliosApi } from '@/services/api';
import { generateTransactionsPDF } from '@/services/pdfGenerator';
import type {
  Portfolio,
  TransactionWithStock,
  OptionTransaction,
} from '@/types';
import {
  formatCurrency,
  formatPrice,
  formatDate,
  formatShares,
} from '@/utils/format';
import { cn } from '@/utils/cn';

import { useSortable } from '@/hooks';
import {
  Button,
  LoadingSpinner,
  EmptyState,
  ToggleGroup,
  MobileSortControl,
  type SortField,
} from '@/components/shared';
import { Input } from '@/components/shared/Input';
import {
  SectionTitle,
  Text,
  MetricLabel,
  MetricValue,
  Badge,
  Ticker,
  StockName,
} from '@/components/shared/Typography';
import './TransactionReport.css';

type TransactionType = 'all' | 'stocks' | 'options';
type StockTypeFilter = 'ALL' | 'BUY' | 'SELL' | 'CLOSE';

type StockSortKey = 'date' | 'ticker' | 'type' | 'quantity' | 'totalCzk';
type OptionSortKey =
  | 'date'
  | 'symbol'
  | 'action'
  | 'contracts'
  | 'totalPremium';

const STOCK_SORT_FIELDS: SortField[] = [
  { value: 'date', label: 'Datum', defaultDirection: 'desc' },
  { value: 'ticker', label: 'Ticker', defaultDirection: 'asc' },
  { value: 'type', label: 'Typ', defaultDirection: 'asc' },
  { value: 'totalCzk', label: 'Celkem CZK', defaultDirection: 'desc' },
];

const OPTION_SORT_FIELDS: SortField[] = [
  { value: 'date', label: 'Datum', defaultDirection: 'desc' },
  { value: 'symbol', label: 'Symbol', defaultDirection: 'asc' },
  { value: 'action', label: 'Akce', defaultDirection: 'asc' },
  { value: 'totalPremium', label: 'Prémium', defaultDirection: 'desc' },
];

const TYPE_OPTIONS = [
  { value: 'all', label: 'Vše' },
  { value: 'stocks', label: 'Akcie' },
  { value: 'options', label: 'Opce' },
];

const STOCK_TYPE_OPTIONS = [
  { value: 'ALL', label: 'Vše' },
  { value: 'BUY', label: 'Nákup' },
  { value: 'SELL', label: 'Prodej' },
  { value: 'CLOSE', label: 'Ukončení' },
];

// Get first day of current month
const getFirstDayOfMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    '0'
  )}-01`;
};

// Get today's date
const getToday = () => {
  return new Date().toISOString().split('T')[0];
};

interface TransactionReportProps {
  portfolioId?: string | null;
  onStockClick?: (stockId: string) => void;
}

export function TransactionReport({
  portfolioId,
  onStockClick,
}: TransactionReportProps) {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [stockTransactions, setStockTransactions] = useState<
    TransactionWithStock[]
  >([]);
  const [optionTransactions, setOptionTransactions] = useState<
    OptionTransaction[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // Filters
  const [transactionType, setTransactionType] =
    useState<TransactionType>('all');
  const [stockTypeFilter, setStockTypeFilter] =
    useState<StockTypeFilter>('ALL');
  const [dateFrom, setDateFrom] = useState<string>(getFirstDayOfMonth());
  const [dateTo, setDateTo] = useState<string>('');
  const [stockSearch, setStockSearch] = useState('');

  // Stock transactions sorting
  const getStockValue = useCallback(
    (
      item: TransactionWithStock,
      field: StockSortKey
    ): string | number | null => {
      switch (field) {
        case 'date':
          return new Date(item.date).getTime();
        case 'ticker':
          return (item.stock?.ticker || '').toLowerCase();
        case 'type':
          return item.type;
        case 'quantity':
          return item.quantity;
        case 'totalCzk':
          return item.total_amount_czk;
        default:
          return null;
      }
    },
    []
  );

  const {
    sortedData: sortedStockTx,
    sortField: stockSortField,
    sortDirection: stockSortDirection,
    handleSort: handleStockSort,
    getSortIndicator: getStockSortIndicator,
    isSorted: isStockSorted,
  } = useSortable<TransactionWithStock, StockSortKey>(
    stockTransactions,
    getStockValue,
    {
      defaultField: 'date',
      defaultDirection: 'desc',
      ascendingFields: ['ticker'],
    }
  );

  // Option transactions sorting
  const getOptionValue = useCallback(
    (item: OptionTransaction, field: OptionSortKey): string | number | null => {
      switch (field) {
        case 'date':
          return new Date(item.date).getTime();
        case 'symbol':
          return item.symbol.toLowerCase();
        case 'action':
          return item.action;
        case 'contracts':
          return item.contracts;
        case 'totalPremium':
          return item.total_premium || 0;
        default:
          return null;
      }
    },
    []
  );

  const {
    sortedData: sortedOptionTx,
    sortField: optionSortField,
    sortDirection: optionSortDirection,
    handleSort: handleOptionSort,
    getSortIndicator: getOptionSortIndicator,
    isSorted: isOptionSorted,
  } = useSortable<OptionTransaction, OptionSortKey>(
    optionTransactions,
    getOptionValue,
    {
      defaultField: 'date',
      defaultDirection: 'desc',
      ascendingFields: ['symbol'],
    }
  );

  // Load portfolios
  useEffect(() => {
    portfoliosApi.getAll().then(setPortfolios).catch(console.error);
  }, []);

  // Load transactions
  useEffect(() => {
    loadTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioId, portfolios]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      // Load stock transactions
      const stockTx = await transactionsApi.getAll(portfolioId ?? undefined);

      // Load option transactions
      let optionTx: OptionTransaction[] = [];
      if (portfolioId) {
        optionTx = await optionsApi.getTransactions(portfolioId);
      } else if (portfolios.length > 0) {
        // Load from all portfolios
        const allOptionTx: OptionTransaction[] = [];
        for (const portfolio of portfolios) {
          const tx = await optionsApi.getTransactions(portfolio.id);
          allOptionTx.push(...tx);
        }
        optionTx = allOptionTx;
      }

      setStockTransactions(stockTx);
      setOptionTransactions(optionTx);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter stock transactions
  const filteredStockTx = useMemo(() => {
    return sortedStockTx.filter((tx) => {
      // Date filter
      if (dateFrom) {
        const txDate = new Date(tx.date);
        const fromDate = new Date(dateFrom);
        if (txDate < fromDate) return false;
      }
      if (dateTo) {
        const txDate = new Date(tx.date);
        const toDate = new Date(dateTo + 'T23:59:59');
        if (txDate > toDate) return false;
      }

      // Type filter
      if (stockTypeFilter !== 'ALL' && tx.type !== stockTypeFilter) {
        return false;
      }

      // Search filter
      if (stockSearch) {
        const search = stockSearch.toLowerCase();
        const ticker = tx.stock?.ticker?.toLowerCase() || '';
        const name = tx.stock?.name?.toLowerCase() || '';
        if (!ticker.includes(search) && !name.includes(search)) {
          return false;
        }
      }

      return true;
    });
  }, [sortedStockTx, dateFrom, dateTo, stockTypeFilter, stockSearch]);

  // Filter option transactions
  const filteredOptionTx = useMemo(() => {
    return sortedOptionTx.filter((tx) => {
      // Date filter
      if (dateFrom) {
        const txDate = new Date(tx.date);
        const fromDate = new Date(dateFrom);
        if (txDate < fromDate) return false;
      }
      if (dateTo) {
        const txDate = new Date(tx.date);
        const toDate = new Date(dateTo + 'T23:59:59');
        if (txDate > toDate) return false;
      }

      // Type filter - BTO/BTC = BUY, STO/STC = SELL, EXPIRATION/ASSIGNMENT/EXERCISE = CLOSE
      if (stockTypeFilter !== 'ALL') {
        const isBuy = tx.action === 'BTO' || tx.action === 'BTC';
        const isSell = tx.action === 'STO' || tx.action === 'STC';
        const isClose =
          tx.action === 'EXPIRATION' ||
          tx.action === 'ASSIGNMENT' ||
          tx.action === 'EXERCISE';
        if (stockTypeFilter === 'BUY' && !isBuy) return false;
        if (stockTypeFilter === 'SELL' && !isSell) return false;
        if (stockTypeFilter === 'CLOSE' && !isClose) return false;
      }

      // Search filter (for options, search in symbol)
      if (stockSearch) {
        const search = stockSearch.toLowerCase();
        if (!tx.symbol.toLowerCase().includes(search)) {
          return false;
        }
      }

      return true;
    });
  }, [sortedOptionTx, dateFrom, dateTo, stockTypeFilter, stockSearch]);

  // Summary stats
  const summary = useMemo(() => {
    const stockBuys = filteredStockTx.filter((tx) => tx.type === 'BUY');
    const stockSells = filteredStockTx.filter((tx) => tx.type === 'SELL');
    const totalStockBuyCzk = stockBuys.reduce(
      (sum, tx) => sum + tx.total_amount_czk,
      0
    );
    const totalStockSellCzk = stockSells.reduce(
      (sum, tx) => sum + tx.total_amount_czk,
      0
    );

    // Option P/L from premium flow
    const optionPremiumIn = filteredOptionTx
      .filter((tx) => tx.action === 'STO' || tx.action === 'STC')
      .reduce((sum, tx) => sum + (tx.total_premium || 0), 0);
    const optionPremiumOut = filteredOptionTx
      .filter((tx) => tx.action === 'BTO' || tx.action === 'BTC')
      .reduce((sum, tx) => sum + (tx.total_premium || 0), 0);
    const optionFees = filteredOptionTx.reduce(
      (sum, tx) => sum + (tx.fees || 0),
      0
    );

    return {
      stockTxCount: filteredStockTx.length,
      stockBuyCount: stockBuys.length,
      stockSellCount: stockSells.length,
      totalStockBuyCzk,
      totalStockSellCzk,
      optionTxCount: filteredOptionTx.length,
      optionPremiumIn,
      optionPremiumOut,
      optionNetPremium: optionPremiumIn - optionPremiumOut,
      optionFees,
    };
  }, [filteredStockTx, filteredOptionTx]);

  // Get portfolio name
  const portfolioName = portfolioId
    ? portfolios.find((p) => p.id === portfolioId)?.name || 'Portfolio'
    : 'Všechna portfolia';

  // Handle PDF generation
  const handleGeneratePDF = async () => {
    setGenerating(true);
    try {
      // Use filtered data for PDF based on transaction type
      const stockTxForPdf =
        transactionType === 'options' ? [] : filteredStockTx;
      const optionTxForPdf =
        transactionType === 'stocks' ? [] : filteredOptionTx;

      await generateTransactionsPDF({
        portfolioName,
        dateFrom: dateFrom || getFirstDayOfMonth(),
        dateTo: dateTo || getToday(),
        stockTransactions: stockTxForPdf,
        optionTransactions: optionTxForPdf,
        summary,
        portfolios,
      });
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setGenerating(false);
    }
  };

  const showStocks = transactionType === 'all' || transactionType === 'stocks';
  const showOptions =
    transactionType === 'all' || transactionType === 'options';
  const hasData = filteredStockTx.length > 0 || filteredOptionTx.length > 0;
  const showPortfolioColumn = portfolioId === null;

  // Sortable header helper for stocks
  const StockSortHeader = ({
    label,
    sortKey,
    className,
  }: {
    label: string;
    sortKey: StockSortKey;
    className?: string;
  }) => (
    <th
      className={cn('sortable', className, isStockSorted(sortKey) && 'sorted')}
      onClick={() => handleStockSort(sortKey)}
    >
      {label}
      {getStockSortIndicator(sortKey)}
    </th>
  );

  // Sortable header helper for options
  const OptionSortHeader = ({
    label,
    sortKey,
    className,
  }: {
    label: string;
    sortKey: OptionSortKey;
    className?: string;
  }) => (
    <th
      className={cn('sortable', className, isOptionSorted(sortKey) && 'sorted')}
      onClick={() => handleOptionSort(sortKey)}
    >
      {label}
      {getOptionSortIndicator(sortKey)}
    </th>
  );

  if (loading) {
    return <LoadingSpinner text="Načítám transakce..." />;
  }

  return (
    <div className="transaction-report">
      {/* Header */}
      <div className="report-header">
        <SectionTitle>Historie transakcí</SectionTitle>
        <Button
          variant="primary"
          size="sm"
          onClick={handleGeneratePDF}
          disabled={!hasData || generating}
        >
          {generating ? 'Generuji...' : 'Stáhnout PDF'}
        </Button>
      </div>

      {/* Filters */}
      <div className="report-filters">
        <div className="filters-row filters-row--primary">
          <div className="date-filters">
            <div className="date-filter-item">
              <Text size="xs" color="muted">
                Od
              </Text>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                inputSize="sm"
              />
            </div>
            <div className="date-filter-item">
              <Text size="xs" color="muted">
                Do
              </Text>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                inputSize="sm"
              />
            </div>
            {(dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                }}
              >
                ✕
              </Button>
            )}
          </div>

          <div className="search-filter">
            <Input
              type="text"
              placeholder="Hledat ticker..."
              value={stockSearch}
              onChange={(e) => setStockSearch(e.target.value)}
              inputSize="sm"
            />
          </div>
        </div>

        <div className="filters-row filters-row--toggles">
          <div className="filter-group">
            <Text size="xs" color="muted">
              Zobrazit
            </Text>
            <ToggleGroup
              value={transactionType}
              onChange={(v) => setTransactionType(v as TransactionType)}
              options={TYPE_OPTIONS}
              size="sm"
            />
          </div>

          <div className="filter-group">
            <Text size="xs" color="muted">
              Typ transakce
            </Text>
            <ToggleGroup
              value={stockTypeFilter}
              onChange={(v) => setStockTypeFilter(v as StockTypeFilter)}
              options={STOCK_TYPE_OPTIONS}
              size="sm"
            />
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="report-stats">
        {showStocks && (
          <>
            <div className="stat-item">
              <Text size="xs" color="muted">
                Akcie
              </Text>
              <Text size="sm" weight="semibold">
                {summary.stockTxCount}
              </Text>
            </div>
            <div className="stat-item">
              <Text size="xs" color="muted">
                Nákupy
              </Text>
              <Text size="sm" weight="semibold" color="success">
                {summary.stockBuyCount} (
                {formatCurrency(summary.totalStockBuyCzk)})
              </Text>
            </div>
            <div className="stat-item">
              <Text size="xs" color="muted">
                Prodeje
              </Text>
              <Text size="sm" weight="semibold" color="danger">
                {summary.stockSellCount} (
                {formatCurrency(summary.totalStockSellCzk)})
              </Text>
            </div>
          </>
        )}
        {showOptions && (
          <>
            <div className="stat-item">
              <Text size="xs" color="muted">
                Opce
              </Text>
              <Text size="sm" weight="semibold">
                {summary.optionTxCount}
              </Text>
            </div>
            <div className="stat-item">
              <Text size="xs" color="muted">
                Čisté prémium
              </Text>
              <Text
                size="sm"
                weight="semibold"
                color={summary.optionNetPremium >= 0 ? 'success' : 'danger'}
              >
                {formatPrice(summary.optionNetPremium, 'USD')}
              </Text>
            </div>
          </>
        )}
      </div>

      {/* Empty state */}
      {!hasData && (
        <EmptyState
          title="Žádné transakce"
          description="Pro vybrané období nebyly nalezeny žádné transakce"
        />
      )}

      {/* Stock Transactions Table */}
      {showStocks && filteredStockTx.length > 0 && (
        <div className="transactions-section">
          <div className="section-header">
            <Text size="sm" weight="semibold">
              Akciové transakce ({filteredStockTx.length})
            </Text>
            <MobileSortControl
              selectedField={stockSortField}
              direction={stockSortDirection}
              onFieldChange={(field) => handleStockSort(field as StockSortKey)}
              onDirectionChange={() => handleStockSort(stockSortField)}
              fields={STOCK_SORT_FIELDS}
            />
          </div>

          {/* Mobile Cards */}
          <div className="transaction-cards">
            {filteredStockTx.map((tx) => (
              <div key={tx.id} className="transaction-card">
                <div className="transaction-card-header">
                  <div className="transaction-card-title">
                    {tx.stock?.id && onStockClick ? (
                      <span
                        onClick={() => onStockClick(tx.stock!.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <Ticker>{tx.stock?.ticker}</Ticker>
                      </span>
                    ) : (
                      <Ticker>{tx.stock?.ticker || '—'}</Ticker>
                    )}
                    <StockName truncate>{tx.stock?.name || '—'}</StockName>
                  </div>
                  <div className="transaction-card-total">
                    <MetricValue
                      sentiment={tx.type === 'BUY' ? 'negative' : 'positive'}
                    >
                      {formatCurrency(tx.total_amount_czk)}
                    </MetricValue>
                    <Badge variant={tx.type === 'BUY' ? 'buy' : 'sell'}>
                      {tx.type === 'BUY' ? 'Nákup' : 'Prodej'}
                    </Badge>
                  </div>
                </div>
                <div className="transaction-card-stats">
                  <div className="transaction-card-stat">
                    <MetricLabel>Datum</MetricLabel>
                    <MetricValue>{formatDate(tx.date)}</MetricValue>
                  </div>
                  <div className="transaction-card-stat">
                    <MetricLabel>Množství</MetricLabel>
                    <MetricValue>{formatShares(tx.quantity)}</MetricValue>
                  </div>
                  <div className="transaction-card-stat">
                    <MetricLabel>Cena</MetricLabel>
                    <MetricValue>
                      {formatPrice(tx.price_per_share, tx.currency)}
                    </MetricValue>
                  </div>
                  <div className="transaction-card-stat">
                    <MetricLabel>Poplatky</MetricLabel>
                    <MetricValue>
                      {tx.fees ? formatPrice(tx.fees, tx.currency) : '—'}
                    </MetricValue>
                  </div>
                  {showPortfolioColumn && (
                    <div className="transaction-card-stat transaction-card-stat--full">
                      <MetricLabel>Portfolio</MetricLabel>
                      <MetricValue>{tx.portfolio?.name || '—'}</MetricValue>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="table-container">
            <table className="transactions-table">
              <thead>
                <tr>
                  <StockSortHeader label="Datum" sortKey="date" />
                  <StockSortHeader label="Ticker" sortKey="ticker" />
                  <th>Název</th>
                  {showPortfolioColumn && <th>Portfolio</th>}
                  <StockSortHeader label="Typ" sortKey="type" />
                  <StockSortHeader
                    label="Množství"
                    sortKey="quantity"
                    className="align-right"
                  />
                  <th className="align-right">Cena</th>
                  <th className="align-right">Poplatky</th>
                  <StockSortHeader
                    label="Celkem CZK"
                    sortKey="totalCzk"
                    className="align-right"
                  />
                </tr>
              </thead>
              <tbody>
                {filteredStockTx.map((tx) => (
                  <tr key={tx.id}>
                    <td>
                      <Text size="sm">{formatDate(tx.date)}</Text>
                    </td>
                    <td>
                      {tx.stock?.id && onStockClick ? (
                        <span
                          onClick={() => onStockClick(tx.stock!.id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <Ticker>{tx.stock?.ticker}</Ticker>
                        </span>
                      ) : (
                        <Ticker>{tx.stock?.ticker || '—'}</Ticker>
                      )}
                    </td>
                    <td>
                      <StockName truncate>{tx.stock?.name || '—'}</StockName>
                    </td>
                    {showPortfolioColumn && (
                      <td>
                        <Text size="sm" color="muted">
                          {tx.portfolio?.name || '—'}
                        </Text>
                      </td>
                    )}
                    <td>
                      <Badge variant={tx.type === 'BUY' ? 'buy' : 'sell'}>
                        {tx.type === 'BUY' ? 'Nákup' : 'Prodej'}
                      </Badge>
                    </td>
                    <td className="align-right">
                      <Text size="sm">{formatShares(tx.quantity)}</Text>
                    </td>
                    <td className="align-right">
                      <Text size="sm">
                        {formatPrice(tx.price_per_share, tx.currency)}
                      </Text>
                    </td>
                    <td className="align-right">
                      <Text size="sm" color="muted">
                        {tx.fees ? formatPrice(tx.fees, tx.currency) : '—'}
                      </Text>
                    </td>
                    <td className="align-right">
                      <MetricValue
                        sentiment={tx.type === 'BUY' ? 'negative' : 'positive'}
                      >
                        {formatCurrency(tx.total_amount_czk)}
                      </MetricValue>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Option Transactions Table */}
      {showOptions && filteredOptionTx.length > 0 && (
        <div className="transactions-section">
          <div className="section-header">
            <Text size="sm" weight="semibold">
              Opční transakce ({filteredOptionTx.length})
            </Text>
            <MobileSortControl
              selectedField={optionSortField}
              direction={optionSortDirection}
              onFieldChange={(field) =>
                handleOptionSort(field as OptionSortKey)
              }
              onDirectionChange={() => handleOptionSort(optionSortField)}
              fields={OPTION_SORT_FIELDS}
            />
          </div>

          {/* Mobile Cards */}
          <div className="transaction-cards">
            {filteredOptionTx.map((tx) => (
              <div key={tx.id} className="transaction-card">
                <div className="transaction-card-header">
                  <div className="transaction-card-title">
                    <Ticker>{tx.symbol}</Ticker>
                    <div className="transaction-card-badges">
                      <Badge
                        variant={tx.option_type === 'call' ? 'info' : 'warning'}
                      >
                        {tx.option_type.toUpperCase()}
                      </Badge>
                      <Badge
                        variant={
                          tx.action === 'BTO' || tx.action === 'BTC'
                            ? 'buy'
                            : tx.action === 'STO' || tx.action === 'STC'
                            ? 'sell'
                            : 'hold'
                        }
                      >
                        {tx.action}
                      </Badge>
                    </div>
                  </div>
                  <div className="transaction-card-total">
                    <MetricValue
                      sentiment={
                        tx.action === 'STO' || tx.action === 'STC'
                          ? 'positive'
                          : tx.action === 'BTO' || tx.action === 'BTC'
                          ? 'negative'
                          : 'neutral'
                      }
                    >
                      {tx.total_premium !== null
                        ? formatPrice(tx.total_premium, 'USD')
                        : '—'}
                    </MetricValue>
                  </div>
                </div>
                <div className="transaction-card-stats">
                  <div className="transaction-card-stat">
                    <MetricLabel>Datum</MetricLabel>
                    <MetricValue>{formatDate(tx.date)}</MetricValue>
                  </div>
                  <div className="transaction-card-stat">
                    <MetricLabel>Strike</MetricLabel>
                    <MetricValue>${tx.strike_price}</MetricValue>
                  </div>
                  <div className="transaction-card-stat">
                    <MetricLabel>Expirace</MetricLabel>
                    <MetricValue>{formatDate(tx.expiration_date)}</MetricValue>
                  </div>
                  <div className="transaction-card-stat">
                    <MetricLabel>Kontrakty</MetricLabel>
                    <MetricValue>{tx.contracts}</MetricValue>
                  </div>
                  <div className="transaction-card-stat">
                    <MetricLabel>Prémium</MetricLabel>
                    <MetricValue>
                      {tx.premium !== null
                        ? formatPrice(tx.premium, 'USD')
                        : '—'}
                    </MetricValue>
                  </div>
                  <div className="transaction-card-stat">
                    <MetricLabel>Poplatky</MetricLabel>
                    <MetricValue>
                      {tx.fees ? formatPrice(tx.fees, 'USD') : '—'}
                    </MetricValue>
                  </div>
                  {showPortfolioColumn && (
                    <div className="transaction-card-stat transaction-card-stat--full">
                      <MetricLabel>Portfolio</MetricLabel>
                      <MetricValue>
                        {portfolios.find((p) => p.id === tx.portfolio_id)
                          ?.name || '—'}
                      </MetricValue>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="table-container">
            <table className="transactions-table options-table">
              <thead>
                <tr>
                  <OptionSortHeader label="Datum" sortKey="date" />
                  <OptionSortHeader label="Symbol" sortKey="symbol" />
                  <th>Typ</th>
                  <th>Strike</th>
                  <th>Expirace</th>
                  {showPortfolioColumn && <th>Portfolio</th>}
                  <OptionSortHeader label="Akce" sortKey="action" />
                  <th className="align-right">Kontrakty</th>
                  <th className="align-right">Prémium</th>
                  <OptionSortHeader
                    label="Celkem"
                    sortKey="totalPremium"
                    className="align-right"
                  />
                  <th className="align-right">Poplatky</th>
                </tr>
              </thead>
              <tbody>
                {filteredOptionTx.map((tx) => (
                  <tr key={tx.id}>
                    <td>
                      <Text size="sm">{formatDate(tx.date)}</Text>
                    </td>
                    <td>
                      <Ticker>{tx.symbol}</Ticker>
                    </td>
                    <td>
                      <Badge
                        variant={tx.option_type === 'call' ? 'info' : 'warning'}
                      >
                        {tx.option_type.toUpperCase()}
                      </Badge>
                    </td>
                    <td>
                      <Text size="sm">${tx.strike_price}</Text>
                    </td>
                    <td>
                      <Text size="sm">{formatDate(tx.expiration_date)}</Text>
                    </td>
                    {showPortfolioColumn && (
                      <td>
                        <Text size="sm" color="muted">
                          {portfolios.find((p) => p.id === tx.portfolio_id)
                            ?.name || '—'}
                        </Text>
                      </td>
                    )}
                    <td>
                      <Badge
                        variant={
                          tx.action === 'BTO' || tx.action === 'BTC'
                            ? 'buy'
                            : tx.action === 'STO' || tx.action === 'STC'
                            ? 'sell'
                            : 'hold'
                        }
                      >
                        {tx.action}
                      </Badge>
                    </td>
                    <td className="align-right">
                      <Text size="sm">{tx.contracts}</Text>
                    </td>
                    <td className="align-right">
                      <Text size="sm">
                        {tx.premium !== null
                          ? formatPrice(tx.premium, 'USD')
                          : '—'}
                      </Text>
                    </td>
                    <td className="align-right">
                      <MetricValue
                        sentiment={
                          tx.action === 'STO' || tx.action === 'STC'
                            ? 'positive'
                            : tx.action === 'BTO' || tx.action === 'BTC'
                            ? 'negative'
                            : 'neutral'
                        }
                      >
                        {tx.total_premium !== null
                          ? formatPrice(tx.total_premium, 'USD')
                          : '—'}
                      </MetricValue>
                    </td>
                    <td className="align-right">
                      <Text size="sm" color="muted">
                        {tx.fees ? formatPrice(tx.fees, 'USD') : '—'}
                      </Text>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
