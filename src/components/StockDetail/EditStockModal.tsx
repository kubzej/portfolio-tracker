import { useState, useEffect, useMemo } from 'react';
import { stocksApi, sectorsApi } from '@/services/api';
import type {
  StockWithSector,
  Sector,
  UpdateStockInput,
} from '@/types/database';
import { Modal, Button } from '@/components/shared';
import {
  BottomSheetSelect,
  type SelectOption,
} from '@/components/shared/BottomSheet';

const EXCHANGE_OPTIONS: SelectOption[] = [
  { value: '', label: 'No exchange' },
  { value: 'NYSE', label: 'NYSE' },
  { value: 'NASDAQ', label: 'NASDAQ' },
  { value: 'XETRA', label: 'XETRA' },
  { value: 'LSE', label: 'LSE' },
  { value: 'TSX', label: 'TSX' },
  { value: 'Other', label: 'Other' },
];

const CURRENCY_OPTIONS: SelectOption[] = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
  { value: 'CZK', label: 'CZK' },
  { value: 'CAD', label: 'CAD' },
];

interface EditStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  stock: StockWithSector | null;
}

export function EditStockModal({
  isOpen,
  onClose,
  onSuccess,
  stock,
}: EditStockModalProps) {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<UpdateStockInput>({});

  useEffect(() => {
    if (isOpen && stock) {
      setFormData({
        ticker: stock.ticker,
        name: stock.name,
        sector_id: stock.sector_id,
        exchange: stock.exchange,
        currency: stock.currency,
        target_price: stock.target_price,
        notes: stock.notes,
        finnhub_ticker: stock.finnhub_ticker,
      });
      loadSectors();
    }
  }, [isOpen, stock]);

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
      { value: '', label: 'No sector' },
      ...sectors.map((s) => ({ value: s.id, label: s.name })),
    ],
    [sectors]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stock) return;

    setLoading(true);
    setError(null);

    try {
      await stocksApi.update(stock.id, {
        ...formData,
        ticker: formData.ticker?.toUpperCase(),
      });

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update stock');
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
      [name]: value === '' ? null : value,
    }));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value === '' ? null : parseFloat(value),
    }));
  };

  if (!stock) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Stock" size="md">
      <form onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="ticker">Ticker *</label>
            <input
              type="text"
              id="ticker"
              name="ticker"
              value={formData.ticker || ''}
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
              value={formData.name || ''}
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
              setFormData((prev) => ({ ...prev, sector_id: value || null }))
            }
            placeholder="No sector"
          />

          <BottomSheetSelect
            label="Exchange"
            options={EXCHANGE_OPTIONS}
            value={formData.exchange || ''}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, exchange: value || null }))
            }
            placeholder="No exchange"
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
            placeholder="USD"
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
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
