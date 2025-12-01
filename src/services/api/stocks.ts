import { supabase } from '@/lib/supabase';
import type {
  Stock,
  StockWithSector,
  CreateStockInput,
  UpdateStockInput,
} from '@/types';

async function getCurrentUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('User not authenticated');
  return user.id;
}

export const stocksApi = {
  /**
   * Get all stocks with sector info
   */
  async getAll(): Promise<StockWithSector[]> {
    const { data, error } = await supabase
      .from('stocks')
      .select(
        `
        *,
        sectors (
          name
        )
      `
      )
      .order('ticker');

    if (error) throw error;

    // Flatten the sector name
    return (data || []).map((stock) => ({
      ...stock,
      sector_name: stock.sectors?.name || null,
      sectors: undefined,
    }));
  },

  /**
   * Get stock by ID
   */
  async getById(id: string): Promise<StockWithSector | null> {
    const { data, error } = await supabase
      .from('stocks')
      .select(
        `
        *,
        sectors (
          name
        )
      `
      )
      .eq('id', id)
      .single();

    if (error) throw error;

    if (!data) return null;

    return {
      ...data,
      sector_name: data.sectors?.name || null,
      sectors: undefined,
    };
  },

  /**
   * Get stock by ticker
   */
  async getByTicker(ticker: string): Promise<StockWithSector | null> {
    const { data, error } = await supabase
      .from('stocks')
      .select(
        `
        *,
        sectors (
          name
        )
      `
      )
      .eq('ticker', ticker.toUpperCase())
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows

    if (!data) return null;

    return {
      ...data,
      sector_name: data.sectors?.name || null,
      sectors: undefined,
    };
  },

  /**
   * Create a new stock
   */
  async create(input: CreateStockInput): Promise<Stock> {
    const userId = await getCurrentUserId();
    
    const { data, error } = await supabase
      .from('stocks')
      .insert({
        ...input,
        ticker: input.ticker.toUpperCase(),
        user_id: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update a stock
   */
  async update(id: string, input: UpdateStockInput): Promise<Stock> {
    const updateData = { ...input };
    if (updateData.ticker) {
      updateData.ticker = updateData.ticker.toUpperCase();
    }

    const { data, error } = await supabase
      .from('stocks')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete a stock (will also delete all related transactions)
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('stocks').delete().eq('id', id);

    if (error) throw error;
  },

  /**
   * Search stocks by ticker or name
   */
  async search(query: string): Promise<StockWithSector[]> {
    const { data, error } = await supabase
      .from('stocks')
      .select(
        `
        *,
        sectors (
          name
        )
      `
      )
      .or(`ticker.ilike.%${query}%,name.ilike.%${query}%`)
      .order('ticker')
      .limit(10);

    if (error) throw error;

    return (data || []).map((stock) => ({
      ...stock,
      sector_name: stock.sectors?.name || null,
      sectors: undefined,
    }));
  },
};
