import { supabase } from '@/lib/supabase';
import type { Sector } from '@/types';

export const sectorsApi = {
  /**
   * Get all sectors
   */
  async getAll(): Promise<Sector[]> {
    const { data, error } = await supabase
      .from('sectors')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  },

  /**
   * Get sector by ID
   */
  async getById(id: string): Promise<Sector | null> {
    const { data, error } = await supabase
      .from('sectors')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Create a new sector
   */
  async create(name: string): Promise<Sector> {
    const { data, error } = await supabase
      .from('sectors')
      .insert({ name })
      .select()
      .single();

    if (error) throw error;
    return data;
  },
};
