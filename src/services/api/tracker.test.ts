import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSnapshots,
  getLatestSnapshot,
  getSnapshotWithHoldings,
  getTickerHistory,
  getChanges,
  getLatestHoldings,
  getResearchTracked,
  addResearchTracked,
  updateResearchTrackedStatus,
  updateResearchTrackedNotes,
  removeResearchTracked,
  getTrackedId,
  isTickerTracked,
} from './tracker';

// Mock supabase
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
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
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      getUser: () => mockGetUser(),
    },
  },
}));

describe('tracker API', () => {
  // Create chainable mock with thenable for await
  let chainMock: ReturnType<typeof createChainMock>;

  function createChainMock(defaultData: any = [], defaultError: any = null) {
    let resolveData = defaultData;
    let resolveError = defaultError;

    const mock: any = {
      eq: vi.fn(),
      gte: vi.fn(),
      lte: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
      select: vi.fn(),
      single: vi.fn(),
      maybeSingle: vi.fn(),
      // Make it thenable for await
      then: (resolve: (val: any) => void) => {
        resolve({ data: resolveData, error: resolveError });
        return mock;
      },
      _setResponse: (data: any, error: any = null) => {
        resolveData = data;
        resolveError = error;
      },
    };

    // Chain methods return mock itself
    mock.eq.mockImplementation(() => mock);
    mock.gte.mockImplementation(() => mock);
    mock.lte.mockImplementation(() => mock);
    mock.order.mockImplementation(() => mock);
    mock.limit.mockImplementation(() => mock);
    mock.select.mockImplementation(() => mock);
    mock.single.mockImplementation(() => mock);
    mock.maybeSingle.mockImplementation(() => mock);

    return mock;
  }

  beforeEach(() => {
    vi.clearAllMocks();

    chainMock = createChainMock();

    mockSelect.mockReturnValue(chainMock);

    mockInsert.mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: mockSingle,
      }),
    });

    mockUpdate.mockReturnValue(chainMock);

    mockDelete.mockReturnValue(chainMock);

    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-123' } },
      error: null,
    });
  });

  describe('getSnapshots', () => {
    it('should fetch daily snapshots', async () => {
      const mockSnapshots = [
        { id: '1', snapshot_date: '2024-01-15', portfolio_total_value: 10000 },
      ];

      chainMock._setResponse(mockSnapshots);

      const result = await getSnapshots();

      expect(mockFrom).toHaveBeenCalledWith('daily_snapshots');
      expect(result).toEqual(mockSnapshots);
    });

    it('should filter by date range', async () => {
      chainMock._setResponse([]);

      await getSnapshots('2024-01-01', '2024-01-31');

      expect(chainMock.gte).toHaveBeenCalledWith('snapshot_date', '2024-01-01');
      expect(chainMock.lte).toHaveBeenCalledWith('snapshot_date', '2024-01-31');
    });

    it('should respect limit parameter', async () => {
      chainMock._setResponse([]);

      await getSnapshots(undefined, undefined, 10);

      expect(chainMock.limit).toHaveBeenCalledWith(10);
    });
  });

  describe('getLatestSnapshot', () => {
    it('should fetch latest snapshot', async () => {
      const mockSnapshot = { id: '1', snapshot_date: '2024-01-15' };

      chainMock._setResponse(mockSnapshot);

      const result = await getLatestSnapshot();

      expect(result).toEqual(mockSnapshot);
    });

    it('should return null when no snapshots', async () => {
      chainMock._setResponse(null, { code: 'PGRST116' }); // Not found

      const result = await getLatestSnapshot();

      expect(result).toBeNull();
    });
  });

  describe('getSnapshotWithHoldings', () => {
    it('should fetch snapshot with holdings', async () => {
      const mockSnapshot = { id: '1', snapshot_date: '2024-01-15' };
      const mockHoldings = [
        { id: 'h1', ticker: 'AAPL', portfolios: { name: 'Main' } },
      ];

      // First call returns snapshot, second call returns holdings
      let callCount = 0;
      chainMock.then = (resolve: (val: any) => void) => {
        callCount++;
        if (callCount === 1) {
          resolve({ data: mockSnapshot, error: null });
        } else {
          resolve({ data: mockHoldings, error: null });
        }
        return chainMock;
      };

      const result = await getSnapshotWithHoldings('2024-01-15');

      expect(result?.holdings).toBeDefined();
      expect(result?.holdings[0].portfolio_name).toBe('Main');
    });

    it('should return null when snapshot not found', async () => {
      chainMock._setResponse(null, { code: 'PGRST116' });

      const result = await getSnapshotWithHoldings('2024-01-15');

      expect(result).toBeNull();
    });
  });

  describe('getLatestHoldings', () => {
    it('should fetch latest holdings', async () => {
      const mockHoldings = [{ id: '1', ticker: 'AAPL', source: 'portfolio' }];

      chainMock._setResponse(mockHoldings);

      const result = await getLatestHoldings();

      expect(mockFrom).toHaveBeenCalledWith('latest_snapshots');
    });

    it('should filter by source', async () => {
      chainMock._setResponse([]);

      await getLatestHoldings('research');

      expect(chainMock.eq).toHaveBeenCalledWith('source', 'research');
    });
  });

  describe('getResearchTracked', () => {
    it('should fetch active tracked stocks by default', async () => {
      const mockTracked = [{ id: '1', ticker: 'AAPL', status: 'active' }];

      chainMock._setResponse(mockTracked);

      const result = await getResearchTracked();

      expect(chainMock.eq).toHaveBeenCalledWith('status', 'active');
      expect(result).toEqual(mockTracked);
    });

    it('should fetch all statuses when specified', async () => {
      chainMock._setResponse([]);

      await getResearchTracked('all');

      // Should NOT call eq for status
      expect(chainMock.eq).not.toHaveBeenCalledWith(
        'status',
        expect.any(String)
      );
    });
  });

  describe('addResearchTracked', () => {
    it('should add stock to tracking', async () => {
      const newTracked = {
        id: '1',
        ticker: 'AAPL',
        stock_name: 'Apple Inc.',
        added_price: 180,
      };

      mockSingle.mockResolvedValue({
        data: newTracked,
        error: null,
      });

      const result = await addResearchTracked(
        'AAPL',
        'Apple Inc.',
        'AAPL',
        180,
        'DIP_OPPORTUNITY',
        75,
        'high'
      );

      expect(mockFrom).toHaveBeenCalledWith('research_tracked');
      expect(result.ticker).toBe('AAPL');
    });

    it('should throw when not authenticated', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      await expect(
        addResearchTracked('AAPL', null, null, null, null, null, null)
      ).rejects.toThrow('Not authenticated');
    });
  });

  describe('updateResearchTrackedStatus', () => {
    it('should update status to bought with price', async () => {
      chainMock._setResponse({ id: '1', status: 'bought', bought_price: 185 });

      const result = await updateResearchTrackedStatus('1', 'bought', 185);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'bought',
          bought_price: 185,
        })
      );
      expect(result.status).toBe('bought');
    });

    it('should update status to dismissed', async () => {
      chainMock._setResponse({ id: '1', status: 'dismissed' });

      await updateResearchTrackedStatus('1', 'dismissed');

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'dismissed',
        })
      );
    });
  });

  describe('updateResearchTrackedNotes', () => {
    it('should update notes', async () => {
      chainMock._setResponse({ id: '1', notes: 'Updated notes' });

      const result = await updateResearchTrackedNotes('1', 'Updated notes');

      expect(mockUpdate).toHaveBeenCalledWith({ notes: 'Updated notes' });
      expect(result.notes).toBe('Updated notes');
    });
  });

  describe('removeResearchTracked', () => {
    it('should remove tracked stock', async () => {
      chainMock._setResponse(null);

      await removeResearchTracked('1');

      expect(mockFrom).toHaveBeenCalledWith('research_tracked');
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe('getTrackedId', () => {
    it('should return ID when tracked', async () => {
      chainMock._setResponse({ id: 'tracked-1' });

      const result = await getTrackedId('AAPL');

      expect(result).toBe('tracked-1');
    });

    it('should return null when not tracked', async () => {
      chainMock._setResponse(null);

      const result = await getTrackedId('UNKNOWN');

      expect(result).toBeNull();
    });
  });

  describe('isTickerTracked', () => {
    it('should return true when tracked', async () => {
      chainMock._setResponse({ id: 'tracked-1' });

      const result = await isTickerTracked('AAPL');

      expect(result).toBe(true);
    });

    it('should return false when not tracked', async () => {
      chainMock._setResponse(null);

      const result = await isTickerTracked('UNKNOWN');

      expect(result).toBe(false);
    });
  });
});
