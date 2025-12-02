import type { AnalystData } from '@/services/api/analysis';
import type { StockRecommendation } from '@/utils/recommendations';
import { cn } from '@/utils/cn';
import {
  ScoreCard,
  InfoTooltip,
  IndicatorSignal,
  MetricCard,
} from '@/components/shared';
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
                <InfoTooltip text="**Celkové skóre akcie** | Vážený průměr všech analytických faktorů: | • 25% technická analýza | • 20% fundamenty | • 20% portfolio kontext | • 15% analytici | • 10% zprávy | • 10% insider aktivita" />
              </div>
              <MetricValue size="xl">
                {recommendation.compositeScore}
              </MetricValue>
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
                <InfoTooltip text="**Conviction Score** | Dlouhodobá kvalita akcie pro držení. | Zahrnuje stabilitu fundamentů (ROE, marže, růst), tržní pozici a momentum." />
              </div>
              <MetricValue size="xl">
                {recommendation.convictionScore}
              </MetricValue>
              <Badge
                variant={
                  recommendation.convictionLevel === 'HIGH'
                    ? 'buy'
                    : recommendation.convictionLevel === 'LOW'
                    ? 'sell'
                    : 'hold'
                }
              >
                {recommendation.convictionLevel}
              </Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Score Breakdown */}
      <section className="summary-section">
        <CardTitle>Rozpad skóre</CardTitle>
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
            <CardTitle>Silné stránky</CardTitle>
          </div>
          {strengths.length > 0 ? (
            <div className="points-list">
              {strengths.map((s, i) => (
                <div key={i} className="points-list-item">
                  <Text>{s}</Text>
                </div>
              ))}
            </div>
          ) : (
            <Muted>Žádné výrazné pozitiva</Muted>
          )}
        </div>
        <div className="points-card concerns">
          <div className="points-header">
            <span className="points-icon">!</span>
            <CardTitle>Obavy</CardTitle>
          </div>
          {concerns.length > 0 ? (
            <div className="points-list">
              {concerns.map((c, i) => (
                <div key={i} className="points-list-item">
                  <Text>{c}</Text>
                </div>
              ))}
            </div>
          ) : (
            <Muted>Žádné vážné obavy</Muted>
          )}
        </div>
      </section>

      {/* Entry Strategy */}
      {buyStrategy && (
        <section className="summary-section">
          <CardTitle>Vstupní strategie</CardTitle>
          <div className="entry-strategy">
            {buyStrategy.inBuyZone && (
              <IndicatorSignal type="bullish">
                Aktuální cena je v nákupní zóně
              </IndicatorSignal>
            )}
            <div className="strategy-grid">
              <MetricCard
                label="Nákupní zóna"
                value={
                  buyStrategy.buyZoneLow && buyStrategy.buyZoneHigh
                    ? `$${buyStrategy.buyZoneLow.toFixed(
                        2
                      )} – $${buyStrategy.buyZoneHigh.toFixed(2)}`
                    : null
                }
                sentiment={buyStrategy.inBuyZone ? 'positive' : undefined}
              />
              <MetricCard
                label="Podpora"
                value={
                  buyStrategy.supportPrice
                    ? `$${buyStrategy.supportPrice.toFixed(2)}`
                    : null
                }
              />
              <MetricCard
                label="Riziko/Výnos"
                value={
                  buyStrategy.riskRewardRatio
                    ? `${buyStrategy.riskRewardRatio}:1`
                    : null
                }
                sentiment={
                  buyStrategy.riskRewardRatio
                    ? buyStrategy.riskRewardRatio >= 2
                      ? 'positive'
                      : buyStrategy.riskRewardRatio >= 1
                      ? 'neutral'
                      : 'negative'
                    : undefined
                }
              />
              <MetricCard
                label="DCA"
                value={buyStrategy.dcaRecommendation || null}
                sentiment={
                  buyStrategy.dcaRecommendation === 'AGGRESSIVE'
                    ? 'positive'
                    : buyStrategy.dcaRecommendation === 'NO_DCA'
                    ? 'negative'
                    : 'neutral'
                }
              />
            </div>
          </div>
        </section>
      )}

      {/* Exit Strategy */}
      {exitStrategy && (
        <section className="summary-section">
          <CardTitle>Strategie výstupu</CardTitle>
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
                  ? 'Krátkodobě'
                  : exitStrategy.holdingPeriod === 'MEDIUM'
                  ? 'Střednědobě'
                  : 'Dlouhodobě'}
              </Badge>
              <Text color="secondary">{exitStrategy.holdingReason}</Text>
            </div>
            <div className="strategy-grid">
              <MetricCard
                label="TP1"
                value={
                  exitStrategy.takeProfit1
                    ? `$${exitStrategy.takeProfit1.toFixed(2)}`
                    : null
                }
                subtext={
                  exitStrategy.takeProfit1 && recommendation.currentPrice > 0
                    ? `+${(
                        ((exitStrategy.takeProfit1 -
                          recommendation.currentPrice) /
                          recommendation.currentPrice) *
                        100
                      ).toFixed(0)}%`
                    : undefined
                }
                sentiment="positive"
              />
              <MetricCard
                label="TP2"
                value={
                  exitStrategy.takeProfit2
                    ? `$${exitStrategy.takeProfit2.toFixed(2)}`
                    : null
                }
                subtext={
                  exitStrategy.takeProfit2 && recommendation.currentPrice > 0
                    ? `+${(
                        ((exitStrategy.takeProfit2 -
                          recommendation.currentPrice) /
                          recommendation.currentPrice) *
                        100
                      ).toFixed(0)}%`
                    : undefined
                }
                sentiment="positive"
              />
              <MetricCard
                label="Cíl"
                value={
                  exitStrategy.takeProfit3
                    ? `$${exitStrategy.takeProfit3.toFixed(2)}`
                    : null
                }
                subtext={
                  exitStrategy.takeProfit3 && recommendation.currentPrice > 0
                    ? `+${(
                        ((exitStrategy.takeProfit3 -
                          recommendation.currentPrice) /
                          recommendation.currentPrice) *
                        100
                      ).toFixed(0)}%`
                    : undefined
                }
                sentiment="positive"
              />
              <MetricCard
                label="Stop Loss"
                value={
                  exitStrategy.stopLoss
                    ? `$${exitStrategy.stopLoss.toFixed(2)}`
                    : null
                }
                subtext={
                  exitStrategy.stopLoss && recommendation.currentPrice > 0
                    ? `${(
                        ((exitStrategy.stopLoss - recommendation.currentPrice) /
                          recommendation.currentPrice) *
                        100
                      ).toFixed(0)}%`
                    : undefined
                }
                sentiment="negative"
              />
            </div>
            {exitStrategy.trailingStopPercent && (
              <IndicatorSignal type="info">
                Zvažte {exitStrategy.trailingStopPercent}% trailing stop po
                prvním cíli
              </IndicatorSignal>
            )}
          </div>
        </section>
      )}

      {/* Analyst Consensus - always show */}
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
            <div className="section-title-row">
              <CardTitle>Insider sentiment</CardTitle>
            </div>
            <div className="strategy-grid insider-grid">
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
