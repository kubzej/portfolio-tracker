import { describe, it, expect, vi, beforeEach } from 'vitest';
import { transactionsApi } from './transactions';

// Mock supabase
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockNot = vi.fn();
const mockGte = vi.fn();
const mockLte = vi.fn();
const mockSingle = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: Parameters<typeof mockFrom>) => mockFrom(...args),
  },
}));

describe('transactionsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default chain returns
    mockSelect.mockReturnValue({
      order: mockOrder,
      eq: mockEq,
      gte: mockGte,
    });

    mockOrder.mockReturnValue({
      limit: mockLimit,
      eq: mockEq,
    });

    mockEq.mockReturnValue({
      eq: mockEq,
      order: mockOrder,
      single: mockSingle,
      not: mockNot,
    });

    mockGte.mockReturnValue({
      lte: mockLte,
    });

    mockLte.mockReturnValue({
      order: mockOrder,
    });

    mockNot.mockResolvedValue({
      data: [],
      error: null,
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
  });

  describe('getAll', () => {
    it('should fetch all transactions with stock info', async () => {
      const mockTransactions = [
        {
          id: '1',
          type: 'BUY',
          quantity: 10,
          stock: { ticker: 'AAPL', name: 'Apple' },
        },
      ];

      mockOrder.mockResolvedValueOnce({
        data: mockTransactions,
        error: null,
      });

      const result = await transactionsApi.getAll();

      expect(mockFrom).toHaveBeenCalledWith('transactions');
      expect(result).toEqual(mockTransactions);
    });

    it('should filter by portfolio ID', async () => {
      mockEq.mockReturnValue({
        data: [],
        error: null,
      });

      mockOrder.mockReturnValue({
        eq: mockEq,
      });

      await transactionsApi.getAll('portfolio-1');

      expect(mockEq).toHaveBeenCalledWith('portfolio_id', 'portfolio-1');
    });

    it('should return empty array when no transactions', async () => {
      mockOrder.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await transactionsApi.getAll();
      expect(result).toEqual([]);
    });
  });

  describe('getByStockId', () => {
    it('should fetch transactions for a specific stock', async () => {
      const mockTransactions = [
        { id: '1', stock_id: 's1', type: 'BUY', quantity: 10 },
      ];

      mockOrder.mockResolvedValueOnce({
        data: mockTransactions,
        error: null,
      });

      const result = await transactionsApi.getByStockId('s1');

      expect(mockEq).toHaveBeenCalledWith('stock_id', 's1');
      expect(result).toEqual(mockTransactions);
    });

    it('should filter by portfolio and stock', async () => {
      // The chain is: select -> eq(stock_id) -> order -> eq(portfolio_id) -> await
      const mockPortfolioEq = vi
        .fn()
        .mockResolvedValue({ data: [], error: null });

      mockOrder.mockReturnValueOnce({
        eq: mockPortfolioEq,
      });

      await transactionsApi.getByStockId('s1', 'p1');

      expect(mockEq).toHaveBeenCalledWith('stock_id', 's1');
      expect(mockPortfolioEq).toHaveBeenCalledWith('portfolio_id', 'p1');
    });
  });

  describe('getById', () => {
    it('should fetch transaction by ID', async () => {
      const mockTransaction = {
        id: '1',
        type: 'BUY',
        stock: { ticker: 'AAPL' },
      };

      mockSingle.mockResolvedValue({
        data: mockTransaction,
        error: null,
      });

      const result = await transactionsApi.getById('1');

      expect(mockEq).toHaveBeenCalledWith('id', '1');
      expect(result).toEqual(mockTransaction);
    });
  });

  describe('create', () => {
    it('should create a BUY transaction', async () => {
      const newTransaction = {
        id: '1',
        stock_id: 's1',
        portfolio_id: 'p1',
        type: 'BUY',
        quantity: 10,
        price_per_share: 150,
      };

      mockSingle.mockResolvedValue({
        data: newTransaction,
        error: null,
      });

      const result = await transactionsApi.create({
        stock_id: 's1',
        portfolio_id: 'p1',
        date: '2024-01-15',
        type: 'BUY',
        quantity: 10,
        price_per_share: 150,
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(result).toEqual(newTransaction);
    });

    it('should create a SELL transaction with source', async () => {
      const newTransaction = {
        id: '2',
        type: 'SELL',
        source_transaction_id: '1',
      };

      mockSingle.mockResolvedValue({
        data: newTransaction,
        error: null,
      });

      await transactionsApi.create({
        stock_id: 's1',
        portfolio_id: 'p1',
        date: '2024-01-20',
        type: 'SELL',
        quantity: 5,
        price_per_share: 160,
        source_transaction_id: '1',
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          source_transaction_id: '1',
        })
      );
    });

    it('should use default currency USD', async () => {
      mockSingle.mockResolvedValue({
        data: { id: '1' },
        error: null,
      });

      await transactionsApi.create({
        stock_id: 's1',
        portfolio_id: 'p1',
        date: '2024-01-15',
        type: 'BUY',
        quantity: 10,
        price_per_share: 100,
      });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'USD',
        })
      );
    });

    it('should throw on error', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' },
      });

      await expect(
        transactionsApi.create({
          stock_id: 's1',
          portfolio_id: 'p1',
          date: '2024-01-15',
          type: 'BUY',
          quantity: 10,
          price_per_share: 100,
        })
      ).rejects.toEqual({ message: 'Insert failed' });
    });
  });

  describe('update', () => {
    it('should update a transaction', async () => {
      const updatedTransaction = { id: '1', quantity: 15 };

      mockEq.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: updatedTransaction,
            error: null,
          }),
        }),
      });

      const result = await transactionsApi.update('1', { quantity: 15 });

      expect(mockUpdate).toHaveBeenCalledWith({ quantity: 15 });
      expect(result).toEqual(updatedTransaction);
    });
  });

  describe('delete', () => {
    it('should delete a transaction', async () => {
      mockEq.mockResolvedValue({
        data: null,
        error: null,
      });

      await transactionsApi.delete('1');

      expect(mockFrom).toHaveBeenCalledWith('transactions');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', '1');
    });

    it('should throw on error', async () => {
      mockEq.mockResolvedValue({
        data: null,
        error: { message: 'Cannot delete' },
      });

      await expect(transactionsApi.delete('1')).rejects.toEqual({
        message: 'Cannot delete',
      });
    });
  });

  describe('getByDateRange', () => {
    it('should fetch transactions within date range', async () => {
      const mockTransactions = [
        { id: '1', date: '2024-01-15' },
        { id: '2', date: '2024-01-20' },
      ];

      mockOrder.mockResolvedValueOnce({
        data: mockTransactions,
        error: null,
      });

      const result = await transactionsApi.getByDateRange(
        '2024-01-01',
        '2024-01-31'
      );

      expect(mockGte).toHaveBeenCalledWith('date', '2024-01-01');
      expect(mockLte).toHaveBeenCalledWith('date', '2024-01-31');
      expect(result).toEqual(mockTransactions);
    });
  });

  describe('getRecent', () => {
    it('should fetch recent transactions with default limit', async () => {
      mockLimit.mockResolvedValueOnce({
        data: [{ id: '1' }],
        error: null,
      });

      await transactionsApi.getRecent();

      expect(mockLimit).toHaveBeenCalledWith(10);
    });

    it('should fetch recent transactions with custom limit', async () => {
      mockLimit.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await transactionsApi.getRecent(5);

      expect(mockLimit).toHaveBeenCalledWith(5);
    });
  });

  describe('getAvailableLots', () => {
    it('should return available lots with remaining shares', async () => {
      const buyTransactions = [
        {
          id: 'buy1',
          date: '2024-01-01',
          quantity: 10,
          price_per_share: 100,
          currency: 'USD',
          total_amount: 1000,
        },
        {
          id: 'buy2',
          date: '2024-01-15',
          quantity: 5,
          price_per_share: 110,
          currency: 'USD',
          total_amount: 550,
        },
      ];

      const sellTransactions = [{ source_transaction_id: 'buy1', quantity: 3 }];

      // First call: BUY transactions
      mockOrder.mockResolvedValueOnce({
        data: buyTransactions,
        error: null,
      });

      // Second call: SELL transactions
      mockNot.mockResolvedValueOnce({
        data: sellTransactions,
        error: null,
      });

      const result = await transactionsApi.getAvailableLots('s1', 'p1');

      expect(result).toHaveLength(2);
      expect(result[0].remaining_shares).toBe(7); // 10 - 3
      expect(result[1].remaining_shares).toBe(5); // 5 - 0
    });

    it('should exclude fully sold lots', async () => {
      const buyTransactions = [
        {
          id: 'buy1',
          date: '2024-01-01',
          quantity: 10,
          price_per_share: 100,
          currency: 'USD',
          total_amount: 1000,
        },
      ];

      const sellTransactions = [
        { source_transaction_id: 'buy1', quantity: 10 }, // Fully sold
      ];

      mockOrder.mockResolvedValueOnce({
        data: buyTransactions,
        error: null,
      });

      mockNot.mockResolvedValueOnce({
        data: sellTransactions,
        error: null,
      });

      const result = await transactionsApi.getAvailableLots('s1', 'p1');

      expect(result).toHaveLength(0);
    });

    it('should handle multiple sells from same lot', async () => {
      const buyTransactions = [
        {
          id: 'buy1',
          date: '2024-01-01',
          quantity: 20,
          price_per_share: 100,
          currency: 'USD',
          total_amount: 2000,
        },
      ];

      const sellTransactions = [
        { source_transaction_id: 'buy1', quantity: 5 },
        { source_transaction_id: 'buy1', quantity: 3 },
        { source_transaction_id: 'buy1', quantity: 2 },
      ];

      mockOrder.mockResolvedValueOnce({
        data: buyTransactions,
        error: null,
      });

      mockNot.mockResolvedValueOnce({
        data: sellTransactions,
        error: null,
      });

      const result = await transactionsApi.getAvailableLots('s1', 'p1');

      expect(result[0].remaining_shares).toBe(10); // 20 - (5+3+2)
    });
  });

  describe('getTotalAvailableShares', () => {
    it('should sum remaining shares across all lots', async () => {
      const buyTransactions = [
        {
          id: 'buy1',
          date: '2024-01-01',
          quantity: 10,
          price_per_share: 100,
          currency: 'USD',
          total_amount: 1000,
        },
        {
          id: 'buy2',
          date: '2024-01-15',
          quantity: 15,
          price_per_share: 110,
          currency: 'USD',
          total_amount: 1650,
        },
      ];

      mockOrder.mockResolvedValueOnce({
        data: buyTransactions,
        error: null,
      });

      mockNot.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const result = await transactionsApi.getTotalAvailableShares('s1', 'p1');

      expect(result).toBe(25);
    });

    it('should return 0 when no lots available', async () => {
      mockOrder.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      mockNot.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const result = await transactionsApi.getTotalAvailableShares('s1', 'p1');

      expect(result).toBe(0);
    });
  });
});
