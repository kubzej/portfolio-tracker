import { useState, useEffect } from 'react';
import { sectorsApi, stocksApi } from '@/services/api';
import type { Sector, CreateStockInput } from '@/types';
import './StockForm.css';

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
        <div className="form-group">
          <label htmlFor="sector_id">Sector</label>
          <select
            id="sector_id"
            name="sector_id"
            value={formData.sector_id || ''}
            onChange={handleChange}
          >
            <option value="">Select sector...</option>
            {sectors.map((sector) => (
              <option key={sector.id} value={sector.id}>
                {sector.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="exchange">Exchange</label>
          <select
            id="exchange"
            name="exchange"
            value={formData.exchange || ''}
            onChange={handleChange}
          >
            <option value="">Select exchange...</option>
            <option value="NYSE">NYSE</option>
            <option value="NASDAQ">NASDAQ</option>
            <option value="XETRA">XETRA</option>
            <option value="LSE">LSE</option>
            <option value="TSX">TSX</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="currency">Currency</label>
          <select
            id="currency"
            name="currency"
            value={formData.currency || 'USD'}
            onChange={handleChange}
          >
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="CZK">CZK</option>
            <option value="CAD">CAD</option>
          </select>
        </div>

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
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Adding...' : 'Add Stock'}
        </button>
      </div>
    </form>
  );
}
