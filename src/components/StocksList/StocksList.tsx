import { useState, useEffect } from 'react';
import { stocksApi } from '@/services/api';
import type { StockWithSector } from '@/types/database';
import { formatPrice } from '@/utils/format';
import './StocksList.css';

interface StocksListProps {
  onStockClick: (stockId: string) => void;
  onAddStock: () => void;
}

export function StocksList({ onStockClick, onAddStock }: StocksListProps) {
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
    return <div className="stocks-list-loading">Loading stocks...</div>;
  }

  if (error) {
    return <div className="stocks-list-error">{error}</div>;
  }

  return (
    <div className="stocks-list">
      <div className="stocks-list-header">
        <h2>Stocks</h2>
        <button className="btn-primary" onClick={onAddStock}>
          + Add Stock
        </button>
      </div>

      {stocks.length === 0 ? (
        <div className="empty-state">
          <p>No stocks yet. Add your first stock to get started!</p>
        </div>
      ) : (
        <div className="stocks-grid">
          {stocks.map((stock) => (
            <div
              key={stock.id}
              className="stock-card"
              onClick={() => onStockClick(stock.id)}
            >
              <div className="stock-card-header">
                <span className="ticker">{stock.ticker}</span>
                <span className="exchange">{stock.exchange || '—'}</span>
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
          ))}
        </div>
      )}
    </div>
  );
}
