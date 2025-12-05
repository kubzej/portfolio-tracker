import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getAllIndicators,
  getUserViews,
  createView,
  updateView,
  deleteView,
  updateViewColumns,
  formatLargeNumber,
  DEFAULT_INDICATOR_KEYS,
} from './indicators';

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
    from: (...args: Parameters<typeof mockFrom>) => mockFrom(...args),
    auth: {
      getUser: () => mockGetUser(),
    },
  },
}));

describe('indicators', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSelect.mockReturnValue({
      order: mockOrder,
    });

    mockOrder.mockReturnValue({
      order: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    });

    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: mockSingle,
      }),
    });

    mockUpdate.mockReturnValue({
      eq: mockEq,
    });

    mockEq.mockReturnValue({
      eq: mockEq,
      neq: mockNeq,
      select: vi.fn().mockReturnValue({
        single: mockSingle,
      }),
    });

    mockNeq.mockResolvedValue({ data: null, error: null });

    mockDelete.mockReturnValue({
      eq: mockEq,
    });

    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
  });

  describe('getAllIndicators', () => {
    it('should fetch all indicators ordered by category and sort_order', async () => {
      const mockIndicators = [
        { id: '1', key: 'peRatio', name: 'P/E Ratio', category: 'valuation' },
        { id: '2', key: 'roe', name: 'ROE', category: 'profitability' },
      ];

      mockOrder.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({
          data: mockIndicators,
          error: null,
        }),
      });

      const result = await getAllIndicators();

      expect(mockFrom).toHaveBeenCalledWith('analysis_indicators');
      expect(mockOrder).toHaveBeenCalledWith('category');
      expect(result).toEqual(mockIndicators);
    });

    it('should return empty array when no indicators', async () => {
      mockOrder.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      });

      const result = await getAllIndicators();
      expect(result).toEqual([]);
    });

    it('should throw on error', async () => {
      mockOrder.mockReturnValueOnce({
        order: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'DB error' },
        }),
      });

      await expect(getAllIndicators()).rejects.toThrow('DB error');
    });
  });

  describe('getUserViews', () => {
    it('should fetch user analysis views', async () => {
      const mockViews = [
        { id: '1', name: 'Default', indicator_keys: ['peRatio', 'roe'] },
      ];

      mockOrder.mockResolvedValueOnce({
        data: mockViews,
        error: null,
      });

      const result = await getUserViews();

      expect(mockFrom).toHaveBeenCalledWith('user_analysis_views');
      expect(result).toEqual(mockViews);
    });

    it('should throw on error', async () => {
      mockOrder.mockResolvedValueOnce({
        data: null,
        error: { message: 'Views error' },
      });

      await expect(getUserViews()).rejects.toThrow('Views error');
    });
  });

  describe('createView', () => {
    it('should create a new view', async () => {
      const newView = {
        id: '1',
        name: 'My View',
        indicator_keys: ['peRatio'],
        is_default: false,
      };

      mockSingle.mockResolvedValue({
        data: newView,
        error: null,
      });

      const result = await createView('My View', ['peRatio']);

      expect(mockFrom).toHaveBeenCalledWith('user_analysis_views');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My View',
          indicator_keys: ['peRatio'],
          is_default: false,
        })
      );
      expect(result).toEqual(newView);
    });

    it('should unset other defaults when creating default view', async () => {
      mockUpdate.mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      mockSingle.mockResolvedValue({
        data: { id: '1', is_default: true },
        error: null,
      });

      await createView('Default View', ['peRatio'], true);

      // Update should be called to unset other defaults
      expect(mockFrom).toHaveBeenCalledWith('user_analysis_views');
    });

    it('should throw when not authenticated', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(createView('Test', ['peRatio'])).rejects.toThrow(
        'Not authenticated'
      );
    });
  });

  describe('updateView', () => {
    it('should update a view', async () => {
      const updatedView = { id: '1', name: 'Updated' };

      mockSingle.mockResolvedValue({
        data: updatedView,
        error: null,
      });

      const result = await updateView('1', { name: 'Updated' });

      expect(mockUpdate).toHaveBeenCalled();
      expect(result).toEqual(updatedView);
    });

    it('should throw when not authenticated', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(updateView('1', { name: 'Test' })).rejects.toThrow(
        'Not authenticated'
      );
    });
  });

  describe('deleteView', () => {
    it('should delete a view', async () => {
      mockEq.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await deleteView('1');

      expect(mockFrom).toHaveBeenCalledWith('user_analysis_views');
      expect(mockDelete).toHaveBeenCalled();
    });

    it('should throw on error', async () => {
      mockEq.mockResolvedValueOnce({
        data: null,
        error: { message: 'Delete error' },
      });

      await expect(deleteView('1')).rejects.toThrow('Delete error');
    });
  });

  describe('updateViewColumns', () => {
    it('should update view columns', async () => {
      mockEq.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await updateViewColumns('1', ['peRatio', 'roe', 'beta']);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          indicator_keys: ['peRatio', 'roe', 'beta'],
        })
      );
    });

    it('should throw on error', async () => {
      mockEq.mockResolvedValueOnce({
        data: null,
        error: { message: 'Update columns error' },
      });

      await expect(updateViewColumns('1', [])).rejects.toThrow(
        'Update columns error'
      );
    });
  });

  describe('formatLargeNumber', () => {
    it('should return dash for null/undefined', () => {
      expect(formatLargeNumber(null)).toBe('—');
      expect(formatLargeNumber(undefined)).toBe('—');
    });

    it('should format trillions', () => {
      expect(formatLargeNumber(2500000)).toBe('2.5T');
      expect(formatLargeNumber(1000000)).toBe('1.0T');
    });

    it('should format billions', () => {
      // The function uses millions as base unit
      expect(formatLargeNumber(500)).toBe('500M');
      expect(formatLargeNumber(1500)).toBe('1.5B');
    });

    it('should format millions', () => {
      expect(formatLargeNumber(50)).toBe('50M');
      expect(formatLargeNumber(1)).toBe('1M');
    });

    it('should format thousands', () => {
      expect(formatLargeNumber(0.5)).toBe('500K');
      expect(formatLargeNumber(0.1)).toBe('100K');
    });
  });

  describe('DEFAULT_INDICATOR_KEYS', () => {
    it('should have default indicators defined', () => {
      expect(DEFAULT_INDICATOR_KEYS).toContain('peRatio');
      expect(DEFAULT_INDICATOR_KEYS).toContain('roe');
      expect(DEFAULT_INDICATOR_KEYS).toContain('beta');
      expect(DEFAULT_INDICATOR_KEYS.length).toBeGreaterThan(0);
    });
  });
});
