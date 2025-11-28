import type { AnalystData } from '@/services/api/analysis';
import type { StockRecommendation } from '@/utils/recommendations';
import { cn } from '@/utils/cn';
import { ScoreCard, MetricRow } from '@/components/shared';
import './ResearchSummary.css';

interface ResearchSummaryProps {
  recommendation: StockRecommendation;
  analystData: AnalystData;
}

export function ResearchSummary({
  recommendation,
  analystData,
}: ResearchSummaryProps) {
  const { breakdown, strengths, concerns, buyStrategy } = recommendation;

  return (
    <div className="research-summary">
      {/* Score Overview */}
      <section className="summary-section">
        <h3 className="section-title">Overall Rating</h3>
        <div className="score-overview">
          <div className="main-score">
            <div
              className={cn(
                'score-circle',
                getScoreClass(recommendation.compositeScore)
              )}
            >
              <span className="score-value">
                {recommendation.compositeScore}
              </span>
              <span className="score-max">/100</span>
            </div>
            <div className="score-meta">
              <span
                className={cn(
                  'conviction-badge',
                  recommendation.convictionLevel.toLowerCase()
                )}
              >
                {recommendation.convictionLevel} Conviction
              </span>
              <span className="technical-bias">
                Technical: <strong>{recommendation.technicalBias}</strong>
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Score Breakdown */}
      <section className="summary-section">
        <h3 className="section-title">Score Breakdown</h3>
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
        <div className="strengths-concerns-col">
          <h4 className="col-title positive">
            <span className="icon">✓</span> Strengths
          </h4>
          {strengths.length > 0 ? (
            <ul className="points-list">
              {strengths.map((s, i) => (
                <li key={i} className="point positive">
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-points">No strong positives</p>
          )}
        </div>
        <div className="strengths-concerns-col">
          <h4 className="col-title negative">
            <span className="icon">!</span> Concerns
          </h4>
          {concerns.length > 0 ? (
            <ul className="points-list">
              {concerns.map((c, i) => (
                <li key={i} className="point negative">
                  {c}
                </li>
              ))}
            </ul>
          ) : (
            <p className="no-points">No major concerns</p>
          )}
        </div>
      </section>

      {/* Entry Strategy */}
      {buyStrategy && (
        <section className="summary-section">
          <h3 className="section-title">Entry Strategy</h3>
          <div className="entry-strategy">
            <div className="strategy-grid">
              <MetricRow
                label="Buy Zone"
                value={
                  buyStrategy.buyZoneLow && buyStrategy.buyZoneHigh
                    ? `$${buyStrategy.buyZoneLow.toFixed(
                        2
                      )} – $${buyStrategy.buyZoneHigh.toFixed(2)}`
                    : null
                }
                sentiment={buyStrategy.inBuyZone ? 'positive' : 'neutral'}
              />
              <MetricRow
                label="Support Level"
                value={
                  buyStrategy.supportPrice
                    ? `$${buyStrategy.supportPrice.toFixed(2)}`
                    : null
                }
              />
              <MetricRow
                label="Risk/Reward"
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
              <MetricRow
                label="DCA Recommendation"
                value={buyStrategy.dcaRecommendation}
                sentiment={
                  buyStrategy.dcaRecommendation === 'AGGRESSIVE'
                    ? 'positive'
                    : buyStrategy.dcaRecommendation === 'NO_DCA'
                    ? 'negative'
                    : 'neutral'
                }
              />
            </div>
            {buyStrategy.inBuyZone && (
              <div className="in-buy-zone-alert">
                🎯 Current price is in the buy zone
              </div>
            )}
          </div>
        </section>
      )}

      {/* Analyst Consensus */}
      {analystData.numberOfAnalysts && analystData.numberOfAnalysts > 0 && (
        <section className="summary-section">
          <h3 className="section-title">Analyst Consensus</h3>
          <div className="analyst-consensus">
            <div className="consensus-header">
              <span
                className={cn(
                  'consensus-label',
                  getConsensusClass(analystData.consensusScore)
                )}
              >
                {analystData.recommendationKey}
              </span>
              <span className="analyst-count">
                {analystData.numberOfAnalysts} analysts
              </span>
            </div>
            <div className="ratings-bar">
              <RatingSegment
                count={analystData.strongBuy ?? 0}
                label="Strong Buy"
                type="strong-buy"
              />
              <RatingSegment
                count={analystData.buy ?? 0}
                label="Buy"
                type="buy"
              />
              <RatingSegment
                count={analystData.hold ?? 0}
                label="Hold"
                type="hold"
              />
              <RatingSegment
                count={analystData.sell ?? 0}
                label="Sell"
                type="sell"
              />
              <RatingSegment
                count={analystData.strongSell ?? 0}
                label="Strong Sell"
                type="strong-sell"
              />
            </div>
          </div>
        </section>
      )}

      {/* Insider Sentiment */}
      {analystData.insiderSentiment &&
        analystData.insiderSentiment.mspr !== null && (
          <section className="summary-section">
            <h3 className="section-title">Insider Sentiment</h3>
            <div className="insider-sentiment">
              <MetricRow
                label="MSPR (3M)"
                value={analystData.insiderSentiment.mspr.toFixed(1)}
                tooltip="Monthly Share Purchase Ratio. Positive = net buying, Negative = net selling"
                sentiment={
                  analystData.insiderSentiment.mspr > 15
                    ? 'positive'
                    : analystData.insiderSentiment.mspr < -15
                    ? 'negative'
                    : 'neutral'
                }
              />
              {analystData.insiderSentiment.change !== null && (
                <MetricRow
                  label="Net Shares Changed"
                  value={analystData.insiderSentiment.change.toLocaleString()}
                  sentiment={
                    analystData.insiderSentiment.change > 0
                      ? 'positive'
                      : analystData.insiderSentiment.change < 0
                      ? 'negative'
                      : 'neutral'
                  }
                />
              )}
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

function getConsensusClass(score: number | null): string {
  if (score === null) return '';
  if (score > 1) return 'strong-buy';
  if (score > 0.5) return 'buy';
  if (score > -0.5) return 'hold';
  if (score > -1) return 'sell';
  return 'strong-sell';
}

// Rating segment for the bar
interface RatingSegmentProps {
  count: number;
  label: string;
  type: string;
}

function RatingSegment({ count, label, type }: RatingSegmentProps) {
  if (count === 0) return null;

  return (
    <div
      className={cn('rating-segment', `rating-segment--${type}`)}
      title={`${label}: ${count}`}
    >
      <span className="rating-count">{count}</span>
    </div>
  );
}
