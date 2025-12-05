import { describe, it, expect, vi, beforeEach } from 'vitest';
import { stocksApi } from './stocks';

// Mock supabase
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockOr = vi.fn();
const mockSingle = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
}));

const mockGetUser = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: Parameters<typeof mockFrom>) => mockFrom(...args),
    auth: {
      getUser: () => mockGetUser(),
    },
  },
}));

describe('stocksApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default chain returns
    mockSelect.mockReturnValue({
      order: mockOrder,
      eq: mockEq,
      or: mockOr,
    });

    mockOrder.mockReturnValue({
      limit: mockLimit,
    });

    mockEq.mockReturnValue({
      single: mockSingle,
    });

    mockOr.mockReturnValue({
      order: mockOrder,
    });

    mockLimit.mockResolvedValue({
      data: [],
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

    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
  });

  describe('getAll', () => {
    it('should fetch all stocks with sector info', async () => {
      const mockStocks = [
        {
          id: '1',
          ticker: 'AAPL',
          name: 'Apple',
          sectors: { name: 'Technology' },
        },
        {
          id: '2',
          ticker: 'MSFT',
          name: 'Microsoft',
          sectors: { name: 'Technology' },
        },
      ];

      mockOrder.mockResolvedValueOnce({
        data: mockStocks,
        error: null,
      });

      const result = await stocksApi.getAll();

      expect(mockFrom).toHaveBeenCalledWith('stocks');
      expect(result).toHaveLength(2);
      expect(result[0].sector_name).toBe('Technology');
    });

    it('should return empty array when no stocks', async () => {
      mockOrder.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await stocksApi.getAll();
      expect(result).toEqual([]);
    });

    it('should handle stocks without sector', async () => {
      const mockStocks = [
        { id: '1', ticker: 'AAPL', name: 'Apple', sectors: null },
      ];

      mockOrder.mockResolvedValueOnce({
        data: mockStocks,
        error: null,
      });

      const result = await stocksApi.getAll();
      expect(result[0].sector_name).toBeNull();
    });

    it('should throw error on database error', async () => {
      mockOrder.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(stocksApi.getAll()).rejects.toEqual({
        message: 'Database error',
      });
    });
  });

  describe('getById', () => {
    it('should fetch stock by ID with sector', async () => {
      const mockStock = {
        id: '1',
        ticker: 'AAPL',
        name: 'Apple',
        sectors: { name: 'Technology' },
      };

      mockSingle.mockResolvedValue({
        data: mockStock,
        error: null,
      });

      const result = await stocksApi.getById('1');

      expect(mockFrom).toHaveBeenCalledWith('stocks');
      expect(mockEq).toHaveBeenCalledWith('id', '1');
      expect(result?.ticker).toBe('AAPL');
      expect(result?.sector_name).toBe('Technology');
    });

    it('should return null when stock not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await stocksApi.getById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getByTicker', () => {
    it('should fetch stock by ticker (case insensitive)', async () => {
      const mockStock = {
        id: '1',
        ticker: 'AAPL',
        name: 'Apple',
        sectors: { name: 'Technology' },
      };

      mockSingle.mockResolvedValue({
        data: mockStock,
        error: null,
      });

      const result = await stocksApi.getByTicker('aapl');

      expect(mockEq).toHaveBeenCalledWith('ticker', 'AAPL');
      expect(result?.ticker).toBe('AAPL');
    });

    it('should return null when ticker not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await stocksApi.getByTicker('UNKNOWN');
      expect(result).toBeNull();
    });

    it('should throw on other errors', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'OTHER', message: 'Error' },
      });

      await expect(stocksApi.getByTicker('AAPL')).rejects.toEqual({
        code: 'OTHER',
        message: 'Error',
      });
    });
  });

  describe('create', () => {
    it('should create a new stock with uppercase ticker', async () => {
      const newStock = {
        id: '1',
        ticker: 'AAPL',
        name: 'Apple Inc.',
        user_id: 'user-123',
      };

      mockSingle.mockResolvedValue({
        data: newStock,
        error: null,
      });

      const result = await stocksApi.create({
        ticker: 'aapl',
        name: 'Apple Inc.',
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(result.ticker).toBe('AAPL');
    });

    it('should throw when user not authenticated', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(
        stocksApi.create({ ticker: 'AAPL', name: 'Apple' })
      ).rejects.toThrow('User not authenticated');
    });

    it('should throw on insert error', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Duplicate ticker' },
      });

      await expect(
        stocksApi.create({ ticker: 'AAPL', name: 'Apple' })
      ).rejects.toEqual({ message: 'Duplicate ticker' });
    });
  });

  describe('update', () => {
    it('should update a stock', async () => {
      const updatedStock = {
        id: '1',
        ticker: 'AAPL',
        name: 'Apple Inc. Updated',
      };

      mockEq.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: updatedStock,
            error: null,
          }),
        }),
      });

      const result = await stocksApi.update('1', {
        name: 'Apple Inc. Updated',
      });

      expect(mockUpdate).toHaveBeenCalledWith({ name: 'Apple Inc. Updated' });
      expect(result.name).toBe('Apple Inc. Updated');
    });

    it('should uppercase ticker on update', async () => {
      const updatedStock = { id: '1', ticker: 'GOOG', name: 'Google' };

      mockEq.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: updatedStock,
            error: null,
          }),
        }),
      });

      await stocksApi.update('1', { ticker: 'goog' });

      expect(mockUpdate).toHaveBeenCalledWith({ ticker: 'GOOG' });
    });
  });

  describe('delete', () => {
    it('should delete a stock', async () => {
      mockEq.mockResolvedValue({
        data: null,
        error: null,
      });

      await stocksApi.delete('1');

      expect(mockFrom).toHaveBeenCalledWith('stocks');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', '1');
    });

    it('should throw on error', async () => {
      mockEq.mockResolvedValue({
        data: null,
        error: { message: 'Foreign key constraint' },
      });

      await expect(stocksApi.delete('1')).rejects.toEqual({
        message: 'Foreign key constraint',
      });
    });
  });

  describe('search', () => {
    it('should search stocks by ticker or name', async () => {
      const mockStocks = [
        { id: '1', ticker: 'AAPL', name: 'Apple', sectors: { name: 'Tech' } },
      ];

      mockLimit.mockResolvedValueOnce({
        data: mockStocks,
        error: null,
      });

      const result = await stocksApi.search('appl');

      expect(mockOr).toHaveBeenCalledWith(
        'ticker.ilike.%appl%,name.ilike.%appl%'
      );
      expect(result).toHaveLength(1);
      expect(result[0].sector_name).toBe('Tech');
    });

    it('should return empty array when no matches', async () => {
      mockLimit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const result = await stocksApi.search('xyz');
      expect(result).toEqual([]);
    });

    it('should limit results to 10', async () => {
      mockLimit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await stocksApi.search('a');

      expect(mockLimit).toHaveBeenCalledWith(10);
    });
  });
});
