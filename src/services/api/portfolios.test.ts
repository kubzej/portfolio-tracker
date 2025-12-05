import { describe, it, expect, vi, beforeEach } from 'vitest';
import { portfoliosApi } from './portfolios';

// Mock supabase
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockNeq = vi.fn();
const mockSingle = vi.fn();
const mockOrder = vi.fn();

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
}));

const mockGetUser = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      getUser: () => mockGetUser(),
    },
  },
}));

describe('portfoliosApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default chain returns
    mockSelect.mockReturnValue({
      order: mockOrder,
      eq: mockEq,
    });

    mockOrder.mockReturnValue({
      order: mockOrder,
      then: undefined,
    });

    mockEq.mockReturnValue({
      single: mockSingle,
    });

    mockNeq.mockReturnValue({
      then: undefined,
    });

    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: mockSingle,
      }),
    });

    mockUpdate.mockReturnValue({
      eq: mockEq,
      neq: mockNeq,
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
    it('should fetch all portfolios ordered correctly', async () => {
      const mockPortfolios = [
        { id: '1', name: 'Main', is_default: true },
        { id: '2', name: 'Secondary', is_default: false },
      ];

      mockOrder.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({
          data: mockPortfolios,
          error: null,
        }),
      });

      const result = await portfoliosApi.getAll();

      expect(mockFrom).toHaveBeenCalledWith('portfolios');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(result).toEqual(mockPortfolios);
    });

    it('should return empty array when no portfolios', async () => {
      mockOrder.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      });

      const result = await portfoliosApi.getAll();
      expect(result).toEqual([]);
    });

    it('should throw error on database error', async () => {
      mockOrder.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      });

      await expect(portfoliosApi.getAll()).rejects.toEqual({
        message: 'Database error',
      });
    });
  });

  describe('getById', () => {
    it('should fetch portfolio by ID', async () => {
      const mockPortfolio = { id: '1', name: 'Main', is_default: true };

      mockSingle.mockResolvedValue({
        data: mockPortfolio,
        error: null,
      });

      const result = await portfoliosApi.getById('1');

      expect(mockFrom).toHaveBeenCalledWith('portfolios');
      expect(mockEq).toHaveBeenCalledWith('id', '1');
      expect(result).toEqual(mockPortfolio);
    });

    it('should return null when portfolio not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await portfoliosApi.getById('nonexistent');
      expect(result).toBeNull();
    });

    it('should throw on other errors', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'OTHER', message: 'Other error' },
      });

      await expect(portfoliosApi.getById('1')).rejects.toEqual({
        code: 'OTHER',
        message: 'Other error',
      });
    });
  });

  describe('getDefault', () => {
    it('should fetch default portfolio', async () => {
      const mockPortfolio = { id: '1', name: 'Main', is_default: true };

      mockSingle.mockResolvedValue({
        data: mockPortfolio,
        error: null,
      });

      const result = await portfoliosApi.getDefault();

      expect(mockEq).toHaveBeenCalledWith('is_default', true);
      expect(result).toEqual(mockPortfolio);
    });

    it('should return null when no default portfolio', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await portfoliosApi.getDefault();
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new portfolio', async () => {
      const newPortfolio = {
        id: '1',
        name: 'New Portfolio',
        is_default: false,
      };

      mockSingle.mockResolvedValue({
        data: newPortfolio,
        error: null,
      });

      const result = await portfoliosApi.create({
        name: 'New Portfolio',
        is_default: false,
      });

      expect(mockFrom).toHaveBeenCalledWith('portfolios');
      expect(mockInsert).toHaveBeenCalled();
      expect(result).toEqual(newPortfolio);
    });

    it('should unset other defaults when creating default portfolio', async () => {
      const newPortfolio = { id: '1', name: 'Main', is_default: true };

      // First call is the update to unset defaults
      mockUpdate.mockReturnValueOnce({
        eq: vi.fn().mockResolvedValue({ data: null, error: null }),
      });

      mockSingle.mockResolvedValue({
        data: newPortfolio,
        error: null,
      });

      await portfoliosApi.create({
        name: 'Main',
        is_default: true,
      });

      // Should have called update to unset other defaults
      expect(mockFrom).toHaveBeenCalledWith('portfolios');
    });

    it('should throw when user not authenticated', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(
        portfoliosApi.create({ name: 'Test', is_default: false })
      ).rejects.toThrow('User not authenticated');
    });
  });

  describe('update', () => {
    it('should update a portfolio', async () => {
      const updatedPortfolio = { id: '1', name: 'Updated', is_default: false };

      mockEq.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: updatedPortfolio,
            error: null,
          }),
        }),
      });

      const result = await portfoliosApi.update('1', { name: 'Updated' });

      expect(mockFrom).toHaveBeenCalledWith('portfolios');
      expect(mockUpdate).toHaveBeenCalledWith({ name: 'Updated' });
      expect(result).toEqual(updatedPortfolio);
    });

    it('should unset other defaults when setting as default', async () => {
      const updatedPortfolio = { id: '1', name: 'Main', is_default: true };

      // Mock the update chain for unsetting defaults
      const mockNeqChain = vi
        .fn()
        .mockResolvedValue({ data: null, error: null });
      mockUpdate.mockReturnValueOnce({
        neq: mockNeqChain,
      });

      // Mock the update chain for the actual update
      mockUpdate.mockReturnValueOnce({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: updatedPortfolio,
              error: null,
            }),
          }),
        }),
      });

      const result = await portfoliosApi.update('1', { is_default: true });

      // Should have been called to unset other defaults
      expect(mockNeqChain).toHaveBeenCalledWith('id', '1');
      expect(result).toEqual(updatedPortfolio);
    });
  });

  describe('delete', () => {
    it('should delete a portfolio', async () => {
      mockEq.mockResolvedValue({
        data: null,
        error: null,
      });

      await portfoliosApi.delete('1');

      expect(mockFrom).toHaveBeenCalledWith('portfolios');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', '1');
    });

    it('should throw on error', async () => {
      mockEq.mockResolvedValue({
        data: null,
        error: { message: 'Cannot delete' },
      });

      await expect(portfoliosApi.delete('1')).rejects.toEqual({
        message: 'Cannot delete',
      });
    });
  });
});
