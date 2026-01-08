import { useState, useEffect, useMemo } from 'react';
import { sectorsApi, stocksApi } from '@/services/api';
import type { Sector, CreateStockInput, StockWithSector } from '@/types';
import { Modal, Button, Input, TextArea } from '@/components/shared';
import { Label, Hint, Text } from '@/components/shared/Typography';
import {
  BottomSheetSelect,
  type SelectOption,
} from '@/components/shared/BottomSheet';
import './StockModal.css';

const EXCHANGE_OPTIONS: SelectOption[] = [
  { value: '', label: 'No exchange' },
  { value: 'NYSE', label: 'NYSE (USA)' },
  { value: 'NASDAQ', label: 'Nasdaq (USA)' },
  { value: 'LSE', label: 'London Stock Exchange (UK)' },
  { value: 'XETRA', label: 'Xetra / Deutsche Börse (DE)' },
  { value: 'SIX', label: 'SIX Swiss Exchange (CH)' },
  { value: 'TSX', label: 'Toronto Stock Exchange (CA)' },
  { value: 'ASX', label: 'Australian Securities Exchange (AU)' },
  { value: 'JPX', label: 'Japan Exchange Group (JP)' },
  { value: 'SSE', label: 'Shanghai Stock Exchange (CN)' },
  { value: 'HKEX', label: 'Hong Kong Exchanges (HK)' },
  { value: 'PSE', label: 'Philippine Stock Exchange (PH)' },
  { value: 'OMX-STO', label: 'Nasdaq Stockholm (SE)' },
  { value: 'Other', label: 'Other' },
  { value: 'VIE', label: 'Vienna Stock Exchange (AT)' },
  { value: 'WSE', label: 'Warsaw Stock Exchange (PL)' },
  { value: 'PSE-PRA', label: 'Prague Stock Exchange (CZ)' },
  { value: 'EURONEXT-PARIS', label: 'Euronext Paris (FR)' },
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
  // Nordics & Central Europe
  { value: 'SEK', label: 'SEK' }, // Sweden
  { value: 'DKK', label: 'DKK' }, // Denmark
  { value: 'NOK', label: 'NOK' }, // Norway
  { value: 'PLN', label: 'PLN' }, // Poland
  { value: 'HUF', label: 'HUF' }, // Hungary
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
  price_scale: 1,
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
          price_scale: stock.price_scale ?? 1,
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
      { value: '', label: 'Vyberte sektor...' },
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
          : `Nepodařilo se ${isEditMode ? 'upravit' : 'vytvořit'} akcii`
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

  const title = isEditMode ? 'Upravit akcii' : 'Přidat novou akcii';
  const submitLabel = isEditMode
    ? loading
      ? 'Ukládám...'
      : 'Uložit změny'
    : loading
    ? 'Přidávám...'
    : 'Přidat akcii';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="md"
      closeOnOverlay={false}
      closeOnEscape={false}
      hideCloseButton
    >
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
            <Label htmlFor="name">Název společnosti *</Label>
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
            label="Sektor"
            options={sectorOptions}
            value={formData.sector_id || ''}
            onChange={(value) =>
              setFormData((prev) => ({
                ...prev,
                sector_id: value || undefined,
              }))
            }
            placeholder="Vyberte sektor..."
          />

          <BottomSheetSelect
            label="Burza"
            options={EXCHANGE_OPTIONS}
            value={formData.exchange || ''}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, exchange: value || undefined }))
            }
            placeholder="Vyberte burzu..."
          />
        </div>

        <div className="form-row">
          <BottomSheetSelect
            label="Měna"
            options={CURRENCY_OPTIONS}
            value={formData.currency || 'USD'}
            onChange={(value) =>
              setFormData((prev) => ({ ...prev, currency: value || 'USD' }))
            }
            placeholder="Vyberte měnu..."
          />

          <div className="form-group">
            <Label htmlFor="target_price">Cílová cena</Label>
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
            <Hint>
              Potřeba pouze pro ne-US akcie, pokud auto-detekce selhává
            </Hint>
          </div>

          <div className="form-group">
            <Label htmlFor="price_scale">Cenový poměr</Label>
            <Input
              type="number"
              id="price_scale"
              name="price_scale"
              value={formData.price_scale ?? ''}
              onChange={handleNumberChange}
              placeholder="1"
              step="any"
              min="0.0001"
              max="1"
              fullWidth
            />
            <Hint>
              Poměr pro převod kotované ceny na skutečnou cenu za akcii. 1 =
              normální, 0.01 = cena za 100 ks (LSE)
            </Hint>
          </div>
        </div>

        <div className="form-group">
          <Label htmlFor="notes">Poznámky</Label>
          <TextArea
            id="notes"
            name="notes"
            value={formData.notes || ''}
            onChange={handleChange}
            placeholder="Jakékoli poznámky k této akcii..."
            rows={3}
            fullWidth
          />
        </div>

        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Zrušit
          </Button>
          <Button type="submit" variant="primary" disabled={loading}>
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
