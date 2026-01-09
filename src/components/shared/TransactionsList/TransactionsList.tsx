import { useState, useEffect, useMemo, useCallback } from 'react';
import { transactionsApi } from '@/services/api';
import type { TransactionWithStock, Stock } from '@/types';
import {
  formatCurrency,
  formatPrice,
  formatShares,
  formatDate,
} from '@/utils/format';
import { cn } from '@/utils/cn';
import { useSortable } from '@/hooks';
import {
  Button,
  EmptyState,
  LoadingSpinner,
  ToggleGroup,
  MobileSortControl,
  EditIcon,
  TrashIcon,
  type SortField,
} from '@/components/shared';
import {
  SectionTitle,
  Badge,
  Text,
  MetricLabel,
  MetricValue,
  Ticker,
  StockName,
} from '@/components/shared/Typography';
import { Input } from '@/components/shared/Input';
import './TransactionsList.css';

type TypeFilter = 'ALL' | 'BUY' | 'SELL';

type SortKey =
  | 'date'
  | 'ticker'
  | 'type'
  | 'quantity'
  | 'price'
  | 'total'
  | 'totalCzk';

const SORT_FIELDS: SortField[] = [
  { value: 'date', label: 'Datum', defaultDirection: 'desc' },
  { value: 'ticker', label: 'Ticker', defaultDirection: 'asc' },
  { value: 'type', label: 'Typ', defaultDirection: 'asc' },
  { value: 'totalCzk', label: 'Celkem CZK', defaultDirection: 'desc' },
  { value: 'quantity', label: 'Množství', defaultDirection: 'desc' },
];

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'Vše' },
  { value: 'BUY', label: 'Nákup' },
  { value: 'SELL', label: 'Prodej' },
];

// Helper to format source lot info for SELL transactions
const formatSourceLot = (tx: TransactionWithStock): string | null => {
  if (tx.type !== 'SELL') return null;
  if (!tx.source_transaction_id) return 'Celá pozice';
  if (tx.source_transaction) {
    const date = formatDate(tx.source_transaction.date);
    const price = formatPrice(
      tx.source_transaction.price_per_share,
      tx.source_transaction.currency
    );
    return `${date} @ ${price}`;
  }
  return 'Lot';
};

interface TransactionsListProps {
  /** Portfolio ID - if null, shows all portfolios */
  portfolioId?: string | null;
  /** Stock ID - if provided, filters to single stock (used in StockDetail) */
  stockId?: string;
  /** Stock object - if provided, uses this for currency display instead of fetching */
  stock?: Stock;
  /** Show stock column (ticker) - useful when showing transactions across stocks */
  showStockColumn?: boolean;
  /** Show filters (time range, type, stock search) */
  showFilters?: boolean;
  /** Show section header with title */
  showHeader?: boolean;
  /** Custom header title */
  headerTitle?: string;
  /** Show add transaction button */
  showAddButton?: boolean;
  /** Callback when add transaction is clicked */
  onAddTransaction?: () => void;
  /** Callback when edit transaction is clicked */
  onEditTransaction?: (transaction: TransactionWithStock) => void;
  /** Callback when delete transaction is clicked */
  onDeleteTransaction?: (transactionId: string) => void;
  /** Whether to allow editing/deleting */
  editable?: boolean;
  /** Max items to show (for compact view) */
  maxItems?: number;
  /** Callback when stock is clicked (navigates to stock detail) */
  onStockClick?: (stockId: string) => void;
  /** External refresh trigger - increment to trigger reload */
  refreshTrigger?: number;
  /** Default to showing current month only (for Dashboard) */
  defaultToCurrentMonth?: boolean;
}

export function TransactionsList({
  portfolioId,
  stockId,
  stock,
  showStockColumn = true,
  showFilters = true,
  showHeader = true,
  headerTitle = 'Transakce',
  showAddButton = false,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  editable = false,
  maxItems,
  onStockClick,
  refreshTrigger,
  defaultToCurrentMonth = false,
}: TransactionsListProps) {
  const [transactions, setTransactions] = useState<TransactionWithStock[]>([]);
  const [loading, setLoading] = useState(true);

  // Helper to get first day of current month in YYYY-MM-DD format
  const getFirstDayOfMonth = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
      2,
      '0'
    )}-01`;
  };

  // Filter states
  const [dateFrom, setDateFrom] = useState<string>(
    defaultToCurrentMonth ? getFirstDayOfMonth() : ''
  );
  const [dateTo, setDateTo] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [stockSearch, setStockSearch] = useState('');

  // Value extractor for sorting
  const getTransactionValue = useCallback(
    (item: TransactionWithStock, field: SortKey): string | number | null => {
      switch (field) {
        case 'date':
          return new Date(item.date).getTime();
        case 'ticker':
          return (item.stock?.ticker || '').toLowerCase();
        case 'type':
          return item.type;
        case 'quantity':
          return item.quantity;
        case 'price':
          return item.price_per_share;
        case 'total':
          return item.total_amount;
        case 'totalCzk':
          return item.total_amount_czk;
        default:
          return null;
      }
    },
    []
  );

  const {
    sortedData,
    sortField,
    sortDirection,
    handleSort,
    setSort,
    getSortIndicator,
    isSorted,
  } = useSortable<TransactionWithStock, SortKey>(
    transactions,
    getTransactionValue,
    {
      defaultField: 'date',
      defaultDirection: 'desc',
      ascendingFields: ['ticker', 'type'],
    }
  );

  // Load data
  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portfolioId, stockId, refreshTrigger]);

  const loadData = async () => {
    try {
      setLoading(true);

      let data: TransactionWithStock[];

      if (stockId) {
        // Get transactions for specific stock (includes portfolio data from API)
        const stockTransactions = await transactionsApi.getByStockId(
          stockId,
          portfolioId ?? undefined
        );
        // Enrich with stock data if provided
        data = stockTransactions.map((tx) => ({
          ...tx,
          stock: stock ?? tx.stock,
        }));
      } else {
        // Get all transactions (optionally filtered by portfolio)
        data = await transactionsApi.getAll(portfolioId ?? undefined);
      }

      setTransactions(data);
    } catch (err) {
      console.error('Failed to load transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    let filtered = sortedData;

    // Date from filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      filtered = filtered.filter((tx) => new Date(tx.date) >= fromDate);
    }

    // Date to filter
    if (dateTo) {
      const toDate = new Date(dateTo);
      // Include the entire "to" day
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter((tx) => new Date(tx.date) <= toDate);
    }

    // Type filter
    if (typeFilter !== 'ALL') {
      filtered = filtered.filter((tx) => tx.type === typeFilter);
    }

    // Stock search filter
    if (stockSearch.trim()) {
      const search = stockSearch.toLowerCase();
      filtered = filtered.filter(
        (tx) =>
          tx.stock?.ticker.toLowerCase().includes(search) ||
          tx.stock?.name.toLowerCase().includes(search)
      );
    }

    // Max items limit
    if (maxItems) {
      filtered = filtered.slice(0, maxItems);
    }

    return filtered;
  }, [sortedData, dateFrom, dateTo, typeFilter, stockSearch, maxItems]);

  // Summary stats
  const stats = useMemo(() => {
    const buyTx = filteredTransactions.filter((tx) => tx.type === 'BUY');
    const sellTx = filteredTransactions.filter((tx) => tx.type === 'SELL');

    return {
      totalCount: filteredTransactions.length,
      buyCount: buyTx.length,
      sellCount: sellTx.length,
      totalBuyCzk: buyTx.reduce((sum, tx) => sum + tx.total_amount_czk, 0),
      totalSellCzk: sellTx.reduce((sum, tx) => sum + tx.total_amount_czk, 0),
    };
  }, [filteredTransactions]);

  // Calculate sold quantity per BUY lot
  const soldPerLot = useMemo(() => {
    const map = new Map<string, number>();
    // Go through all transactions (not just filtered) to get accurate counts
    transactions.forEach((tx) => {
      if (tx.type === 'SELL' && tx.source_transaction_id) {
        const current = map.get(tx.source_transaction_id) || 0;
        map.set(tx.source_transaction_id, current + tx.quantity);
      }
    });
    return map;
  }, [transactions]);

  // Helper to get lot status for BUY transactions
  const getLotStatus = (
    tx: TransactionWithStock
  ): { sold: number; remaining: number; isFullySold: boolean } | null => {
    if (tx.type !== 'BUY') return null;
    const sold = soldPerLot.get(tx.id) || 0;
    const remaining = tx.quantity - sold;
    return { sold, remaining, isFullySold: remaining <= 0 };
  };

  const handleDeleteClick = async (transactionId: string) => {
    if (onDeleteTransaction) {
      onDeleteTransaction(transactionId);
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
    return <LoadingSpinner text="Načítám transakce..." />;
  }

  const hasTransactions = transactions.length > 0;

  return (
    <div className="transactions-list">
      {/* Header */}
      {showHeader && (
        <div className="transactions-list-header">
          <SectionTitle>{headerTitle}</SectionTitle>
          {showAddButton && onAddTransaction && (
            <Button variant="primary" size="sm" onClick={onAddTransaction}>
              + Přidat
            </Button>
          )}
        </div>
      )}

      {/* Filters */}
      {showFilters && hasTransactions && (
        <div className="transactions-filters">
          <div className="filters-row">
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
                  Vymazat
                </Button>
              )}
            </div>
            <ToggleGroup
              value={typeFilter}
              onChange={(v) => setTypeFilter(v as TypeFilter)}
              options={TYPE_OPTIONS}
              variant="transaction"
              size="sm"
            />
          </div>
          {showStockColumn && !stockId && (
            <div className="stock-filter">
              <Input
                type="text"
                placeholder="Hledat akcie..."
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                inputSize="sm"
              />
            </div>
          )}
        </div>
      )}

      {/* Summary stats */}
      {showFilters && hasTransactions && (
        <div className="transactions-stats">
          <div className="stat-item">
            <Text size="xs" color="muted">
              Celkem
            </Text>
            <Text size="sm" weight="semibold">
              {stats.totalCount}
            </Text>
          </div>
          <div className="stat-item">
            <Text size="xs" color="muted">
              Nákupy
            </Text>
            <Text size="sm" weight="semibold" color="success">
              {stats.buyCount} ({formatCurrency(stats.totalBuyCzk)})
            </Text>
          </div>
          <div className="stat-item">
            <Text size="xs" color="muted">
              Prodeje
            </Text>
            <Text size="sm" weight="semibold" color="danger">
              {stats.sellCount} ({formatCurrency(stats.totalSellCzk)})
            </Text>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasTransactions && (
        <EmptyState
          title="Žádné transakce"
          description={stockId ? undefined : 'Přidejte první transakci'}
        />
      )}

      {/* Content */}
      {hasTransactions && (
        <>
          {filteredTransactions.length === 0 ? (
            <EmptyState
              title="Žádné transakce"
              description="Změňte filtry pro zobrazení transakcí"
            />
          ) : (
            <>
              {/* Mobile Sort Controls */}
              <div className="transactions-mobile-sort">
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
              <div className="transactions-cards">
                {filteredTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className={cn(
                      'transaction-card',
                      onStockClick && showStockColumn && 'clickable'
                    )}
                    onClick={() =>
                      showStockColumn &&
                      onStockClick &&
                      tx.stock_id &&
                      onStockClick(tx.stock_id)
                    }
                  >
                    <div className="transaction-card-header">
                      <div className="transaction-card-info">
                        <Badge variant={tx.type === 'BUY' ? 'buy' : 'sell'}>
                          {tx.type}
                        </Badge>
                        <Text color="muted" size="sm">
                          {formatDate(tx.date)}
                        </Text>
                      </div>
                      {editable &&
                        (onEditTransaction || onDeleteTransaction) && (
                          <div
                            className="transaction-card-actions"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {onEditTransaction && (
                              <Button
                                variant="ghost"
                                size="sm"
                                icon
                                onClick={() => onEditTransaction(tx)}
                              >
                                <EditIcon size={14} />
                              </Button>
                            )}
                            {onDeleteTransaction && (
                              <Button
                                variant="ghost"
                                size="sm"
                                icon
                                className="danger"
                                onClick={() => handleDeleteClick(tx.id)}
                              >
                                <TrashIcon size={14} />
                              </Button>
                            )}
                          </div>
                        )}
                    </div>

                    {showStockColumn && tx.stock && (
                      <div className="transaction-card-stock">
                        <Ticker>{tx.stock.ticker}</Ticker>
                        <StockName truncate>{tx.stock.name}</StockName>
                      </div>
                    )}

                    {!portfolioId && tx.portfolio && (
                      <div className="transaction-card-portfolio">
                        <Text size="xs" color="muted">
                          {tx.portfolio.name}
                        </Text>
                      </div>
                    )}

                    {/* Source lot info for SELL transactions */}
                    {tx.type === 'SELL' && (
                      <div className="transaction-card-lot">
                        <MetricLabel>Lot</MetricLabel>
                        <MetricValue size="sm">
                          {formatSourceLot(tx)}
                        </MetricValue>
                      </div>
                    )}

                    {/* Lot status for BUY transactions */}
                    {tx.type === 'BUY' &&
                      (() => {
                        const lotStatus = getLotStatus(tx);
                        if (!lotStatus || lotStatus.sold === 0) return null;
                        return (
                          <div className="transaction-card-lot">
                            <MetricLabel>Lot</MetricLabel>
                            <MetricValue
                              size="sm"
                              sentiment={
                                lotStatus.isFullySold ? 'negative' : undefined
                              }
                            >
                              {lotStatus.isFullySold
                                ? 'Prodáno'
                                : `Zbývá ${formatShares(lotStatus.remaining)}`}
                            </MetricValue>
                          </div>
                        );
                      })()}

                    <div className="transaction-card-body">
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
                        <MetricLabel>Celkem</MetricLabel>
                        <MetricValue>
                          {formatPrice(tx.total_amount, tx.currency)}
                        </MetricValue>
                      </div>
                      <div className="transaction-card-stat">
                        <MetricLabel>Celkem CZK</MetricLabel>
                        <MetricValue>
                          {formatCurrency(tx.total_amount_czk)}
                        </MetricValue>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="transactions-table-wrapper">
                <table className="transactions-table">
                  <thead>
                    <tr>
                      <SortHeader label="Datum" sortKeyName="date" />
                      {showStockColumn && (
                        <SortHeader label="Akcie" sortKeyName="ticker" />
                      )}
                      {!portfolioId && <th>Portfolio</th>}
                      <SortHeader label="Typ" sortKeyName="type" />
                      <th>Lot</th>
                      <SortHeader
                        label="Množství"
                        sortKeyName="quantity"
                        className="right"
                      />
                      <SortHeader
                        label="Cena"
                        sortKeyName="price"
                        className="right"
                      />
                      <SortHeader
                        label="Celkem"
                        sortKeyName="total"
                        className="right"
                      />
                      <th className="right">Poplatky</th>
                      <SortHeader
                        label="Celkem CZK"
                        sortKeyName="totalCzk"
                        className="right"
                      />
                      {editable && <th>Akce</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((tx) => (
                      <tr
                        key={tx.id}
                        className={cn(
                          onStockClick && showStockColumn && 'clickable'
                        )}
                        onClick={() =>
                          showStockColumn &&
                          onStockClick &&
                          tx.stock_id &&
                          onStockClick(tx.stock_id)
                        }
                      >
                        <td>{formatDate(tx.date)}</td>
                        {showStockColumn && (
                          <td>
                            <div className="stock-cell">
                              <Ticker>{tx.stock?.ticker || '—'}</Ticker>
                              <StockName truncate>
                                {tx.stock?.name || ''}
                              </StockName>
                            </div>
                          </td>
                        )}
                        {!portfolioId && (
                          <td>
                            <Text size="sm">{tx.portfolio?.name || '—'}</Text>
                          </td>
                        )}
                        <td>
                          <Badge variant={tx.type === 'BUY' ? 'buy' : 'sell'}>
                            {tx.type}
                          </Badge>
                        </td>
                        <td>
                          {tx.type === 'SELL' ? (
                            <Text size="sm" color="secondary">
                              {formatSourceLot(tx)}
                            </Text>
                          ) : (
                            (() => {
                              const lotStatus = getLotStatus(tx);
                              if (!lotStatus || lotStatus.sold === 0) {
                                return (
                                  <Text size="sm" color="muted">
                                    —
                                  </Text>
                                );
                              }
                              if (lotStatus.isFullySold) {
                                return (
                                  <Text size="sm" color="danger">
                                    Prodáno
                                  </Text>
                                );
                              }
                              return (
                                <Text size="sm" color="secondary">
                                  Zbývá {formatShares(lotStatus.remaining)}
                                </Text>
                              );
                            })()
                          )}
                        </td>
                        <td className="right">{formatShares(tx.quantity)}</td>
                        <td className="right">
                          {formatPrice(tx.price_per_share, tx.currency)}
                        </td>
                        <td className="right">
                          {formatPrice(tx.total_amount, tx.currency)}
                        </td>
                        <td className="right">
                          {tx.fees ? formatPrice(tx.fees, tx.currency) : '—'}
                        </td>
                        <td className="right">
                          {formatCurrency(tx.total_amount_czk)}
                        </td>
                        {editable && (
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="row-actions">
                              {onEditTransaction && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon
                                  onClick={() => onEditTransaction(tx)}
                                >
                                  <EditIcon size={14} />
                                </Button>
                              )}
                              {onDeleteTransaction && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon
                                  className="danger"
                                  onClick={() => handleDeleteClick(tx.id)}
                                >
                                  <TrashIcon size={14} />
                                </Button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
