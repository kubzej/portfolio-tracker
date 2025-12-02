import { useCallback } from 'react';
import type {
  TechnicalData,
  IntradayPricePoint,
} from '@/services/api/technical';
import { fetchIntradayData } from '@/services/api/technical';
import type { StockRecommendation } from '@/utils/recommendations';
import {
  ScoreCard,
  CardTitle,
  MetricCard,
  MetricLabel,
  MetricValue,
  Text,
  Badge,
  InfoTooltip,
  IndicatorSignal,
  PriceChart,
} from '@/components/shared';
import type { SignalType } from '@/components/shared';
import './ResearchTechnical.css';

interface ResearchTechnicalProps {
  technicalData: TechnicalData | null;
  recommendation: StockRecommendation | null;
  ticker: string;
  currency?: string;
}

export function ResearchTechnical({
  technicalData,
  recommendation,
  ticker,
  currency = 'USD',
}: ResearchTechnicalProps) {
  const tech = technicalData;

  // Lazy load intraday data
  const handleLoadIntraday = useCallback(
    async (range: '1d' | '1w'): Promise<IntradayPricePoint[]> => {
      const data = await fetchIntradayData(ticker, range);
      return data.prices;
    },
    [ticker]
  );

  if (!tech) {
    return (
      <div className="research-technical">
        <div className="no-data">Nejsou dostupná technická data</div>
      </div>
    );
  }

  return (
    <div className="research-technical">
      {/* Price Chart */}
      <section className="technical-section">
        <CardTitle>Cenový graf</CardTitle>
        <PriceChart
          historicalPrices={tech.historicalPrices}
          historicalPricesWeekly={tech.historicalPricesWeekly}
          currency={currency}
          onLoadIntraday={handleLoadIntraday}
          defaultRange="3m"
          sma50History={tech.sma50History}
          sma200History={tech.sma200History}
        />
      </section>
      {/* Technical Bias */}
      {recommendation && (
        <section className="technical-section">
          <CardTitle>Technický výhled</CardTitle>
          <div className="technical-outlook">
            <Badge
              variant={
                recommendation.technicalBias === 'BULLISH'
                  ? 'buy'
                  : recommendation.technicalBias === 'BEARISH'
                  ? 'sell'
                  : 'hold'
              }
              size="lg"
            >
              {recommendation.technicalBias}
            </Badge>
            <div className="technical-score">
              <ScoreCard
                label="Technické skóre"
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
        <CardTitle>Klouzavé průměry</CardTitle>
        <div className="metrics-grid">
          <MetricCard
            label="SMA 50"
            value={tech.sma50 ? `$${tech.sma50.toFixed(2)}` : null}
            sentiment={getSMASentiment(tech.priceVsSma50)}
            tooltip={
              <InfoTooltip text="**SMA 50** | Průměrná cena za posledních 50 dní. | Ukazuje krátkodobý trend. | • Cena NAD SMA50 = krátkodobě bullish | • Cena POD SMA50 = krátkodobě bearish" />
            }
          />
          <MetricCard
            label="SMA 200"
            value={tech.sma200 ? `$${tech.sma200.toFixed(2)}` : null}
            sentiment={getSMASentiment(tech.priceVsSma200)}
            tooltip={
              <InfoTooltip text="**SMA 200** | Průměrná cena za posledních 200 dní. | Ukazuje dlouhodobý trend. | • Cena NAD SMA200 = dlouhodobě bullish | • Cena POD SMA200 = dlouhodobě bearish" />
            }
          />
          <MetricCard
            label="Price vs SMA50"
            value={
              tech.priceVsSma50 !== null
                ? `${tech.priceVsSma50.toFixed(1)}%`
                : null
            }
            sentiment={getSMASentiment(tech.priceVsSma50)}
            tooltip={
              <InfoTooltip text="**Cena vs SMA50** | O kolik % je cena nad/pod 50denním průměrem. | • Kladné = bullish momentum | • Záporné = bearish momentum | • Nad +10% = možná překoupená | • Pod -10% = možná přeprodaná" />
            }
          />
          <MetricCard
            label="Price vs SMA200"
            value={
              tech.priceVsSma200 !== null
                ? `${tech.priceVsSma200.toFixed(1)}%`
                : null
            }
            sentiment={getSMASentiment(tech.priceVsSma200)}
            tooltip={
              <InfoTooltip text="**Cena vs SMA200** | O kolik % je cena nad/pod 200denním průměrem. | • Kladné = dlouhodobý uptrend | • Záporné = dlouhodobý downtrend | Kombinace: Nad oběma SMA = silně bullish, pod oběma = silně bearish" />
            }
          />
        </div>
        {tech.priceVsSma50 !== null && tech.priceVsSma200 !== null && (
          <div className="sma-interpretation">
            <IndicatorSignal
              type={getSMASignalType(tech.priceVsSma50, tech.priceVsSma200)}
            >
              {getSMAInterpretation(tech.priceVsSma50, tech.priceVsSma200)}
            </IndicatorSignal>
          </div>
        )}
      </section>

      {/* Momentum Indicators */}
      <section className="technical-section">
        <CardTitle>Indikátory momenta</CardTitle>
        <div className="momentum-grid">
          {/* RSI */}
          <div className="momentum-card">
            <div className="momentum-header">
              <MetricLabel tooltip="**RSI** | Index relativní síly (0-100). | • Pod 30 = přeprodaná | • Nad 70 = překoupená | • 30-70 = neutrální">
                RSI (14)
              </MetricLabel>
              <Badge
                variant={
                  getRSISignalClass(tech.rsi14) === 'bullish'
                    ? 'buy'
                    : getRSISignalClass(tech.rsi14) === 'bearish'
                    ? 'sell'
                    : 'hold'
                }
              >
                {getRSISignal(tech.rsi14)}
              </Badge>
            </div>
            <div className="momentum-value-row">
              <MetricValue size="lg">
                {tech.rsi14 !== null ? tech.rsi14.toFixed(1) : '—'}
              </MetricValue>
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
              <MetricLabel tooltip="**Stochastic** | Momentum indikátor (0-100). | • Pod 20 = přeprodaná | • Nad 80 = překoupená | %K = rychlá, %D = pomalá linie">
                Stochastic
              </MetricLabel>
              <Badge
                variant={
                  getStochSignalClass(tech.stochasticK) === 'bullish'
                    ? 'buy'
                    : getStochSignalClass(tech.stochasticK) === 'bearish'
                    ? 'sell'
                    : 'hold'
                }
              >
                {tech.stochasticSignal ?? '—'}
              </Badge>
            </div>
            <div className="momentum-value-row">
              <div className="stoch-values">
                <div className="stoch-item">
                  <MetricLabel>%K</MetricLabel>
                  <MetricValue size="md">
                    {tech.stochasticK?.toFixed(1) ?? '—'}
                  </MetricValue>
                </div>
                <div className="stoch-item">
                  <MetricLabel>%D</MetricLabel>
                  <MetricValue size="md">
                    {tech.stochasticD?.toFixed(1) ?? '—'}
                  </MetricValue>
                </div>
              </div>
            </div>
          </div>

          {/* MACD */}
          <div className="momentum-card">
            <div className="momentum-header">
              <MetricLabel tooltip="**MACD** | Ukazatel směru a síly momenta. | • MACD nad Signal = bullish | • MACD pod Signal = bearish | Histogram = síla trendu">
                MACD
              </MetricLabel>
              <Badge
                variant={
                  getMACDSignalClass(tech.macdHistogram) === 'bullish'
                    ? 'buy'
                    : getMACDSignalClass(tech.macdHistogram) === 'bearish'
                    ? 'sell'
                    : 'hold'
                }
              >
                {tech.macdTrend ?? '—'}
              </Badge>
            </div>
            <div className="macd-row">
              <div className="macd-item">
                <MetricLabel>MACD</MetricLabel>
                <MetricValue size="sm">
                  {tech.macd?.toFixed(3) ?? '—'}
                </MetricValue>
              </div>
              <div className="macd-item">
                <MetricLabel>Signal</MetricLabel>
                <MetricValue size="sm">
                  {tech.macdSignal?.toFixed(3) ?? '—'}
                </MetricValue>
              </div>
              <div className="macd-item">
                <MetricLabel>Hist</MetricLabel>
                <MetricValue
                  size="sm"
                  sentiment={
                    tech.macdHistogram !== null
                      ? tech.macdHistogram > 0
                        ? 'positive'
                        : 'negative'
                      : undefined
                  }
                >
                  {tech.macdHistogram?.toFixed(3) ?? '—'}
                </MetricValue>
              </div>
            </div>
            {/* MACD Divergence indicator */}
            {tech.macdDivergence && (
              <div className="macd-divergence">
                <Badge
                  variant={tech.macdDivergence === 'bullish' ? 'buy' : 'sell'}
                  size="sm"
                >
                  {tech.macdDivergence === 'bullish'
                    ? '↑ Bullish Divergence'
                    : '↓ Bearish Divergence'}
                </Badge>
                <InfoTooltip
                  text={
                    tech.macdDivergence === 'bullish'
                      ? '**Bullish Divergence** | Cena dělá nižší low, ale MACD dělá vyšší low. | Signál potenciálního obratu nahoru.'
                      : '**Bearish Divergence** | Cena dělá vyšší high, ale MACD dělá nižší high. | Signál potenciálního obratu dolů.'
                  }
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Bollinger Bands */}
      <section className="technical-section">
        <CardTitle>Bollingerova pásma</CardTitle>
        <div className="metrics-grid">
          <MetricCard
            label="Horní pásmo"
            value={
              tech.bollingerUpper ? `$${tech.bollingerUpper.toFixed(2)}` : null
            }
            tooltip={
              <InfoTooltip text="**Horní pásmo** | Cena blízko horního pásma = překoupený stav, možná korekce." />
            }
          />
          <MetricCard
            label="Střední pásmo"
            value={
              tech.bollingerMiddle
                ? `$${tech.bollingerMiddle.toFixed(2)}`
                : null
            }
            tooltip={
              <InfoTooltip text="**Střední pásmo** | SMA 20, slouží jako dynamická podpora/rezistence." />
            }
          />
          <MetricCard
            label="Spodní pásmo"
            value={
              tech.bollingerLower ? `$${tech.bollingerLower.toFixed(2)}` : null
            }
            tooltip={
              <InfoTooltip text="**Spodní pásmo** | Cena blízko spodního pásma = přeprodaný stav, možný odraz." />
            }
          />
          <MetricCard
            label="Pozice v pásmech"
            value={
              tech.bollingerPosition !== null
                ? `${tech.bollingerPosition.toFixed(0)}%`
                : null
            }
            tooltip={
              <InfoTooltip text="**Pozice v pásmech** | 0-100% v rámci Bollinger Bands. | • Pod 20% = přeprodáno | • Nad 80% = překoupeno" />
            }
            sentiment={getBollingerSentiment(tech.bollingerPosition)}
          />
        </div>
        {tech.bollingerSignal && (
          <div className="bollinger-signal-row">
            <Badge
              variant={
                getBollingerSignalClass(tech.bollingerSignal) === 'bullish'
                  ? 'buy'
                  : getBollingerSignalClass(tech.bollingerSignal) === 'bearish'
                  ? 'sell'
                  : 'hold'
              }
            >
              {tech.bollingerSignal}
            </Badge>
          </div>
        )}
      </section>

      {/* Trend & Volume */}
      <section className="technical-section">
        <CardTitle>Trend a objem</CardTitle>
        <div className="metrics-grid">
          <MetricCard
            label="ADX"
            value={tech.adx?.toFixed(1) ?? null}
            tooltip={
              <InfoTooltip text="**ADX** | Síla trendu. | • Pod 20 = slabý/žádný trend | • 20-25 = vznikající | • Nad 25 = silný trend" />
            }
            sentiment={
              tech.adx !== null
                ? tech.adx > 25
                  ? 'positive'
                  : 'neutral'
                : undefined
            }
          />
          <MetricCard
            label="+DI"
            value={tech.plusDI?.toFixed(1) ?? null}
            tooltip={
              <InfoTooltip text="**+DI** | Pozitivní směrový indikátor. | +DI > -DI = býčí tlak, kupující dominují." />
            }
          />
          <MetricCard
            label="-DI"
            value={tech.minusDI?.toFixed(1) ?? null}
            tooltip={
              <InfoTooltip text="**-DI** | Negativní směrový indikátor. | -DI > +DI = medvědí tlak, prodávající dominují." />
            }
          />
          <MetricCard
            label="ATR"
            value={tech.atr14 ? `$${tech.atr14.toFixed(2)}` : null}
            tooltip={
              <InfoTooltip text="**ATR** | Průměrné skutečné rozpětí. | Měří volatilitu - vyšší = větší cenové výkyvy." />
            }
          />
          <MetricCard
            label="Změna objemu"
            value={
              tech.volumeChange !== null
                ? `${tech.volumeChange.toFixed(0)}%`
                : null
            }
            tooltip={
              <InfoTooltip text="**Změna objemu** | Objem vs 20denní průměr. | Vysoký objem potvrzuje cenový pohyb." />
            }
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
          <CardTitle>Fibonacci úrovně</CardTitle>
          <div className="metrics-grid">
            <MetricCard
              label="0% (High)"
              value={
                tech.fibonacciLevels.level0
                  ? `$${tech.fibonacciLevels.level0.toFixed(2)}`
                  : null
              }
              tooltip={
                <InfoTooltip text="**0% (High)** | Nejvyšší bod - začátek měření." />
              }
            />
            <MetricCard
              label="23.6%"
              value={
                tech.fibonacciLevels.level236
                  ? `$${tech.fibonacciLevels.level236.toFixed(2)}`
                  : null
              }
              tooltip={
                <InfoTooltip text="**23.6%** | Mělká korekce. Silný trend často udrží tuto úroveň." />
              }
            />
            <MetricCard
              label="38.2%"
              value={
                tech.fibonacciLevels.level382
                  ? `$${tech.fibonacciLevels.level382.toFixed(2)}`
                  : null
              }
              tooltip={
                <InfoTooltip text="**38.2%** | Důležitá supportní úroveň. Častá zóna odrazu." />
              }
            />
            <MetricCard
              label="50%"
              value={
                tech.fibonacciLevels.level500
                  ? `$${tech.fibonacciLevels.level500.toFixed(2)}`
                  : null
              }
              tooltip={
                <InfoTooltip text="**50%** | Psychologická úroveň - polovina předchozího pohybu." />
              }
            />
            <MetricCard
              label="61.8%"
              value={
                tech.fibonacciLevels.level618
                  ? `$${tech.fibonacciLevels.level618.toFixed(2)}`
                  : null
              }
              tooltip={
                <InfoTooltip text="**61.8%** | Zlatý řez - nejdůležitější Fibonacci úroveň. Silný support." />
              }
            />
            <MetricCard
              label="100% (Low)"
              value={
                tech.fibonacciLevels.level100
                  ? `$${tech.fibonacciLevels.level100.toFixed(2)}`
                  : null
              }
              tooltip={
                <InfoTooltip text="**100% (Low)** | Nejnižší bod - konec měření. Propad pod = pokračování downtrend." />
              }
            />
          </div>
          {tech.fibonacciLevels.currentLevel && (
            <div className="fib-current">
              <Text color="secondary">
                Aktuální cena blízko{' '}
                <Text as="span" weight="semibold">
                  {tech.fibonacciLevels.currentLevel}
                </Text>{' '}
                úrovně
                {tech.fibonacciLevels.trend &&
                  ` (${tech.fibonacciLevels.trend})`}
              </Text>
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
    return 'Cena nad oběma SMA — Bullish trend';
  }
  if (vsSma50 < 0 && vsSma200 < 0) {
    return 'Cena pod oběma SMA — Bearish trend';
  }
  if (vsSma50 > 0 && vsSma200 < 0) {
    return 'Krátkodobé zotavení, stále pod dlouhodobým trendem';
  }
  return 'Nedávná slabost, ale dlouhodobý trend drží';
}

function getSMASignalType(vsSma50: number, vsSma200: number): SignalType {
  if (vsSma50 > 0 && vsSma200 > 0) {
    return 'bullish';
  }
  if (vsSma50 < 0 && vsSma200 < 0) {
    return 'bearish';
  }
  return 'neutral';
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
