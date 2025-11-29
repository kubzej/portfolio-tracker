import { useState, useEffect } from 'react';
import { stocksApi } from '@/services/api';
import type { StockWithSector } from '@/types/database';
import { formatPrice, getMarketStatus } from '@/utils/format';
import { Button } from '@/components/shared/Button';
import { LoadingSpinner, ErrorState, EmptyState } from '@/components/shared';
import { StockModal } from './StockModal';
import './StocksList.css';

interface StocksListProps {
  onStockClick: (stockId: string) => void;
}

export function StocksList({ onStockClick }: StocksListProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [stocks, setStocks] = useState<StockWithSector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStocks();
  }, []);

  const loadStocks = async () => {
    try {
      setLoading(true);
      const data = await stocksApi.getAll();
      setStocks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stocks');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Loading stocks..." />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  return (
    <div className="stocks-list">
      <div className="stocks-list-header">
        <h2>Stocks</h2>
        <Button variant="primary" onClick={() => setShowAddModal(true)}>
          + Add Stock
        </Button>
      </div>

      {stocks.length === 0 ? (
        <EmptyState
          title="No stocks yet"
          description="Add your first stock to get started!"
          action={{
            label: '+ Add Stock',
            onClick: () => setShowAddModal(true),
          }}
        />
      ) : (
        <div className="stocks-grid">
          {stocks.map((stock) => {
            const marketStatus = getMarketStatus(stock.ticker);
            return (
              <div
                key={stock.id}
                className="stock-card"
                onClick={() => onStockClick(stock.id)}
              >
                <div className="stock-card-header">
                  <span className="ticker">{stock.ticker}</span>
                  <div className="stock-card-badges">
                    <span
                      className={`market-status market-status--${
                        marketStatus.isOpen ? 'open' : 'closed'
                      }`}
                      title={`${marketStatus.localTime} local • ${
                        marketStatus.nextChange || ''
                      }`}
                    >
                      {marketStatus.isOpen ? 'Open' : marketStatus.statusText}
                    </span>
                    {stock.exchange && (
                      <span className="exchange">{stock.exchange}</span>
                    )}
                  </div>
                </div>
                <div className="stock-card-name">{stock.name}</div>
                <div className="stock-card-meta">
                  <span className="sector">
                    {stock.sector_name || 'No sector'}
                  </span>
                  <span className="currency">{stock.currency}</span>
                </div>
                {stock.target_price && (
                  <div className="stock-card-target">
                    Target: {formatPrice(stock.target_price, stock.currency)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <StockModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={loadStocks}
      />
    </div>
  );
}
