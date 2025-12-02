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
import { getExchangeInfo } from '@/utils/format';
import {
  LoadingSpinner,
  ErrorState,
  PriceDisplay,
  InfoTooltip,
  Button,
} from '@/components/shared';
import {
  Ticker,
  MetricLabel,
  MetricValue,
  Badge,
  Text,
} from '@/components/shared/Typography';
import { Tabs } from '@/components/shared/Tabs';
import { ResearchSummary } from './ResearchSummary';
import { ResearchValuation } from './ResearchValuation';
import { ResearchTechnical } from './ResearchTechnical';
import { ResearchFundamentals } from './ResearchFundamentals';
import { ResearchPeers } from './ResearchPeers';
import { AddStockForm } from '@/components/Watchlists/AddStockForm';
import './StockResearch.css';

// Debug info for data loading status
interface DataLoadStatus {
  analyst: boolean;
  fundamentals: boolean;
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
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [showWatchlistModal, setShowWatchlistModal] = useState(false);
  const [dataLoadStatus, setDataLoadStatus] = useState<DataLoadStatus>({
    analyst: false,
    fundamentals: false,
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
        fundamentals: false,
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

          // Update load status for debug - check if data is actually present
          const hasFundamentals = !!(
            analyst?.fundamentals?.peRatio ||
            analyst?.fundamentals?.roe ||
            analyst?.fundamentals?.netMargin
          );
          setDataLoadStatus({
            analyst: !!(analyst?.currentPrice || analyst?.recommendationKey),
            fundamentals: hasFundamentals,
            technical: !!(technical?.rsi14 || technical?.macd),
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
            err instanceof Error ? err.message : 'Nepodařilo se načíst data'
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
      isResearch: true,
    });
  }, [analystData, technicalData, newsArticles]);

  if (loading) {
    return (
      <div className="stock-research">
        <LoadingSpinner text={`Načítám data pro ${ticker}...`} />
      </div>
    );
  }

  if (error || !analystData) {
    return (
      <div className="stock-research">
        <div className="stock-research-header">
          <button className="back-btn" onClick={onBack}>
            ← Zpět
          </button>
        </div>
        <ErrorState
          message={error || 'Nepodařilo se načíst data'}
          onRetry={handleRetry}
        />
      </div>
    );
  }

  const tabs = [
    { value: 'summary', label: 'Přehled' },
    { value: 'fundamentals', label: 'Fundamenty' },
    { value: 'valuation', label: 'Valuace' },
    { value: 'technical', label: 'Technika' },
    { value: 'peers', label: 'Konkurence' },
  ];

  // Get exchange info for non-US stock badges
  const exchangeInfo = getExchangeInfo(ticker);

  // Debug status: critical = analyst, fund, tech, peers. News is optional.
  const criticalDataOk =
    dataLoadStatus.analyst &&
    dataLoadStatus.fundamentals &&
    dataLoadStatus.technical &&
    dataLoadStatus.peers;
  const onlyNewsMissing =
    dataLoadStatus.analyst &&
    dataLoadStatus.fundamentals &&
    dataLoadStatus.technical &&
    dataLoadStatus.peers &&
    !dataLoadStatus.news;
  const debugBgColor = criticalDataOk
    ? '#d4edda' // green - all critical OK
    : onlyNewsMissing
    ? '#f5f5f5' // neutral - only news missing
    : '#f8d7da'; // red - critical data missing

  return (
    <div className="stock-research">
      {/* Debug */}
      <div
        style={{
          fontSize: '9px',
          fontFamily: 'monospace',
          color: '#333',
          padding: '2px 4px',
          marginBottom: '1rem',
          background: debugBgColor,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
        }}
      >
        <span>
          req: {ticker} | analyst: {dataLoadStatus.analyst ? '✓' : '✗'} | fund:{' '}
          {dataLoadStatus.fundamentals ? '✓' : '✗'} | tech:{' '}
          {dataLoadStatus.technical ? '✓' : '✗'} | news:{' '}
          {dataLoadStatus.news ? '✓' : '✗'} | peers:{' '}
          {dataLoadStatus.peers ? '✓' : '✗'} | desc:{' '}
          {analystData.descriptionSource ?? '✗'}
        </span>
        {dataLoadStatus.rateLimited && (
          <span style={{ color: '#c00', fontWeight: 'bold' }}>
            RATE LIMITED: {dataLoadStatus.rateLimited.finnhub && 'Finnhub '}
            {dataLoadStatus.rateLimited.yahoo && 'Yahoo '}
            {dataLoadStatus.rateLimited.alpha && 'Alpha'}
          </span>
        )}
        {(ticker !== analystData.ticker ||
          (technicalData && ticker !== technicalData.ticker)) && (
          <span style={{ color: 'red' }}>ticker mismatch!</span>
        )}
      </div>

      {/* Header */}
      <div className="stock-research-header">
        <div className="stock-research-header__top">
          <Button variant="ghost" size="sm" onClick={onBack}>
            ← Zpět
          </Button>
          {onAddToWatchlist && (
            <Button
              variant="primary"
              size="sm"
              onClick={() => onAddToWatchlist(ticker)}
            >
              + Sledovat
            </Button>
          )}
        </div>
        <div className="stock-research-header__title">
          <Ticker size="lg">{analystData.ticker}</Ticker>
          {!exchangeInfo.isUSStock && (
            <Badge variant="info">{exchangeInfo.exchangeSuffix}</Badge>
          )}
        </div>
      </div>

      {/* Company Description */}
      {analystData.description && (
        <div
          className={`stock-research-description${
            !descriptionExpanded ? ' stock-research-description--collapsed' : ''
          }`}
        >
          <Text size="sm" color="secondary">
            {analystData.description}
          </Text>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDescriptionExpanded(!descriptionExpanded)}
          >
            {descriptionExpanded ? 'Méně' : 'Více'}
          </Button>
        </div>
      )}

      {/* Price */}
      <div className="stock-research-price-bar">
        <PriceDisplay
          price={analystData.currentPrice}
          change={analystData.priceChange}
          changePercent={analystData.priceChangePercent}
          size="lg"
        />
      </div>

      {/* Quick Stats Bar */}
      <div className="stock-research-quick-stats">
        <QuickStat
          label="52T rozsah"
          value={
            analystData.fiftyTwoWeekLow && analystData.fiftyTwoWeekHigh
              ? `$${analystData.fiftyTwoWeekLow.toFixed(
                  0
                )} – $${analystData.fiftyTwoWeekHigh.toFixed(0)}`
              : '—'
          }
        />
        <QuickStat
          label="Analytici"
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
        <QuickStat label="Odvětví" value={analystData.industry ?? '—'} />
      </div>

      {/* Tabs */}
      <Tabs options={tabs} value={activeTab} onChange={setActiveTab} />

      {/* Tab Content */}
      <div className="stock-research-content">
        {activeTab === 'summary' && recommendation && (
          <ResearchSummary
            recommendation={recommendation}
            analystData={analystData}
            onAddToWatchlist={() => setShowWatchlistModal(true)}
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
            ticker={ticker}
            data={technicalData}
            isLoading={loading && !technicalData}
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

      {/* Add to Watchlist Modal */}
      {showWatchlistModal && (
        <AddStockForm
          prefillTicker={ticker}
          prefillName={stockName || analystData.stockName || ticker}
          suggestedBuyPrice={getSuggestedBuyPrice(
            recommendation,
            analystData.currentPrice,
            technicalData?.fibonacciLevels,
            analystData.fiftyTwoWeekLow
          )}
          suggestedSellPrice={analystData.analystTargetPrice ?? undefined}
          onClose={() => setShowWatchlistModal(false)}
          onSuccess={() => setShowWatchlistModal(false)}
        />
      )}
    </div>
  );
}

/**
 * Calculate suggested buy price based on verdict
 * - Good Entry: use current price (it's a good time to buy)
 * - Wait: use support level (Fib 38.2% or 61.8%) or 52W low + buffer
 * - Pass: leave empty
 */
function getSuggestedBuyPrice(
  recommendation: StockRecommendation | null,
  currentPrice: number | null | undefined,
  fibLevels: { level382: number; level618: number } | null | undefined,
  fiftyTwoWeekLow: number | null | undefined
): number | undefined {
  if (!recommendation || !currentPrice) return undefined;

  const verdict =
    recommendation.compositeScore >= 60 &&
    (recommendation.targetUpside ?? 0) > 10 &&
    (recommendation.technicalBias === 'BULLISH' ||
      recommendation.technicalScore >= 50)
      ? 'good-entry'
      : recommendation.compositeScore >= 50 &&
        recommendation.fundamentalScore >= 55
      ? 'wait'
      : 'pass';

  switch (verdict) {
    case 'good-entry':
      // Current price is good
      return currentPrice;

    case 'wait':
      // Use Fibonacci support level or 52W low with 5% buffer
      if (fibLevels) {
        // If current price is above 38.2%, suggest 38.2% level
        // If current price is below 38.2%, suggest 61.8% level
        const suggestedLevel =
          currentPrice > fibLevels.level382
            ? fibLevels.level382
            : fibLevels.level618;
        return Math.round(suggestedLevel * 100) / 100;
      }
      if (fiftyTwoWeekLow) {
        // 52W low + 5% buffer
        return Math.round(fiftyTwoWeekLow * 1.05 * 100) / 100;
      }
      // Fallback: 10% below current price
      return Math.round(currentPrice * 0.9 * 100) / 100;

    case 'pass':
    default:
      // Don't suggest a price for stocks to avoid
      return undefined;
  }
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
      <div className="quick-stat-label">
        <MetricLabel>{label}</MetricLabel>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <MetricValue sentiment={sentiment}>{value}</MetricValue>
    </div>
  );
}
