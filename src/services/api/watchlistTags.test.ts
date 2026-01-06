import { describe, it, expect, vi, beforeEach } from 'vitest';
import { watchlistTagsApi } from './watchlistTags';

// Mock supabase
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockOrder = vi.fn();
const mockSingle = vi.fn();

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

describe('watchlistTagsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default chain setup
    mockSelect.mockReturnValue({
      eq: mockEq,
      in: mockIn,
      order: mockOrder,
      single: mockSingle,
    });
    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({ single: mockSingle }),
    });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockDelete.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({
      eq: mockEq,
      select: vi.fn().mockReturnValue({ single: mockSingle }),
      single: mockSingle,
    });
    mockIn.mockResolvedValue({ data: [], error: null });
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockSingle.mockResolvedValue({ data: null, error: null });

    // Default user
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
  });

  describe('getAll', () => {
    it('should fetch all tags ordered by name', async () => {
      const mockTags = [
        { id: 'tag-1', name: 'Alpha', color: '#ff0000' },
        { id: 'tag-2', name: 'Beta', color: '#00ff00' },
      ];

      mockOrder.mockResolvedValueOnce({
        data: mockTags,
        error: null,
      });

      const result = await watchlistTagsApi.getAll();

      expect(mockFrom).toHaveBeenCalledWith('watchlist_tags');
      expect(mockSelect).toHaveBeenCalledWith('*');
      expect(mockOrder).toHaveBeenCalledWith('name');
      expect(result).toEqual(mockTags);
    });

    it('should return empty array when no tags', async () => {
      mockOrder.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await watchlistTagsApi.getAll();
      expect(result).toEqual([]);
    });

    it('should throw error on database error', async () => {
      mockOrder.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(watchlistTagsApi.getAll()).rejects.toEqual({
        message: 'Database error',
      });
    });
  });

  describe('create', () => {
    it('should create a tag with trimmed name', async () => {
      const newTag = {
        id: 'tag-new',
        name: 'New Tag',
        color: '#123456',
        user_id: 'user-123',
      };

      mockSingle.mockResolvedValueOnce({
        data: newTag,
        error: null,
      });

      const result = await watchlistTagsApi.create({
        name: '  New Tag  ',
        color: '#123456',
      });

      expect(mockFrom).toHaveBeenCalledWith('watchlist_tags');
      expect(mockInsert).toHaveBeenCalledWith({
        user_id: 'user-123',
        name: 'New Tag',
        color: '#123456',
      });
      expect(result).toEqual(newTag);
    });

    it('should use default color if not provided', async () => {
      const newTag = {
        id: 'tag-new',
        name: 'Tag',
        color: '#6b7280',
        user_id: 'user-123',
      };

      mockSingle.mockResolvedValueOnce({
        data: newTag,
        error: null,
      });

      await watchlistTagsApi.create({ name: 'Tag' });

      expect(mockInsert).toHaveBeenCalledWith({
        user_id: 'user-123',
        name: 'Tag',
        color: '#6b7280',
      });
    });

    it('should throw user-friendly error on duplicate name', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'unique violation' },
      });

      await expect(
        watchlistTagsApi.create({ name: 'Existing' })
      ).rejects.toThrow('Tag s tímto názvem již existuje');
    });

    it('should throw error when user not authenticated', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: null },
        error: null,
      });

      await expect(watchlistTagsApi.create({ name: 'Test' })).rejects.toThrow(
        'User not authenticated'
      );
    });
  });

  describe('update', () => {
    it('should update tag name and color', async () => {
      const updatedTag = { id: 'tag-1', name: 'Updated', color: '#ff0000' };

      mockSingle.mockResolvedValueOnce({
        data: updatedTag,
        error: null,
      });

      const result = await watchlistTagsApi.update('tag-1', {
        name: '  Updated  ',
        color: '#ff0000',
      });

      expect(mockFrom).toHaveBeenCalledWith('watchlist_tags');
      expect(mockUpdate).toHaveBeenCalledWith({
        name: 'Updated',
        color: '#ff0000',
      });
      expect(mockEq).toHaveBeenCalledWith('id', 'tag-1');
      expect(result).toEqual(updatedTag);
    });

    it('should update only provided fields', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'tag-1', name: 'Old', color: '#new' },
        error: null,
      });

      await watchlistTagsApi.update('tag-1', { color: '#new' });

      expect(mockUpdate).toHaveBeenCalledWith({ color: '#new' });
    });

    it('should throw user-friendly error on duplicate name', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'unique violation' },
      });

      await expect(
        watchlistTagsApi.update('tag-1', { name: 'Duplicate' })
      ).rejects.toThrow('Tag s tímto názvem již existuje');
    });
  });

  describe('delete', () => {
    it('should delete a tag by id', async () => {
      mockEq.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await watchlistTagsApi.delete('tag-1');

      expect(mockFrom).toHaveBeenCalledWith('watchlist_tags');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('id', 'tag-1');
    });

    it('should throw error on database error', async () => {
      mockEq.mockResolvedValueOnce({
        data: null,
        error: { message: 'Delete failed' },
      });

      await expect(watchlistTagsApi.delete('tag-1')).rejects.toEqual({
        message: 'Delete failed',
      });
    });
  });

  describe('getTagsForItem', () => {
    it('should fetch tags for a specific item', async () => {
      const mockData = [
        {
          tag_id: 'tag-1',
          watchlist_tags: { id: 'tag-1', name: 'Tag1', color: '#111' },
        },
        {
          tag_id: 'tag-2',
          watchlist_tags: { id: 'tag-2', name: 'Tag2', color: '#222' },
        },
      ];

      mockEq.mockResolvedValueOnce({
        data: mockData,
        error: null,
      });

      const result = await watchlistTagsApi.getTagsForItem('item-1');

      expect(mockFrom).toHaveBeenCalledWith('watchlist_item_tags');
      expect(mockSelect).toHaveBeenCalledWith('tag_id, watchlist_tags(*)');
      expect(mockEq).toHaveBeenCalledWith('watchlist_item_id', 'item-1');
      expect(result).toEqual([
        { id: 'tag-1', name: 'Tag1', color: '#111' },
        { id: 'tag-2', name: 'Tag2', color: '#222' },
      ]);
    });

    it('should return empty array when no tags', async () => {
      mockEq.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const result = await watchlistTagsApi.getTagsForItem('item-1');
      expect(result).toEqual([]);
    });

    it('should filter out null tags', async () => {
      const mockData = [
        {
          tag_id: 'tag-1',
          watchlist_tags: { id: 'tag-1', name: 'Tag1', color: '#111' },
        },
        { tag_id: 'tag-2', watchlist_tags: null },
      ];

      mockEq.mockResolvedValueOnce({
        data: mockData,
        error: null,
      });

      const result = await watchlistTagsApi.getTagsForItem('item-1');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Tag1');
    });
  });

  describe('getTagsForItems', () => {
    it('should return empty map for empty input', async () => {
      const result = await watchlistTagsApi.getTagsForItems([]);
      expect(result).toEqual(new Map());
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('should fetch tags for multiple items', async () => {
      const mockData = [
        {
          watchlist_item_id: 'item-1',
          tag_id: 'tag-1',
          watchlist_tags: { id: 'tag-1', name: 'A', color: '#a' },
        },
        {
          watchlist_item_id: 'item-1',
          tag_id: 'tag-2',
          watchlist_tags: { id: 'tag-2', name: 'B', color: '#b' },
        },
        {
          watchlist_item_id: 'item-2',
          tag_id: 'tag-1',
          watchlist_tags: { id: 'tag-1', name: 'A', color: '#a' },
        },
      ];

      mockIn.mockResolvedValueOnce({
        data: mockData,
        error: null,
      });

      const result = await watchlistTagsApi.getTagsForItems([
        'item-1',
        'item-2',
      ]);

      expect(mockFrom).toHaveBeenCalledWith('watchlist_item_tags');
      expect(mockSelect).toHaveBeenCalledWith(
        'watchlist_item_id, tag_id, watchlist_tags(*)'
      );
      expect(mockIn).toHaveBeenCalledWith('watchlist_item_id', [
        'item-1',
        'item-2',
      ]);

      expect(result.get('item-1')).toHaveLength(2);
      expect(result.get('item-2')).toHaveLength(1);
    });

    it('should skip null tags in batch result', async () => {
      const mockData = [
        {
          watchlist_item_id: 'item-1',
          tag_id: 'tag-1',
          watchlist_tags: { id: 'tag-1', name: 'A', color: '#a' },
        },
        { watchlist_item_id: 'item-1', tag_id: 'tag-2', watchlist_tags: null },
      ];

      mockIn.mockResolvedValueOnce({
        data: mockData,
        error: null,
      });

      const result = await watchlistTagsApi.getTagsForItems(['item-1']);
      expect(result.get('item-1')).toHaveLength(1);
    });
  });

  describe('addTagToItem', () => {
    it('should add a tag to an item', async () => {
      mockInsert.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      await watchlistTagsApi.addTagToItem('item-1', 'tag-1');

      expect(mockFrom).toHaveBeenCalledWith('watchlist_item_tags');
      expect(mockInsert).toHaveBeenCalledWith({
        watchlist_item_id: 'item-1',
        tag_id: 'tag-1',
      });
    });

    it('should ignore duplicate constraint error', async () => {
      mockInsert.mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate' },
      });

      // Should not throw
      await expect(
        watchlistTagsApi.addTagToItem('item-1', 'tag-1')
      ).resolves.toBeUndefined();
    });

    it('should throw other errors', async () => {
      mockInsert.mockResolvedValueOnce({
        data: null,
        error: { code: '23503', message: 'foreign key' },
      });

      await expect(
        watchlistTagsApi.addTagToItem('item-1', 'tag-invalid')
      ).rejects.toEqual({ code: '23503', message: 'foreign key' });
    });
  });

  describe('removeTagFromItem', () => {
    it('should remove a tag from an item', async () => {
      // Chain: delete().eq().eq()
      const mockSecondEq = vi
        .fn()
        .mockResolvedValueOnce({ data: null, error: null });
      mockEq.mockReturnValueOnce({ eq: mockSecondEq });

      await watchlistTagsApi.removeTagFromItem('item-1', 'tag-1');

      expect(mockFrom).toHaveBeenCalledWith('watchlist_item_tags');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('watchlist_item_id', 'item-1');
      expect(mockSecondEq).toHaveBeenCalledWith('tag_id', 'tag-1');
    });
  });

  describe('setTagsForItem', () => {
    it('should replace all tags for an item', async () => {
      // First call: delete existing
      mockEq.mockResolvedValueOnce({ data: null, error: null });
      // Second call: insert new
      mockInsert.mockResolvedValueOnce({ data: null, error: null });

      await watchlistTagsApi.setTagsForItem('item-1', ['tag-1', 'tag-2']);

      // First: delete from watchlist_item_tags
      expect(mockFrom).toHaveBeenCalledWith('watchlist_item_tags');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq).toHaveBeenCalledWith('watchlist_item_id', 'item-1');

      // Second: insert new tags
      expect(mockInsert).toHaveBeenCalledWith([
        { watchlist_item_id: 'item-1', tag_id: 'tag-1' },
        { watchlist_item_id: 'item-1', tag_id: 'tag-2' },
      ]);
    });

    it('should only delete when setting empty tags', async () => {
      mockEq.mockResolvedValueOnce({ data: null, error: null });

      await watchlistTagsApi.setTagsForItem('item-1', []);

      expect(mockDelete).toHaveBeenCalled();
      // Insert should not be called for empty array
      expect(mockInsert).not.toHaveBeenCalled();
    });

    it('should throw on delete error', async () => {
      mockEq.mockResolvedValueOnce({
        data: null,
        error: { message: 'Delete failed' },
      });

      await expect(
        watchlistTagsApi.setTagsForItem('item-1', ['tag-1'])
      ).rejects.toEqual({ message: 'Delete failed' });
    });

    it('should throw on insert error', async () => {
      mockEq.mockResolvedValueOnce({ data: null, error: null });
      mockInsert.mockResolvedValueOnce({
        data: null,
        error: { message: 'Insert failed' },
      });

      await expect(
        watchlistTagsApi.setTagsForItem('item-1', ['tag-1'])
      ).rejects.toEqual({ message: 'Insert failed' });
    });
  });
});
