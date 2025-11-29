import { useState, useEffect } from 'react';
import { stocksApi, transactionsApi } from '@/services/api';
import type { StockWithSector, Transaction } from '@/types/database';
import {
  formatCurrency,
  formatNumber,
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
      setError(err instanceof Error ? err.message : 'Failed to load stock');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteStock = async () => {
    if (
      !confirm(
        `Delete ${stock?.ticker}? This will also delete all transactions.`
      )
    ) {
      return;
    }
    try {
      await stocksApi.delete(stockId);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete stock');
    }
  };

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm('Delete this transaction?')) {
      return;
    }
    try {
      await transactionsApi.delete(transactionId);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete transaction'
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
    return <LoadingSpinner text="Loading stock..." />;
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!stock) {
    return <ErrorState message="Stock not found" />;
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
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <div className="header-actions">
          <Button variant="secondary" onClick={() => setShowEditStock(true)}>
            Edit
          </Button>
          <Button variant="danger" onClick={handleDeleteStock}>
            Delete
          </Button>
        </div>
      </div>

      {/* Stock Info */}
      <div className="stock-info-card">
        <div className="stock-title">
          <span className="ticker">{stock.ticker}</span>
          <span className="name">{stock.name}</span>
        </div>
        <div className="stock-meta">
          <div className="meta-item">
            <span className="label">Sector</span>
            <span className="value">{stock.sector_name || '—'}</span>
          </div>
          <div className="meta-item">
            <span className="label">Exchange</span>
            <span className="value">{stock.exchange || '—'}</span>
          </div>
          <div className="meta-item">
            <span className="label">Currency</span>
            <span className="value">{stock.currency}</span>
          </div>
          <div className="meta-item">
            <span className="label">Target Price</span>
            <span className="value">
              {stock.target_price
                ? formatPrice(stock.target_price, stock.currency)
                : '—'}
            </span>
          </div>
        </div>
        {stock.notes && (
          <div className="stock-notes">
            <span className="label">Notes</span>
            <p>{stock.notes}</p>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="summary-cards">
        <div className="summary-card">
          <span className="label">Total Shares</span>
          <span className="value">{formatShares(totalShares)}</span>
        </div>
        <div className="summary-card">
          <span className="label">Avg. Buy Price</span>
          <span className="value">{formatPrice(avgPrice, stock.currency)}</span>
        </div>
        <div className="summary-card">
          <span className="label">Total Invested</span>
          <span className="value">{formatCurrency(totalInvested, 'CZK')}</span>
        </div>
        <div className="summary-card">
          <span className="label">Transactions</span>
          <span className="value">{transactions.length}</span>
        </div>
      </div>

      {/* Transactions */}
      <div className="transactions-section">
        <div className="section-header">
          <h3>Transactions</h3>
          <Button variant="primary" onClick={() => setShowAddTransaction(true)}>
            + Add Transaction
          </Button>
        </div>

        {transactions.length === 0 ? (
          <EmptyState title="No transactions yet" />
        ) : (
          <>
            {/* Mobile Cards View */}
            <div className="transactions-cards">
              {transactions.map((tx) => (
                <div key={tx.id} className="transaction-card">
                  <div className="transaction-card-header">
                    <div>
                      <span className={`type-badge ${tx.type.toLowerCase()}`}>
                        {tx.type}
                      </span>
                      <span className="date"> {formatDate(tx.date)}</span>
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
                      <span className="label">Quantity</span>
                      <span className="value">{formatShares(tx.quantity)}</span>
                    </div>
                    <div className="transaction-card-stat">
                      <span className="label">Price</span>
                      <span className="value">
                        {formatPrice(tx.price_per_share)}
                      </span>
                    </div>
                    <div className="transaction-card-stat">
                      <span className="label">Total</span>
                      <span className="value">
                        {formatNumber(tx.total_amount, 2)}
                      </span>
                    </div>
                    <div className="transaction-card-stat">
                      <span className="label">Total CZK</span>
                      <span className="value">
                        {formatCurrency(tx.total_amount_czk, 'CZK')}
                      </span>
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
                    <th>Date</th>
                    <th>Type</th>
                    <th className="right">Quantity</th>
                    <th className="right">Price</th>
                    <th className="right">Total</th>
                    <th className="right">Fees</th>
                    <th className="right">Total CZK</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td>{formatDate(tx.date)}</td>
                      <td>
                        <span className={`type-badge ${tx.type.toLowerCase()}`}>
                          {tx.type}
                        </span>
                      </td>
                      <td className="right">{formatShares(tx.quantity)}</td>
                      <td className="right">
                        {formatPrice(tx.price_per_share)}
                      </td>
                      <td className="right">
                        {formatNumber(tx.total_amount, 2)}
                      </td>
                      <td className="right">{formatNumber(tx.fees, 2)}</td>
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
