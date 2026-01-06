import { supabase } from '@/lib/supabase';
import type {
  WatchlistTag,
  CreateWatchlistTagInput,
  UpdateWatchlistTagInput,
} from '@/types/database';

async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error('User not authenticated');
  return user.id;
}

export const watchlistTagsApi = {
  /**
   * Get all tags for the current user
   */
  async getAll(): Promise<WatchlistTag[]> {
    const { data, error } = await supabase
      .from('watchlist_tags')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new tag
   */
  async create(input: CreateWatchlistTagInput): Promise<WatchlistTag> {
    const userId = await getCurrentUserId();

    const { data, error } = await supabase
      .from('watchlist_tags')
      .insert({
        user_id: userId,
        name: input.name.trim(),
        color: input.color || '#6b7280',
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Tag s tímto názvem již existuje');
      }
      throw error;
    }
    return data;
  },

  /**
   * Update a tag
   */
  async update(
    id: string,
    input: UpdateWatchlistTagInput
  ): Promise<WatchlistTag> {
    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name.trim();
    if (input.color !== undefined) updateData.color = input.color;

    const { data, error } = await supabase
      .from('watchlist_tags')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error('Tag s tímto názvem již existuje');
      }
      throw error;
    }
    return data;
  },

  /**
   * Delete a tag
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('watchlist_tags')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Get tags for a specific watchlist item
   */
  async getTagsForItem(itemId: string): Promise<WatchlistTag[]> {
    const { data, error } = await supabase
      .from('watchlist_item_tags')
      .select('tag_id, watchlist_tags(*)')
      .eq('watchlist_item_id', itemId);

    if (error) throw error;

    return (data || [])
      .map((row) => row.watchlist_tags as unknown as WatchlistTag)
      .filter(Boolean);
  },

  /**
   * Get tags for multiple watchlist items (batch)
   */
  async getTagsForItems(
    itemIds: string[]
  ): Promise<Map<string, WatchlistTag[]>> {
    if (itemIds.length === 0) return new Map();

    const { data, error } = await supabase
      .from('watchlist_item_tags')
      .select('watchlist_item_id, tag_id, watchlist_tags(*)')
      .in('watchlist_item_id', itemIds);

    if (error) throw error;

    const result = new Map<string, WatchlistTag[]>();
    for (const row of data || []) {
      const tag = row.watchlist_tags as unknown as WatchlistTag;
      if (tag) {
        const existing = result.get(row.watchlist_item_id) || [];
        existing.push(tag);
        result.set(row.watchlist_item_id, existing);
      }
    }
    return result;
  },

  /**
   * Add a tag to a watchlist item
   */
  async addTagToItem(itemId: string, tagId: string): Promise<void> {
    const { error } = await supabase.from('watchlist_item_tags').insert({
      watchlist_item_id: itemId,
      tag_id: tagId,
    });

    if (error) {
      if (error.code === '23505') {
        // Already exists, ignore
        return;
      }
      throw error;
    }
  },

  /**
   * Remove a tag from a watchlist item
   */
  async removeTagFromItem(itemId: string, tagId: string): Promise<void> {
    const { error } = await supabase
      .from('watchlist_item_tags')
      .delete()
      .eq('watchlist_item_id', itemId)
      .eq('tag_id', tagId);

    if (error) throw error;
  },

  /**
   * Set tags for an item (replace all existing)
   */
  async setTagsForItem(itemId: string, tagIds: string[]): Promise<void> {
    // Delete all existing tags
    const { error: deleteError } = await supabase
      .from('watchlist_item_tags')
      .delete()
      .eq('watchlist_item_id', itemId);

    if (deleteError) throw deleteError;

    // Insert new tags
    if (tagIds.length > 0) {
      const { error: insertError } = await supabase
        .from('watchlist_item_tags')
        .insert(
          tagIds.map((tagId) => ({
            watchlist_item_id: itemId,
            tag_id: tagId,
          }))
        );

      if (insertError) throw insertError;
    }
  },
};
