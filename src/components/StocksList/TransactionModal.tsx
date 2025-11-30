import { useState, useEffect, useMemo } from 'react';
import { stocksApi, transactionsApi, portfoliosApi } from '@/services/api';
import type {
  Stock,
  Portfolio,
  Transaction,
  CreateTransactionInput,
  TransactionType,
} from '@/types/database';
import {
  Modal,
  Button,
  Input,
  ToggleGroup,
  TextArea,
} from '@/components/shared';
import { Label, Hint, Text, MetricValue } from '@/components/shared/Typography';
import {
  BottomSheetSelect,
  type SelectOption,
} from '@/components/shared/BottomSheet';
import './TransactionModal.css';

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'JPY', label: 'JPY' },
  { value: 'CHF', label: 'CHF' },
  { value: 'CAD', label: 'CAD' },
  { value: 'AUD', label: 'AUD' },
  { value: 'CNY', label: 'CNY' },
  { value: 'CZK', label: 'CZK' },
  { value: 'HKD', label: 'HKD' },
];

const EMPTY_FORM: CreateTransactionInput = {
  stock_id: '',
  portfolio_id: '',
  date: new Date().toISOString().split('T')[0],
  type: 'BUY',
  quantity: 0,
  price_per_share: 0,
  currency: 'USD',
  exchange_rate_to_czk: undefined,
  fees: 0,
  notes: '',
};

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** If provided, modal is in edit mode. Otherwise, it's add mode. */
  transaction?: Transaction | null;
  /** Pre-select portfolio (for add mode) */
  portfolioId?: string | null;
  /** Pre-select stock (for add mode) */
  preselectedStockId?: string;
}

export function TransactionModal({
  isOpen,
  onClose,
  onSuccess,
  transaction,
  portfolioId,
  preselectedStockId,
}: TransactionModalProps) {
  const isEditMode = !!transaction;
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateTransactionInput>(EMPTY_FORM);

  useEffect(() => {
    if (isOpen) {
      loadData();

      if (transaction) {
        // Edit mode - populate form with transaction data
        setFormData({
          stock_id: transaction.stock_id,
          portfolio_id: transaction.portfolio_id,
          date: transaction.date,
          type: transaction.type,
          quantity: transaction.quantity,
          price_per_share: transaction.price_per_share,
          currency: transaction.currency || 'USD',
          exchange_rate_to_czk: transaction.exchange_rate_to_czk ?? undefined,
          fees: transaction.fees ?? 0,
          notes: transaction.notes ?? '',
        });
      } else {
        // Add mode - reset form with preselected values
        setFormData({
          ...EMPTY_FORM,
          stock_id: preselectedStockId || '',
          portfolio_id: portfolioId || '',
        });
      }
      setError(null);
    }
  }, [isOpen, transaction, portfolioId, preselectedStockId]);

  const loadData = async () => {
    try {
      const [stocksData, portfoliosData] = await Promise.all([
        stocksApi.getAll(),
        portfoliosApi.getAll(),
      ]);
      setStocks(stocksData);
      setPortfolios(portfoliosData);

      // Only set defaults in add mode
      if (!transaction) {
        // If we have stocks and no preselected one, select the first and use its currency
        if (stocksData.length > 0 && !preselectedStockId) {
          setFormData((prev) => ({
            ...prev,
            stock_id: prev.stock_id || stocksData[0].id,
            currency: stocksData[0].currency || 'USD',
          }));
        } else if (preselectedStockId) {
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
              prev.portfolio_id ||
              (defaultPortfolio?.id ?? portfoliosData[0].id),
          }));
        }
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  const stockOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'Select stock...' },
      ...stocks.map((s) => ({
        value: s.id,
        label: `${s.ticker} - ${s.name}`,
      })),
    ],
    [stocks]
  );

  const portfolioOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'Select portfolio...' },
      ...portfolios.map((p) => ({ value: p.id, label: p.name })),
    ],
    [portfolios]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isEditMode && transaction) {
        await transactionsApi.update(transaction.id, {
          date: formData.date,
          type: formData.type,
          quantity: formData.quantity,
          price_per_share: formData.price_per_share,
          exchange_rate_to_czk: formData.exchange_rate_to_czk,
          fees: formData.fees,
          notes: formData.notes || undefined,
        });
      } else {
        await transactionsApi.create(formData);
      }

      if (!isEditMode) {
        // Reset form but keep stock, portfolio, and date
        setFormData((prev) => ({
          ...prev,
          quantity: 0,
          price_per_share: 0,
          fees: 0,
          notes: '',
        }));
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${isEditMode ? 'update' : 'create'} transaction`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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

  const title = isEditMode ? 'Edit Transaction' : 'Add Transaction';
  const submitLabel = isEditMode
    ? loading
      ? 'Saving...'
      : 'Save Changes'
    : loading
    ? 'Adding...'
    : `Add ${formData.type}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <form onSubmit={handleSubmit} className="transaction-modal-form">
        {error && (
          <div className="form-error">
            <Text color="danger">{error}</Text>
          </div>
        )}

        {/* Transaction Type Toggle */}
        <ToggleGroup
          value={formData.type}
          onChange={(value: string) =>
            handleTypeChange(value as TransactionType)
          }
          options={[
            { value: 'BUY', label: 'BUY' },
            { value: 'SELL', label: 'SELL' },
          ]}
          variant="transaction"
        />

        <div className="form-row form-row--first">
          <BottomSheetSelect
            label="Portfolio"
            options={portfolioOptions}
            value={formData.portfolio_id}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, portfolio_id: value }))
            }
            placeholder="Select portfolio..."
            required
            disabled={isEditMode || !!portfolioId}
          />

          <BottomSheetSelect
            label="Stock"
            options={stockOptions}
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
            disabled={isEditMode}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <Label htmlFor="date">Date *</Label>
            <Input
              type="date"
              id="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
              fullWidth
            />
          </div>

          <div className="form-group">
            <Label htmlFor="quantity">Quantity *</Label>
            <Input
              type="number"
              id="quantity"
              name="quantity"
              value={formData.quantity || ''}
              onChange={handleNumberChange}
              placeholder="0"
              step="0.000001"
              min="0"
              required
              fullWidth
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <Label htmlFor="price_per_share">Price per Share *</Label>
            <Input
              type="number"
              id="price_per_share"
              name="price_per_share"
              value={formData.price_per_share || ''}
              onChange={handleNumberChange}
              placeholder="0.00"
              step="0.0001"
              min="0"
              required
              fullWidth
            />
          </div>

          <BottomSheetSelect
            label="Currency"
            options={CURRENCY_OPTIONS}
            value={formData.currency || 'USD'}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, currency: value || 'USD' }))
            }
            placeholder="USD"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <Label htmlFor="exchange_rate_to_czk">Exchange Rate to CZK</Label>
            <Input
              type="number"
              id="exchange_rate_to_czk"
              name="exchange_rate_to_czk"
              value={formData.exchange_rate_to_czk || ''}
              onChange={handleNumberChange}
              placeholder="e.g. 23.50"
              step="0.0001"
              min="0"
              fullWidth
            />
            <Hint>Leave empty to auto-fetch</Hint>
          </div>

          <div className="form-group">
            <Label htmlFor="fees">Fees ({formData.currency})</Label>
            <Input
              type="number"
              id="fees"
              name="fees"
              value={formData.fees || ''}
              onChange={handleNumberChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              fullWidth
            />
          </div>
        </div>

        {/* Total display */}
        <div className="transaction-totals">
          <div className="total-row">
            <Label>Total Amount</Label>
            <MetricValue>
              {totalAmount.toFixed(2)} {formData.currency}
              {formData.fees ? ` + ${formData.fees.toFixed(2)} fees` : ''}
            </MetricValue>
          </div>
          {totalInCzk !== null && (
            <div className="total-row">
              <Label>Total in CZK</Label>
              <MetricValue>{totalInCzk.toFixed(2)} Kč</MetricValue>
            </div>
          )}
        </div>

        <div className="form-group notes-section">
          <Label htmlFor="notes">Notes</Label>
          <TextArea
            id="notes"
            name="notes"
            value={formData.notes || ''}
            onChange={handleChange}
            placeholder="Any notes about this transaction..."
            rows={2}
            fullWidth
          />
        </div>

        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
