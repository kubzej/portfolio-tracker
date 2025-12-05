import { describe, it, expect, vi, beforeEach } from 'vitest';
import { watchlistsApi } from './watchlists';

// Mock supabase
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
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
    from: (...args: Parameters<typeof mockFrom>) => mockFrom(...args),
    auth: {
      getUser: () => mockGetUser(),
    },
  },
}));

describe('watchlistsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSelect.mockReturnValue({
      order: mockOrder,
      eq: mockEq,
    });

    mockOrder.mockResolvedValue({
      data: [],
      error: null,
    });

    mockEq.mockReturnValue({
      single: mockSingle,
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
    it('should fetch all watchlists ordered by name', async () => {
      const mockWatchlists = [
        { id: '1', name: 'Growth Stocks' },
        { id: '2', name: 'Value Plays' },
      ];

      mockOrder.mockResolvedValueOnce({
        data: mockWatchlists,
        error: null,
      });

      const result = await watchlistsApi.getAll();

      expect(mockFrom).toHaveBeenCalledWith('watchlists');
      expect(mockOrder).toHaveBeenCalledWith('name');
      expect(result).toEqual(mockWatchlists);
    });

    it('should return empty array when no watchlists', async () => {
      mockOrder.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await watchlistsApi.getAll();
      expect(result).toEqual([]);
    });
  });

  describe('getAllWithSummary', () => {
    it('should fetch watchlists with item counts', async () => {
      const mockSummary = [{ id: '1', name: 'Growth Stocks', item_count: 5 }];

      mockOrder.mockResolvedValueOnce({
        data: mockSummary,
        error: null,
      });

      const result = await watchlistsApi.getAllWithSummary();

      expect(mockFrom).toHaveBeenCalledWith('watchlist_summary');
      expect(result).toEqual(mockSummary);
    });
  });

  describe('getById', () => {
    it('should fetch watchlist by ID', async () => {
      const mockWatchlist = { id: '1', name: 'My Watchlist' };

      mockSingle.mockResolvedValue({
        data: mockWatchlist,
        error: null,
      });

      const result = await watchlistsApi.getById('1');

      expect(mockEq).toHaveBeenCalledWith('id', '1');
      expect(result).toEqual(mockWatchlist);
    });

    it('should return null when not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await watchlistsApi.getById('nonexistent');
      expect(result).toBeNull();
    });

    it('should throw on other errors', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'OTHER', message: 'Error' },
      });

      await expect(watchlistsApi.getById('1')).rejects.toEqual({
        code: 'OTHER',
        message: 'Error',
      });
    });
  });

  describe('create', () => {
    it('should create a new watchlist', async () => {
      const newWatchlist = { id: '1', name: 'Tech Stocks' };

      mockSingle.mockResolvedValue({
        data: newWatchlist,
        error: null,
      });

      const result = await watchlistsApi.create({ name: 'Tech Stocks' });

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Tech Stocks',
          user_id: 'user-123',
        })
      );
      expect(result).toEqual(newWatchlist);
    });

    it('should throw when not authenticated', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(watchlistsApi.create({ name: 'Test' })).rejects.toThrow(
        'User not authenticated'
      );
    });
  });

  describe('update', () => {
    it('should update a watchlist', async () => {
      const updatedWatchlist = { id: '1', name: 'Updated Name' };

      mockEq.mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: updatedWatchlist,
            error: null,
          }),
        }),
      });

      const result = await watchlistsApi.update('1', { name: 'Updated Name' });

      expect(mockUpdate).toHaveBeenCalledWith({ name: 'Updated Name' });
      expect(result).toEqual(updatedWatchlist);
    });
  });

  describe('delete', () => {
    it('should delete a watchlist', async () => {
      mockEq.mockResolvedValue({
        data: null,
        error: null,
      });

      await watchlistsApi.delete('1');

      expect(mockFrom).toHaveBeenCalledWith('watchlists');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', '1');
    });

    it('should throw on error', async () => {
      mockEq.mockResolvedValue({
        data: null,
        error: { message: 'Cannot delete' },
      });

      await expect(watchlistsApi.delete('1')).rejects.toEqual({
        message: 'Cannot delete',
      });
    });
  });
});
