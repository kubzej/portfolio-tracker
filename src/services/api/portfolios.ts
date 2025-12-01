import { supabase } from '@/lib/supabase';
import type {
  Portfolio,
  CreatePortfolioInput,
  UpdatePortfolioInput,
} from '@/types/database';

async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new Error('User not authenticated');
  return user.id;
}

export const portfoliosApi = {
  // Get all portfolios
  async getAll(): Promise<Portfolio[]> {
    const { data, error } = await supabase
      .from('portfolios')
      .select('*')
      .order('is_default', { ascending: false })
      .order('name');

    if (error) throw error;
    return data || [];
  },

  // Get a single portfolio by ID
  async getById(id: string): Promise<Portfolio | null> {
    const { data, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }
    return data;
  },

  // Get the default portfolio
  async getDefault(): Promise<Portfolio | null> {
    const { data, error } = await supabase
      .from('portfolios')
      .select('*')
      .eq('is_default', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }
    return data;
  },

  // Create a new portfolio
  async create(input: CreatePortfolioInput): Promise<Portfolio> {
    const userId = await getCurrentUserId();

    // If this is set as default, unset other defaults first
    if (input.is_default) {
      await supabase
        .from('portfolios')
        .update({ is_default: false })
        .eq('is_default', true);
    }

    const { data, error } = await supabase
      .from('portfolios')
      .insert({ ...input, user_id: userId })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Update a portfolio
  async update(id: string, input: UpdatePortfolioInput): Promise<Portfolio> {
    // If this is set as default, unset other defaults first
    if (input.is_default) {
      await supabase
        .from('portfolios')
        .update({ is_default: false })
        .neq('id', id);
    }

    const { data, error } = await supabase
      .from('portfolios')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Delete a portfolio (will fail if there are transactions)
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('portfolios').delete().eq('id', id);

    if (error) throw error;
  },
};
