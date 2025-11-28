import type { TechnicalData } from '@/services/api/technical';
import type { StockRecommendation } from '@/utils/recommendations';
import { InfoTooltip, ScoreCard } from '@/components/shared';
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
          <TechnicalMetric
            label="SMA 50"
            value={tech.sma50 ? `$${tech.sma50.toFixed(2)}` : null}
            sentiment={getSMASentiment(tech.priceVsSma50)}
            tooltip="50denní klouzavý průměr. Krátkodobý trend - cena nad SMA50 = býčí signál."
          />
          <TechnicalMetric
            label="SMA 200"
            value={tech.sma200 ? `$${tech.sma200.toFixed(2)}` : null}
            sentiment={getSMASentiment(tech.priceVsSma200)}
            tooltip="200denní klouzavý průměr. Dlouhodobý trend - klíčová úroveň pro institucionální investory."
          />
          <TechnicalMetric
            label="Price vs SMA50"
            value={
              tech.priceVsSma50 !== null
                ? `${tech.priceVsSma50.toFixed(1)}%`
                : null
            }
            sentiment={getSMASentiment(tech.priceVsSma50)}
            tooltip="Vzdálenost ceny od SMA50. Kladné = nad průměrem (býčí), záporné = pod (medvědí)."
          />
          <TechnicalMetric
            label="Price vs SMA200"
            value={
              tech.priceVsSma200 !== null
                ? `${tech.priceVsSma200.toFixed(1)}%`
                : null
            }
            sentiment={getSMASentiment(tech.priceVsSma200)}
            tooltip="Vzdálenost ceny od SMA200. Nad = dlouhodobý uptrend, pod = downtrend."
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
        <div className="momentum-grid">
          {/* RSI */}
          <div className="momentum-card">
            <div className="momentum-header">
              <span className="momentum-name">
                RSI (14)
                <InfoTooltip text="Index relativní síly. Měří rychlost a změnu cenových pohybů. Pod 30 = přeprodáno (nákupní příležitost), nad 70 = překoupeno (možná korekce)." />
              </span>
              <span
                className={cn('momentum-signal', getRSISignalClass(tech.rsi14))}
              >
                {getRSISignal(tech.rsi14)}
              </span>
            </div>
            <div className="momentum-value-row">
              <span className="momentum-value">
                {tech.rsi14 !== null ? tech.rsi14.toFixed(1) : '—'}
              </span>
              <div className="rsi-bar">
                <div className="rsi-bar-track">
                  <div className="rsi-zone oversold" />
                  <div className="rsi-zone neutral" />
                  <div className="rsi-zone overbought" />
                  {tech.rsi14 !== null && (
                    <div
                      className="rsi-marker"
                      style={{
                        left: `${Math.min(Math.max(tech.rsi14, 0), 100)}%`,
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stochastic */}
          <div className="momentum-card">
            <div className="momentum-header">
              <span className="momentum-name">
                Stochastic
                <InfoTooltip text="Stochastický oscilátor. Porovnává zavírací cenu s cenovým rozpětím. %K je rychlá linie, %D je pomalá. Pod 20 = přeprodáno, nad 80 = překoupeno." />
              </span>
              <span
                className={cn(
                  'momentum-signal',
                  getStochSignalClass(tech.stochasticK)
                )}
              >
                {tech.stochasticSignal ?? '—'}
              </span>
            </div>
            <div className="momentum-value-row">
              <div className="stoch-values">
                <span className="stoch-item">
                  <span className="stoch-label">%K</span>
                  <span className="stoch-value">
                    {tech.stochasticK?.toFixed(1) ?? '—'}
                  </span>
                </span>
                <span className="stoch-item">
                  <span className="stoch-label">%D</span>
                  <span className="stoch-value">
                    {tech.stochasticD?.toFixed(1) ?? '—'}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {/* MACD */}
          <div className="momentum-card">
            <div className="momentum-header">
              <span className="momentum-name">
                MACD
                <InfoTooltip text="Klouzavý průměr konvergence/divergence. MACD nad signální linií = býčí, pod = medvědí. Histogram ukazuje sílu trendu." />
              </span>
              <span
                className={cn(
                  'momentum-signal',
                  getMACDSignalClass(tech.macdHistogram)
                )}
              >
                {tech.macdTrend ?? '—'}
              </span>
            </div>
            <div className="macd-row">
              <div className="macd-item">
                <span className="macd-label">MACD</span>
                <span className="macd-value">
                  {tech.macd?.toFixed(3) ?? '—'}
                </span>
              </div>
              <div className="macd-item">
                <span className="macd-label">Signal</span>
                <span className="macd-value">
                  {tech.macdSignal?.toFixed(3) ?? '—'}
                </span>
              </div>
              <div className="macd-item">
                <span className="macd-label">Hist</span>
                <span
                  className={cn(
                    'macd-value',
                    tech.macdHistogram !== null
                      ? tech.macdHistogram > 0
                        ? 'positive'
                        : 'negative'
                      : undefined
                  )}
                >
                  {tech.macdHistogram?.toFixed(3) ?? '—'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bollinger Bands */}
      <section className="technical-section">
        <h3 className="section-title">Bollinger Bands</h3>
        <div className="metrics-grid">
          <TechnicalMetric
            label="Upper Band"
            value={
              tech.bollingerUpper ? `$${tech.bollingerUpper.toFixed(2)}` : null
            }
            tooltip="Horní pásmo. Cena blízko horního pásma = překoupený stav, možná korekce."
          />
          <TechnicalMetric
            label="Middle Band"
            value={
              tech.bollingerMiddle
                ? `$${tech.bollingerMiddle.toFixed(2)}`
                : null
            }
            tooltip="Střední pásmo (SMA 20). Slouzí jako dynamická podpora/rezistence."
          />
          <TechnicalMetric
            label="Lower Band"
            value={
              tech.bollingerLower ? `$${tech.bollingerLower.toFixed(2)}` : null
            }
            tooltip="Spodní pásmo. Cena blízko spodního pásma = přeprodaný stav, možný odraz."
          />
          <TechnicalMetric
            label="Position"
            value={
              tech.bollingerPosition !== null
                ? `${tech.bollingerPosition.toFixed(0)}%`
                : null
            }
            tooltip="Pozice v pásmech (0-100%). Pod 20% = přeprodáno, nad 80% = překoupeno."
            sentiment={getBollingerSentiment(tech.bollingerPosition)}
          />
        </div>
        {tech.bollingerSignal && (
          <div className="bollinger-signal-row">
            <span
              className={cn(
                'bollinger-badge',
                getBollingerSignalClass(tech.bollingerSignal)
              )}
            >
              {tech.bollingerSignal}
            </span>
          </div>
        )}
      </section>

      {/* Trend & Volume */}
      <section className="technical-section">
        <h3 className="section-title">Trend & Volume</h3>
        <div className="metrics-grid">
          <TechnicalMetric
            label="ADX"
            value={tech.adx?.toFixed(1) ?? null}
            tooltip="Síla trendu. Pod 20 = slabý/žádný trend, 20-25 = vznikající, nad 25 = silný trend."
            sentiment={
              tech.adx !== null
                ? tech.adx > 25
                  ? 'positive'
                  : 'neutral'
                : undefined
            }
          />
          <TechnicalMetric
            label="+DI"
            value={tech.plusDI?.toFixed(1) ?? null}
            tooltip="Pozitivní směrový indikátor. +DI > -DI = býčí tlak, kupující dominují."
          />
          <TechnicalMetric
            label="-DI"
            value={tech.minusDI?.toFixed(1) ?? null}
            tooltip="Negativní směrový indikátor. -DI > +DI = medvědí tlak, prodávající dominují."
          />
          <TechnicalMetric
            label="ATR"
            value={tech.atr14 ? `$${tech.atr14.toFixed(2)}` : null}
            tooltip="Průměrné skutečné rozpětí. Měří volatilitu - vyšší = větší cenové výkyvy."
          />
          <TechnicalMetric
            label="Volume Change"
            value={
              tech.volumeChange !== null
                ? `${tech.volumeChange.toFixed(0)}%`
                : null
            }
            tooltip="Změna objemu vs 20denní průměr. Vysoký objem potvrzuje cenový pohyb."
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
          <div className="metrics-grid">
            <TechnicalMetric
              label="0% (High)"
              value={
                tech.fibonacciLevels.level0
                  ? `$${tech.fibonacciLevels.level0.toFixed(2)}`
                  : null
              }
              tooltip="Nejvyšší bod - začátek měření."
            />
            <TechnicalMetric
              label="23.6%"
              value={
                tech.fibonacciLevels.level236
                  ? `$${tech.fibonacciLevels.level236.toFixed(2)}`
                  : null
              }
              tooltip="Mělká korekce. Silný trend často udrží tuto úroveň."
            />
            <TechnicalMetric
              label="38.2%"
              value={
                tech.fibonacciLevels.level382
                  ? `$${tech.fibonacciLevels.level382.toFixed(2)}`
                  : null
              }
              tooltip="Důležitá supportní úroveň. Častá zóna odrazu."
            />
            <TechnicalMetric
              label="50%"
              value={
                tech.fibonacciLevels.level500
                  ? `$${tech.fibonacciLevels.level500.toFixed(2)}`
                  : null
              }
              tooltip="Psychologická úroveň - polovina předchozího pohybu."
            />
            <TechnicalMetric
              label="61.8%"
              value={
                tech.fibonacciLevels.level618
                  ? `$${tech.fibonacciLevels.level618.toFixed(2)}`
                  : null
              }
              tooltip="Zlatý řez - nejdůležitější Fibonacci úroveň. Silný support."
            />
            <TechnicalMetric
              label="100% (Low)"
              value={
                tech.fibonacciLevels.level100
                  ? `$${tech.fibonacciLevels.level100.toFixed(2)}`
                  : null
              }
              tooltip="Nejnižší bod - konec měření. Propad pod = pokračování downtrend."
            />
          </div>
          {tech.fibonacciLevels.currentLevel && (
            <div className="fib-current">
              Aktuální cena blízko{' '}
              <strong>{tech.fibonacciLevels.currentLevel}</strong> úrovně
              {tech.fibonacciLevels.trend && ` (${tech.fibonacciLevels.trend})`}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// Technical Metric component - label on top, value below
interface TechnicalMetricProps {
  value: string | null;
  label: string;
  tooltip?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

function TechnicalMetric({
  value,
  label,
  tooltip,
  sentiment,
}: TechnicalMetricProps) {
  return (
    <div className="technical-metric">
      <span className="technical-metric-label">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </span>
      <span className={cn('technical-metric-value', sentiment)}>
        {value ?? '—'}
      </span>
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
