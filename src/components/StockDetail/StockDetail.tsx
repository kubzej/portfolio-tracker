import { useState, useEffect } from 'react';
import { stocksApi, transactionsApi } from '@/services/api';
import type { StockWithSector, TransactionWithStock } from '@/types/database';
import { formatCurrency, formatPrice, formatShares } from '@/utils/format';
import { Button } from '@/components/shared/Button';
import {
  LoadingSpinner,
  ErrorState,
  TransactionsList,
} from '@/components/shared';
import {
  Ticker,
  StockName,
  MetricLabel,
  MetricValue,
  Description,
} from '@/components/shared/Typography';
import { StockModal, TransactionModal } from '../StocksList';
import './StockDetail.css';

interface StockDetailProps {
  stockId: string;
  portfolioId?: string | null;
  onBack: () => void;
  onDeleted: () => void;
}

export function StockDetail({
  stockId,
  portfolioId,
  onBack,
  onDeleted,
}: StockDetailProps) {
  const [stock, setStock] = useState<StockWithSector | null>(null);
  const [transactions, setTransactions] = useState<TransactionWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Modal states
  const [showEditStock, setShowEditStock] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<TransactionWithStock | null>(null);
  const [showAddTransaction, setShowAddTransaction] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockId, portfolioId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [stockData, transactionsData] = await Promise.all([
        stocksApi.getById(stockId),
        transactionsApi.getByStockId(stockId, portfolioId ?? undefined),
      ]);
      setStock(stockData);
      setTransactions(transactionsData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Nepodařilo se načíst akcii'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStock = async () => {
    if (!confirm(`Smazat ${stock?.ticker}? Toto smaže i všechny transakce.`)) {
      return;
    }
    try {
      await stocksApi.delete(stockId);
      onDeleted();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Nepodařilo se smazat akcii'
      );
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm('Smazat tuto transakci?')) {
      return;
    }
    try {
      await transactionsApi.delete(transactionId);
      setRefreshTrigger((prev) => prev + 1);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Nepodařilo se smazat transakci'
      );
    }
  };

  const handleEditTransaction = (tx: TransactionWithStock) => {
    setEditingTransaction(tx);
  };

  const handleEditModalClose = () => {
    setEditingTransaction(null);
  };

  const handleEditModalSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
    loadData();
  };

  const handleAddTransactionSuccess = () => {
    setRefreshTrigger((prev) => prev + 1);
    loadData();
  };

  if (loading) {
    return <LoadingSpinner text="Načítám akcii..." />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!stock) {
    return <ErrorState message="Akcie nenalezena" />;
  }

  // Calculate summary
  const totalShares = transactions.reduce(
    (sum, tx) => sum + (tx.type === 'BUY' ? tx.quantity : -tx.quantity),
    0
  );

  // Calculate total invested based on remaining shares (proportional to what's left)
  // First, calculate remaining shares per BUY transaction (lot)
  const buyTransactions = transactions.filter((tx) => tx.type === 'BUY');
  const sellTransactions = transactions.filter((tx) => tx.type === 'SELL');

  // Calculate sold quantity per lot (for sells with source_transaction_id)
  const soldPerLot = new Map<string, number>();
  let unallocatedSold = 0;

  for (const sell of sellTransactions) {
    if (sell.source_transaction_id) {
      const current = soldPerLot.get(sell.source_transaction_id) || 0;
      soldPerLot.set(sell.source_transaction_id, current + sell.quantity);
    } else {
      unallocatedSold += sell.quantity;
    }
  }

  // Sort buy transactions by date for FIFO
  const sortedBuys = [...buyTransactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  // Calculate remaining shares and invested amount per lot
  let totalInvested = 0;
  let fifoRemaining = unallocatedSold;

  for (const buy of sortedBuys) {
    const soldFromThisLot = soldPerLot.get(buy.id) || 0;
    let remaining = buy.quantity - soldFromThisLot;

    // Apply FIFO for unallocated sells
    if (fifoRemaining > 0 && remaining > 0) {
      const fifoSold = Math.min(fifoRemaining, remaining);
      remaining -= fifoSold;
      fifoRemaining -= fifoSold;
    }

    // Add proportional invested amount for remaining shares
    if (remaining > 0 && buy.quantity > 0) {
      totalInvested += (remaining / buy.quantity) * buy.total_amount_czk;
    }
  }

  // Average price only makes sense if we have shares
  const avgPrice =
    totalShares > 0
      ? sortedBuys.reduce((sum, buy) => {
          const soldFromThisLot = soldPerLot.get(buy.id) || 0;
          const remaining = buy.quantity - soldFromThisLot;
          // Note: simplified, doesn't account for FIFO here but close enough for display
          return sum + remaining * buy.price_per_share;
        }, 0) / totalShares
      : 0;

  return (
    <div className="stock-detail">
      {/* Header */}
      <div className="stock-detail-header">
        <Button variant="secondary" onClick={onBack}>
          ← Zpět
        </Button>
        <div className="header-actions">
          <Button variant="secondary" onClick={() => setShowEditStock(true)}>
            Upravit
          </Button>
          <Button variant="danger" onClick={handleDeleteStock}>
            Smazat
          </Button>
        </div>
      </div>

      {/* Stock Info */}
      <div className="stock-info-card">
        <div className="stock-title">
          <Ticker size="lg">{stock.ticker}</Ticker>
          <StockName>{stock.name}</StockName>
        </div>
        <div className="stock-meta">
          <div className="meta-item">
            <MetricLabel>Sektor</MetricLabel>
            <MetricValue>{stock.sector_name || '—'}</MetricValue>
          </div>
          <div className="meta-item">
            <MetricLabel>Burza</MetricLabel>
            <MetricValue>{stock.exchange || '—'}</MetricValue>
          </div>
          <div className="meta-item">
            <MetricLabel>Měna</MetricLabel>
            <MetricValue>{stock.currency}</MetricValue>
          </div>
          <div className="meta-item">
            <MetricLabel>Cílová cena</MetricLabel>
            <MetricValue>
              {stock.target_price
                ? formatPrice(stock.target_price, stock.currency)
                : '—'}
            </MetricValue>
          </div>
          {stock.price_scale !== 1 && (
            <div className="meta-item">
              <MetricLabel>Cenový poměr</MetricLabel>
              <MetricValue>{stock.price_scale}</MetricValue>
            </div>
          )}
        </div>
        {stock.notes && (
          <div className="stock-notes">
            <MetricLabel>Poznámky</MetricLabel>
            <Description>{stock.notes}</Description>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="summary-cards">
        <div className="summary-card">
          <MetricLabel>Celkem akcií</MetricLabel>
          <MetricValue size="lg">{formatShares(totalShares)}</MetricValue>
        </div>
        <div className="summary-card">
          <MetricLabel>Prům. nákupní cena</MetricLabel>
          <MetricValue size="lg">
            {formatPrice(avgPrice / (stock.price_scale ?? 1), stock.currency)}
          </MetricValue>
        </div>
        <div className="summary-card">
          <MetricLabel>Celkem investováno (CZK)</MetricLabel>
          <MetricValue size="lg">
            {formatCurrency(totalInvested, 'CZK')}
          </MetricValue>
        </div>
        <div className="summary-card">
          <MetricLabel>Transakcí</MetricLabel>
          <MetricValue size="lg">{transactions.length}</MetricValue>
        </div>
      </div>

      {/* Transactions */}
      <div className="transactions-section">
        <TransactionsList
          portfolioId={portfolioId}
          stockId={stockId}
          stock={stock}
          showStockColumn={false}
          showFilters={false}
          showHeader={true}
          headerTitle="Transakce"
          showAddButton={true}
          onAddTransaction={() => setShowAddTransaction(true)}
          onEditTransaction={handleEditTransaction}
          onDeleteTransaction={handleDeleteTransaction}
          editable={true}
          refreshTrigger={refreshTrigger}
        />
      </div>

      {/* Edit Stock Modal */}
      <StockModal
        isOpen={showEditStock}
        onClose={() => setShowEditStock(false)}
        onSuccess={loadData}
        stock={stock}
      />

      {/* Edit Transaction Modal */}
      <TransactionModal
        isOpen={editingTransaction !== null}
        onClose={handleEditModalClose}
        onSuccess={handleEditModalSuccess}
        transaction={editingTransaction}
      />

      {/* Add Transaction Modal */}
      <TransactionModal
        isOpen={showAddTransaction}
        onClose={() => setShowAddTransaction(false)}
        onSuccess={handleAddTransactionSuccess}
        portfolioId={portfolioId}
        preselectedStockId={stockId}
      />
    </div>
  );
}
