import type { AnalystData } from '@/services/api/analysis';
import type { StockRecommendation } from '@/utils/recommendations';
import { cn } from '@/utils/cn';
import { ScoreCard, InfoTooltip, IndicatorSignal } from '@/components/shared';
import {
  CardTitle,
  MetricLabel,
  MetricValue,
  Text,
  Muted,
  Badge,
} from '@/components/shared/Typography';
import './ResearchSummary.css';

interface ResearchSummaryProps {
  recommendation: StockRecommendation;
  analystData: AnalystData;
}

export function ResearchSummary({
  recommendation,
  analystData,
}: ResearchSummaryProps) {
  const { breakdown, strengths, concerns, buyStrategy, exitStrategy } =
    recommendation;

  return (
    <div className="research-summary">
      {/* Score Overview - both Conviction and Composite scores */}
      <section className="summary-section">
        <CardTitle>Overall Rating</CardTitle>
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
                <MetricLabel>Score</MetricLabel>
                <InfoTooltip text="Celkové skóre akcie. Vážený průměr: 25% technická analýza, 20% fundamenty, 20% portfolio kontext, 15% analytici, 10% zprávy, 10% insider aktivita." />
              </div>
              <span className="score-value">
                {recommendation.compositeScore}
              </span>
            </div>

            {/* Conviction Score */}
            <div
              className={cn(
                'score-item',
                getScoreClass(recommendation.convictionScore)
              )}
            >
              <div className="score-label">
                <MetricLabel>Conviction</MetricLabel>
                <InfoTooltip text="Měří dlouhodobou kvalitu akcie pro držení. Zahrnuje stabilitu fundamentů (ROE, marže, růst), tržní pozici (analytici, target price) a momentum (insider aktivita)." />
              </div>
              <span className="score-value">
                {recommendation.convictionScore}
              </span>
            </div>
          </div>

          <div className="score-badges">
            <Badge
              variant={
                recommendation.technicalBias === 'BULLISH'
                  ? 'buy'
                  : recommendation.technicalBias === 'BEARISH'
                  ? 'sell'
                  : 'hold'
              }
            >
              Technical: {recommendation.technicalBias}
            </Badge>
            <Badge
              variant={
                recommendation.convictionLevel === 'HIGH'
                  ? 'buy'
                  : recommendation.convictionLevel === 'LOW'
                  ? 'sell'
                  : 'hold'
              }
            >
              {recommendation.convictionLevel} Conviction
            </Badge>
          </div>
        </div>
      </section>

      {/* Score Breakdown */}
      <section className="summary-section">
        <CardTitle>Score Breakdown</CardTitle>
        <div className="score-breakdown-grid">
          {breakdown.map((component) => (
            <ScoreCard
              key={component.category}
              label={component.category}
              value={Math.round(component.percent)}
              showBar
              thresholds={{ good: 60, bad: 40 }}
              size="sm"
            />
          ))}
        </div>
      </section>

      {/* Strengths & Concerns */}
      <section className="summary-section summary-section--two-col">
        <div className="points-card strengths">
          <div className="points-header">
            <span className="points-icon">✓</span>
            <CardTitle>Strengths</CardTitle>
          </div>
          {strengths.length > 0 ? (
            <ul className="points-list">
              {strengths.map((s, i) => (
                <li key={i}>
                  <Text>{s}</Text>
                </li>
              ))}
            </ul>
          ) : (
            <Muted>No strong positives</Muted>
          )}
        </div>
        <div className="points-card concerns">
          <div className="points-header">
            <span className="points-icon">!</span>
            <CardTitle>Concerns</CardTitle>
          </div>
          {concerns.length > 0 ? (
            <ul className="points-list">
              {concerns.map((c, i) => (
                <li key={i}>
                  <Text>{c}</Text>
                </li>
              ))}
            </ul>
          ) : (
            <Muted>No major concerns</Muted>
          )}
        </div>
      </section>

      {/* Entry Strategy */}
      {buyStrategy && (
        <section className="summary-section">
          <CardTitle>Entry Strategy</CardTitle>
          <div className="entry-strategy">
            {buyStrategy.inBuyZone && (
              <IndicatorSignal type="bullish">
                Current price is in the buy zone
              </IndicatorSignal>
            )}
            <div className="strategy-cards">
              <div className="strategy-card">
                <MetricLabel>Buy Zone</MetricLabel>
                <MetricValue
                  sentiment={buyStrategy.inBuyZone ? 'positive' : undefined}
                >
                  {buyStrategy.buyZoneLow && buyStrategy.buyZoneHigh
                    ? `$${buyStrategy.buyZoneLow.toFixed(
                        2
                      )} – $${buyStrategy.buyZoneHigh.toFixed(2)}`
                    : '—'}
                </MetricValue>
              </div>
              <div className="strategy-card">
                <MetricLabel>Support</MetricLabel>
                <MetricValue>
                  {buyStrategy.supportPrice
                    ? `$${buyStrategy.supportPrice.toFixed(2)}`
                    : '—'}
                </MetricValue>
              </div>
              <div className="strategy-card">
                <MetricLabel>Risk/Reward</MetricLabel>
                <MetricValue
                  sentiment={
                    buyStrategy.riskRewardRatio
                      ? buyStrategy.riskRewardRatio >= 2
                        ? 'positive'
                        : buyStrategy.riskRewardRatio >= 1
                        ? 'neutral'
                        : 'negative'
                      : undefined
                  }
                >
                  {buyStrategy.riskRewardRatio
                    ? `${buyStrategy.riskRewardRatio}:1`
                    : '—'}
                </MetricValue>
              </div>
              <div className="strategy-card">
                <MetricLabel>DCA</MetricLabel>
                <MetricValue
                  sentiment={
                    buyStrategy.dcaRecommendation === 'AGGRESSIVE'
                      ? 'positive'
                      : buyStrategy.dcaRecommendation === 'NO_DCA'
                      ? 'negative'
                      : 'neutral'
                  }
                >
                  {buyStrategy.dcaRecommendation || '—'}
                </MetricValue>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Exit Strategy */}
      {exitStrategy && (
        <section className="summary-section">
          <CardTitle>Exit Strategy</CardTitle>
          <div className="entry-strategy">
            <div className="holding-period-badge">
              <Badge
                variant={
                  exitStrategy.holdingPeriod === 'LONG'
                    ? 'buy'
                    : exitStrategy.holdingPeriod === 'SWING'
                    ? 'sell'
                    : 'hold'
                }
              >
                {exitStrategy.holdingPeriod === 'SWING'
                  ? 'Swing Trade'
                  : exitStrategy.holdingPeriod === 'MEDIUM'
                  ? 'Medium Term'
                  : 'Long Term Hold'}
              </Badge>
              <Text color="secondary">{exitStrategy.holdingReason}</Text>
            </div>
            <div className="strategy-cards">
              <div className="strategy-card">
                <MetricLabel>Take Profit 1</MetricLabel>
                <MetricValue sentiment="positive">
                  {exitStrategy.takeProfit1
                    ? `$${exitStrategy.takeProfit1.toFixed(2)}`
                    : '—'}
                  {exitStrategy.takeProfit1 &&
                    recommendation.currentPrice > 0 && (
                      <span className="strategy-percent">
                        {' '}
                        (+
                        {(
                          ((exitStrategy.takeProfit1 -
                            recommendation.currentPrice) /
                            recommendation.currentPrice) *
                          100
                        ).toFixed(0)}
                        %)
                      </span>
                    )}
                </MetricValue>
              </div>
              <div className="strategy-card">
                <MetricLabel>Take Profit 2</MetricLabel>
                <MetricValue sentiment="positive">
                  {exitStrategy.takeProfit2
                    ? `$${exitStrategy.takeProfit2.toFixed(2)}`
                    : '—'}
                  {exitStrategy.takeProfit2 &&
                    recommendation.currentPrice > 0 && (
                      <span className="strategy-percent">
                        {' '}
                        (+
                        {(
                          ((exitStrategy.takeProfit2 -
                            recommendation.currentPrice) /
                            recommendation.currentPrice) *
                          100
                        ).toFixed(0)}
                        %)
                      </span>
                    )}
                </MetricValue>
              </div>
              <div className="strategy-card">
                <MetricLabel>Target</MetricLabel>
                <MetricValue sentiment="positive">
                  {exitStrategy.takeProfit3
                    ? `$${exitStrategy.takeProfit3.toFixed(2)}`
                    : '—'}
                  {exitStrategy.takeProfit3 &&
                    recommendation.currentPrice > 0 && (
                      <span className="strategy-percent">
                        {' '}
                        (+
                        {(
                          ((exitStrategy.takeProfit3 -
                            recommendation.currentPrice) /
                            recommendation.currentPrice) *
                          100
                        ).toFixed(0)}
                        %)
                      </span>
                    )}
                </MetricValue>
              </div>
              <div className="strategy-card">
                <MetricLabel>Stop Loss</MetricLabel>
                <MetricValue sentiment="negative">
                  {exitStrategy.stopLoss
                    ? `$${exitStrategy.stopLoss.toFixed(2)}`
                    : '—'}
                  {exitStrategy.stopLoss && recommendation.currentPrice > 0 && (
                    <span className="strategy-percent">
                      {' '}
                      (
                      {(
                        ((exitStrategy.stopLoss - recommendation.currentPrice) /
                          recommendation.currentPrice) *
                        100
                      ).toFixed(0)}
                      %)
                    </span>
                  )}
                </MetricValue>
              </div>
            </div>
            {exitStrategy.trailingStopPercent && (
              <IndicatorSignal type="info">
                Consider {exitStrategy.trailingStopPercent}% trailing stop after
                first target
              </IndicatorSignal>
            )}
          </div>
        </section>
      )}

      {/* Analyst Consensus - always show */}
      <section className="summary-section">
        <div className="section-title-row">
          <CardTitle>Analyst Consensus</CardTitle>
          {analystData.numberOfAnalysts && analystData.numberOfAnalysts > 0 && (
            <Text color="secondary" size="sm">
              {analystData.numberOfAnalysts} analysts
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
              <Muted>No analyst coverage available</Muted>
            </div>
          )}
        </div>
      </section>

      {/* Insider Sentiment */}
      {analystData.insiderSentiment &&
        analystData.insiderSentiment.mspr !== null && (
          <section className="summary-section">
            <div className="section-title-row">
              <CardTitle>Insider Sentiment</CardTitle>
            </div>
            <div className="strategy-cards insider-cards">
              <div className="strategy-card">
                <MetricLabel>MSPR (3M)</MetricLabel>
                <MetricValue
                  sentiment={
                    analystData.insiderSentiment.mspr > 15
                      ? 'positive'
                      : analystData.insiderSentiment.mspr < -15
                      ? 'negative'
                      : 'neutral'
                  }
                >
                  {analystData.insiderSentiment.mspr > 0 ? '+' : ''}
                  {analystData.insiderSentiment.mspr.toFixed(1)}
                </MetricValue>
              </div>
              {analystData.insiderSentiment.change !== null && (
                <div className="strategy-card">
                  <MetricLabel>Net Shares</MetricLabel>
                  <MetricValue
                    sentiment={
                      analystData.insiderSentiment.change > 0
                        ? 'positive'
                        : analystData.insiderSentiment.change < 0
                        ? 'negative'
                        : 'neutral'
                    }
                  >
                    {analystData.insiderSentiment.change > 0 ? '+' : ''}
                    {analystData.insiderSentiment.change.toLocaleString()}
                  </MetricValue>
                </div>
              )}
              <div className="strategy-card">
                <MetricLabel>Signal</MetricLabel>
                <MetricValue
                  sentiment={
                    analystData.insiderSentiment.mspr > 15
                      ? 'positive'
                      : analystData.insiderSentiment.mspr < -15
                      ? 'negative'
                      : 'neutral'
                  }
                >
                  {analystData.insiderSentiment.mspr > 15
                    ? 'Buying'
                    : analystData.insiderSentiment.mspr < -15
                    ? 'Selling'
                    : 'Neutral'}
                </MetricValue>
              </div>
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

// Simple Analyst Ratings display
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
