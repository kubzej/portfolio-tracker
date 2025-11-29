import type { AnalystData } from '@/services/api/analysis';
import type { StockRecommendation } from '@/utils/recommendations';
import { cn } from '@/utils/cn';
import { ScoreCard, InfoTooltip } from '@/components/shared';
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
                Current price is in the buy zone
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
                  ? 'Swing Trade'
                  : exitStrategy.holdingPeriod === 'MEDIUM'
                  ? 'Medium Term'
                  : 'Long Term Hold'}
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
                Consider {exitStrategy.trailingStopPercent}% trailing stop after
                first target
              </div>
            )}
          </div>
        </section>
      )}

      {/* Analyst Consensus - always show */}
      <section className="summary-section">
        <h3 className="section-title">
          Analyst Consensus
          {analystData.numberOfAnalysts && analystData.numberOfAnalysts > 0 && (
            <span className="title-meta">
              {analystData.numberOfAnalysts} analysts
            </span>
          )}
        </h3>
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
              <span className="no-data-icon">—</span>
              <span>No analyst coverage available</span>
            </div>
          )}
        </div>
      </section>

      {/* Insider Sentiment */}
      {analystData.insiderSentiment &&
        analystData.insiderSentiment.mspr !== null && (
          <section className="summary-section">
            <h3 className="section-title">
              Insider Sentiment
              <InfoTooltip text="Aktivita insiderů (vedení, ředitelé) za posledních 3 měsíce. MSPR = Monthly Share Purchase Ratio. Kladné = nákupy, záporné = prodeje. Silný nákup insiderů je pozitivní signál důvěry ve firmu." />
            </h3>
            <div className="strategy-cards insider-cards">
              <div className="strategy-card">
                <span className="strategy-label">MSPR (3M)</span>
                <span
                  className={cn(
                    'strategy-value',
                    analystData.insiderSentiment.mspr > 15
                      ? 'positive'
                      : analystData.insiderSentiment.mspr < -15
                      ? 'negative'
                      : 'neutral'
                  )}
                >
                  {analystData.insiderSentiment.mspr > 0 ? '+' : ''}
                  {analystData.insiderSentiment.mspr.toFixed(1)}
                </span>
              </div>
              {analystData.insiderSentiment.change !== null && (
                <div className="strategy-card">
                  <span className="strategy-label">Net Shares</span>
                  <span
                    className={cn(
                      'strategy-value',
                      analystData.insiderSentiment.change > 0
                        ? 'positive'
                        : analystData.insiderSentiment.change < 0
                        ? 'negative'
                        : 'neutral'
                    )}
                  >
                    {analystData.insiderSentiment.change > 0 ? '+' : ''}
                    {analystData.insiderSentiment.change.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="strategy-card">
                <span className="strategy-label">Signál</span>
                <span
                  className={cn(
                    'strategy-value',
                    analystData.insiderSentiment.mspr > 15
                      ? 'positive'
                      : analystData.insiderSentiment.mspr < -15
                      ? 'negative'
                      : 'neutral'
                  )}
                >
                  {analystData.insiderSentiment.mspr > 15
                    ? 'Buying'
                    : analystData.insiderSentiment.mspr < -15
                    ? 'Selling'
                    : 'Neutral'}
                </span>
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
          <span className="rating-label-text">{rating.label}</span>
          <span
            className={cn('rating-label-count', rating.count === 0 && 'zero')}
          >
            {rating.count}
          </span>
        </div>
      ))}
    </div>
  );
}
