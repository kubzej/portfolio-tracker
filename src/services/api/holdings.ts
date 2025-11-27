import { supabase } from '@/lib/supabase';
import type {
  Holding,
  PortfolioSummary,
  PortfolioTotals,
  UpdateCurrentPriceInput,
} from '@/types';

export const holdingsApi = {
  /**
   * Get all current holdings (from view), optionally filtered by portfolio
   */
  async getAll(portfolioId?: string): Promise<Holding[]> {
    let query = supabase.from('holdings').select('*');

    if (portfolioId) {
      query = query.eq('portfolio_id', portfolioId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  /**
   * Get portfolio summary with current prices (from view), optionally filtered by portfolio
   */
  async getPortfolioSummary(portfolioId?: string): Promise<PortfolioSummary[]> {
    let query = supabase.from('portfolio_summary').select('*');

    if (portfolioId) {
      query = query.eq('portfolio_id', portfolioId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  /**
   * Update current price for a stock
   */
  async updateCurrentPrice(input: UpdateCurrentPriceInput): Promise<void> {
    const { error } = await supabase.from('current_prices').upsert(
      {
        stock_id: input.stock_id,
        price: input.price,
        currency: input.currency || 'USD',
        exchange_rate_to_czk: input.exchange_rate_to_czk,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'stock_id',
      }
    );

    if (error) throw error;
  },

  /**
   * Bulk update current prices
   */
  async bulkUpdateCurrentPrices(
    inputs: UpdateCurrentPriceInput[]
  ): Promise<void> {
    const updates = inputs.map((input) => ({
      stock_id: input.stock_id,
      price: input.price,
      currency: input.currency || 'USD',
      exchange_rate_to_czk: input.exchange_rate_to_czk,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from('current_prices').upsert(updates, {
      onConflict: 'stock_id',
    });

    if (error) throw error;
  },

  /**
   * Calculate portfolio totals (optionally filtered by portfolio)
   */
  async getPortfolioTotals(portfolioId?: string): Promise<PortfolioTotals> {
    const summary = await this.getPortfolioSummary(portfolioId);

    const totalInvestedCzk = summary.reduce(
      (sum, item) => sum + (item.total_invested_czk || 0),
      0
    );

    const totalCurrentValueCzk = summary.reduce(
      (sum, item) => sum + (item.current_value_czk || 0),
      0
    );

    // Use current value if available, otherwise use invested amount
    const hasCurrentPrices = totalCurrentValueCzk > 0;
    const valueForDistribution = hasCurrentPrices
      ? totalCurrentValueCzk
      : totalInvestedCzk;

    const totalUnrealizedGain = totalCurrentValueCzk - totalInvestedCzk;

    const totalUnrealizedGainPercentage =
      totalInvestedCzk > 0 ? (totalUnrealizedGain / totalInvestedCzk) * 100 : 0;

    // Calculate sector distribution - use current value if available, otherwise invested amount
    const sectorMap = new Map<string, number>();
    for (const item of summary) {
      const sector = item.sector_name || 'Other';
      // Use current value if available, otherwise use invested amount
      const value = hasCurrentPrices
        ? item.current_value_czk || 0
        : item.total_invested_czk || 0;
      sectorMap.set(sector, (sectorMap.get(sector) || 0) + value);
    }

    const sectorDistribution = Array.from(sectorMap.entries())
      .map(([sector, value]) => ({
        sector,
        value,
        percentage:
          valueForDistribution > 0 ? (value / valueForDistribution) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    // Get realized gains from holdings
    const holdings = await this.getAll(portfolioId);
    const totalRealizedGains = holdings.reduce(
      (sum, h) => sum + (h.realized_gains || 0),
      0
    );

    return {
      totalInvestedCzk,
      totalCurrentValueCzk,
      totalUnrealizedGain,
      totalUnrealizedGainPercentage,
      totalRealizedGains,
      stockCount: summary.length,
      sectorDistribution,
    };
  },
};
