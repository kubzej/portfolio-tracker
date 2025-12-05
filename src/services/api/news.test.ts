import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchPortfolioNews, fetchMarketNews, fetchTickerNews } from './news';

// Mock supabase
const mockInvoke = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

describe('news', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchPortfolioNews', () => {
    it('should fetch news for portfolio holdings', async () => {
      const mockResponse = {
        articles: [{ id: '1', title: 'Apple News', ticker: 'AAPL' }],
        byTicker: [{ ticker: 'AAPL', stockName: 'Apple', articles: [] }],
        stats: {
          totalArticles: 1,
          byTicker: [],
          overallSentiment: 0.5,
        },
        errors: [],
      };

      mockInvoke.mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await fetchPortfolioNews();

      expect(mockInvoke).toHaveBeenCalledWith('fetch-news', {
        body: { portfolioId: undefined, includeBasicSentiment: true },
      });
      expect(result.articles).toHaveLength(1);
      expect(result.stats.overallSentiment).toBe(0.5);
    });

    it('should filter by portfolio ID', async () => {
      mockInvoke.mockResolvedValue({
        data: { articles: [], byTicker: [], stats: {}, errors: [] },
        error: null,
      });

      await fetchPortfolioNews('portfolio-123');

      expect(mockInvoke).toHaveBeenCalledWith('fetch-news', {
        body: { portfolioId: 'portfolio-123', includeBasicSentiment: true },
      });
    });

    it('should throw on error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'News API error' },
      });

      await expect(fetchPortfolioNews()).rejects.toThrow('News API error');
    });
  });

  describe('fetchMarketNews', () => {
    it('should fetch general market news', async () => {
      const mockResponse = {
        articles: [{ id: '1', title: 'Market Update' }],
        byTicker: [],
        stats: { totalArticles: 1 },
        errors: [],
      };

      mockInvoke.mockResolvedValue({
        data: mockResponse,
        error: null,
      });

      const result = await fetchMarketNews();

      expect(mockInvoke).toHaveBeenCalledWith('fetch-news', {
        body: { marketNews: true, includeBasicSentiment: true },
      });
      expect(result.articles).toHaveLength(1);
    });

    it('should throw on error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Market news error' },
      });

      await expect(fetchMarketNews()).rejects.toThrow('Market news error');
    });
  });

  describe('fetchTickerNews', () => {
    it('should fetch news for a single ticker', async () => {
      // fetchTickerNews extracts data?.data?.[0] from response
      const mockTickerNews = {
        ticker: 'AAPL',
        stockName: 'Apple Inc.',
        articles: [{ id: '1', title: 'Apple Earnings' }],
      };

      mockInvoke.mockResolvedValue({
        data: {
          data: [mockTickerNews],
        },
        error: null,
      });

      const result = await fetchTickerNews('AAPL');

      expect(mockInvoke).toHaveBeenCalledWith('fetch-news', {
        body: { ticker: 'AAPL', includeBasicSentiment: true },
      });
      expect(result?.ticker).toBe('AAPL');
      expect(result?.articles).toHaveLength(1);
    });

    it('should throw on error', async () => {
      mockInvoke.mockResolvedValue({
        data: null,
        error: { message: 'Ticker news error' },
      });

      await expect(fetchTickerNews('AAPL')).rejects.toThrow(
        'Ticker news error'
      );
    });
  });
});
