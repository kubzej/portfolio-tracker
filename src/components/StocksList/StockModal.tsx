import { useState, useEffect, useMemo } from 'react';
import { sectorsApi, stocksApi } from '@/services/api';
import type { Sector, CreateStockInput, StockWithSector } from '@/types';
import { Modal, Button, Input } from '@/components/shared';
import { Label, Hint, Text } from '@/components/shared/Typography';
import {
  BottomSheetSelect,
  type SelectOption,
} from '@/components/shared/BottomSheet';
import './StockModal.css';

const EXCHANGE_OPTIONS: SelectOption[] = [
  { value: '', label: 'No exchange' },
  { value: 'NYSE', label: 'NYSE' },
  { value: 'NASDAQ', label: 'NASDAQ' },
  { value: 'LSE', label: 'LSE' },
  { value: 'XETRA', label: 'XETRA' },
  { value: 'SIX', label: 'SIX' },
  { value: 'TSX', label: 'TSX' },
  { value: 'ASX', label: 'ASX' },
  { value: 'JPX', label: 'JPX' },
  { value: 'SSE', label: 'SSE' },
  { value: 'HKEX', label: 'HKEX' },
  { value: 'PSE', label: 'PSE' },
  { value: 'Other', label: 'Other' },
];

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

const EMPTY_FORM: CreateStockInput = {
  ticker: '',
  name: '',
  sector_id: undefined,
  exchange: '',
  currency: 'USD',
  target_price: undefined,
  notes: '',
  finnhub_ticker: '',
};

interface StockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** If provided, modal is in edit mode. Otherwise, it's add mode. */
  stock?: StockWithSector | null;
}

export function StockModal({
  isOpen,
  onClose,
  onSuccess,
  stock,
}: StockModalProps) {
  const isEditMode = !!stock;
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateStockInput>(EMPTY_FORM);

  useEffect(() => {
    if (isOpen) {
      loadSectors();
      if (stock) {
        // Edit mode - populate form with stock data
        setFormData({
          ticker: stock.ticker,
          name: stock.name,
          sector_id: stock.sector_id ?? undefined,
          exchange: stock.exchange ?? '',
          currency: stock.currency ?? 'USD',
          target_price: stock.target_price ?? undefined,
          notes: stock.notes ?? '',
          finnhub_ticker: stock.finnhub_ticker ?? '',
        });
      } else {
        // Add mode - reset form
        setFormData(EMPTY_FORM);
      }
      setError(null);
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
      const payload = {
        ...formData,
        ticker: formData.ticker.toUpperCase(),
      };

      if (isEditMode && stock) {
        await stocksApi.update(stock.id, payload);
      } else {
        await stocksApi.create(payload);
      }

      if (!isEditMode) {
        setFormData(EMPTY_FORM);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${isEditMode ? 'update' : 'create'} stock`
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

  const title = isEditMode ? 'Edit Stock' : 'Add New Stock';
  const submitLabel = isEditMode
    ? loading
      ? 'Saving...'
      : 'Save Changes'
    : loading
    ? 'Adding...'
    : 'Add Stock';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="md">
      <form onSubmit={handleSubmit} className="stock-modal-form">
        {error && (
          <div className="form-error">
            <Text color="primary">{error}</Text>
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <Label htmlFor="ticker">Ticker *</Label>
            <Input
              id="ticker"
              name="ticker"
              value={formData.ticker}
              onChange={handleChange}
              placeholder="AAPL"
              required
              maxLength={20}
              fullWidth
            />
          </div>

          <div className="form-group">
            <Label htmlFor="name">Company Name *</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="Apple Inc."
              required
              fullWidth
            />
          </div>
        </div>

        <div className="form-row">
          <BottomSheetSelect
            label="Sector"
            options={sectorOptions}
            value={formData.sector_id || ''}
            onChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                sector_id: value || undefined,
              }))
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
            <Label htmlFor="target_price">Target Price</Label>
            <Input
              type="number"
              id="target_price"
              name="target_price"
              value={formData.target_price ?? ''}
              onChange={handleNumberChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              fullWidth
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <Label htmlFor="finnhub_ticker">Finnhub Ticker</Label>
            <Input
              id="finnhub_ticker"
              name="finnhub_ticker"
              value={formData.finnhub_ticker || ''}
              onChange={handleChange}
              placeholder="e.g., ZAL for ZAL.DE"
              maxLength={20}
              fullWidth
            />
            <Hint>Only needed for non-US stocks if auto-detection fails</Hint>
          </div>
        </div>

        <div className="form-group">
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            name="notes"
            value={formData.notes || ''}
            onChange={handleChange}
            placeholder="Any notes about this stock..."
            rows={3}
            className="stock-modal-textarea"
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
