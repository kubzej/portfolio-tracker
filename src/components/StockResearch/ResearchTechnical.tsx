import type { TechnicalData } from '@/services/api/technical';
import type { StockRecommendation } from '@/utils/recommendations';
import { MetricRow, ScoreCard } from '@/components/shared';
import { cn } from '@/utils/cn';
import './ResearchTechnical.css';

interface ResearchTechnicalProps {
  technicalData: TechnicalData | null;
  recommendation: StockRecommendation | null;
}

export function ResearchTechnical({
  technicalData,
  recommendation,
}: ResearchTechnicalProps) {
  const tech = technicalData;

  if (!tech) {
    return (
      <div className="research-technical">
        <div className="no-data">No technical data available</div>
      </div>
    );
  }

  return (
    <div className="research-technical">
      {/* Technical Bias */}
      {recommendation && (
        <section className="technical-section">
          <h3 className="section-title">Technical Outlook</h3>
          <div className="technical-outlook">
            <div
              className={cn(
                'bias-indicator',
                recommendation.technicalBias.toLowerCase()
              )}
            >
              {recommendation.technicalBias}
            </div>
            <div className="technical-score">
              <ScoreCard
                label="Technical Score"
                value={recommendation.technicalScore}
                showBar
                thresholds={{ good: 60, bad: 40 }}
              />
            </div>
          </div>
        </section>
      )}

      {/* Moving Averages */}
      <section className="technical-section">
        <h3 className="section-title">Moving Averages</h3>
        <div className="metrics-grid">
          <MetricRow
            label="SMA 50"
            value={tech.sma50 ? `$${tech.sma50.toFixed(2)}` : null}
            sentiment={getSMASentiment(tech.priceVsSma50)}
            tooltip="50-day Simple Moving Average"
          />
          <MetricRow
            label="SMA 200"
            value={tech.sma200 ? `$${tech.sma200.toFixed(2)}` : null}
            sentiment={getSMASentiment(tech.priceVsSma200)}
            tooltip="200-day Simple Moving Average"
          />
          <MetricRow
            label="Price vs SMA50"
            value={
              tech.priceVsSma50 !== null
                ? `${tech.priceVsSma50.toFixed(1)}%`
                : null
            }
            sentiment={getSMASentiment(tech.priceVsSma50)}
          />
          <MetricRow
            label="Price vs SMA200"
            value={
              tech.priceVsSma200 !== null
                ? `${tech.priceVsSma200.toFixed(1)}%`
                : null
            }
            sentiment={getSMASentiment(tech.priceVsSma200)}
          />
        </div>
        {tech.priceVsSma50 !== null && tech.priceVsSma200 !== null && (
          <div className="sma-interpretation">
            {getSMAInterpretation(tech.priceVsSma50, tech.priceVsSma200)}
          </div>
        )}
      </section>

      {/* Momentum Indicators */}
      <section className="technical-section">
        <h3 className="section-title">Momentum Indicators</h3>
        <div className="indicators-grid">
          {/* RSI */}
          <div className="indicator-card">
            <div className="indicator-header">
              <span className="indicator-name">RSI (14)</span>
              <span
                className={cn(
                  'indicator-signal',
                  getRSISignalClass(tech.rsi14)
                )}
              >
                {getRSISignal(tech.rsi14)}
              </span>
            </div>
            <div className="indicator-value">
              {tech.rsi14 !== null ? tech.rsi14.toFixed(1) : '—'}
            </div>
            <div className="indicator-bar">
              <div className="indicator-bar-track">
                <div className="indicator-bar-zones">
                  <div className="zone oversold" />
                  <div className="zone neutral" />
                  <div className="zone overbought" />
                </div>
                {tech.rsi14 !== null && (
                  <div
                    className="indicator-bar-marker"
                    style={{
                      left: `${Math.min(Math.max(tech.rsi14, 0), 100)}%`,
                    }}
                  />
                )}
              </div>
              <div className="indicator-bar-labels">
                <span>0</span>
                <span>30</span>
                <span>70</span>
                <span>100</span>
              </div>
            </div>
          </div>

          {/* Stochastic */}
          <div className="indicator-card">
            <div className="indicator-header">
              <span className="indicator-name">Stochastic</span>
              <span
                className={cn(
                  'indicator-signal',
                  getStochSignalClass(tech.stochasticK)
                )}
              >
                {tech.stochasticSignal ?? '—'}
              </span>
            </div>
            <div className="indicator-values">
              <span>%K: {tech.stochasticK?.toFixed(1) ?? '—'}</span>
              <span>%D: {tech.stochasticD?.toFixed(1) ?? '—'}</span>
            </div>
          </div>

          {/* MACD */}
          <div className="indicator-card">
            <div className="indicator-header">
              <span className="indicator-name">MACD</span>
              <span
                className={cn(
                  'indicator-signal',
                  getMACDSignalClass(tech.macdHistogram)
                )}
              >
                {tech.macdTrend ?? '—'}
              </span>
            </div>
            <div className="macd-values">
              <MetricRow label="MACD" value={tech.macd?.toFixed(3) ?? null} />
              <MetricRow
                label="Signal"
                value={tech.macdSignal?.toFixed(3) ?? null}
              />
              <MetricRow
                label="Histogram"
                value={tech.macdHistogram?.toFixed(3) ?? null}
                sentiment={
                  tech.macdHistogram !== null
                    ? tech.macdHistogram > 0
                      ? 'positive'
                      : 'negative'
                    : undefined
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* Bollinger Bands */}
      <section className="technical-section">
        <h3 className="section-title">Bollinger Bands</h3>
        <div className="metrics-grid">
          <MetricRow
            label="Upper Band"
            value={
              tech.bollingerUpper ? `$${tech.bollingerUpper.toFixed(2)}` : null
            }
          />
          <MetricRow
            label="Middle Band"
            value={
              tech.bollingerMiddle
                ? `$${tech.bollingerMiddle.toFixed(2)}`
                : null
            }
          />
          <MetricRow
            label="Lower Band"
            value={
              tech.bollingerLower ? `$${tech.bollingerLower.toFixed(2)}` : null
            }
          />
          <MetricRow
            label="Position"
            value={
              tech.bollingerPosition !== null
                ? `${tech.bollingerPosition.toFixed(0)}%`
                : null
            }
            sentiment={getBollingerSentiment(tech.bollingerPosition)}
          />
        </div>
        {tech.bollingerSignal && (
          <div
            className={cn(
              'bollinger-signal',
              getBollingerSignalClass(tech.bollingerSignal)
            )}
          >
            {tech.bollingerSignal}
          </div>
        )}
      </section>

      {/* Trend & Volume */}
      <section className="technical-section">
        <h3 className="section-title">Trend & Volume</h3>
        <div className="metrics-grid">
          <MetricRow
            label="ADX"
            value={tech.adx?.toFixed(1) ?? null}
            tooltip="Average Directional Index - Trend strength. Above 25 = strong trend."
            sentiment={
              tech.adx !== null
                ? tech.adx > 25
                  ? 'positive'
                  : 'neutral'
                : undefined
            }
          />
          <MetricRow
            label="+DI"
            value={tech.plusDI?.toFixed(1) ?? null}
            tooltip="Positive Directional Indicator"
          />
          <MetricRow
            label="-DI"
            value={tech.minusDI?.toFixed(1) ?? null}
            tooltip="Negative Directional Indicator"
          />
          <MetricRow
            label="ATR"
            value={tech.atr14 ? `$${tech.atr14.toFixed(2)}` : null}
            tooltip="Average True Range - Volatility measure"
          />
          <MetricRow
            label="Volume Change"
            value={
              tech.volumeChange !== null
                ? `${tech.volumeChange.toFixed(0)}%`
                : null
            }
            tooltip="Current volume vs 20-day average"
            sentiment={
              tech.volumeChange !== null
                ? tech.volumeChange > 50
                  ? 'positive'
                  : tech.volumeChange < -50
                  ? 'negative'
                  : 'neutral'
                : undefined
            }
          />
        </div>
      </section>

      {/* Fibonacci Levels */}
      {tech.fibonacciLevels && (
        <section className="technical-section">
          <h3 className="section-title">Fibonacci Retracement</h3>
          <div className="fibonacci-grid">
            <MetricRow
              label="0% (High)"
              value={
                tech.fibonacciLevels.level0
                  ? `$${tech.fibonacciLevels.level0.toFixed(2)}`
                  : null
              }
            />
            <MetricRow
              label="23.6%"
              value={
                tech.fibonacciLevels.level236
                  ? `$${tech.fibonacciLevels.level236.toFixed(2)}`
                  : null
              }
            />
            <MetricRow
              label="38.2%"
              value={
                tech.fibonacciLevels.level382
                  ? `$${tech.fibonacciLevels.level382.toFixed(2)}`
                  : null
              }
            />
            <MetricRow
              label="50%"
              value={
                tech.fibonacciLevels.level500
                  ? `$${tech.fibonacciLevels.level500.toFixed(2)}`
                  : null
              }
            />
            <MetricRow
              label="61.8%"
              value={
                tech.fibonacciLevels.level618
                  ? `$${tech.fibonacciLevels.level618.toFixed(2)}`
                  : null
              }
            />
            <MetricRow
              label="100% (Low)"
              value={
                tech.fibonacciLevels.level100
                  ? `$${tech.fibonacciLevels.level100.toFixed(2)}`
                  : null
              }
            />
          </div>
          {tech.fibonacciLevels.currentLevel && (
            <div className="fib-current">
              Current price near{' '}
              <strong>{tech.fibonacciLevels.currentLevel}</strong> level
              {tech.fibonacciLevels.trend && ` (${tech.fibonacciLevels.trend})`}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// Helper functions
function getSMASentiment(
  pctDiff: number | null
): 'positive' | 'negative' | 'neutral' | undefined {
  if (pctDiff === null) return undefined;
  if (pctDiff > 5) return 'positive';
  if (pctDiff < -5) return 'negative';
  return 'neutral';
}

function getSMAInterpretation(vsSma50: number, vsSma200: number): string {
  if (vsSma50 > 0 && vsSma200 > 0) {
    return 'Price above both SMAs - Bullish trend';
  }
  if (vsSma50 < 0 && vsSma200 < 0) {
    return 'Price below both SMAs - Bearish trend';
  }
  if (vsSma50 > 0 && vsSma200 < 0) {
    return 'Short-term recovery, still below long-term trend';
  }
  return 'Recent weakness, but long-term trend intact';
}

function getRSISignal(rsi: number | null): string {
  if (rsi === null) return '—';
  if (rsi < 30) return 'Oversold';
  if (rsi > 70) return 'Overbought';
  if (rsi < 45) return 'Weak';
  if (rsi > 55) return 'Strong';
  return 'Neutral';
}

function getRSISignalClass(rsi: number | null): string {
  if (rsi === null) return '';
  if (rsi < 30) return 'bullish';
  if (rsi > 70) return 'bearish';
  return 'neutral';
}

function getStochSignalClass(k: number | null): string {
  if (k === null) return '';
  if (k < 20) return 'bullish';
  if (k > 80) return 'bearish';
  return 'neutral';
}

function getMACDSignalClass(histogram: number | null): string {
  if (histogram === null) return '';
  return histogram > 0 ? 'bullish' : 'bearish';
}

function getBollingerSentiment(
  position: number | null
): 'positive' | 'negative' | 'neutral' | undefined {
  if (position === null) return undefined;
  // Position is a percentage (0-100) where 0 is lower band, 100 is upper band
  if (position < 20) return 'positive'; // Near lower band - potential bounce
  if (position > 80) return 'negative'; // Near upper band - overbought
  return 'neutral';
}

function getBollingerSignalClass(signal: string): string {
  const lower = signal.toLowerCase();
  if (lower.includes('oversold') || lower.includes('below')) return 'bullish';
  if (lower.includes('overbought') || lower.includes('above')) return 'bearish';
  return 'neutral';
}
