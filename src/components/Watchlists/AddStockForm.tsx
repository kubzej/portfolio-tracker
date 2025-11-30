import { useState } from 'react';
import type {
  WatchlistItemWithCalculations,
  AddWatchlistItemInput,
  UpdateWatchlistItemInput,
} from '@/types/database';
import { watchlistItemsApi } from '@/services/api';
import { Button } from '@/components/shared/Button';
import { Modal } from '@/components/shared/Modal';
import { Input, TextArea } from '@/components/shared/Input';
import { Label, Hint } from '@/components/shared/Typography';

interface AddStockFormProps {
  watchlistId: string;
  item?: WatchlistItemWithCalculations | null;
  existingTickers: string[];
  onClose: () => void;
  onSuccess: () => void;
}

export function AddStockForm({
  watchlistId,
  item,
  existingTickers,
  onClose,
  onSuccess,
}: AddStockFormProps) {
  const [ticker, setTicker] = useState(item?.ticker ?? '');
  const [name, setName] = useState(item?.name ?? '');
  const [targetBuyPrice, setTargetBuyPrice] = useState(
    item?.target_buy_price?.toString() ?? ''
  );
  const [targetSellPrice, setTargetSellPrice] = useState(
    item?.target_sell_price?.toString() ?? ''
  );
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!item;

  const validateTicker = (value: string) => {
    const normalized = value.toUpperCase().trim();

    if (!normalized) {
      return 'Ticker symbol is required';
    }

    // Allow letters, numbers, dots (for exchange suffix like .HK, .DE)
    if (!/^[A-Z0-9]{1,10}(\.[A-Z]{1,2})?$/.test(normalized)) {
      return 'Invalid ticker symbol (e.g., AAPL, SAP.DE, 1211.HK)';
    }

    // Check for duplicates (allow keeping the same ticker when editing)
    const isChangingTicker = isEditing && normalized !== item?.ticker;
    if (
      (!isEditing || isChangingTicker) &&
      existingTickers.includes(normalized)
    ) {
      return `${normalized} is already in this watchlist`;
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const tickerError = validateTicker(ticker);
    if (tickerError) {
      setError(tickerError);
      return;
    }

    const parsedBuyPrice = targetBuyPrice
      ? parseFloat(targetBuyPrice)
      : undefined;
    const parsedSellPrice = targetSellPrice
      ? parseFloat(targetSellPrice)
      : undefined;

    if (targetBuyPrice && (isNaN(parsedBuyPrice!) || parsedBuyPrice! <= 0)) {
      setError('Buy target must be a positive number');
      return;
    }

    if (targetSellPrice && (isNaN(parsedSellPrice!) || parsedSellPrice! <= 0)) {
      setError('Sell target must be a positive number');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      if (isEditing) {
        const normalizedTicker = ticker.toUpperCase().trim();
        const input: UpdateWatchlistItemInput = {
          ticker:
            normalizedTicker !== item.ticker ? normalizedTicker : undefined,
          name: name.trim() || undefined,
          target_buy_price: parsedBuyPrice ?? null,
          target_sell_price: parsedSellPrice ?? null,
          notes: notes.trim() || null,
        };
        await watchlistItemsApi.update(item.id, input);
      } else {
        const input: AddWatchlistItemInput = {
          watchlist_id: watchlistId,
          ticker: ticker.toUpperCase().trim(),
          name: name.trim() || undefined,
          target_buy_price: parsedBuyPrice,
          target_sell_price: parsedSellPrice,
          notes: notes.trim() || undefined,
        };
        await watchlistItemsApi.add(input);
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={isEditing ? `Edit ${item.ticker}` : 'Add Stock'}
      size="md"
    >
      <form onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <div className="form-group">
          <Label htmlFor="stock-ticker">Ticker Symbol *</Label>
          <Input
            id="stock-ticker"
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="e.g., AAPL, SAP.DE, 1211.HK"
            autoFocus={!isEditing}
            maxLength={15}
            fullWidth
          />
        </div>

        <div className="form-group">
          <Label htmlFor="stock-name">Company Name</Label>
          <Input
            id="stock-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Apple Inc."
            maxLength={100}
            fullWidth
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <Label htmlFor="buy-target">Buy Target ($)</Label>
            <Input
              id="buy-target"
              type="number"
              step="0.01"
              min="0"
              value={targetBuyPrice}
              onChange={(e) => setTargetBuyPrice(e.target.value)}
              placeholder="Optional"
              fullWidth
            />
            <Hint>Alert when price drops to this</Hint>
          </div>

          <div className="form-group">
            <Label htmlFor="sell-target">Sell Target ($)</Label>
            <Input
              id="sell-target"
              type="number"
              step="0.01"
              min="0"
              value={targetSellPrice}
              onChange={(e) => setTargetSellPrice(e.target.value)}
              placeholder="Optional"
              fullWidth
            />
            <Hint>Alert when price rises to this</Hint>
          </div>
        </div>

        <div className="form-group">
          <Label htmlFor="stock-notes">Notes</Label>
          <TextArea
            id="stock-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Why are you watching this stock? Investment thesis, key metrics to watch..."
            rows={4}
            fullWidth
          />
        </div>

        <div className="form-actions">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Stock'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
