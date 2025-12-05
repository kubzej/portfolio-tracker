import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sectorsApi } from './sectors';

// Mock supabase
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockOrder = vi.fn();

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (...args: Parameters<typeof mockFrom>) => mockFrom(...args),
  },
}));

describe('sectorsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSelect.mockReturnValue({
      order: mockOrder,
      eq: mockEq,
    });

    mockEq.mockReturnValue({
      single: mockSingle,
    });

    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: mockSingle,
      }),
    });
  });

  describe('getAll', () => {
    it('should fetch all sectors ordered by name', async () => {
      const mockSectors = [
        { id: '1', name: 'Finance' },
        { id: '2', name: 'Technology' },
      ];

      mockOrder.mockResolvedValueOnce({
        data: mockSectors,
        error: null,
      });

      const result = await sectorsApi.getAll();

      expect(mockFrom).toHaveBeenCalledWith('sectors');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockOrder).toHaveBeenCalledWith('name');
      expect(result).toEqual(mockSectors);
    });

    it('should return empty array when no sectors', async () => {
      mockOrder.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await sectorsApi.getAll();
      expect(result).toEqual([]);
    });

    it('should throw error on database error', async () => {
      mockOrder.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(sectorsApi.getAll()).rejects.toEqual({
        message: 'Database error',
      });
    });
  });

  describe('getById', () => {
    it('should fetch sector by ID', async () => {
      const mockSector = { id: '1', name: 'Technology' };

      mockSingle.mockResolvedValue({
        data: mockSector,
        error: null,
      });

      const result = await sectorsApi.getById('1');

      expect(mockEq).toHaveBeenCalledWith('id', '1');
      expect(result).toEqual(mockSector);
    });

    it('should throw on error', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      await expect(sectorsApi.getById('1')).rejects.toEqual({
        message: 'Not found',
      });
    });
  });

  describe('create', () => {
    it('should create a new sector', async () => {
      const newSector = { id: '1', name: 'Healthcare' };

      mockSingle.mockResolvedValue({
        data: newSector,
        error: null,
      });

      const result = await sectorsApi.create('Healthcare');

      expect(mockInsert).toHaveBeenCalledWith({ name: 'Healthcare' });
      expect(result).toEqual(newSector);
    });

    it('should throw on duplicate', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Duplicate key' },
      });

      await expect(sectorsApi.create('Technology')).rejects.toEqual({
        message: 'Duplicate key',
      });
    });
  });
});
