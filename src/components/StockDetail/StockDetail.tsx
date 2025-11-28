import { useState, useEffect, useMemo } from 'react';
import { stocksApi, transactionsApi, sectorsApi } from '@/services/api';
import type {
  StockWithSector,
  Transaction,
  Sector,
  UpdateStockInput,
  UpdateTransactionInput,
  CreateTransactionInput,
} from '@/types/database';
import {
  formatCurrency,
  formatNumber,
  formatPrice,
  formatShares,
  formatDate,
} from '@/utils/format';
import {
  BottomSheetSelect,
  type SelectOption,
} from '@/components/shared/BottomSheet';
import { Button } from '@/components/shared/Button';
import './StockDetail.css';

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'CZK', label: 'CZK' },
  { value: 'CAD', label: 'CAD' },
];

const TRANSACTION_TYPE_OPTIONS: SelectOption[] = [
  { value: 'BUY', label: 'BUY' },
  { value: 'SELL', label: 'SELL' },
];

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
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit modes
  const [editingStock, setEditingStock] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<string | null>(
    null
  );
  const [addingTransaction, setAddingTransaction] = useState(false);

  // Form data
  const [stockForm, setStockForm] = useState<UpdateStockInput>({});
  const [transactionForm, setTransactionForm] = useState<
    UpdateTransactionInput | CreateTransactionInput
  >({});

  useEffect(() => {
    loadData();
  }, [stockId, portfolioId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [stockData, transactionsData, sectorsData] = await Promise.all([
        stocksApi.getById(stockId),
        transactionsApi.getByStockId(stockId, portfolioId ?? undefined),
        sectorsApi.getAll(),
      ]);
      setStock(stockData);
      setTransactions(transactionsData);
      setSectors(sectorsData);

      if (stockData) {
        setStockForm({
          ticker: stockData.ticker,
          name: stockData.name,
          sector_id: stockData.sector_id,
          exchange: stockData.exchange,
          currency: stockData.currency,
          target_price: stockData.target_price,
          notes: stockData.notes,
          finnhub_ticker: stockData.finnhub_ticker,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stock');
    } finally {
      setLoading(false);
    }
  };

  // Sector options for BottomSheetSelect
  const sectorOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'No sector' },
      ...sectors.map((s) => ({ value: s.id, label: s.name })),
    ],
    [sectors]
  );

  const handleSaveStock = async () => {
    try {
      await stocksApi.update(stockId, stockForm);
      setEditingStock(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update stock');
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

  const handleSaveTransaction = async (transactionId: string) => {
    try {
      await transactionsApi.update(
        transactionId,
        transactionForm as UpdateTransactionInput
      );
      setEditingTransaction(null);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to update transaction'
      );
    }
  };

  const handleAddTransaction = async () => {
    if (!portfolioId) {
      setError('Please select a portfolio to add transactions');
      return;
    }
    try {
      await transactionsApi.create({
        ...(transactionForm as CreateTransactionInput),
        stock_id: stockId,
        portfolio_id: portfolioId,
      });
      setAddingTransaction(false);
      setTransactionForm({});
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to add transaction'
      );
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
    setEditingTransaction(tx.id);
    setTransactionForm({
      date: tx.date,
      type: tx.type,
      quantity: tx.quantity,
      price_per_share: tx.price_per_share,
      currency: tx.currency,
      exchange_rate_to_czk: tx.exchange_rate_to_czk,
      fees: tx.fees,
      notes: tx.notes,
    });
  };

  const startAddTransaction = () => {
    setAddingTransaction(true);
    setTransactionForm({
      date: new Date().toISOString().split('T')[0],
      type: 'BUY',
      quantity: 0,
      price_per_share: 0,
      currency: stock?.currency || 'USD',
      fees: 0,
    } as CreateTransactionInput);
  };

  if (loading) {
    return <div className="stock-detail-loading">Loading...</div>;
  }

  if (error) {
    return <div className="stock-detail-error">{error}</div>;
  }

  if (!stock) {
    return <div className="stock-detail-error">Stock not found</div>;
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
          {!editingStock && (
            <>
              <Button variant="secondary" onClick={() => setEditingStock(true)}>
                Edit
              </Button>
              <Button variant="danger" onClick={handleDeleteStock}>
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stock Info */}
      <div className="stock-info-card">
        {editingStock ? (
          <div className="edit-form">
            <div className="form-row">
              <div className="form-group">
                <label>Ticker</label>
                <input
                  type="text"
                  value={stockForm.ticker || ''}
                  onChange={(e) =>
                    setStockForm({ ...stockForm, ticker: e.target.value })
                  }
                />
              </div>
              <div className="form-group">
                <label>Name</label>
                <input
                  type="text"
                  value={stockForm.name || ''}
                  onChange={(e) =>
                    setStockForm({ ...stockForm, name: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="form-row">
              <BottomSheetSelect
                label="Sector"
                options={sectorOptions}
                value={stockForm.sector_id || ''}
                onChange={(value) =>
                  setStockForm({
                    ...stockForm,
                    sector_id: value || null,
                  })
                }
                placeholder="No sector"
              />
              <div className="form-group">
                <label>Exchange</label>
                <input
                  type="text"
                  value={stockForm.exchange || ''}
                  onChange={(e) =>
                    setStockForm({ ...stockForm, exchange: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="form-row">
              <BottomSheetSelect
                label="Currency"
                options={CURRENCY_OPTIONS}
                value={stockForm.currency || 'USD'}
                onChange={(value) =>
                  setStockForm({ ...stockForm, currency: value || 'USD' })
                }
                placeholder="USD"
              />
              <div className="form-group">
                <label>Target Price</label>
                <input
                  type="number"
                  value={stockForm.target_price || ''}
                  onChange={(e) =>
                    setStockForm({
                      ...stockForm,
                      target_price: e.target.value
                        ? parseFloat(e.target.value)
                        : null,
                    })
                  }
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Finnhub Ticker</label>
                <input
                  type="text"
                  value={stockForm.finnhub_ticker || ''}
                  onChange={(e) =>
                    setStockForm({
                      ...stockForm,
                      finnhub_ticker: e.target.value || null,
                    })
                  }
                  placeholder="e.g., ZAL for ZAL.DE"
                />
                <small className="form-hint">
                  Only needed for non-US stocks
                </small>
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea
                value={stockForm.notes || ''}
                onChange={(e) =>
                  setStockForm({ ...stockForm, notes: e.target.value })
                }
              />
            </div>
            <div className="form-actions">
              <Button
                variant="secondary"
                onClick={() => setEditingStock(false)}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSaveStock}>
                Save
              </Button>
            </div>
          </div>
        ) : (
          <>
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
          </>
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
          <Button variant="primary" onClick={startAddTransaction}>
            + Add Transaction
          </Button>
        </div>

        {addingTransaction && (
          <div className="transaction-form-card">
            <h4>New Transaction</h4>
            <div className="form-row">
              <BottomSheetSelect
                label="Type"
                options={TRANSACTION_TYPE_OPTIONS}
                value={
                  (transactionForm as CreateTransactionInput).type || 'BUY'
                }
                onChange={(value) =>
                  setTransactionForm({
                    ...transactionForm,
                    type: value as 'BUY' | 'SELL',
                  })
                }
                placeholder="BUY"
              />
              <div className="form-group">
                <label>Date</label>
                <input
                  type="date"
                  value={(transactionForm as CreateTransactionInput).date || ''}
                  onChange={(e) =>
                    setTransactionForm({
                      ...transactionForm,
                      date: e.target.value,
                    })
                  }
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Quantity</label>
                <input
                  type="number"
                  step="0.000001"
                  value={
                    (transactionForm as CreateTransactionInput).quantity || ''
                  }
                  onChange={(e) =>
                    setTransactionForm({
                      ...transactionForm,
                      quantity: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="form-group">
                <label>Price per Share</label>
                <input
                  type="number"
                  step="0.0001"
                  value={
                    (transactionForm as CreateTransactionInput)
                      .price_per_share || ''
                  }
                  onChange={(e) =>
                    setTransactionForm({
                      ...transactionForm,
                      price_per_share: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Exchange Rate to CZK</label>
                <input
                  type="number"
                  step="0.0001"
                  value={
                    (transactionForm as CreateTransactionInput)
                      .exchange_rate_to_czk || ''
                  }
                  onChange={(e) =>
                    setTransactionForm({
                      ...transactionForm,
                      exchange_rate_to_czk:
                        parseFloat(e.target.value) || undefined,
                    })
                  }
                />
              </div>
              <div className="form-group">
                <label>Fees</label>
                <input
                  type="number"
                  step="0.01"
                  value={(transactionForm as CreateTransactionInput).fees || ''}
                  onChange={(e) =>
                    setTransactionForm({
                      ...transactionForm,
                      fees: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
            <div className="form-actions">
              <Button
                variant="secondary"
                onClick={() => setAddingTransaction(false)}
              >
                Cancel
              </Button>
              <Button variant="primary" onClick={handleAddTransaction}>
                Add
              </Button>
            </div>
          </div>
        )}

        {transactions.length === 0 ? (
          <div className="empty-state">No transactions yet</div>
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
                        ✏️
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon
                        className="danger"
                        onClick={() => handleDeleteTransaction(tx.id)}
                      >
                        🗑️
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
                      {editingTransaction === tx.id ? (
                        <>
                          <td>
                            <input
                              type="date"
                              value={
                                (transactionForm as UpdateTransactionInput)
                                  .date || ''
                              }
                              onChange={(e) =>
                                setTransactionForm({
                                  ...transactionForm,
                                  date: e.target.value,
                                })
                              }
                            />
                          </td>
                          <td>
                            <select
                              value={
                                (transactionForm as UpdateTransactionInput)
                                  .type || 'BUY'
                              }
                              onChange={(e) =>
                                setTransactionForm({
                                  ...transactionForm,
                                  type: e.target.value as 'BUY' | 'SELL',
                                })
                              }
                            >
                              <option value="BUY">BUY</option>
                              <option value="SELL">SELL</option>
                            </select>
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.000001"
                              value={
                                (transactionForm as UpdateTransactionInput)
                                  .quantity || ''
                              }
                              onChange={(e) =>
                                setTransactionForm({
                                  ...transactionForm,
                                  quantity: parseFloat(e.target.value),
                                })
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="number"
                              step="0.0001"
                              value={
                                (transactionForm as UpdateTransactionInput)
                                  .price_per_share || ''
                              }
                              onChange={(e) =>
                                setTransactionForm({
                                  ...transactionForm,
                                  price_per_share: parseFloat(e.target.value),
                                })
                              }
                            />
                          </td>
                          <td colSpan={2}>
                            <input
                              type="number"
                              step="0.01"
                              placeholder="Fees"
                              value={
                                (transactionForm as UpdateTransactionInput)
                                  .fees || ''
                              }
                              onChange={(e) =>
                                setTransactionForm({
                                  ...transactionForm,
                                  fees: parseFloat(e.target.value),
                                })
                              }
                            />
                          </td>
                          <td colSpan={2}>
                            <div className="inline-actions">
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setEditingTransaction(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleSaveTransaction(tx.id)}
                              >
                                Save
                              </Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td>{formatDate(tx.date)}</td>
                          <td>
                            <span
                              className={`type-badge ${tx.type.toLowerCase()}`}
                            >
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
                                ✏️
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                icon
                                className="danger"
                                onClick={() => handleDeleteTransaction(tx.id)}
                              >
                                🗑️
                              </Button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
