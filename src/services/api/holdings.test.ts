import { describe, it, expect, vi, beforeEach } from 'vitest';
import { holdingsApi } from './holdings';

// Mock supabase
const mockSelect = vi.fn();
const mockUpsert = vi.fn();
const mockEq = vi.fn();

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  upsert: mockUpsert,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: Parameters<typeof mockFrom>) => mockFrom(...args),
  },
}));

describe('holdingsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSelect.mockReturnValue({
      eq: mockEq,
    });

    mockEq.mockResolvedValue({
      data: [],
      error: null,
    });

    mockUpsert.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  describe('getAll', () => {
    it('should fetch all holdings', async () => {
      const mockHoldings = [
        { id: '1', stock_id: 's1', shares: 10, avg_price: 100 },
        { id: '2', stock_id: 's2', shares: 20, avg_price: 50 },
      ];

      mockSelect.mockResolvedValueOnce({
        data: mockHoldings,
        error: null,
      });

      const result = await holdingsApi.getAll();

      expect(mockFrom).toHaveBeenCalledWith('holdings');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(result).toEqual(mockHoldings);
    });

    it('should filter by portfolio ID', async () => {
      mockEq.mockResolvedValueOnce({
        data: [{ id: '1', portfolio_id: 'p1' }],
        error: null,
      });

      await holdingsApi.getAll('p1');

      expect(mockEq).toHaveBeenCalledWith('portfolio_id', 'p1');
    });

    it('should return empty array when no holdings', async () => {
      mockSelect.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await holdingsApi.getAll();
      expect(result).toEqual([]);
    });

    it('should throw error on database error', async () => {
      mockSelect.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(holdingsApi.getAll()).rejects.toEqual({
        message: 'Database error',
      });
    });
  });

  describe('getPortfolioSummary', () => {
    it('should fetch portfolio summary', async () => {
      const mockSummary = [
        {
          stock_id: 's1',
          ticker: 'AAPL',
          total_invested_czk: 10000,
          current_value_czk: 12000,
        },
      ];

      mockSelect.mockResolvedValueOnce({
        data: mockSummary,
        error: null,
      });

      const result = await holdingsApi.getPortfolioSummary();

      expect(mockFrom).toHaveBeenCalledWith('portfolio_summary');
      expect(result).toEqual(mockSummary);
    });

    it('should filter by portfolio ID', async () => {
      mockEq.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await holdingsApi.getPortfolioSummary('p1');

      expect(mockEq).toHaveBeenCalledWith('portfolio_id', 'p1');
    });
  });

  describe('updateCurrentPrice', () => {
    it('should update current price for a stock', async () => {
      await holdingsApi.updateCurrentPrice({
        stock_id: 's1',
        price: 150.5,
        currency: 'USD',
        exchange_rate_to_czk: 23.5,
      });

      expect(mockFrom).toHaveBeenCalledWith('current_prices');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          stock_id: 's1',
          price: 150.5,
          currency: 'USD',
          exchange_rate_to_czk: 23.5,
        }),
        { onConflict: 'stock_id' }
      );
    });

    it('should use default currency USD', async () => {
      await holdingsApi.updateCurrentPrice({
        stock_id: 's1',
        price: 100,
      });

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'USD',
        }),
        expect.any(Object)
      );
    });

    it('should throw on error', async () => {
      mockUpsert.mockResolvedValueOnce({
        data: null,
        error: { message: 'Update failed' },
      });

      await expect(
        holdingsApi.updateCurrentPrice({ stock_id: 's1', price: 100 })
      ).rejects.toEqual({ message: 'Update failed' });
    });
  });

  describe('bulkUpdateCurrentPrices', () => {
    it('should bulk update prices', async () => {
      const inputs = [
        { stock_id: 's1', price: 100, currency: 'USD' },
        {
          stock_id: 's2',
          price: 200,
          currency: 'EUR',
          exchange_rate_to_czk: 25,
        },
      ];

      await holdingsApi.bulkUpdateCurrentPrices(inputs);

      expect(mockFrom).toHaveBeenCalledWith('current_prices');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ stock_id: 's1', price: 100 }),
          expect.objectContaining({ stock_id: 's2', price: 200 }),
        ]),
        { onConflict: 'stock_id' }
      );
    });

    it('should handle empty array', async () => {
      await holdingsApi.bulkUpdateCurrentPrices([]);

      expect(mockUpsert).toHaveBeenCalledWith([], { onConflict: 'stock_id' });
    });
  });

  describe('getPortfolioTotals', () => {
    it('should calculate portfolio totals', async () => {
      const mockSummary = [
        {
          stock_id: 's1',
          total_invested_czk: 10000,
          current_value_czk: 12000,
          sector_name: 'Technology',
        },
        {
          stock_id: 's2',
          total_invested_czk: 5000,
          current_value_czk: 4500,
          sector_name: 'Finance',
        },
      ];

      const mockHoldings = [
        { id: '1', stock_id: 's1', realized_gains: 1000 },
        { id: '2', stock_id: 's2', realized_gains: 500 },
      ];

      // First call for getPortfolioSummary
      mockSelect.mockResolvedValueOnce({
        data: mockSummary,
        error: null,
      });

      // Second call for getAll (holdings)
      mockSelect.mockResolvedValueOnce({
        data: mockHoldings,
        error: null,
      });

      const result = await holdingsApi.getPortfolioTotals();

      expect(result.totalInvestedCzk).toBe(15000);
      expect(result.totalCurrentValueCzk).toBe(16500);
      expect(result.totalUnrealizedGain).toBe(1500);
      expect(result.totalUnrealizedGainPercentage).toBe(10);
      expect(result.totalRealizedGains).toBe(1500);
      expect(result.stockCount).toBe(2);
      expect(result.sectorDistribution).toHaveLength(2);
    });

    it('should handle empty portfolio', async () => {
      mockSelect.mockResolvedValueOnce({ data: [], error: null });
      mockSelect.mockResolvedValueOnce({ data: [], error: null });

      const result = await holdingsApi.getPortfolioTotals();

      expect(result.totalInvestedCzk).toBe(0);
      expect(result.totalCurrentValueCzk).toBe(0);
      expect(result.stockCount).toBe(0);
      expect(result.sectorDistribution).toEqual([]);
    });

    it('should group stocks without sector as Other', async () => {
      const mockSummary = [
        {
          stock_id: 's1',
          total_invested_czk: 10000,
          current_value_czk: 10000,
          sector_name: null,
        },
      ];

      mockSelect.mockResolvedValueOnce({ data: mockSummary, error: null });
      mockSelect.mockResolvedValueOnce({ data: [], error: null });

      const result = await holdingsApi.getPortfolioTotals();

      expect(result.sectorDistribution[0].sector).toBe('Other');
    });

    it('should use invested amount when no current prices', async () => {
      const mockSummary = [
        {
          stock_id: 's1',
          total_invested_czk: 10000,
          current_value_czk: 0, // No current price
          sector_name: 'Tech',
        },
      ];

      mockSelect.mockResolvedValueOnce({ data: mockSummary, error: null });
      mockSelect.mockResolvedValueOnce({ data: [], error: null });

      const result = await holdingsApi.getPortfolioTotals();

      expect(result.sectorDistribution[0].value).toBe(10000);
      expect(result.sectorDistribution[0].percentage).toBe(100);
    });

    it('should calculate correct percentage for unrealized gains', async () => {
      const mockSummary = [
        {
          stock_id: 's1',
          total_invested_czk: 1000,
          current_value_czk: 1500,
          sector_name: 'Tech',
        },
      ];

      mockSelect.mockResolvedValueOnce({ data: mockSummary, error: null });
      mockSelect.mockResolvedValueOnce({ data: [], error: null });

      const result = await holdingsApi.getPortfolioTotals();

      expect(result.totalUnrealizedGainPercentage).toBe(50);
    });
  });
});
