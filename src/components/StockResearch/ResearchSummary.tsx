import type { AnalystData } from '@/services/api/analysis';
import type { StockRecommendation } from '@/utils/recommendations';
import { cn } from '@/utils/cn';
import { InfoTooltip, MetricCard } from '@/components/shared';
import {
  CardTitle,
  MetricLabel,
  MetricValue,
  Text,
  Muted,
  Badge,
} from '@/components/shared/Typography';
import { ResearchVerdict } from './ResearchVerdict';
import { EntryPointAnalysis } from './EntryPointAnalysis';
import { RiskAssessment } from './RiskAssessment';
import './ResearchSummary.css';

interface ResearchSummaryProps {
  recommendation: StockRecommendation;
  analystData: AnalystData;
  onAddToWatchlist?: () => void;
  onTrack?: () => void;
  isTracked?: boolean;
  trackLoading?: boolean;
}

export function ResearchSummary({
  recommendation,
  analystData,
  onAddToWatchlist,
  onTrack,
  isTracked,
  trackLoading,
}: ResearchSummaryProps) {
  const { breakdown } = recommendation;

  return (
    <div className="research-summary">
      {/* Research Verdict - BUY/WAIT/PASS with Watchlist button */}
      <ResearchVerdict
        recommendation={recommendation}
        onAddToWatchlist={onAddToWatchlist}
        onTrack={onTrack}
        isTracked={isTracked}
        trackLoading={trackLoading}
      />

      {/* Score Overview - Composite + Conviction */}
      <section className="summary-section">
        <CardTitle>Celkové hodnocení</CardTitle>
        <div className="score-overview">
          <div className="dual-scores">
            {/* Composite Score */}
            <div
              className={cn(
                'score-item',
                getScoreClass(recommendation.compositeScore)
              )}
            >
              <div className="score-label">
                <MetricLabel>Skóre</MetricLabel>
                <InfoTooltip text="**Celkové skóre** | Komplexní hodnocení akcie (0-100). Kombinuje 5 klíčových oblastí: | • Technická analýza (30%) | • Fundamenty (25%) | • Názory analytiků (20%) | • Insider aktivita (15%) | • Zprávy a sentiment (10%)" />
              </div>
              <MetricValue size="xl">
                {recommendation.compositeScore}
              </MetricValue>
            </div>

            {/* Conviction Score */}
            <div
              className={cn(
                'score-item',
                getScoreClass(recommendation.convictionScore)
              )}
            >
              <div className="score-label">
                <MetricLabel>Přesvědčení</MetricLabel>
                <InfoTooltip text="**Skóre přesvědčení (Conviction)** | Měří kvalitu a bezpečnost akcie pro dlouhodobé držení. | • Vysoké skóre = Kvalitní firma se stabilním růstem a zisky | • Nízké skóre = Riziková nebo spekulativní investice." />
              </div>
              <MetricValue size="xl">
                {recommendation.convictionScore}
              </MetricValue>
            </div>
          </div>
        </div>
      </section>

      {/* Score Breakdown */}
      <section className="summary-section">
        <CardTitle>Rozpad skóre</CardTitle>
        <div className="breakdown-list">
          {breakdown.map((b) => (
            <div key={b.category} className="breakdown-item">
              <div className="breakdown-header">
                <div className="breakdown-title">
                  <Text weight="semibold">{b.category}</Text>
                  {b.category === 'Technika' && (
                    <Badge
                      variant={
                        recommendation.technicalBias === 'BULLISH'
                          ? 'buy'
                          : recommendation.technicalBias === 'BEARISH'
                          ? 'sell'
                          : 'hold'
                      }
                    >
                      {recommendation.technicalBias}
                    </Badge>
                  )}
                </div>
                <Text
                  weight="bold"
                  color={
                    b.sentiment === 'bullish'
                      ? 'success'
                      : b.sentiment === 'bearish'
                      ? 'danger'
                      : 'secondary'
                  }
                >
                  {b.percent.toFixed(0)}%
                </Text>
              </div>
              <div className="breakdown-bar">
                <div
                  className={`breakdown-fill ${b.sentiment}`}
                  style={{ width: `${b.percent}%` }}
                />
              </div>
              {b.details.length > 0 && (
                <div className="breakdown-details">
                  {b.details.slice(0, 5).map((d, i) => (
                    <Text key={i} size="sm" color="muted">
                      {d}
                    </Text>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Entry Point Analysis */}
      <EntryPointAnalysis
        recommendation={recommendation}
        analystTarget={analystData.analystTargetPrice ?? null}
      />

      {/* Risk Assessment */}
      <RiskAssessment
        fundamentals={analystData.fundamentals}
        volatilityPercent={null}
      />

      {/* Analyst Consensus */}
      <section className="summary-section">
        <div className="section-title-row">
          <CardTitle>Konsenzus analytiků</CardTitle>
          {analystData.numberOfAnalysts && analystData.numberOfAnalysts > 0 && (
            <Text color="secondary" size="sm">
              {analystData.numberOfAnalysts} analytiků
            </Text>
          )}
        </div>
        <div className="analyst-consensus">
          {analystData.numberOfAnalysts && analystData.numberOfAnalysts > 0 ? (
            <AnalystRatings
              strongBuy={analystData.strongBuy ?? 0}
              buy={analystData.buy ?? 0}
              hold={analystData.hold ?? 0}
              sell={analystData.sell ?? 0}
              strongSell={analystData.strongSell ?? 0}
            />
          ) : (
            <div className="no-analyst-data">
              <Muted>Není k dispozici pokrytí analytiky</Muted>
            </div>
          )}
        </div>
      </section>

      {/* Insider Sentiment */}
      {analystData.insiderSentiment &&
        analystData.insiderSentiment.mspr !== null && (
          <section className="summary-section">
            <CardTitle>Insider sentiment</CardTitle>
            <div className="insider-grid">
              <MetricCard
                label="MSPR (3M)"
                value={`${
                  analystData.insiderSentiment.mspr > 0 ? '+' : ''
                }${analystData.insiderSentiment.mspr.toFixed(1)}`}
                sentiment={
                  analystData.insiderSentiment.mspr > 15
                    ? 'positive'
                    : analystData.insiderSentiment.mspr < -15
                    ? 'negative'
                    : 'neutral'
                }
                tooltip={
                  <InfoTooltip text="**MSPR** | Monthly Share Purchase Ratio. | Pozitivní = insideři kupují | Negativní = insideři prodávají" />
                }
              />
              {analystData.insiderSentiment.change !== null && (
                <MetricCard
                  label="Net Shares"
                  value={`${
                    analystData.insiderSentiment.change > 0 ? '+' : ''
                  }${analystData.insiderSentiment.change.toLocaleString()}`}
                  sentiment={
                    analystData.insiderSentiment.change > 0
                      ? 'positive'
                      : analystData.insiderSentiment.change < 0
                      ? 'negative'
                      : 'neutral'
                  }
                />
              )}
              <MetricCard
                label="Signál"
                value={
                  analystData.insiderSentiment.mspr > 15
                    ? 'Nákupy'
                    : analystData.insiderSentiment.mspr < -15
                    ? 'Prodeje'
                    : 'Neutrální'
                }
                sentiment={
                  analystData.insiderSentiment.mspr > 15
                    ? 'positive'
                    : analystData.insiderSentiment.mspr < -15
                    ? 'negative'
                    : 'neutral'
                }
              />
            </div>
          </section>
        )}
    </div>
  );
}

// Helper functions
function getScoreClass(score: number): string {
  if (score >= 70) return 'score-high';
  if (score >= 50) return 'score-medium';
  return 'score-low';
}

// Analyst Ratings display
interface AnalystRatingsProps {
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

function AnalystRatings({
  strongBuy,
  buy,
  hold,
  sell,
  strongSell,
}: AnalystRatingsProps) {
  const ratings = [
    {
      key: 'strong-buy',
      label: 'Strong Buy',
      count: strongBuy,
      color: '#059669',
    },
    { key: 'buy', label: 'Buy', count: buy, color: '#10b981' },
    { key: 'hold', label: 'Hold', count: hold, color: '#f59e0b' },
    { key: 'sell', label: 'Sell', count: sell, color: '#f97316' },
    {
      key: 'strong-sell',
      label: 'Strong Sell',
      count: strongSell,
      color: '#ef4444',
    },
  ];

  return (
    <div className="ratings-labels">
      {ratings.map((rating) => (
        <div key={rating.key} className="rating-label-item">
          <span
            className="rating-dot"
            style={{ backgroundColor: rating.color }}
          />
          <Text size="sm">{rating.label}</Text>
          <Text
            size="sm"
            weight="semibold"
            color={rating.count === 0 ? 'muted' : undefined}
          >
            {rating.count}
          </Text>
        </div>
      ))}
    </div>
  );
}
