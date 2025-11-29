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
} from '@/components/shared';
import {
  BottomSheetSelect,
  type SelectOption,
} from '@/components/shared/BottomSheet';
import { useSortable } from '@/hooks';
import { AddStockForm } from './AddStockForm';
import { formatCurrency } from '@/utils/format';
import { cn } from '@/utils/cn';
import './Watchlists.css';

type SortField =
  | 'ticker'
  | 'last_price'
  | 'last_price_change_percent'
  | 'target_buy_price'
  | 'target_sell_price';

const SORT_OPTIONS: SelectOption[] = [
  { value: 'ticker-asc', label: 'Ticker (A-Z)' },
  { value: 'ticker-desc', label: 'Ticker (Z-A)' },
  { value: 'last_price-desc', label: 'Price (High-Low)' },
  { value: 'last_price-asc', label: 'Price (Low-High)' },
  { value: 'last_price_change_percent-desc', label: 'Change (Best)' },
  { value: 'last_price_change_percent-asc', label: 'Change (Worst)' },
  { value: 'target_buy_price-asc', label: 'Buy Target (Low-High)' },
  { value: 'target_buy_price-desc', label: 'Buy Target (High-Low)' },
  { value: 'target_sell_price-desc', label: 'Sell Target (High-Low)' },
  { value: 'target_sell_price-asc', label: 'Sell Target (Low-High)' },
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

  // Value extractor for sorting
  const getItemValue = useCallback(
    (item: WatchlistItemWithCalculations, field: SortField) => {
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
    sortValue,
    handleSort,
    setSortFromValue,
    getSortIndicator,
    isSorted,
  } = useSortable<WatchlistItemWithCalculations, SortField>(
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

  const getPriceClass = (change: number | null) => {
    if (change === null) return '';
    if (change > 0) return 'positive';
    if (change < 0) return 'negative';
    return '';
  };

  const getTargetStatus = (item: WatchlistItemWithCalculations) => {
    const badges: React.ReactNode[] = [];

    if (item.at_buy_target) {
      badges.push(
        <span key="buy" className="target-badge buy">
          ✓ Buy Target
        </span>
      );
    }

    if (item.at_sell_target) {
      badges.push(
        <span key="sell" className="target-badge sell">
          ✓ Sell Target
        </span>
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
          <button className="back-btn" onClick={onBack}>
            ← Back
          </button>
          <div
            className="watchlist-color-dot"
            style={{ backgroundColor: watchlist.color }}
          />
          <div className="watchlist-info">
            <h2>{watchlist.name}</h2>
            {watchlist.description && <p>{watchlist.description}</p>}
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
            <BottomSheetSelect
              label="Sort by"
              options={SORT_OPTIONS}
              value={sortValue}
              onChange={setSortFromValue}
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
                      {item.ticker}
                    </button>
                    {item.name && (
                      <span className="stock-name">{item.name}</span>
                    )}
                  </td>
                  <td className="text-right">
                    {item.last_price
                      ? formatCurrency(item.last_price, item.currency || 'USD')
                      : '—'}
                  </td>
                  <td
                    className={cn(
                      'text-right',
                      getPriceClass(item.last_price_change_percent)
                    )}
                  >
                    {item.last_price_change_percent !== null ? (
                      <div className="dual-value">
                        <span className="primary">
                          {item.last_price_change_percent > 0 ? '+' : ''}
                          {item.last_price_change_percent.toFixed(2)}%
                        </span>
                        {item.last_price_change !== null && (
                          <span className="secondary">
                            {item.last_price_change > 0 ? '+' : ''}
                            {formatCurrency(
                              item.last_price_change,
                              item.currency || 'USD'
                            )}
                          </span>
                        )}
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="text-right">
                    {item.target_buy_price ? (
                      <span
                        className={item.at_buy_target ? 'target-hit buy' : ''}
                      >
                        {formatCurrency(
                          item.target_buy_price,
                          item.currency || 'USD'
                        )}
                        {item.distance_to_buy_target !== null && (
                          <span className="distance">
                            ({item.distance_to_buy_target > 0 ? '+' : ''}
                            {item.distance_to_buy_target.toFixed(1)}%)
                          </span>
                        )}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="text-right">
                    {item.target_sell_price ? (
                      <span
                        className={item.at_sell_target ? 'target-hit sell' : ''}
                      >
                        {formatCurrency(
                          item.target_sell_price,
                          item.currency || 'USD'
                        )}
                        {item.distance_to_sell_target !== null && (
                          <span className="distance">
                            ({item.distance_to_sell_target > 0 ? '+' : ''}
                            {item.distance_to_sell_target.toFixed(1)}%)
                          </span>
                        )}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="status-cell">{getTargetStatus(item)}</td>
                  <td className="notes-cell">
                    {item.notes && (
                      <span className="notes-preview" title={item.notes}>
                        {item.notes.length > 30
                          ? item.notes.slice(0, 30) + '...'
                          : item.notes}
                      </span>
                    )}
                  </td>
                  <td className="actions-cell">
                    <button
                      className="item-action-btn"
                      onClick={() => handleEditItem(item)}
                      title="Edit"
                    >
                      <EditIcon size={14} />
                    </button>
                    <button
                      className="item-action-btn danger"
                      onClick={() => handleRemoveItem(item.id, item.ticker)}
                      title="Remove"
                    >
                      <TrashIcon size={14} />
                    </button>
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
                      {item.ticker}
                    </button>
                    {item.name && (
                      <span className="stock-name">{item.name}</span>
                    )}
                  </div>
                  <div className="item-card-actions">
                    <button
                      className="item-action-btn"
                      onClick={() => handleEditItem(item)}
                    >
                      <EditIcon size={14} />
                    </button>
                    <button
                      className="item-action-btn danger"
                      onClick={() => handleRemoveItem(item.id, item.ticker)}
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                </div>

                <div className="item-card-price">
                  <span className="price">
                    {item.last_price
                      ? formatCurrency(item.last_price, item.currency || 'USD')
                      : '—'}
                  </span>
                  <span
                    className={cn(
                      'change',
                      getPriceClass(item.last_price_change_percent)
                    )}
                  >
                    {item.last_price_change_percent !== null
                      ? `${
                          item.last_price_change_percent > 0 ? '+' : ''
                        }${item.last_price_change_percent.toFixed(2)}%`
                      : ''}
                  </span>
                </div>

                <div className="item-card-targets">
                  {item.target_buy_price && (
                    <div
                      className={cn(
                        'target-row',
                        item.at_buy_target && 'target-hit'
                      )}
                    >
                      <span className="target-label">Buy:</span>
                      <span className="target-value">
                        {formatCurrency(
                          item.target_buy_price,
                          item.currency || 'USD'
                        )}
                      </span>
                      {item.distance_to_buy_target !== null && (
                        <span className="target-distance">
                          ({item.distance_to_buy_target > 0 ? '+' : ''}
                          {item.distance_to_buy_target.toFixed(1)}%)
                        </span>
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
                      <span className="target-label">Sell:</span>
                      <span className="target-value">
                        {formatCurrency(
                          item.target_sell_price,
                          item.currency || 'USD'
                        )}
                      </span>
                      {item.distance_to_sell_target !== null && (
                        <span className="target-distance">
                          ({item.distance_to_sell_target > 0 ? '+' : ''}
                          {item.distance_to_sell_target.toFixed(1)}%)
                        </span>
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
                  <div className="item-card-notes">{item.notes}</div>
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
