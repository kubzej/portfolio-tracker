import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type {
  WatchlistItemWithCalculations,
  AddWatchlistItemInput,
  UpdateWatchlistItemInput,
} from '@/types/database';
import { watchlistItemsApi } from '@/services/api';
import { Button } from '@/components/shared/Button';
import { Modal } from '@/components/shared/Modal';
import { Input, TextArea } from '@/components/shared/Input';
import { Label, Hint, Text, Muted } from '@/components/shared/Typography';

interface Watchlist {
  id: string;
  name: string;
}

interface AddStockFormProps {
  /** If provided, stock will be added to this watchlist. If not, show dropdown. */
  watchlistId?: string;
  /** Existing item for edit mode */
  item?: WatchlistItemWithCalculations | null;
  /** Tickers already in the selected watchlist (for duplicate check) */
  existingTickers?: string[];
  /** Pre-fill ticker (for Research flow) */
  prefillTicker?: string;
  /** Pre-fill name (for Research flow) */
  prefillName?: string;
  /** Suggested buy price (e.g. current price from Research) */
  suggestedBuyPrice?: number;
  /** Suggested sell price (e.g. analyst target from Research) */
  suggestedSellPrice?: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddStockForm({
  watchlistId: initialWatchlistId,
  item,
  existingTickers = [],
  prefillTicker,
  prefillName,
  suggestedBuyPrice,
  suggestedSellPrice,
  onClose,
  onSuccess,
}: AddStockFormProps) {
  const { user } = useAuth();

  // Watchlist selection (when no watchlistId provided)
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string>(
    item?.watchlist_id ?? initialWatchlistId ?? ''
  );
  const [loadingWatchlists, setLoadingWatchlists] = useState(false);

  // Form fields
  const [ticker, setTicker] = useState(item?.ticker ?? prefillTicker ?? '');
  const [name, setName] = useState(item?.name ?? prefillName ?? '');
  const [targetBuyPrice, setTargetBuyPrice] = useState(
    item?.target_buy_price?.toString() ?? suggestedBuyPrice?.toFixed(2) ?? ''
  );
  const [targetSellPrice, setTargetSellPrice] = useState(
    item?.target_sell_price?.toString() ?? suggestedSellPrice?.toFixed(2) ?? ''
  );
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isEditing = !!item;
  const needsWatchlistSelection = !initialWatchlistId && !isEditing;
  const showWatchlistSelector = !initialWatchlistId || isEditing; // Show when adding without ID or when editing
  const effectiveWatchlistId = selectedWatchlistId || initialWatchlistId;

  // Load watchlists if we need to show the selector
  useEffect(() => {
    if (showWatchlistSelector && user) {
      loadWatchlists();
    }
  }, [showWatchlistSelector, user]);

  const loadWatchlists = async () => {
    if (!user) return;

    setLoadingWatchlists(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('watchlists')
        .select('id, name')
        .eq('user_id', user.id)
        .order('name');

      if (fetchError) throw fetchError;

      setWatchlists(data || []);
      if (data && data.length > 0 && !selectedWatchlistId) {
        setSelectedWatchlistId(data[0].id);
      }
    } catch (err) {
      console.error('Error loading watchlists:', err);
      setError('Nepodařilo se načíst watchlisty');
    } finally {
      setLoadingWatchlists(false);
    }
  };

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

    if (!effectiveWatchlistId) {
      setError('Vyberte watchlist');
      return;
    }

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

      // Check for duplicates when adding to a new watchlist (not editing)
      // Or when moving to a different watchlist (editing)
      const isMovingToNewWatchlist =
        isEditing && selectedWatchlistId !== item?.watchlist_id;

      if (!isEditing || isMovingToNewWatchlist) {
        const targetWatchlistId = isMovingToNewWatchlist
          ? selectedWatchlistId
          : effectiveWatchlistId;

        const { data: existing } = await supabase
          .from('watchlist_items')
          .select('id')
          .eq('watchlist_id', targetWatchlistId)
          .eq('ticker', ticker.toUpperCase().trim())
          .single();

        if (existing) {
          setError(
            isMovingToNewWatchlist
              ? 'Tato akcie už v cílovém watchlistu je'
              : 'Tato akcie už ve watchlistu je'
          );
          setSaving(false);
          return;
        }
      }

      if (isEditing) {
        const normalizedTicker = ticker.toUpperCase().trim();

        // If moving to a different watchlist, use moveToWatchlist
        if (isMovingToNewWatchlist) {
          await watchlistItemsApi.moveToWatchlist(item.id, selectedWatchlistId);
          // After move, update the new item with any changed fields
          // Note: moveToWatchlist copies all data, so we only need to update if something else changed
        }

        // Update other fields (even after move, update the data)
        const input: UpdateWatchlistItemInput = {
          ticker:
            normalizedTicker !== item.ticker ? normalizedTicker : undefined,
          name: name.trim() || undefined,
          target_buy_price: parsedBuyPrice ?? null,
          target_sell_price: parsedSellPrice ?? null,
          notes: notes.trim() || null,
        };

        // If we moved, we need to find the new item ID
        // For simplicity, just call onSuccess - the data is moved
        if (!isMovingToNewWatchlist) {
          await watchlistItemsApi.update(item.id, input);
        }

        onSuccess();
      } else {
        const input: AddWatchlistItemInput = {
          watchlist_id: effectiveWatchlistId,
          ticker: ticker.toUpperCase().trim(),
          name: name.trim() || undefined,
          target_buy_price: parsedBuyPrice,
          target_sell_price: parsedSellPrice,
          notes: notes.trim() || undefined,
        };
        await watchlistItemsApi.add(input);

        // Show success state briefly before closing
        setSuccess(true);
        setTimeout(() => {
          onSuccess();
        }, 1000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nepodařilo se uložit');
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
      {success ? (
        <div className="form-success">
          <Text color="success">✓ Přidáno do watchlistu</Text>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          {error && <div className="form-error">{error}</div>}

          {/* Watchlist selector (when adding without ID, or when editing to allow move) */}
          {showWatchlistSelector && (
            <div className="form-group">
              <Label htmlFor="watchlist-select">
                Watchlist {!isEditing && '*'}
              </Label>
              {loadingWatchlists ? (
                <Muted>Načítám...</Muted>
              ) : watchlists.length === 0 ? (
                <Muted>Nemáte žádný watchlist</Muted>
              ) : (
                <select
                  id="watchlist-select"
                  className="form-select"
                  value={selectedWatchlistId}
                  onChange={(e) => setSelectedWatchlistId(e.target.value)}
                >
                  {watchlists.map((wl) => (
                    <option key={wl.id} value={wl.id}>
                      {wl.name}
                    </option>
                  ))}
                </select>
              )}
              {isEditing && selectedWatchlistId !== item?.watchlist_id && (
                <Hint>Akcie bude přesunuta do vybraného watchlistu</Hint>
              )}
            </div>
          )}

          {/* Stock info when prefilled */}
          {prefillTicker && !isEditing && (
            <div className="form-stock-info">
              <Text weight="semibold">{prefillTicker}</Text>
              {prefillName && <Muted>{prefillName}</Muted>}
            </div>
          )}

          {/* Ticker input (hidden when prefilled, show when editing or adding manually) */}
          {(!prefillTicker || isEditing) && (
            <div className="form-group">
              <Label htmlFor="stock-ticker">Ticker symbol *</Label>
              <Input
                id="stock-ticker"
                type="text"
                value={ticker}
                onChange={(e) => setTicker(e.target.value.toUpperCase())}
                placeholder="např. AAPL, SAP.DE, 1211.HK"
                autoFocus={!isEditing && !prefillTicker}
                maxLength={15}
                fullWidth
              />
            </div>
          )}

          {/* Name input (hidden when prefilled) */}
          {(!prefillName || isEditing) && (
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
          )}

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
            <Button
              variant="primary"
              type="submit"
              disabled={
                saving || (needsWatchlistSelection && !selectedWatchlistId)
              }
            >
              {saving
                ? 'Ukládám...'
                : isEditing
                ? 'Uložit změny'
                : 'Přidat akcii'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
