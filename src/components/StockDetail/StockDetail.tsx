import { useState, useEffect } from 'react';
import { stocksApi, transactionsApi } from '@/services/api';
import type { StockWithSector, Transaction } from '@/types/database';
import {
  formatCurrency,
  formatPrice,
  formatShares,
  formatDate,
} from '@/utils/format';
import { Button } from '@/components/shared/Button';
import {
  LoadingSpinner,
  ErrorState,
  EmptyState,
  EditIcon,
  TrashIcon,
} from '@/components/shared';
import {
  Ticker,
  StockName,
  MetricLabel,
  MetricValue,
  SectionTitle,
  Description,
  Badge,
  Text,
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [showEditStock, setShowEditStock] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);
  const [showAddTransaction, setShowAddTransaction] = useState(false);

  useEffect(() => {
    loadData();
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
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Nepodařilo se smazat transakci'
      );
    }
  };

  const startEditTransaction = (tx: Transaction) => {
    setEditingTransaction(tx);
  };

  const handleEditModalClose = () => {
    setEditingTransaction(null);
  };

  const handleEditModalSuccess = () => {
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
  const totalInvested = transactions.reduce(
    (sum, tx) => (tx.type === 'BUY' ? sum + tx.total_amount_czk : sum),
    0
  );
  const avgPrice =
    totalShares > 0
      ? transactions.reduce(
          (sum, tx) =>
            tx.type === 'BUY' ? sum + tx.quantity * tx.price_per_share : sum,
          0
        ) /
        transactions.reduce(
          (sum, tx) => (tx.type === 'BUY' ? sum + tx.quantity : sum),
          0
        )
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
            {formatPrice(avgPrice, stock.currency)}
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
        <div className="section-header">
          <SectionTitle>Transakce</SectionTitle>
          <Button variant="primary" onClick={() => setShowAddTransaction(true)}>
            + Přidat transakci
          </Button>
        </div>

        {transactions.length === 0 ? (
          <EmptyState title="Žádné transakce" />
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className="transactions-cards">
              {transactions.map((tx) => (
                <div key={tx.id} className="transaction-card">
                  <div className="transaction-card-header">
                    <div className="transaction-card-info">
                      <Badge variant={tx.type === 'BUY' ? 'buy' : 'sell'}>
                        {tx.type}
                      </Badge>
                      <Text color="muted" size="sm">
                        {formatDate(tx.date)}
                      </Text>
                    </div>
                    <div className="transaction-card-actions">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon
                        onClick={() => startEditTransaction(tx)}
                      >
                        <EditIcon size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon
                        className="danger"
                        onClick={() => handleDeleteTransaction(tx.id)}
                      >
                        <TrashIcon size={14} />
                      </Button>
                    </div>
                  </div>
                  <div className="transaction-card-body">
                    <div className="transaction-card-stat">
                      <MetricLabel>Množství</MetricLabel>
                      <MetricValue>{formatShares(tx.quantity)}</MetricValue>
                    </div>
                    <div className="transaction-card-stat">
                      <MetricLabel>Cena</MetricLabel>
                      <MetricValue>
                        {formatPrice(tx.price_per_share, stock.currency)}
                      </MetricValue>
                    </div>
                    <div className="transaction-card-stat">
                      <MetricLabel>Celkem</MetricLabel>
                      <MetricValue>
                        {formatPrice(tx.total_amount, stock.currency)}
                      </MetricValue>
                    </div>
                    <div className="transaction-card-stat">
                      <MetricLabel>Celkem CZK</MetricLabel>
                      <MetricValue>
                        {formatCurrency(tx.total_amount_czk, 'CZK')}
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
                    <th>Datum</th>
                    <th>Typ</th>
                    <th className="right">Množství</th>
                    <th className="right">Cena</th>
                    <th className="right">Celkem</th>
                    <th className="right">Poplatky</th>
                    <th className="right">Celkem CZK</th>
                    <th>Akce</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>{formatDate(tx.date)}</td>
                      <td>
                        <Badge variant={tx.type === 'BUY' ? 'buy' : 'sell'}>
                          {tx.type}
                        </Badge>
                      </td>
                      <td className="right">{formatShares(tx.quantity)}</td>
                      <td className="right">
                        {formatPrice(tx.price_per_share, stock.currency)}
                      </td>
                      <td className="right">
                        {formatPrice(tx.total_amount, stock.currency)}
                      </td>
                      <td className="right">
                        {tx.fees ? formatPrice(tx.fees, stock.currency) : '—'}
                      </td>
                      <td className="right">
                        {formatCurrency(tx.total_amount_czk, 'CZK')}
                      </td>
                      <td>
                        <div className="row-actions">
                          <Button
                            variant="ghost"
                            size="sm"
                            icon
                            onClick={() => startEditTransaction(tx)}
                          >
                            <EditIcon size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon
                            className="danger"
                            onClick={() => handleDeleteTransaction(tx.id)}
                          >
                            <TrashIcon size={14} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
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
        onSuccess={loadData}
        portfolioId={portfolioId}
        preselectedStockId={stockId}
      />
    </div>
  );
}
