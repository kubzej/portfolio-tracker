import { useState, useEffect, useMemo } from 'react';
import { fetchSingleAnalystData } from '@/services/api/analysis';
import { fetchSingleTechnicalData } from '@/services/api/technical';
import type { AnalystData } from '@/services/api/analysis';
import type { TechnicalData } from '@/services/api/technical';
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
} from '@/components/shared';
import { Tabs } from '@/components/shared/Tabs';
import { ResearchSummary } from './ResearchSummary';
import { ResearchValuation } from './ResearchValuation';
import { ResearchTechnical } from './ResearchTechnical';
import { ResearchFundamentals } from './ResearchFundamentals';
import './StockResearch.css';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('summary');

  useEffect(() => {
    loadData();
  }, [ticker]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [analyst, technical] = await Promise.all([
        fetchSingleAnalystData(ticker, stockName, finnhubTicker),
        fetchSingleTechnicalData(ticker),
      ]);

      setAnalystData(analyst);
      setTechnicalData(technical);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load research data'
      );
    } finally {
      setLoading(false);
    }
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
      newsArticles: [],
      insiderTimeRange: 3,
    });
  }, [analystData, technicalData]);

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
          onRetry={loadData}
        />
      </div>
    );
  }

  const tabs = [
    { value: 'summary', label: 'Summary' },
    { value: 'fundamentals', label: 'Fundamentals' },
    { value: 'valuation', label: 'Valuation' },
    { value: 'technical', label: 'Technical' },
  ];

  // Get exchange info for non-US stock badges
  const exchangeInfo = getExchangeInfo(ticker);

  return (
    <div className="stock-research">
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
          value={analystData.recommendationKey ?? '—'}
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
        {recommendation && (
          <QuickStat
            label="Score"
            value={`${recommendation.compositeScore}/100`}
            sentiment={
              recommendation.compositeScore >= 60
                ? 'positive'
                : recommendation.compositeScore < 40
                ? 'negative'
                : 'neutral'
            }
          />
        )}
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
      </div>
    </div>
  );
}

// Quick stat component for the stats bar
interface QuickStatProps {
  label: string;
  value: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

function QuickStat({ label, value, sentiment }: QuickStatProps) {
  return (
    <div className="quick-stat">
      <span className="quick-stat-label">{label}</span>
      <span className={cn('quick-stat-value', sentiment)}>{value}</span>
    </div>
  );
}
