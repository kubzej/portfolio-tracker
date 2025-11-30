import { useState, useEffect } from 'react';
import type { WatchlistSummary } from '@/types/database';
import { watchlistsApi } from '@/services/api';
import {
  Button,
  LoadingSpinner,
  EmptyState,
  EditIcon,
  TrashIcon,
} from '@/components/shared';
import {
  SectionTitle,
  CardTitle,
  Description,
  MetricValue,
  MetricLabel,
} from '@/components/shared/Typography';
import { WatchlistForm } from './WatchlistForm';
import './Watchlists.css';

interface WatchlistManagerProps {
  onSelectWatchlist: (watchlistId: string) => void;
}

export function WatchlistManager({ onSelectWatchlist }: WatchlistManagerProps) {
  const [watchlists, setWatchlists] = useState<WatchlistSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingWatchlist, setEditingWatchlist] =
    useState<WatchlistSummary | null>(null);

  useEffect(() => {
    loadWatchlists();
  }, []);

  const loadWatchlists = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await watchlistsApi.getAllWithSummary();
      setWatchlists(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load watchlists'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingWatchlist(null);
    setShowForm(true);
  };

  const handleEdit = (watchlist: WatchlistSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingWatchlist(watchlist);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingWatchlist(null);
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingWatchlist(null);
    loadWatchlists();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this watchlist and all its items?')) {
      return;
    }

    try {
      await watchlistsApi.delete(id);
      await loadWatchlists();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete watchlist'
      );
    }
  };

  if (loading) {
    return (
      <div className="watchlists">
        <LoadingSpinner text="Loading watchlists..." fullPage />
      </div>
    );
  }

  return (
    <div className="watchlists">
      <div className="watchlists-header">
        <SectionTitle>Watchlists</SectionTitle>
        <Button variant="primary" onClick={handleCreate}>
          + New Watchlist
        </Button>
      </div>

      {error && <div className="watchlists-error">{error}</div>}

      {watchlists.length === 0 ? (
        <EmptyState
          title="No watchlists yet"
          description="Create your first watchlist to start tracking stocks you're interested in."
          action={{ label: 'Create Watchlist', onClick: handleCreate }}
        />
      ) : (
        <div className="watchlists-grid">
          {watchlists.map((watchlist) => (
            <div
              key={watchlist.id}
              className="watchlist-card"
              onClick={() => onSelectWatchlist(watchlist.id)}
            >
              <div className="watchlist-card-content">
                <div className="watchlist-card-header">
                  <div className="watchlist-card-title">
                    <div
                      className="watchlist-card-dot"
                      style={{ backgroundColor: watchlist.color }}
                    />
                    <CardTitle>{watchlist.name}</CardTitle>
                  </div>
                  <div className="watchlist-card-actions">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleEdit(watchlist, e)}
                      title="Edit watchlist"
                    >
                      <EditIcon size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleDelete(watchlist.id, e)}
                      title="Delete watchlist"
                    >
                      <TrashIcon size={14} />
                    </Button>
                  </div>
                </div>
                {watchlist.description && (
                  <div className="watchlist-card-description">
                    <Description>{watchlist.description}</Description>
                  </div>
                )}
                <div className="watchlist-card-stats">
                  <div className="watchlist-stat">
                    <MetricValue size="base">
                      {watchlist.item_count}
                    </MetricValue>
                    <MetricLabel>
                      {watchlist.item_count === 1 ? 'stock' : 'stocks'}
                    </MetricLabel>
                  </div>
                  {watchlist.items_at_buy_target > 0 && (
                    <div className="watchlist-stat buy-target">
                      <MetricValue size="base" sentiment="positive">
                        {watchlist.items_at_buy_target}
                      </MetricValue>
                      <MetricLabel>at buy target</MetricLabel>
                    </div>
                  )}
                  {watchlist.items_at_sell_target > 0 && (
                    <div className="watchlist-stat sell-target">
                      <MetricValue size="base" sentiment="negative">
                        {watchlist.items_at_sell_target}
                      </MetricValue>
                      <MetricLabel>at sell target</MetricLabel>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showForm && (
        <WatchlistForm
          watchlist={editingWatchlist}
          onClose={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
}
