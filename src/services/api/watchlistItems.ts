import { supabase } from '@/lib/supabase';
import type {
  WatchlistItem,
  WatchlistItemWithCalculations,
  AddWatchlistItemInput,
  UpdateWatchlistItemInput,
} from '@/types/database';

/**
 * Calculate distance to target prices and target status
 */
function enrichWithCalculations(
  item: WatchlistItem
): WatchlistItemWithCalculations {
  let distance_to_buy_target: number | null = null;
  let distance_to_sell_target: number | null = null;
  let at_buy_target = false;
  let at_sell_target = false;

  if (item.last_price && item.target_buy_price) {
    distance_to_buy_target =
      ((item.last_price - item.target_buy_price) / item.target_buy_price) * 100;
    // At buy target when price is at or below target
    at_buy_target = item.last_price <= item.target_buy_price;
  }

  if (item.last_price && item.target_sell_price) {
    distance_to_sell_target =
      ((item.target_sell_price - item.last_price) / item.last_price) * 100;
    // At sell target when price is at or above target
    at_sell_target = item.last_price >= item.target_sell_price;
  }

  return {
    ...item,
    distance_to_buy_target,
    distance_to_sell_target,
    at_buy_target,
    at_sell_target,
    // 52-week range comes from price API, not stored in DB yet
    week_52_low: null,
    week_52_high: null,
  };
}

export const watchlistItemsApi = {
  /**
   * Get all items in a watchlist
   */
  async getByWatchlistId(
    watchlistId: string
  ): Promise<WatchlistItemWithCalculations[]> {
    const { data, error } = await supabase
      .from('watchlist_items')
      .select('*')
      .eq('watchlist_id', watchlistId)
      .order('added_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(enrichWithCalculations);
  },

  /**
   * Get a single item by ID
   */
  async getById(id: string): Promise<WatchlistItemWithCalculations | null> {
    const { data, error } = await supabase
      .from('watchlist_items')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return enrichWithCalculations(data);
  },

  /**
   * Check if ticker exists in a watchlist
   */
  async existsInWatchlist(
    watchlistId: string,
    ticker: string
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from('watchlist_items')
      .select('id')
      .eq('watchlist_id', watchlistId)
      .eq('ticker', ticker.toUpperCase())
      .maybeSingle();

    if (error) throw error;
    return data !== null;
  },

  /**
   * Add a new item to watchlist
   */
  async add(
    input: AddWatchlistItemInput
  ): Promise<WatchlistItemWithCalculations> {
    // Normalize ticker to uppercase
    const normalizedInput = {
      ...input,
      ticker: input.ticker.toUpperCase(),
    };

    const { data, error } = await supabase
      .from('watchlist_items')
      .insert(normalizedInput)
      .select()
      .single();

    if (error) {
      // Handle duplicate ticker error
      if (error.code === '23505') {
        throw new Error(
          `${normalizedInput.ticker} is already in this watchlist`
        );
      }
      throw error;
    }
    return enrichWithCalculations(data);
  },

  /**
   * Update an item (notes, targets, etc.)
   */
  async update(
    id: string,
    input: UpdateWatchlistItemInput
  ): Promise<WatchlistItemWithCalculations> {
    const { data, error } = await supabase
      .from('watchlist_items')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return enrichWithCalculations(data);
  },

  /**
   * Refresh prices for watchlist items via edge function
   * Can be called with watchlistId to refresh specific watchlist, or without to refresh all
   */
  async refreshPrices(watchlistId?: string): Promise<{
    updated: number;
    failed: number;
    errors: string[];
  }> {
    const { data, error } = await supabase.functions.invoke(
      'fetch-watchlist-prices',
      {
        body: watchlistId ? { watchlist_id: watchlistId } : {},
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    return data;
  },

  /**
   * Update cached price for an item
   */
  async updatePrice(
    id: string,
    price: number,
    change: number,
    changePercent: number
  ): Promise<void> {
    const { error } = await supabase
      .from('watchlist_items')
      .update({
        last_price: price,
        last_price_change: change,
        last_price_change_percent: changePercent,
        last_price_updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Batch update prices for multiple items
   * Can be called with an array of update objects OR with watchlistId and tickers
   */
  async updatePrices(
    updatesOrWatchlistId:
      | Array<{
          id: string;
          price: number;
          change: number;
          changePercent: number;
        }>
      | string,
    tickers?: string[]
  ): Promise<void> {
    // If called with watchlistId and tickers, fetch prices and update
    if (typeof updatesOrWatchlistId === 'string' && tickers) {
      // For now, just mark prices as needing refresh
      // The actual price fetching will be done via edge function
      console.log(
        `Refreshing prices for ${tickers.length} tickers in watchlist ${updatesOrWatchlistId}`
      );
      // TODO: Call edge function to fetch and update prices
      return;
    }

    // If called with update array, update each item
    const updates = updatesOrWatchlistId as Array<{
      id: string;
      price: number;
      change: number;
      changePercent: number;
    }>;
    const promises = updates.map((u) =>
      this.updatePrice(u.id, u.price, u.change, u.changePercent)
    );
    await Promise.all(promises);
  },

  /**
   * Remove an item from watchlist
   */
  async remove(id: string): Promise<void> {
    const { error } = await supabase
      .from('watchlist_items')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Move/copy item to another watchlist
   */
  async copyToWatchlist(
    itemId: string,
    targetWatchlistId: string
  ): Promise<WatchlistItemWithCalculations> {
    // Get original item
    const original = await this.getById(itemId);
    if (!original) {
      throw new Error('Item not found');
    }

    // Check if already exists in target
    const exists = await this.existsInWatchlist(
      targetWatchlistId,
      original.ticker
    );
    if (exists) {
      throw new Error(`${original.ticker} already exists in target watchlist`);
    }

    // Create copy
    return this.add({
      watchlist_id: targetWatchlistId,
      ticker: original.ticker,
      name: original.name ?? undefined,
      finnhub_ticker: original.finnhub_ticker ?? undefined,
      target_buy_price: original.target_buy_price ?? undefined,
      target_sell_price: original.target_sell_price ?? undefined,
      notes: original.notes ?? undefined,
    });
  },

  /**
   * Move item to another watchlist (copy + delete original)
   */
  async moveToWatchlist(
    itemId: string,
    targetWatchlistId: string
  ): Promise<WatchlistItemWithCalculations> {
    // Copy to target watchlist
    const copied = await this.copyToWatchlist(itemId, targetWatchlistId);

    // Delete original
    await this.remove(itemId);

    return copied;
  },

  /**
   * Get all items across all watchlists (for batch price update)
   */
  async getAllItems(): Promise<WatchlistItem[]> {
    const { data, error } = await supabase
      .from('watchlist_items')
      .select('*')
      .order('ticker');

    if (error) throw error;
    return data || [];
  },

  /**
   * Get unique tickers across all watchlists
   */
  async getUniqueTickers(): Promise<string[]> {
    const { data, error } = await supabase
      .from('watchlist_items')
      .select('ticker')
      .order('ticker');

    if (error) throw error;

    // Get unique tickers
    const tickers = new Set((data || []).map((d) => d.ticker));
    return Array.from(tickers);
  },
};
