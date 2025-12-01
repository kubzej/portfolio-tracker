import { supabase } from '@/lib/supabase';
import type {
  Watchlist,
  WatchlistSummary,
  CreateWatchlistInput,
  UpdateWatchlistInput,
} from '@/types/database';

async function getCurrentUserId(): Promise<string> {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('User not authenticated');
  return user.id;
}

export const watchlistsApi = {
  /**
   * Get all watchlists (basic info)
   */
  async getAll(): Promise<Watchlist[]> {
    const { data, error } = await supabase
      .from('watchlists')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  },

  /**
   * Get all watchlists with item counts (from view)
   */
  async getAllWithSummary(): Promise<WatchlistSummary[]> {
    const { data, error } = await supabase
      .from('watchlist_summary')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  },

  /**
   * Get a single watchlist by ID
   */
  async getById(id: string): Promise<Watchlist | null> {
    const { data, error } = await supabase
      .from('watchlists')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  },

  /**
   * Create a new watchlist
   */
  async create(input: CreateWatchlistInput): Promise<Watchlist> {
    const userId = await getCurrentUserId();
    
    const { data, error } = await supabase
      .from('watchlists')
      .insert({ ...input, user_id: userId })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update a watchlist
   */
  async update(id: string, input: UpdateWatchlistInput): Promise<Watchlist> {
    const { data, error } = await supabase
      .from('watchlists')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete a watchlist (cascade deletes items)
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('watchlists').delete().eq('id', id);

    if (error) throw error;
  },
};
