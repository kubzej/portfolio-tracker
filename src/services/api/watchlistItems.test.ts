import { describe, it, expect, vi, beforeEach } from 'vitest';
import { watchlistItemsApi } from './watchlistItems';

// Mock supabase
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();
const mockOrder = vi.fn();
const mockInvoke = vi.fn();

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

describe('watchlistItemsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSelect.mockReturnValue({
      eq: mockEq,
      order: mockOrder,
    });

    mockOrder.mockResolvedValue({
      data: [],
      error: null,
    });

    mockEq.mockReturnValue({
      eq: mockEq,
      single: mockSingle,
      maybeSingle: mockMaybeSingle,
      order: mockOrder,
    });

    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });

    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: mockSingle,
      }),
    });

    mockUpdate.mockReturnValue({
      eq: mockEq,
    });

    mockDelete.mockReturnValue({
      eq: mockEq,
    });
  });

  describe('getByWatchlistId', () => {
    it('should fetch items for a watchlist with calculations', async () => {
      const mockItems = [
        {
          id: '1',
          ticker: 'AAPL',
          last_price: 180,
          target_buy_price: 150,
          target_sell_price: 200,
        },
      ];

      mockOrder.mockResolvedValueOnce({
        data: mockItems,
        error: null,
      });

      const result = await watchlistItemsApi.getByWatchlistId('wl-1');

      expect(mockFrom).toHaveBeenCalledWith('watchlist_items');
      expect(mockEq).toHaveBeenCalledWith('watchlist_id', 'wl-1');
      expect(result).toHaveLength(1);
      expect(result[0].at_buy_target).toBe(false); // 180 > 150
      expect(result[0].at_sell_target).toBe(false); // 180 < 200
    });

    it('should calculate at_buy_target correctly', async () => {
      const mockItems = [
        {
          id: '1',
          ticker: 'AAPL',
          last_price: 140, // Below target buy price
          target_buy_price: 150,
          target_sell_price: null,
        },
      ];

      mockOrder.mockResolvedValueOnce({
        data: mockItems,
        error: null,
      });

      const result = await watchlistItemsApi.getByWatchlistId('wl-1');

      expect(result[0].at_buy_target).toBe(true);
    });

    it('should calculate at_sell_target correctly', async () => {
      const mockItems = [
        {
          id: '1',
          ticker: 'AAPL',
          last_price: 210, // Above target sell price
          target_buy_price: null,
          target_sell_price: 200,
        },
      ];

      mockOrder.mockResolvedValueOnce({
        data: mockItems,
        error: null,
      });

      const result = await watchlistItemsApi.getByWatchlistId('wl-1');

      expect(result[0].at_sell_target).toBe(true);
    });

    it('should return empty array when no items', async () => {
      mockOrder.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await watchlistItemsApi.getByWatchlistId('wl-1');
      expect(result).toEqual([]);
    });
  });

  describe('getById', () => {
    it('should fetch item by ID', async () => {
      const mockItem = { id: '1', ticker: 'AAPL', last_price: 180 };

      mockSingle.mockResolvedValue({
        data: mockItem,
        error: null,
      });

      const result = await watchlistItemsApi.getById('1');

      expect(mockEq).toHaveBeenCalledWith('id', '1');
      expect(result?.ticker).toBe('AAPL');
    });

    it('should return null when not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await watchlistItemsApi.getById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('existsInWatchlist', () => {
    it('should return true when ticker exists', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { id: '1' },
        error: null,
      });

      const result = await watchlistItemsApi.existsInWatchlist('wl-1', 'AAPL');

      expect(result).toBe(true);
    });

    it('should return false when ticker not found', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await watchlistItemsApi.existsInWatchlist(
        'wl-1',
        'UNKNOWN'
      );

      expect(result).toBe(false);
    });

    it('should uppercase ticker for comparison', async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      await watchlistItemsApi.existsInWatchlist('wl-1', 'aapl');

      expect(mockEq).toHaveBeenCalledWith('ticker', 'AAPL');
    });
  });

  describe('add', () => {
    it('should add item to watchlist', async () => {
      const newItem = {
        id: '1',
        watchlist_id: 'wl-1',
        ticker: 'AAPL',
        name: 'Apple Inc.',
      };

      mockSingle.mockResolvedValue({
        data: newItem,
        error: null,
      });

      const result = await watchlistItemsApi.add({
        watchlist_id: 'wl-1',
        ticker: 'aapl',
        name: 'Apple Inc.',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          ticker: 'AAPL', // Uppercased
        })
      );
      expect(result.ticker).toBe('AAPL');
    });

    it('should throw on duplicate ticker', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: '23505' },
      });

      await expect(
        watchlistItemsApi.add({
          watchlist_id: 'wl-1',
          ticker: 'AAPL',
        })
      ).rejects.toThrow('AAPL is already in this watchlist');
    });
  });

  describe('update', () => {
    it('should update item', async () => {
      const updatedItem = { id: '1', notes: 'Updated notes' };

      mockEq.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: updatedItem,
            error: null,
          }),
        }),
      });

      const result = await watchlistItemsApi.update('1', {
        notes: 'Updated notes',
      });

      expect(mockUpdate).toHaveBeenCalledWith({ notes: 'Updated notes' });
      expect(result.notes).toBe('Updated notes');
    });
  });

  describe('refreshPrices', () => {
    it('should call edge function for all watchlists', async () => {
      mockInvoke.mockResolvedValue({
        data: { updated: 10, failed: 0, errors: [] },
        error: null,
      });

      const result = await watchlistItemsApi.refreshPrices();

      expect(mockInvoke).toHaveBeenCalledWith('fetch-watchlist-prices', {
        body: {},
      });
      expect(result.updated).toBe(10);
    });

    it('should filter by watchlist ID', async () => {
      mockInvoke.mockResolvedValue({
        data: { updated: 5, failed: 0, errors: [] },
        error: null,
      });

      await watchlistItemsApi.refreshPrices('wl-1');

      expect(mockInvoke).toHaveBeenCalledWith('fetch-watchlist-prices', {
        body: { watchlist_id: 'wl-1' },
      });
    });

    it('should throw on edge function error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Price fetch error' },
      });

      await expect(watchlistItemsApi.refreshPrices()).rejects.toThrow(
        'Price fetch error'
      );
    });
  });

  describe('updatePrice', () => {
    it('should update price for an item', async () => {
      mockEq.mockResolvedValue({
        data: null,
        error: null,
      });

      await watchlistItemsApi.updatePrice('1', 185.5, 2.5, 1.36);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          last_price: 185.5,
          last_price_change: 2.5,
          last_price_change_percent: 1.36,
        })
      );
    });
  });

  describe('remove', () => {
    it('should remove item from watchlist', async () => {
      mockEq.mockResolvedValue({
        data: null,
        error: null,
      });

      await watchlistItemsApi.remove('1');

      expect(mockFrom).toHaveBeenCalledWith('watchlist_items');
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe('getAllItems', () => {
    it('should fetch all items across watchlists', async () => {
      const mockItems = [
        { id: '1', ticker: 'AAPL' },
        { id: '2', ticker: 'MSFT' },
      ];

      mockOrder.mockResolvedValueOnce({
        data: mockItems,
        error: null,
      });

      const result = await watchlistItemsApi.getAllItems();

      expect(mockOrder).toHaveBeenCalledWith('ticker');
      expect(result).toEqual(mockItems);
    });
  });

  describe('getUniqueTickers', () => {
    it('should return unique tickers', async () => {
      const mockItems = [
        { ticker: 'AAPL' },
        { ticker: 'MSFT' },
        { ticker: 'AAPL' }, // Duplicate
      ];

      mockOrder.mockResolvedValueOnce({
        data: mockItems,
        error: null,
      });

      const result = await watchlistItemsApi.getUniqueTickers();

      expect(result).toHaveLength(2);
      expect(result).toContain('AAPL');
      expect(result).toContain('MSFT');
    });
  });
});
