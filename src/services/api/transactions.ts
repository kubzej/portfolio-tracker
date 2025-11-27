import { supabase } from '@/lib/supabase';
import type {
  Transaction,
  TransactionWithStock,
  CreateTransactionInput,
  UpdateTransactionInput,
} from '@/types';

export const transactionsApi = {
  /**
   * Get all transactions with stock info (optionally filtered by portfolio)
   */
  async getAll(portfolioId?: string): Promise<TransactionWithStock[]> {
    let query = supabase
      .from('transactions')
      .select(
        `
        *,
        stock:stocks (*)
      `
      )
      .order('date', { ascending: false });

    if (portfolioId) {
      query = query.eq('portfolio_id', portfolioId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  /**
   * Get transactions for a specific stock (optionally filtered by portfolio)
   */
  async getByStockId(
    stockId: string,
    portfolioId?: string
  ): Promise<Transaction[]> {
    let query = supabase
      .from('transactions')
      .select('*')
      .eq('stock_id', stockId)
      .order('date', { ascending: false });

    if (portfolioId) {
      query = query.eq('portfolio_id', portfolioId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  /**
   * Get transaction by ID
   */
  async getById(id: string): Promise<TransactionWithStock | null> {
    const { data, error } = await supabase
      .from('transactions')
      .select(
        `
        *,
        stock:stocks (*)
      `
      )
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Create a new transaction
   */
  async create(input: CreateTransactionInput): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        stock_id: input.stock_id,
        portfolio_id: input.portfolio_id,
        date: input.date,
        type: input.type,
        quantity: input.quantity,
        price_per_share: input.price_per_share,
        currency: input.currency || 'USD',
        exchange_rate_to_czk: input.exchange_rate_to_czk,
        fees: input.fees || 0,
        notes: input.notes,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update a transaction
   */
  async update(
    id: string,
    input: UpdateTransactionInput
  ): Promise<Transaction> {
    const { data, error } = await supabase
      .from('transactions')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete a transaction
   */
  async delete(id: string): Promise<void> {
    const { error } = await supabase.from('transactions').delete().eq('id', id);

    if (error) throw error;
  },

  /**
   * Get transactions within a date range
   */
  async getByDateRange(
    startDate: string,
    endDate: string
  ): Promise<TransactionWithStock[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select(
        `
        *,
        stock:stocks (*)
      `
      )
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get recent transactions
   */
  async getRecent(limit: number = 10): Promise<TransactionWithStock[]> {
    const { data, error } = await supabase
      .from('transactions')
      .select(
        `
        *,
        stock:stocks (*)
      `
      )
      .order('date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },
};
