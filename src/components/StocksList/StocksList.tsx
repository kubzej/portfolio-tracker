import { useState, useEffect } from 'react';
import { stocksApi } from '@/services/api';
import type { StockWithSector } from '@/types/database';
import { Button } from '@/components/shared/Button';
import {
  LoadingSpinner,
  ErrorState,
  EmptyState,
  StockCard,
} from '@/components/shared';
import { SectionTitle } from '@/components/shared/Typography';
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
      setError(
        err instanceof Error ? err.message : 'Nepodařilo se načíst akcie'
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner text="Načítám akcie..." />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  return (
    <div className="stocks-list">
      <div className="stocks-list-header">
        <SectionTitle>Akcie</SectionTitle>
        <Button variant="primary" onClick={() => setShowAddModal(true)}>
          + Přidat akcii
        </Button>
      </div>

      {stocks.length === 0 ? (
        <EmptyState
          title="Žádné akcie"
          description="Přidejte svou první akcii!"
          action={{
            label: '+ Přidat akcii',
            onClick: () => setShowAddModal(true),
          }}
        />
      ) : (
        <div className="stocks-grid">
          {stocks.map((stock) => (
            <StockCard
              key={stock.id}
              ticker={stock.ticker}
              name={stock.name}
              exchange={stock.exchange}
              currency={stock.currency}
              sectorName={stock.sector_name}
              targetPrice={stock.target_price}
              onClick={() => onStockClick(stock.id)}
            />
          ))}
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
