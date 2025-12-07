import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { optionsApi } from './options';
import { supabase } from '@/lib/supabase';
import type {
  OptionTransaction,
  OptionHolding,
  CreateOptionTransactionInput,
} from '@/types';

// Mock supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

// Helper to create mock chain
const createMockChain = (returnValue: unknown, isError = false) => {
  const chain: Record<string, Mock> = {};

  chain.select = vi.fn().mockReturnValue(chain);
  chain.insert = vi.fn().mockReturnValue(chain);
  chain.update = vi.fn().mockReturnValue(chain);
  chain.upsert = vi.fn().mockReturnValue(chain);
  chain.delete = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.order = vi.fn().mockReturnValue(chain);
  chain.single = vi
    .fn()
    .mockResolvedValue(
      isError
        ? { data: null, error: returnValue }
        : { data: returnValue, error: null }
    );

  // For queries without .single()
  chain.then = vi.fn((resolve) =>
    resolve(
      isError
        ? { data: null, error: returnValue }
        : { data: returnValue, error: null }
    )
  );

  return chain;
};

const mockTransaction: OptionTransaction = {
  id: 'tx-1',
  portfolio_id: 'portfolio-1',
  symbol: 'AAPL',
  option_symbol: 'AAPL250117C00200000',
  option_type: 'call',
  strike_price: 200,
  expiration_date: '2025-01-17',
  action: 'BTO',
  contracts: 1,
  premium: 5.5,
  total_premium: 550,
  currency: 'USD',
  fees: 0.65,
  date: '2024-12-01',
  notes: null,
  linked_stock_tx_id: null,
  created_at: '2024-12-01T10:00:00Z',
  updated_at: '2024-12-01T10:00:00Z',
};

const mockHolding: OptionHolding = {
  portfolio_id: 'portfolio-1',
  symbol: 'AAPL',
  option_symbol: 'AAPL250117C00200000',
  option_type: 'call',
  strike_price: 200,
  expiration_date: '2025-01-17',
  position: 'long',
  contracts: 1,
  avg_premium: 5.5,
  total_cost: 550,
  total_fees: 0.65,
  first_transaction: '2024-12-01',
  last_transaction: '2024-12-01',
  dte: 47,
  current_price: null,
  bid: null,
  ask: null,
  implied_volatility: null,
  delta: null,
  gamma: null,
  theta: null,
  vega: null,
  price_updated_at: null,
};

describe('optionsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // Transactions
  // ==========================================

  describe('getTransactions', () => {
    it('should get all transactions', async () => {
      const chain = createMockChain([mockTransaction]);
      (supabase.from as Mock).mockReturnValue(chain);

      const result = await optionsApi.getTransactions();

      expect(supabase.from).toHaveBeenCalledWith('option_transactions');
      expect(chain.select).toHaveBeenCalledWith('*');
      expect(chain.order).toHaveBeenCalledWith('date', { ascending: false });
      expect(result).toEqual([mockTransaction]);
    });

    it('should filter by portfolio_id when provided', async () => {
      const chain = createMockChain([mockTransaction]);
      (supabase.from as Mock).mockReturnValue(chain);

      await optionsApi.getTransactions('portfolio-1');

      expect(chain.eq).toHaveBeenCalledWith('portfolio_id', 'portfolio-1');
    });

    it('should return empty array when no transactions', async () => {
      const chain = createMockChain(null);
      (supabase.from as Mock).mockReturnValue(chain);

      const result = await optionsApi.getTransactions();

      expect(result).toEqual([]);
    });

    it('should throw on error', async () => {
      const chain = createMockChain({ message: 'Database error' }, true);
      (supabase.from as Mock).mockReturnValue(chain);

      await expect(optionsApi.getTransactions()).rejects.toEqual({
        message: 'Database error',
      });
    });
  });

  describe('getTransactionsBySymbol', () => {
    it('should filter by symbol', async () => {
      const chain = createMockChain([mockTransaction]);
      (supabase.from as Mock).mockReturnValue(chain);

      const result = await optionsApi.getTransactionsBySymbol('AAPL');

      expect(chain.eq).toHaveBeenCalledWith('symbol', 'AAPL');
      expect(result).toEqual([mockTransaction]);
    });

    it('should convert symbol to uppercase', async () => {
      const chain = createMockChain([]);
      (supabase.from as Mock).mockReturnValue(chain);

      await optionsApi.getTransactionsBySymbol('aapl');

      expect(chain.eq).toHaveBeenCalledWith('symbol', 'AAPL');
    });
  });

  describe('getTransactionById', () => {
    it('should get transaction by id', async () => {
      const chain = createMockChain(mockTransaction);
      (supabase.from as Mock).mockReturnValue(chain);

      const result = await optionsApi.getTransactionById('tx-1');

      expect(chain.eq).toHaveBeenCalledWith('id', 'tx-1');
      expect(chain.single).toHaveBeenCalled();
      expect(result).toEqual(mockTransaction);
    });
  });

  describe('createTransaction', () => {
    it('should create transaction with generated OCC symbol', async () => {
      const chain = createMockChain(mockTransaction);
      (supabase.from as Mock).mockReturnValue(chain);

      const input: CreateOptionTransactionInput = {
        portfolio_id: 'portfolio-1',
        symbol: 'aapl', // lowercase to test uppercase conversion
        option_type: 'call',
        strike_price: 200,
        expiration_date: '2025-01-17',
        action: 'BTO',
        contracts: 1,
        premium: 5.5,
        currency: 'USD',
        fees: 0.65,
        date: '2024-12-01',
      };

      const result = await optionsApi.createTransaction(input);

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          portfolio_id: 'portfolio-1',
          symbol: 'AAPL', // should be uppercase
          option_symbol: 'AAPL250117C00200000', // OCC format without padding
          option_type: 'call',
          strike_price: 200,
          action: 'BTO',
          contracts: 1,
          premium: 5.5,
        })
      );
      expect(result).toEqual(mockTransaction);
    });

    it('should handle null premium for EXPIRATION', async () => {
      const chain = createMockChain({
        ...mockTransaction,
        action: 'EXPIRATION',
        premium: null,
      });
      (supabase.from as Mock).mockReturnValue(chain);

      const input: CreateOptionTransactionInput = {
        portfolio_id: 'portfolio-1',
        symbol: 'AAPL',
        option_type: 'call',
        strike_price: 200,
        expiration_date: '2025-01-17',
        action: 'EXPIRATION',
        contracts: 1,
        date: '2025-01-17',
      };

      await optionsApi.createTransaction(input);

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          premium: null,
          action: 'EXPIRATION',
        })
      );
    });

    it('should default currency to USD', async () => {
      const chain = createMockChain(mockTransaction);
      (supabase.from as Mock).mockReturnValue(chain);

      const input: CreateOptionTransactionInput = {
        portfolio_id: 'portfolio-1',
        symbol: 'AAPL',
        option_type: 'call',
        strike_price: 200,
        expiration_date: '2025-01-17',
        action: 'BTO',
        contracts: 1,
        premium: 5.5,
        date: '2024-12-01',
      };

      await optionsApi.createTransaction(input);

      expect(chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'USD',
        })
      );
    });
  });

  describe('updateTransaction', () => {
    it('should update transaction', async () => {
      const updatedTx = { ...mockTransaction, notes: 'Updated note' };
      const chain = createMockChain(updatedTx);
      (supabase.from as Mock).mockReturnValue(chain);

      const result = await optionsApi.updateTransaction('tx-1', {
        notes: 'Updated note',
      });

      expect(chain.update).toHaveBeenCalledWith({ notes: 'Updated note' });
      expect(chain.eq).toHaveBeenCalledWith('id', 'tx-1');
      expect(result.notes).toBe('Updated note');
    });
  });

  describe('deleteTransaction', () => {
    it('should delete transaction', async () => {
      const chain = createMockChain(null);
      chain.then = vi.fn((resolve) => resolve({ error: null }));
      (supabase.from as Mock).mockReturnValue(chain);

      await optionsApi.deleteTransaction('tx-1');

      expect(chain.delete).toHaveBeenCalled();
      expect(chain.eq).toHaveBeenCalledWith('id', 'tx-1');
    });
  });

  // ==========================================
  // Holdings
  // ==========================================

  describe('getHoldings', () => {
    it('should get all holdings ordered by expiration', async () => {
      const chain = createMockChain([mockHolding]);
      (supabase.from as Mock).mockReturnValue(chain);

      const result = await optionsApi.getHoldings();

      expect(supabase.from).toHaveBeenCalledWith('option_holdings');
      expect(chain.order).toHaveBeenCalledWith('expiration_date', {
        ascending: true,
      });
      expect(result).toEqual([mockHolding]);
    });

    it('should filter by portfolio_id when provided', async () => {
      const chain = createMockChain([mockHolding]);
      (supabase.from as Mock).mockReturnValue(chain);

      await optionsApi.getHoldings('portfolio-1');

      expect(chain.eq).toHaveBeenCalledWith('portfolio_id', 'portfolio-1');
    });
  });

  describe('getHoldingsBySymbol', () => {
    it('should filter by symbol', async () => {
      const chain = createMockChain([mockHolding]);
      (supabase.from as Mock).mockReturnValue(chain);

      const result = await optionsApi.getHoldingsBySymbol('AAPL');

      expect(chain.eq).toHaveBeenCalledWith('symbol', 'AAPL');
      expect(result).toEqual([mockHolding]);
    });
  });

  describe('getHoldingByOptionSymbol', () => {
    it('should get holding by option_symbol', async () => {
      const chain = createMockChain(mockHolding);
      (supabase.from as Mock).mockReturnValue(chain);

      const result = await optionsApi.getHoldingByOptionSymbol(
        'AAPL250117C00200000',
        'portfolio-1'
      );

      expect(chain.eq).toHaveBeenCalledWith(
        'option_symbol',
        'AAPL250117C00200000'
      );
      expect(chain.eq).toHaveBeenCalledWith('portfolio_id', 'portfolio-1');
      expect(result).toEqual(mockHolding);
    });

    it('should return null when not found (PGRST116)', async () => {
      const chain = createMockChain({ code: 'PGRST116' }, true);
      (supabase.from as Mock).mockReturnValue(chain);

      const result = await optionsApi.getHoldingByOptionSymbol(
        'INVALID',
        'portfolio-1'
      );

      expect(result).toBeNull();
    });
  });

  // ==========================================
  // Prices
  // ==========================================

  describe('getPrice', () => {
    it('should get price for option symbol', async () => {
      const mockPrice = {
        option_symbol: 'AAPL250117C00200000',
        price: 6.5,
        bid: 6.4,
        ask: 6.6,
      };
      const chain = createMockChain(mockPrice);
      (supabase.from as Mock).mockReturnValue(chain);

      const result = await optionsApi.getPrice('AAPL250117C00200000');

      expect(supabase.from).toHaveBeenCalledWith('option_prices');
      expect(chain.eq).toHaveBeenCalledWith(
        'option_symbol',
        'AAPL250117C00200000'
      );
      expect(result).toEqual(mockPrice);
    });

    it('should return null when price not found', async () => {
      const chain = createMockChain({ code: 'PGRST116' }, true);
      (supabase.from as Mock).mockReturnValue(chain);

      const result = await optionsApi.getPrice('INVALID');

      expect(result).toBeNull();
    });
  });

  describe('getPrices', () => {
    it('should get prices for multiple options', async () => {
      const mockPrices = [
        { option_symbol: 'AAPL250117C00200000', price: 6.5 },
        { option_symbol: 'AAPL250117P00190000', price: 3.2 },
      ];
      const chain = createMockChain(mockPrices);
      (supabase.from as Mock).mockReturnValue(chain);

      const result = await optionsApi.getPrices([
        'AAPL250117C00200000',
        'AAPL250117P00190000',
      ]);

      expect(chain.in).toHaveBeenCalledWith('option_symbol', [
        'AAPL250117C00200000',
        'AAPL250117P00190000',
      ]);
      expect(result).toEqual(mockPrices);
    });

    it('should return empty array for empty input', async () => {
      const result = await optionsApi.getPrices([]);

      expect(supabase.from).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('upsertPrice', () => {
    it('should upsert price with Greeks', async () => {
      const mockPrice = {
        option_symbol: 'AAPL250117C00200000',
        price: 6.5,
        delta: 0.65,
        theta: -0.05,
      };
      const chain = createMockChain(mockPrice);
      (supabase.from as Mock).mockReturnValue(chain);

      const result = await optionsApi.upsertPrice({
        option_symbol: 'AAPL250117C00200000',
        price: 6.5,
        delta: 0.65,
        theta: -0.05,
      });

      expect(chain.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          option_symbol: 'AAPL250117C00200000',
          price: 6.5,
          delta: 0.65,
          theta: -0.05,
        }),
        { onConflict: 'option_symbol' }
      );
      expect(result).toEqual(mockPrice);
    });
  });

  // ==========================================
  // Assignment Helper
  // ==========================================

  describe('linkStockTransaction', () => {
    it('should link stock transaction to option transaction', async () => {
      const chain = createMockChain(null);
      chain.then = vi.fn((resolve) => resolve({ error: null }));
      (supabase.from as Mock).mockReturnValue(chain);

      await optionsApi.linkStockTransaction('opt-tx-1', 'stock-tx-1');

      expect(chain.update).toHaveBeenCalledWith({
        linked_stock_tx_id: 'stock-tx-1',
      });
      expect(chain.eq).toHaveBeenCalledWith('id', 'opt-tx-1');
    });
  });

  // ==========================================
  // Statistics
  // ==========================================

  describe('getStats', () => {
    it('should calculate portfolio statistics', async () => {
      // Create dates - one expiring in 3 days, one in 6 months
      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      const sixMonthsFromNow = new Date();
      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);

      const holdings: OptionHolding[] = [
        {
          ...mockHolding,
          position: 'long',
          total_cost: 550,
          expiration_date: threeDaysFromNow.toISOString().split('T')[0], // expires this week
        },
        {
          ...mockHolding,
          option_symbol: 'AAPL250117P00190000',
          position: 'short',
          total_cost: 300,
          expiration_date: sixMonthsFromNow.toISOString().split('T')[0], // does not expire this week
        },
      ];

      const chain = createMockChain(holdings);
      (supabase.from as Mock).mockReturnValue(chain);

      const result = await optionsApi.getStats();

      expect(result).toEqual({
        totalPositions: 2,
        longPositions: 1,
        shortPositions: 1,
        expiringThisWeek: 1,
        totalValue: 850,
      });
    });

    it('should handle empty holdings', async () => {
      const chain = createMockChain([]);
      (supabase.from as Mock).mockReturnValue(chain);

      const result = await optionsApi.getStats();

      expect(result).toEqual({
        totalPositions: 0,
        longPositions: 0,
        shortPositions: 0,
        expiringThisWeek: 0,
        totalValue: 0,
      });
    });
  });
});
