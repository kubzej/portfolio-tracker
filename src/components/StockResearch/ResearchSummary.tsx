import type { AnalystData } from '@/services/api/analysis';
import type { StockRecommendation } from '@/utils/recommendations';
import { cn } from '@/utils/cn';
import { ScoreCard, MetricRow, InfoTooltip } from '@/components/shared';
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
        <h3 className="section-title">Overall Rating</h3>
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
                Score
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
                Conviction
                <InfoTooltip text="Měří dlouhodobou kvalitu akcie pro držení. Zahrnuje stabilitu fundamentů (ROE, marže, růst), tržní pozici (analytici, target price) a momentum (insider aktivita)." />
              </div>
              <span className="score-value">
                {recommendation.convictionScore}
              </span>
            </div>
          </div>

          <div className="score-badges">
            <span
              className={cn(
                'technical-badge',
                recommendation.technicalBias.toLowerCase()
              )}
            >
              Technical: {recommendation.technicalBias}
            </span>
            <span
              className={cn(
                'conviction-badge',
                recommendation.convictionLevel.toLowerCase()
              )}
            >
              {recommendation.convictionLevel} Conviction
            </span>
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
        <div className="points-card strengths">
          <div className="points-header">
            <span className="points-icon">✓</span>
            <h4>Strengths</h4>
          </div>
          {strengths.length > 0 ? (
            <ul className="points-list">
              {strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          ) : (
            <p className="no-points">No strong positives</p>
          )}
        </div>
        <div className="points-card concerns">
          <div className="points-header">
            <span className="points-icon">!</span>
            <h4>Concerns</h4>
          </div>
          {concerns.length > 0 ? (
            <ul className="points-list">
              {concerns.map((c, i) => (
                <li key={i}>{c}</li>
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
            {buyStrategy.inBuyZone && (
              <div className="in-buy-zone-alert">
                🎯 Current price is in the buy zone
              </div>
            )}
            <div className="strategy-cards">
              <div className="strategy-card">
                <span className="strategy-label">Buy Zone</span>
                <span
                  className={cn(
                    'strategy-value',
                    buyStrategy.inBuyZone && 'positive'
                  )}
                >
                  {buyStrategy.buyZoneLow && buyStrategy.buyZoneHigh
                    ? `$${buyStrategy.buyZoneLow.toFixed(
                        2
                      )} – $${buyStrategy.buyZoneHigh.toFixed(2)}`
                    : '—'}
                </span>
              </div>
              <div className="strategy-card">
                <span className="strategy-label">Support</span>
                <span className="strategy-value">
                  {buyStrategy.supportPrice
                    ? `$${buyStrategy.supportPrice.toFixed(2)}`
                    : '—'}
                </span>
              </div>
              <div className="strategy-card">
                <span className="strategy-label">Risk/Reward</span>
                <span
                  className={cn(
                    'strategy-value',
                    buyStrategy.riskRewardRatio
                      ? buyStrategy.riskRewardRatio >= 2
                        ? 'positive'
                        : buyStrategy.riskRewardRatio >= 1
                        ? 'neutral'
                        : 'negative'
                      : undefined
                  )}
                >
                  {buyStrategy.riskRewardRatio
                    ? `${buyStrategy.riskRewardRatio}:1`
                    : '—'}
                </span>
              </div>
              <div className="strategy-card">
                <span className="strategy-label">DCA</span>
                <span
                  className={cn(
                    'strategy-value',
                    buyStrategy.dcaRecommendation === 'AGGRESSIVE'
                      ? 'positive'
                      : buyStrategy.dcaRecommendation === 'NO_DCA'
                      ? 'negative'
                      : 'neutral'
                  )}
                >
                  {buyStrategy.dcaRecommendation || '—'}
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Exit Strategy */}
      {exitStrategy && (
        <section className="summary-section">
          <h3 className="section-title">Exit Strategy</h3>
          <div className="entry-strategy">
            <div className="holding-period-badge">
              <span
                className={cn(
                  'period-badge',
                  exitStrategy.holdingPeriod.toLowerCase()
                )}
              >
                {exitStrategy.holdingPeriod === 'SWING'
                  ? '⚡ Swing Trade'
                  : exitStrategy.holdingPeriod === 'MEDIUM'
                  ? '📅 Medium Term'
                  : '🏦 Long Term Hold'}
              </span>
              <span className="period-reason">
                {exitStrategy.holdingReason}
              </span>
            </div>
            <div className="strategy-cards">
              <div className="strategy-card">
                <span className="strategy-label">Take Profit 1</span>
                <span className="strategy-value positive">
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
                </span>
              </div>
              <div className="strategy-card">
                <span className="strategy-label">Take Profit 2</span>
                <span className="strategy-value positive">
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
                </span>
              </div>
              <div className="strategy-card">
                <span className="strategy-label">Target</span>
                <span className="strategy-value positive">
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
                </span>
              </div>
              <div className="strategy-card">
                <span className="strategy-label">Stop Loss</span>
                <span className="strategy-value negative">
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
                </span>
              </div>
            </div>
            {exitStrategy.trailingStopPercent && (
              <div className="trailing-stop-note">
                💡 Consider {exitStrategy.trailingStopPercent}% trailing stop
                after first target
              </div>
            )}
          </div>
        </section>
      )}

      {/* Analyst Consensus - always show */}
      <section className="summary-section">
        <h3 className="section-title">Analyst Consensus</h3>
        <div className="analyst-consensus">
          {analystData.numberOfAnalysts && analystData.numberOfAnalysts > 0 ? (
            <>
              <div className="consensus-header">
                <span
                  className={cn(
                    'consensus-label',
                    getConsensusClass(analystData.consensusScore)
                  )}
                >
                  {analystData.recommendationKey ?? 'N/A'}
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
            </>
          ) : (
            <div className="no-analyst-data">
              <span className="no-data-icon">📊</span>
              <span>No analyst coverage available</span>
            </div>
          )}
        </div>
      </section>

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
