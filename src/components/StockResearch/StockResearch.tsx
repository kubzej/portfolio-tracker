import { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchSingleTechnicalData } from '@/services/api/technical';
import { fetchTickerNews } from '@/services/api/news';
import { fetchPeersData } from '@/services/api/peers';
import type { AnalystData, RateLimitInfo } from '@/services/api/analysis';
import type { TechnicalData } from '@/services/api/technical';
import type { NewsArticle } from '@/services/api/news';
import type { PeersResult } from '@/services/api/peers';
import {
  generateRecommendation,
  type EnrichedAnalystData,
  type StockRecommendation,
} from '@/utils/recommendations';
import { cn } from '@/utils/cn';
import { getExchangeInfo } from '@/utils/format';
import {
  LoadingSpinner,
  ErrorState,
  PriceDisplay,
  SignalBadge,
  InfoTooltip,
} from '@/components/shared';
import { Tabs } from '@/components/shared/Tabs';
import { ResearchSummary } from './ResearchSummary';
import { ResearchValuation } from './ResearchValuation';
import { ResearchTechnical } from './ResearchTechnical';
import { ResearchFundamentals } from './ResearchFundamentals';
import { ResearchPeers } from './ResearchPeers';
import './StockResearch.css';

// Debug info for data loading status
interface DataLoadStatus {
  analyst: boolean;
  technical: boolean;
  news: boolean;
  peers: boolean;
  rateLimited?: RateLimitInfo;
}

interface StockResearchProps {
  ticker: string;
  stockName?: string;
  finnhubTicker?: string;
  onBack: () => void;
  /** Optional: Add to watchlist callback */
  onAddToWatchlist?: (ticker: string) => void;
}

export function StockResearch({
  ticker,
  stockName,
  finnhubTicker,
  onBack,
  onAddToWatchlist,
}: StockResearchProps) {
  const [analystData, setAnalystData] = useState<AnalystData | null>(null);
  const [technicalData, setTechnicalData] = useState<TechnicalData | null>(
    null
  );
  const [newsArticles, setNewsArticles] = useState<NewsArticle[]>([]);
  const [peersData, setPeersData] = useState<PeersResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('summary');
  const [retryCount, setRetryCount] = useState(0);
  const [dataLoadStatus, setDataLoadStatus] = useState<DataLoadStatus>({
    analyst: false,
    technical: false,
    news: false,
    peers: false,
  });

  // Track last fetched ticker to prevent duplicate fetches
  const lastFetchedRef = useRef<string | null>(null);

  useEffect(() => {
    // Create unique key for this fetch
    const fetchKey = `${ticker}-${retryCount}`;

    // Skip if we already fetched this exact combination
    if (lastFetchedRef.current === fetchKey && retryCount === 0) {
      return;
    }

    let cancelled = false;

    const loadData = async () => {
      // Reset state
      setAnalystData(null);
      setTechnicalData(null);
      setNewsArticles([]);
      setPeersData(null);
      setActiveTab('summary');
      setLoading(true);
      setError(null);
      setDataLoadStatus({
        analyst: false,
        technical: false,
        news: false,
        peers: false,
      });

      try {
        // Fetch all data in parallel - analyst, technical, news, and peers
        const [analystResult, technical, tickerNews, peers] = await Promise.all(
          [
            supabase.functions.invoke('fetch-analyst-data', {
              body: { ticker, stockName, finnhubTicker, _t: Date.now() },
            }),
            fetchSingleTechnicalData(ticker).catch(() => null),
            fetchTickerNews(ticker).catch(() => null),
            fetchPeersData(ticker).catch(() => null),
          ]
        );

        if (!cancelled) {
          // Parse analyst result with rate limit info
          const analystDataResult = analystResult.data as {
            data: AnalystData[];
            errors: string[];
            rateLimited?: RateLimitInfo;
          } | null;

          const analyst = analystDataResult?.data?.[0] ?? null;
          const rateLimited =
            analystDataResult?.rateLimited ?? peers?.rateLimited;

          setAnalystData(analyst);
          setTechnicalData(technical);
          setPeersData(peers);

          // Convert news to NewsArticle[] with ticker attached
          if (tickerNews?.articles) {
            setNewsArticles(tickerNews.articles.map((a) => ({ ...a, ticker })));
          }

          // Update load status for debug
          setDataLoadStatus({
            analyst: !!analyst,
            technical: !!technical,
            news: !!tickerNews?.articles?.length,
            peers: !!peers?.mainStock,
            rateLimited,
          });

          lastFetchedRef.current = fetchKey;

          // Error if no analyst data (critical)
          if (!analyst && analystResult.error) {
            throw new Error(analystResult.error.message);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load research data'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      cancelled = true;
    };
  }, [ticker, stockName, finnhubTicker, retryCount]);

  const handleRetry = () => {
    setRetryCount((c) => c + 1);
  };

  // Generate recommendation using existing scoring system
  const recommendation: StockRecommendation | null = useMemo(() => {
    if (!analystData) return null;

    // Create enriched data for standalone research (no portfolio context)
    const enrichedData: EnrichedAnalystData = {
      ...analystData,
      weight: 0,
      currentValue: 0,
      totalShares: 0,
      avgBuyPrice: 0,
      totalInvested: 0,
      unrealizedGain: 0,
      gainPercentage: 0,
      targetPrice: null, // No personal target for watchlist research
      distanceToTarget: null,
    };

    return generateRecommendation({
      analystData: enrichedData,
      technicalData: technicalData ?? undefined,
      newsArticles: newsArticles,
      insiderTimeRange: 3,
    });
  }, [analystData, technicalData, newsArticles]);

  if (loading) {
    return (
      <div className="stock-research">
        <LoadingSpinner text={`Loading research for ${ticker}...`} />
      </div>
    );
  }

  if (error || !analystData) {
    return (
      <div className="stock-research">
        <div className="stock-research-header">
          <button className="back-btn" onClick={onBack}>
            ← Back
          </button>
        </div>
        <ErrorState
          message={error || 'Failed to load data'}
          onRetry={handleRetry}
        />
      </div>
    );
  }

  const tabs = [
    { value: 'summary', label: 'Summary' },
    { value: 'fundamentals', label: 'Fundamentals' },
    { value: 'valuation', label: 'Valuation' },
    { value: 'technical', label: 'Technical' },
    { value: 'peers', label: 'Peers' },
  ];

  // Get exchange info for non-US stock badges
  const exchangeInfo = getExchangeInfo(ticker);

  return (
    <div className="stock-research">
      {/* Debug */}
      <div
        style={{
          fontSize: '9px',
          fontFamily: 'monospace',
          color: '#666',
          padding: '2px 4px',
          background: '#f5f5f5',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <span>
          req: {ticker} | analyst: {dataLoadStatus.analyst ? '✓' : '✗'} | tech:{' '}
          {dataLoadStatus.technical ? '✓' : '✗'} | news:{' '}
          {dataLoadStatus.news ? '✓' : '✗'} | peers:{' '}
          {dataLoadStatus.peers ? '✓' : '✗'}
        </span>
        {dataLoadStatus.rateLimited && (
          <span style={{ color: '#c00', fontWeight: 'bold' }}>
            RATE LIMITED: {dataLoadStatus.rateLimited.finnhub && 'Finnhub'}{' '}
            {dataLoadStatus.rateLimited.yahoo && 'Yahoo'}
          </span>
        )}
        {(ticker !== analystData.ticker ||
          (technicalData && ticker !== technicalData.ticker)) && (
          <span style={{ color: 'red' }}>ticker mismatch!</span>
        )}
      </div>

      {/* Header */}
      <div className="stock-research-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <div className="stock-research-title">
          <span className="ticker">{analystData.ticker}</span>
          <span className="name">{analystData.stockName}</span>
          {!exchangeInfo.isUSStock && (
            <span className="exchange-badge">
              {exchangeInfo.exchangeSuffix}
            </span>
          )}
        </div>
        {onAddToWatchlist && (
          <button
            className="add-to-watchlist-btn"
            onClick={() => onAddToWatchlist(ticker)}
          >
            + Watchlist
          </button>
        )}
      </div>

      {/* Price & Signal */}
      <div className="stock-research-price-bar">
        <PriceDisplay
          price={analystData.currentPrice}
          change={analystData.priceChange}
          changePercent={analystData.priceChangePercent}
          size="lg"
        />
        {recommendation && (
          <div className="stock-research-signal">
            <SignalBadge type={recommendation.primarySignal.type} size="md" />
            <span className="signal-description">
              {recommendation.primarySignal.description}
            </span>
          </div>
        )}
      </div>

      {/* Quick Stats Bar */}
      <div className="stock-research-quick-stats">
        <QuickStat
          label="52W Range"
          value={
            analystData.fiftyTwoWeekLow && analystData.fiftyTwoWeekHigh
              ? `$${analystData.fiftyTwoWeekLow.toFixed(
                  0
                )} – $${analystData.fiftyTwoWeekHigh.toFixed(0)}`
              : '—'
          }
        />
        <QuickStat
          label="Analyst"
          value={
            analystData.recommendationKey?.toUpperCase().replace('_', ' ') ??
            '—'
          }
          sentiment={
            analystData.consensusScore !== null
              ? analystData.consensusScore > 0.5
                ? 'positive'
                : analystData.consensusScore < -0.5
                ? 'negative'
                : 'neutral'
              : undefined
          }
        />
        <QuickStat label="Industry" value={analystData.industry ?? '—'} />
      </div>

      {/* Tabs */}
      <Tabs options={tabs} value={activeTab} onChange={setActiveTab} />

      {/* Tab Content */}
      <div className="stock-research-content">
        {activeTab === 'summary' && recommendation && (
          <ResearchSummary
            recommendation={recommendation}
            analystData={analystData}
          />
        )}

        {activeTab === 'fundamentals' && (
          <ResearchFundamentals
            fundamentals={analystData.fundamentals}
            earnings={analystData.earnings}
          />
        )}

        {activeTab === 'valuation' && (
          <ResearchValuation
            fundamentals={analystData.fundamentals}
            recommendation={recommendation}
          />
        )}

        {activeTab === 'technical' && (
          <ResearchTechnical
            technicalData={technicalData}
            recommendation={recommendation}
          />
        )}

        {activeTab === 'peers' && (
          <ResearchPeers
            ticker={ticker}
            peers={analystData.peers}
            prefetchedData={peersData}
          />
        )}
      </div>
    </div>
  );
}

// Quick stat component for the stats bar
interface QuickStatProps {
  label: string;
  value: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  tooltip?: string;
}

function QuickStat({ label, value, sentiment, tooltip }: QuickStatProps) {
  return (
    <div className="quick-stat">
      <span className="quick-stat-label">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </span>
      <span className={cn('quick-stat-value', sentiment)}>{value}</span>
    </div>
  );
}
