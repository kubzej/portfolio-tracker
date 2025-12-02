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
      return 'Ticker symbol je povinný';
    }

    // Allow letters, numbers, dots (for exchange suffix like .HK, .DE)
    if (!/^[A-Z0-9]{1,10}(\.[A-Z]{1,2})?$/.test(normalized)) {
      return 'Neplatný ticker symbol (např. AAPL, SAP.DE, 1211.HK)';
    }

    // Check for duplicates (allow keeping the same ticker when editing)
    const isChangingTicker = isEditing && normalized !== item?.ticker;
    if (
      (!isEditing || isChangingTicker) &&
      existingTickers.includes(normalized)
    ) {
      return `${normalized} již je v tomto watchlistu`;
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
      setError('Nákupní cíl musí být kladné číslo');
      return;
    }

    if (targetSellPrice && (isNaN(parsedSellPrice!) || parsedSellPrice! <= 0)) {
      setError('Prodejní cíl musí být kladné číslo');
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
      title={isEditing ? `Upravit ${item.ticker}` : 'Přidat akcii'}
      size="md"
    >
      <form onSubmit={handleSubmit}>
        {error && <div className="form-error">{error}</div>}

        <div className="form-group">
          <Label htmlFor="stock-ticker">Ticker symbol *</Label>
          <Input
            id="stock-ticker"
            type="text"
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            placeholder="např. AAPL, SAP.DE, 1211.HK"
            autoFocus={!isEditing}
            maxLength={15}
            fullWidth
          />
        </div>

        <div className="form-group">
          <Label htmlFor="stock-name">Název společnosti</Label>
          <Input
            id="stock-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="např. Apple Inc."
            maxLength={100}
            fullWidth
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <Label htmlFor="buy-target">Nákupní cíl ($)</Label>
            <Input
              id="buy-target"
              type="number"
              step="0.01"
              min="0"
              value={targetBuyPrice}
              onChange={(e) => setTargetBuyPrice(e.target.value)}
              placeholder="Volitelné"
              fullWidth
            />
            <Hint>Upozornit, když cena klesne na tuto úroveň</Hint>
          </div>

          <div className="form-group">
            <Label htmlFor="sell-target">Prodejní cíl ($)</Label>
            <Input
              id="sell-target"
              type="number"
              step="0.01"
              min="0"
              value={targetSellPrice}
              onChange={(e) => setTargetSellPrice(e.target.value)}
              placeholder="Volitelné"
              fullWidth
            />
            <Hint>Upozornit, když cena stoupne na tuto úroveň</Hint>
          </div>
        </div>

        <div className="form-group">
          <Label htmlFor="stock-notes">Poznámky</Label>
          <TextArea
            id="stock-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Proč sledujete tuto akcii? Investiční teze, klíčové metriky..."
            rows={4}
            fullWidth
          />
        </div>

        <div className="form-actions">
          <Button variant="outline" type="button" onClick={onClose}>
            Zrušit
          </Button>
          <Button variant="primary" type="submit" disabled={saving}>
            {saving
              ? 'Ukládám...'
              : isEditing
              ? 'Uložit změny'
              : 'Přidat akcii'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
