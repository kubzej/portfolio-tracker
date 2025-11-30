import { useState, useEffect, useCallback } from 'react';
import type {
  Watchlist,
  WatchlistItemWithCalculations,
} from '@/types/database';
import { watchlistsApi, watchlistItemsApi } from '@/services/api';
import {
  Button,
  LoadingSpinner,
  EmptyState,
  ErrorState,
  EditIcon,
  TrashIcon,
  MobileSortControl,
  type SortField as MobileSortField,
} from '@/components/shared';
import {
  SectionTitle,
  Ticker,
  StockName,
  Caption,
  Description,
  Badge,
  Text,
  Muted,
  MetricLabel,
} from '@/components/shared/Typography';
import { useSortable } from '@/hooks';
import { AddStockForm } from './AddStockForm';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';
import './Watchlists.css';

type SortFieldKey =
  | 'ticker'
  | 'last_price'
  | 'last_price_change_percent'
  | 'target_buy_price'
  | 'target_sell_price';

const SORT_FIELDS: MobileSortField[] = [
  { value: 'ticker', label: 'Ticker', defaultDirection: 'asc' },
  { value: 'last_price', label: 'Price', defaultDirection: 'desc' },
  {
    value: 'last_price_change_percent',
    label: 'Change',
    defaultDirection: 'desc',
  },
  { value: 'target_buy_price', label: 'Buy Target', defaultDirection: 'asc' },
  {
    value: 'target_sell_price',
    label: 'Sell Target',
    defaultDirection: 'desc',
  },
];

interface WatchlistViewProps {
  watchlistId: string;
  onBack: () => void;
  onOpenResearch?: (
    ticker: string,
    stockName?: string,
    finnhubTicker?: string
  ) => void;
}

export function WatchlistView({
  watchlistId,
  onBack,
  onOpenResearch,
}: WatchlistViewProps) {
  const [watchlist, setWatchlist] = useState<Watchlist | null>(null);
  const [items, setItems] = useState<WatchlistItemWithCalculations[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingItem, setEditingItem] =
    useState<WatchlistItemWithCalculations | null>(null);
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  // Value extractor for sorting
  const getItemValue = useCallback(
    (item: WatchlistItemWithCalculations, field: SortFieldKey) => {
      switch (field) {
        case 'ticker':
          return item.ticker;
        case 'last_price':
          return item.last_price;
        case 'last_price_change_percent':
          return item.last_price_change_percent;
        case 'target_buy_price':
          return item.target_buy_price;
        case 'target_sell_price':
          return item.target_sell_price;
        default:
          return null;
      }
    },
    []
  );

  const {
    sortedData: sortedItems,
    sortField,
    sortDirection,
    handleSort,
    setSort,
    getSortIndicator,
    isSorted,
  } = useSortable<WatchlistItemWithCalculations, SortFieldKey>(
    items,
    getItemValue,
    {
      defaultField: 'ticker',
      ascendingFields: ['ticker'],
    }
  );

  useEffect(() => {
    loadData();
  }, [watchlistId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [watchlistData, itemsData] = await Promise.all([
        watchlistsApi.getById(watchlistId),
        watchlistItemsApi.getByWatchlistId(watchlistId),
      ]);

      setWatchlist(watchlistData);
      setItems(itemsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load watchlist');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshPrices = async () => {
    if (items.length === 0) return;

    try {
      setRefreshing(true);
      setError(null);

      // Call edge function to fetch and update prices
      await watchlistItemsApi.refreshPrices(watchlistId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh prices');
    } finally {
      setRefreshing(false);
    }
  };

  const handleAddStock = () => {
    setEditingItem(null);
    setShowAddForm(true);
  };

  const handleEditItem = (item: WatchlistItemWithCalculations) => {
    setEditingItem(item);
    setShowAddForm(true);
  };

  const handleFormClose = () => {
    setShowAddForm(false);
    setEditingItem(null);
  };

  const handleFormSuccess = () => {
    setShowAddForm(false);
    setEditingItem(null);
    loadData();
  };

  const toggleNotes = (itemId: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleRemoveItem = async (itemId: string, ticker: string) => {
    if (!confirm(`Remove ${ticker} from this watchlist?`)) {
      return;
    }

    try {
      await watchlistItemsApi.remove(itemId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove item');
    }
  };

  const getTargetStatus = (item: WatchlistItemWithCalculations) => {
    const badges: React.ReactNode[] = [];

    if (item.at_buy_target) {
      badges.push(
        <Badge key="buy" variant="positive" size="sm">
          ✓ Buy
        </Badge>
      );
    }

    if (item.at_sell_target) {
      badges.push(
        <Badge key="sell" variant="negative" size="sm">
          ✓ Sell
        </Badge>
      );
    }

    return badges;
  };

  if (loading) {
    return (
      <div className="watchlist-view">
        <LoadingSpinner text="Loading watchlist..." fullPage />
      </div>
    );
  }

  if (!watchlist) {
    return (
      <div className="watchlist-view">
        <ErrorState message="Watchlist not found" onRetry={onBack} />
      </div>
    );
  }

  return (
    <div className="watchlist-view">
      <div className="watchlist-view-header">
        <div className="header-left">
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← Back
          </Button>
          <div className="watchlist-info">
            <SectionTitle>{watchlist.name}</SectionTitle>
            {watchlist.description && (
              <Description>{watchlist.description}</Description>
            )}
          </div>
        </div>
        <div className="header-actions">
          <Button
            variant="outline"
            onClick={handleRefreshPrices}
            disabled={refreshing || items.length === 0}
          >
            {refreshing ? 'Refreshing...' : 'Refresh Prices'}
          </Button>
          <Button variant="primary" onClick={handleAddStock}>
            + Add Stock
          </Button>
        </div>
      </div>

      {error && <div className="watchlists-error">{error}</div>}

      {items.length === 0 ? (
        <EmptyState
          title="No stocks yet"
          description="Add stocks to this watchlist to start tracking them."
          action={{ label: 'Add Stock', onClick: handleAddStock }}
        />
      ) : (
        <div className="watchlist-items">
          {/* Mobile sort controls */}
          <div className="mobile-sort-controls">
            <MobileSortControl
              fields={SORT_FIELDS}
              selectedField={sortField}
              direction={sortDirection}
              onFieldChange={(field) => {
                const fieldConfig = SORT_FIELDS.find((f) => f.value === field);
                setSort(
                  field as SortFieldKey,
                  fieldConfig?.defaultDirection || 'desc'
                );
              }}
              onDirectionChange={(dir) => setSort(sortField, dir)}
            />
          </div>

          {/* Desktop table view */}
          <table className="watchlist-table">
            <thead>
              <tr>
                <th
                  className={cn('sortable', isSorted('ticker') && 'sorted')}
                  onClick={() => handleSort('ticker')}
                >
                  Ticker {getSortIndicator('ticker')}
                </th>
                <th
                  className={cn(
                    'text-right',
                    'sortable',
                    isSorted('last_price') && 'sorted'
                  )}
                  onClick={() => handleSort('last_price')}
                >
                  Price {getSortIndicator('last_price')}
                </th>
                <th
                  className={cn(
                    'text-right',
                    'sortable',
                    isSorted('last_price_change_percent') && 'sorted'
                  )}
                  onClick={() => handleSort('last_price_change_percent')}
                >
                  Change {getSortIndicator('last_price_change_percent')}
                </th>
                <th
                  className={cn(
                    'text-right',
                    'sortable',
                    isSorted('target_buy_price') && 'sorted'
                  )}
                  onClick={() => handleSort('target_buy_price')}
                >
                  Buy Target {getSortIndicator('target_buy_price')}
                </th>
                <th
                  className={cn(
                    'text-right',
                    'sortable',
                    isSorted('target_sell_price') && 'sorted'
                  )}
                  onClick={() => handleSort('target_sell_price')}
                >
                  Sell Target {getSortIndicator('target_sell_price')}
                </th>
                <th>Status</th>
                <th>Notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => (
                <tr key={item.id}>
                  <td className="ticker-cell">
                    <button
                      className="ticker-link"
                      onClick={() =>
                        onOpenResearch?.(
                          item.ticker,
                          item.name ?? undefined,
                          item.finnhub_ticker ?? undefined
                        )
                      }
                      title="Open research"
                    >
                      <Ticker>{item.ticker}</Ticker>
                    </button>
                    {item.name && <StockName truncate>{item.name}</StockName>}
                  </td>
                  <td className="text-right">
                    {item.last_price
                      ? formatCurrency(item.last_price, item.currency || 'USD')
                      : '—'}
                  </td>
                  <td className="text-right change-cell">
                    {item.last_price_change_percent !== null ? (
                      <div className="dual-value">
                        <Text
                          weight="medium"
                          color={
                            item.last_price_change_percent > 0
                              ? 'success'
                              : item.last_price_change_percent < 0
                              ? 'danger'
                              : undefined
                          }
                        >
                          {item.last_price_change_percent > 0 ? '+' : ''}
                          {item.last_price_change_percent.toFixed(2)}%
                        </Text>
                        {item.last_price_change !== null && (
                          <Text size="xs" color="secondary">
                            {item.last_price_change > 0 ? '+' : ''}
                            {formatCurrency(
                              item.last_price_change,
                              item.currency || 'USD'
                            )}
                          </Text>
                        )}
                      </div>
                    ) : (
                      <Muted>—</Muted>
                    )}
                  </td>
                  <td className="text-right">
                    {item.target_buy_price ? (
                      <div className="dual-value">
                        <Text
                          weight={item.at_buy_target ? 'semibold' : 'medium'}
                          color={item.at_buy_target ? 'success' : undefined}
                        >
                          {formatCurrency(
                            item.target_buy_price,
                            item.currency || 'USD'
                          )}
                        </Text>
                        {item.distance_to_buy_target !== null && (
                          <Text size="xs" color="secondary">
                            ({item.distance_to_buy_target > 0 ? '+' : ''}
                            {item.distance_to_buy_target.toFixed(1)}%)
                          </Text>
                        )}
                      </div>
                    ) : (
                      <Muted>—</Muted>
                    )}
                  </td>
                  <td className="text-right">
                    {item.target_sell_price ? (
                      <div className="dual-value">
                        <Text
                          weight={item.at_sell_target ? 'semibold' : 'medium'}
                          color={item.at_sell_target ? 'danger' : undefined}
                        >
                          {formatCurrency(
                            item.target_sell_price,
                            item.currency || 'USD'
                          )}
                        </Text>
                        {item.distance_to_sell_target !== null && (
                          <Text size="xs" color="secondary">
                            ({item.distance_to_sell_target > 0 ? '+' : ''}
                            {item.distance_to_sell_target.toFixed(1)}%)
                          </Text>
                        )}
                      </div>
                    ) : (
                      <Muted>—</Muted>
                    )}
                  </td>
                  <td className="status-cell">{getTargetStatus(item)}</td>
                  <td className="notes-cell">
                    {item.notes && (
                      <div title={item.notes}>
                        <Caption>
                          {item.notes.length > 30
                            ? item.notes.slice(0, 30) + '...'
                            : item.notes}
                        </Caption>
                      </div>
                    )}
                  </td>
                  <td className="actions-cell">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditItem(item)}
                      title="Edit"
                    >
                      <EditIcon size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(item.id, item.ticker)}
                      title="Remove"
                    >
                      <TrashIcon size={14} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile card view */}
          <div className="watchlist-cards-mobile">
            {sortedItems.map((item) => (
              <div key={item.id} className="watchlist-item-card">
                <div className="item-card-header">
                  <div className="item-card-ticker-group">
                    <button
                      className="ticker-link large"
                      onClick={() =>
                        onOpenResearch?.(
                          item.ticker,
                          item.name ?? undefined,
                          item.finnhub_ticker ?? undefined
                        )
                      }
                    >
                      <Ticker size="lg">{item.ticker}</Ticker>
                    </button>
                    {item.name && <StockName truncate>{item.name}</StockName>}
                  </div>
                  <div className="item-card-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEditItem(item)}
                    >
                      <EditIcon size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveItem(item.id, item.ticker)}
                    >
                      <TrashIcon size={14} />
                    </Button>
                  </div>
                </div>

                <div className="item-card-price">
                  <Text size="lg" weight="semibold">
                    {item.last_price
                      ? formatCurrency(item.last_price, item.currency || 'USD')
                      : '—'}
                  </Text>
                  <Text
                    size="sm"
                    weight="medium"
                    color={
                      item.last_price_change_percent !== null
                        ? item.last_price_change_percent > 0
                          ? 'success'
                          : item.last_price_change_percent < 0
                          ? 'danger'
                          : undefined
                        : undefined
                    }
                  >
                    {item.last_price_change_percent !== null
                      ? `${
                          item.last_price_change_percent > 0 ? '+' : ''
                        }${item.last_price_change_percent.toFixed(2)}%`
                      : ''}
                  </Text>
                </div>

                <div className="item-card-targets">
                  {item.target_buy_price && (
                    <div
                      className={cn(
                        'target-row',
                        item.at_buy_target && 'target-hit'
                      )}
                    >
                      <MetricLabel>Buy:</MetricLabel>
                      <Text size="sm" weight="medium">
                        {formatCurrency(
                          item.target_buy_price,
                          item.currency || 'USD'
                        )}
                      </Text>
                      {item.distance_to_buy_target !== null && (
                        <Text size="xs" color="secondary">
                          ({item.distance_to_buy_target > 0 ? '+' : ''}
                          {item.distance_to_buy_target.toFixed(1)}%)
                        </Text>
                      )}
                    </div>
                  )}
                  {item.target_sell_price && (
                    <div
                      className={cn(
                        'target-row',
                        item.at_sell_target && 'target-hit'
                      )}
                    >
                      <MetricLabel>Sell:</MetricLabel>
                      <Text size="sm" weight="medium">
                        {formatCurrency(
                          item.target_sell_price,
                          item.currency || 'USD'
                        )}
                      </Text>
                      {item.distance_to_sell_target !== null && (
                        <Text size="xs" color="secondary">
                          ({item.distance_to_sell_target > 0 ? '+' : ''}
                          {item.distance_to_sell_target.toFixed(1)}%)
                        </Text>
                      )}
                    </div>
                  )}
                </div>

                {getTargetStatus(item).length > 0 && (
                  <div className="item-card-status">
                    {getTargetStatus(item)}
                  </div>
                )}

                {item.notes && (
                  <div
                    className={cn(
                      'item-card-notes',
                      expandedNotes.has(item.id) && 'expanded'
                    )}
                    onClick={() => toggleNotes(item.id)}
                  >
                    {item.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Stock Form */}
      {showAddForm && (
        <AddStockForm
          watchlistId={watchlistId}
          item={editingItem}
          existingTickers={items.map((i) => i.ticker)}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
}
