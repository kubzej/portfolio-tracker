import { useState, useEffect, useMemo } from 'react';
import { sectorsApi, stocksApi } from '@/services/api';
import type { Sector, CreateStockInput } from '@/types';
import {
  BottomSheetSelect,
  type SelectOption,
} from '@/components/shared/BottomSheet';
import { Button } from '@/components/shared/Button';
import './StockForm.css';

const EXCHANGE_OPTIONS: SelectOption[] = [
  { value: '', label: 'Select exchange...' },
  { value: 'NYSE', label: 'NYSE' },
  { value: 'NASDAQ', label: 'NASDAQ' },
  { value: 'XETRA', label: 'XETRA' },
  { value: 'LSE', label: 'LSE' },
  { value: 'TSX', label: 'TSX' },
  { value: 'Other', label: 'Other' },
];

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
  { value: 'CZK', label: 'CZK - Czech Koruna' },
  { value: 'CAD', label: 'CAD - Canadian Dollar' },
];

interface StockFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function StockForm({ onSuccess, onCancel }: StockFormProps) {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateStockInput>({
    ticker: '',
    name: '',
    sector_id: undefined,
    exchange: '',
    currency: 'USD',
    target_price: undefined,
    notes: '',
    finnhub_ticker: '',
  });

  useEffect(() => {
    loadSectors();
  }, []);

  const loadSectors = async () => {
    try {
      const data = await sectorsApi.getAll();
      setSectors(data);
    } catch (err) {
      console.error('Failed to load sectors:', err);
    }
  };

  const sectorOptions: SelectOption[] = useMemo(
    () => [
      { value: '', label: 'Select sector...' },
      ...sectors.map((s) => ({ value: s.id, label: s.name })),
    ],
    [sectors]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await stocksApi.create({
        ...formData,
        ticker: formData.ticker.toUpperCase(),
      });

      // Reset form
      setFormData({
        ticker: '',
        name: '',
        sector_id: undefined,
        exchange: '',
        currency: 'USD',
        target_price: undefined,
        notes: '',
        finnhub_ticker: '',
      });

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create stock');
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
      [name]: value === '' ? undefined : value,
    }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value === '' ? undefined : parseFloat(value),
    }));
  };

  return (
    <form className="stock-form" onSubmit={handleSubmit}>
      <h3>Add New Stock</h3>

      {error && <div className="form-error">{error}</div>}

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="ticker">Ticker *</label>
          <input
            type="text"
            id="ticker"
            name="ticker"
            value={formData.ticker}
            onChange={handleChange}
            placeholder="AAPL"
            required
            maxLength={20}
          />
        </div>

        <div className="form-group">
          <label htmlFor="name">Company Name *</label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Apple Inc."
            required
          />
        </div>
      </div>

      <div className="form-row">
        <BottomSheetSelect
          label="Sector"
          options={sectorOptions}
          value={formData.sector_id || ''}
          onChange={(value) =>
            setFormData((prev) => ({ ...prev, sector_id: value || undefined }))
          }
          placeholder="Select sector..."
        />

        <BottomSheetSelect
          label="Exchange"
          options={EXCHANGE_OPTIONS}
          value={formData.exchange || ''}
          onChange={(value) =>
            setFormData((prev) => ({ ...prev, exchange: value || undefined }))
          }
          placeholder="Select exchange..."
        />
      </div>

      <div className="form-row">
        <BottomSheetSelect
          label="Currency"
          options={CURRENCY_OPTIONS}
          value={formData.currency || 'USD'}
          onChange={(value) =>
            setFormData((prev) => ({ ...prev, currency: value || 'USD' }))
          }
          placeholder="Select currency..."
        />

        <div className="form-group">
          <label htmlFor="target_price">Target Price</label>
          <input
            type="number"
            id="target_price"
            name="target_price"
            value={formData.target_price || ''}
            onChange={handleNumberChange}
            placeholder="0.00"
            step="0.01"
            min="0"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="finnhub_ticker">Finnhub Ticker</label>
          <input
            type="text"
            id="finnhub_ticker"
            name="finnhub_ticker"
            value={formData.finnhub_ticker || ''}
            onChange={handleChange}
            placeholder="e.g., ZAL for ZAL.DE"
            maxLength={20}
          />
          <small className="form-hint">
            Only needed for non-US stocks if auto-detection fails
          </small>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          name="notes"
          value={formData.notes || ''}
          onChange={handleChange}
          placeholder="Any notes about this stock..."
          rows={3}
        />
      </div>

      <div className="form-actions">
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <Button type="submit" variant="primary" size="lg" disabled={loading}>
          {loading ? 'Adding...' : 'Add Stock'}
        </Button>
      </div>
    </form>
  );
}
