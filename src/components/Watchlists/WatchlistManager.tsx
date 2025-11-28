import { useState, useEffect } from 'react';
import type { WatchlistSummary } from '@/types/database';
import { watchlistsApi } from '@/services/api';
import { Button, LoadingSpinner, EmptyState } from '@/components/shared';
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
        <h2>Watchlists</h2>
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
                    <h3 className="watchlist-card-name">{watchlist.name}</h3>
                  </div>
                  <div className="watchlist-card-actions">
                    <button
                      className="watchlist-action-btn"
                      onClick={(e) => handleEdit(watchlist, e)}
                      title="Edit watchlist"
                    >
                      ✏️
                    </button>
                    <button
                      className="watchlist-action-btn danger"
                      onClick={(e) => handleDelete(watchlist.id, e)}
                      title="Delete watchlist"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                {watchlist.description && (
                  <p className="watchlist-card-description">
                    {watchlist.description}
                  </p>
                )}
                <div className="watchlist-card-stats">
                  <div className="watchlist-stat">
                    <span className="stat-value">{watchlist.item_count}</span>
                    <span className="stat-label">
                      {watchlist.item_count === 1 ? 'stock' : 'stocks'}
                    </span>
                  </div>
                  {watchlist.items_at_buy_target > 0 && (
                    <div className="watchlist-stat buy-target">
                      <span className="stat-value">
                        {watchlist.items_at_buy_target}
                      </span>
                      <span className="stat-label">at buy target</span>
                    </div>
                  )}
                  {watchlist.items_at_sell_target > 0 && (
                    <div className="watchlist-stat sell-target">
                      <span className="stat-value">
                        {watchlist.items_at_sell_target}
                      </span>
                      <span className="stat-label">at sell target</span>
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
