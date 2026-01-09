import { supabase } from '@/lib/supabase';
import type {
  Transaction,
  TransactionWithStock,
  CreateTransactionInput,
  UpdateTransactionInput,
  AvailableLot,
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
        stock:stocks (*),
        portfolio:portfolios (*),
        source_transaction:source_transaction_id (id, date, price_per_share, currency, quantity)
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
  ): Promise<TransactionWithStock[]> {
    let query = supabase
      .from('transactions')
      .select(
        `
        *,
        stock:stocks (*),
        portfolio:portfolios (*),
        source_transaction:source_transaction_id (id, date, price_per_share, currency, quantity)
      `
      )
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
        stock:stocks (*),
        source_transaction:source_transaction_id (id, date, price_per_share, currency, quantity)
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
        source_transaction_id: input.source_transaction_id || null,
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
        stock:stocks (*),
        source_transaction:source_transaction_id (id, date, price_per_share, currency, quantity)
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
        stock:stocks (*),
        source_transaction:source_transaction_id (id, date, price_per_share, currency, quantity)
      `
      )
      .order('date', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  /**
   * Get available lots for selling a specific stock in a portfolio
   * Returns BUY transactions with remaining shares (not fully sold yet)
   */
  async getAvailableLots(
    stockId: string,
    portfolioId: string
  ): Promise<AvailableLot[]> {
    // Get all BUY transactions for this stock/portfolio
    const { data: buyTransactions, error: buyError } = await supabase
      .from('transactions')
      .select('*')
      .eq('stock_id', stockId)
      .eq('portfolio_id', portfolioId)
      .eq('type', 'BUY')
      .order('date', { ascending: true });

    if (buyError) throw buyError;

    // Get all SELL transactions that reference specific lots
    const { data: sellTransactions, error: sellError } = await supabase
      .from('transactions')
      .select('source_transaction_id, quantity')
      .eq('stock_id', stockId)
      .eq('portfolio_id', portfolioId)
      .eq('type', 'SELL')
      .not('source_transaction_id', 'is', null);

    if (sellError) throw sellError;

    // Calculate sold quantities per lot
    const soldPerLot = new Map<string, number>();
    for (const sell of sellTransactions || []) {
      if (sell.source_transaction_id) {
        const current = soldPerLot.get(sell.source_transaction_id) || 0;
        soldPerLot.set(sell.source_transaction_id, current + sell.quantity);
      }
    }

    // Build available lots with remaining shares
    const availableLots: AvailableLot[] = [];
    for (const buy of buyTransactions || []) {
      const soldFromLot = soldPerLot.get(buy.id) || 0;
      const remaining = buy.quantity - soldFromLot;

      if (remaining > 0) {
        availableLots.push({
          id: buy.id,
          date: buy.date,
          quantity: buy.quantity,
          remaining_shares: remaining,
          price_per_share: buy.price_per_share,
          currency: buy.currency,
          total_amount: buy.total_amount,
        });
      }
    }

    return availableLots;
  },

  /**
   * Get total available shares for a stock in a portfolio
   * (sum of all remaining shares across all lots)
   */
  async getTotalAvailableShares(
    stockId: string,
    portfolioId: string
  ): Promise<number> {
    const lots = await this.getAvailableLots(stockId, portfolioId);
    return lots.reduce((sum, lot) => sum + lot.remaining_shares, 0);
  },
};
