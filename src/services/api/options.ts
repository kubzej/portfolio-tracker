import { supabase } from '@/lib/supabase';
import type {
  OptionTransaction,
  OptionHolding,
  OptionPrice,
  CreateOptionTransactionInput,
  UpdateOptionTransactionInput,
  UpdateOptionPriceInput,
} from '@/types';
import { generateOCCSymbol } from '@/utils/options';

export const optionsApi = {
  // ==========================================
  // Option Transactions
  // ==========================================

  /**
   * Get all option transactions (optionally filtered by portfolio)
   */
  async getTransactions(portfolioId?: string): Promise<OptionTransaction[]> {
    let query = supabase
      .from('option_transactions')
      .select('*')
      .order('date', { ascending: false });

    if (portfolioId) {
      query = query.eq('portfolio_id', portfolioId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  /**
   * Get option transactions for a specific underlying
   */
  async getTransactionsBySymbol(
    symbol: string,
    portfolioId?: string
  ): Promise<OptionTransaction[]> {
    let query = supabase
      .from('option_transactions')
      .select('*')
      .eq('symbol', symbol.toUpperCase())
      .order('date', { ascending: false });

    if (portfolioId) {
      query = query.eq('portfolio_id', portfolioId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  /**
   * Get option transaction by ID
   */
  async getTransactionById(id: string): Promise<OptionTransaction | null> {
    const { data, error } = await supabase
      .from('option_transactions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Create a new option transaction
   */
  async createTransaction(
    input: CreateOptionTransactionInput
  ): Promise<OptionTransaction> {
    // Generovat OCC symbol
    const optionSymbol = generateOCCSymbol(
      input.symbol,
      input.strike_price,
      input.expiration_date,
      input.option_type
    );

    const { data, error } = await supabase
      .from('option_transactions')
      .insert({
        portfolio_id: input.portfolio_id,
        symbol: input.symbol.toUpperCase(),
        option_symbol: optionSymbol,
        option_type: input.option_type,
        strike_price: input.strike_price,
        expiration_date: input.expiration_date,
        action: input.action,
        contracts: input.contracts,
        premium: input.premium ?? null,
        currency: input.currency || 'USD',
        fees: input.fees || 0,
        date: input.date,
        notes: input.notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update an option transaction
   */
  async updateTransaction(
    id: string,
    input: UpdateOptionTransactionInput
  ): Promise<OptionTransaction> {
    const { data, error } = await supabase
      .from('option_transactions')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete an option transaction
   */
  async deleteTransaction(id: string): Promise<void> {
    const { error } = await supabase
      .from('option_transactions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // ==========================================
  // Option Holdings (from VIEW)
  // ==========================================

  /**
   * Get all option holdings (current positions)
   */
  async getHoldings(portfolioId?: string): Promise<OptionHolding[]> {
    let query = supabase
      .from('option_holdings')
      .select('*')
      .order('expiration_date', { ascending: true });

    if (portfolioId) {
      query = query.eq('portfolio_id', portfolioId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  /**
   * Get option holdings for a specific underlying
   */
  async getHoldingsBySymbol(
    symbol: string,
    portfolioId?: string
  ): Promise<OptionHolding[]> {
    let query = supabase
      .from('option_holdings')
      .select('*')
      .eq('symbol', symbol.toUpperCase())
      .order('expiration_date', { ascending: true });

    if (portfolioId) {
      query = query.eq('portfolio_id', portfolioId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  /**
   * Get a specific option holding by option_symbol
   */
  async getHoldingByOptionSymbol(
    optionSymbol: string,
    portfolioId: string
  ): Promise<OptionHolding | null> {
    const { data, error } = await supabase
      .from('option_holdings')
      .select('*')
      .eq('option_symbol', optionSymbol)
      .eq('portfolio_id', portfolioId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return data || null;
  },

  // ==========================================
  // Option Prices
  // ==========================================

  /**
   * Get price for a specific option
   */
  async getPrice(optionSymbol: string): Promise<OptionPrice | null> {
    const { data, error } = await supabase
      .from('option_prices')
      .select('*')
      .eq('option_symbol', optionSymbol)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data || null;
  },

  /**
   * Get prices for multiple options
   */
  async getPrices(optionSymbols: string[]): Promise<OptionPrice[]> {
    if (optionSymbols.length === 0) return [];

    const { data, error } = await supabase
      .from('option_prices')
      .select('*')
      .in('option_symbol', optionSymbols);

    if (error) throw error;
    return data || [];
  },

  /**
   * Update or insert option price
   */
  async upsertPrice(input: UpdateOptionPriceInput): Promise<OptionPrice> {
    const { data, error } = await supabase
      .from('option_prices')
      .upsert(
        {
          option_symbol: input.option_symbol,
          price: input.price,
          bid: input.bid,
          ask: input.ask,
          volume: input.volume,
          open_interest: input.open_interest,
          implied_volatility: input.implied_volatility,
          delta: input.delta,
          gamma: input.gamma,
          theta: input.theta,
          vega: input.vega,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'option_symbol' }
      )
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // ==========================================
  // Assignment/Exercise Helpers
  // ==========================================

  /**
   * Process assignment or exercise - creates stock transaction and closes option
   *
   * @param optionTransactionId ID of the ASSIGNMENT/EXERCISE option transaction
   * @param stockTransactionId ID of the created stock transaction
   */
  async linkStockTransaction(
    optionTransactionId: string,
    stockTransactionId: string
  ): Promise<void> {
    const { error } = await supabase
      .from('option_transactions')
      .update({ linked_stock_tx_id: stockTransactionId })
      .eq('id', optionTransactionId);

    if (error) throw error;
  },

  // ==========================================
  // Statistics
  // ==========================================

  /**
   * Get summary statistics for option holdings
   */
  async getStats(portfolioId?: string): Promise<{
    totalPositions: number;
    longPositions: number;
    shortPositions: number;
    expiringThisWeek: number;
    totalValue: number;
  }> {
    const holdings = await this.getHoldings(portfolioId);

    const today = new Date();
    const weekFromNow = new Date();
    weekFromNow.setDate(today.getDate() + 7);

    const stats = {
      totalPositions: holdings.length,
      longPositions: holdings.filter((h) => h.position === 'long').length,
      shortPositions: holdings.filter((h) => h.position === 'short').length,
      expiringThisWeek: holdings.filter((h) => {
        const expDate = new Date(h.expiration_date);
        return expDate <= weekFromNow;
      }).length,
      totalValue: holdings.reduce((sum, h) => sum + (h.total_cost || 0), 0),
    };

    return stats;
  },

  // ==========================================
  // Price Refresh (Edge Function)
  // ==========================================

  /**
   * Refresh option prices from Yahoo Finance via edge function
   */
  async refreshPrices(portfolioId?: string): Promise<{
    updated: number;
    failed: number;
    errors: string[];
  }> {
    const { data, error } = await supabase.functions.invoke(
      'fetch-option-prices',
      {
        body: { portfolioId },
      }
    );

    if (error) throw error;
    return data;
  },

  /**
   * Refresh prices for specific option symbols
   */
  async refreshPricesForSymbols(optionSymbols: string[]): Promise<{
    updated: number;
    failed: number;
    errors: string[];
  }> {
    const { data, error } = await supabase.functions.invoke(
      'fetch-option-prices',
      {
        body: { optionSymbols },
      }
    );

    if (error) throw error;
    return data;
  },
};
