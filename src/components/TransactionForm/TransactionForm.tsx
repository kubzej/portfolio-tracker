import { useState, useEffect, useMemo } from 'react';
import { stocksApi, transactionsApi, portfoliosApi } from '@/services/api';
import type {
  Stock,
  Portfolio,
  CreateTransactionInput,
  TransactionType,
} from '@/types/database';
import {
  BottomSheetSelect,
  type SelectOption,
} from '@/components/shared/BottomSheet';
import './TransactionForm.css';

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'CZK', label: 'CZK' },
  { value: 'CAD', label: 'CAD' },
];

interface TransactionFormProps {
  portfolioId?: string | null;
  preselectedStockId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function TransactionForm({
  portfolioId,
  preselectedStockId,
  onSuccess,
  onCancel,
}: TransactionFormProps) {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateTransactionInput>({
    stock_id: preselectedStockId || '',
    portfolio_id: portfolioId || '',
    date: new Date().toISOString().split('T')[0],
    type: 'BUY',
    quantity: 0,
    price_per_share: 0,
    currency: 'USD',
    exchange_rate_to_czk: undefined,
    fees: 0,
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (preselectedStockId) {
      setFormData((prev) => ({ ...prev, stock_id: preselectedStockId }));
    }
  }, [preselectedStockId]);

  useEffect(() => {
    if (portfolioId) {
      setFormData((prev) => ({ ...prev, portfolio_id: portfolioId }));
    }
  }, [portfolioId]);

  const loadData = async () => {
    try {
      const [stocksData, portfoliosData] = await Promise.all([
        stocksApi.getAll(),
        portfoliosApi.getAll(),
      ]);
      setStocks(stocksData);
      setPortfolios(portfoliosData);

      // If we have stocks and no preselected one, select the first and use its currency
      if (stocksData.length > 0 && !preselectedStockId) {
        setFormData((prev) => ({
          ...prev,
          stock_id: prev.stock_id || stocksData[0].id,
          currency: stocksData[0].currency || 'USD',
        }));
      } else if (preselectedStockId) {
        // If preselected, find that stock and use its currency
        const selectedStock = stocksData.find(
          (s) => s.id === preselectedStockId
        );
        if (selectedStock) {
          setFormData((prev) => ({
            ...prev,
            currency: selectedStock.currency || 'USD',
          }));
        }
      }

      // Set default portfolio if none provided
      if (!portfolioId && portfoliosData.length > 0) {
        const defaultPortfolio = portfoliosData.find((p) => p.is_default);
        setFormData((prev) => ({
          ...prev,
          portfolio_id:
            prev.portfolio_id || (defaultPortfolio?.id ?? portfoliosData[0].id),
        }));
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const handleStockChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const stockId = e.target.value;
    const selectedStock = stocks.find((s) => s.id === stockId);

    setFormData((prev) => ({
      ...prev,
      stock_id: stockId,
      currency: selectedStock?.currency || prev.currency,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await transactionsApi.create(formData);

      // Reset form but keep stock and date
      setFormData((prev) => ({
        ...prev,
        quantity: 0,
        price_per_share: 0,
        fees: 0,
        notes: '',
      }));

      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create transaction'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value === '' ? 0 : parseFloat(value),
    }));
  };

  const handleTypeChange = (type: TransactionType) => {
    setFormData((prev) => ({ ...prev, type }));
  };

  // Calculate totals for display
  const totalAmount = formData.quantity * formData.price_per_share;
  const totalWithFees = totalAmount + (formData.fees || 0);
  const totalInCzk = formData.exchange_rate_to_czk
    ? totalWithFees * formData.exchange_rate_to_czk
    : null;

  return (
    <form className="transaction-form" onSubmit={handleSubmit}>
      <h3>Add Transaction</h3>

      {error && <div className="form-error">{error}</div>}

      {/* Transaction Type Toggle */}
      <div className="type-toggle">
        <button
          type="button"
          className={`type-btn buy ${formData.type === 'BUY' ? 'active' : ''}`}
          onClick={() => handleTypeChange('BUY')}
        >
          BUY
        </button>
        <button
          type="button"
          className={`type-btn sell ${
            formData.type === 'SELL' ? 'active' : ''
          }`}
          onClick={() => handleTypeChange('SELL')}
        >
          SELL
        </button>
      </div>

      <div className="form-row">
        <BottomSheetSelect
          label="Portfolio *"
          options={[
            { value: '', label: 'Select portfolio...' },
            ...portfolios.map((p) => ({ value: p.id, label: p.name })),
          ]}
          value={formData.portfolio_id}
          onChange={(value) =>
            setFormData((prev) => ({ ...prev, portfolio_id: value }))
          }
          placeholder="Select portfolio..."
          required
          disabled={!!portfolioId}
        />

        <BottomSheetSelect
          label="Stock *"
          options={[
            { value: '', label: 'Select stock...' },
            ...stocks.map((s) => ({
              value: s.id,
              label: `${s.ticker} - ${s.name}`,
            })),
          ]}
          value={formData.stock_id}
          onChange={(value) => {
            const selectedStock = stocks.find((s) => s.id === value);
            setFormData((prev) => ({
              ...prev,
              stock_id: value,
              currency: selectedStock?.currency || prev.currency,
            }));
          }}
          placeholder="Select stock..."
          required
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="date">Date *</label>
          <input
            type="date"
            id="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="quantity">Quantity *</label>
          <input
            type="number"
            id="quantity"
            name="quantity"
            value={formData.quantity || ''}
            onChange={handleNumberChange}
            placeholder="0"
            step="0.000001"
            min="0"
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="price_per_share">Price per Share *</label>
          <input
            type="number"
            id="price_per_share"
            name="price_per_share"
            value={formData.price_per_share || ''}
            onChange={handleNumberChange}
            placeholder="0.00"
            step="0.0001"
            min="0"
            required
          />
        </div>
      </div>

      <div className="form-row">
        <BottomSheetSelect
          label="Currency"
          options={CURRENCY_OPTIONS}
          value={formData.currency || 'USD'}
          onChange={(value) =>
            setFormData((prev) => ({ ...prev, currency: value || 'USD' }))
          }
          placeholder="USD"
        />

        <div className="form-group">
          <label htmlFor="exchange_rate_to_czk">Exchange Rate to CZK</label>
          <input
            type="number"
            id="exchange_rate_to_czk"
            name="exchange_rate_to_czk"
            value={formData.exchange_rate_to_czk || ''}
            onChange={handleNumberChange}
            placeholder="e.g. 23.50"
            step="0.0001"
            min="0"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="fees">Fees ({formData.currency})</label>
          <input
            type="number"
            id="fees"
            name="fees"
            value={formData.fees || ''}
            onChange={handleNumberChange}
            placeholder="0.00"
            step="0.01"
            min="0"
          />
        </div>

        <div className="form-group">
          <label>Total Amount</label>
          <div className="calculated-value">
            {totalAmount.toFixed(2)} {formData.currency}
            {formData.fees ? ` + ${formData.fees.toFixed(2)} fees` : ''}
          </div>
        </div>
      </div>

      {totalInCzk !== null && (
        <div className="total-czk">
          Total in CZK: <strong>{totalInCzk.toFixed(2)} Kč</strong>
        </div>
      )}

      <div className="form-group">
        <label htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes || ''}
          onChange={handleChange}
          placeholder="Any notes about this transaction..."
          rows={2}
        />
      </div>

      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Adding...' : `Add ${formData.type}`}
        </button>
      </div>
    </form>
  );
}
