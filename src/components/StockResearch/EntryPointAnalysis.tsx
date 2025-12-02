import type { StockRecommendation } from '@/utils/recommendations';
import { InfoTooltip, MetricCard, IndicatorSignal } from '@/components/shared';
import { CardTitle, MetricLabel, Text } from '@/components/shared/Typography';
import './EntryPointAnalysis.css';

interface EntryPointAnalysisProps {
  recommendation: StockRecommendation;
  analystTarget: number | null;
}

interface EntryData {
  currentPrice: number;
  analystTarget: number | null;
  targetUpside: number | null;
  week52High: number | null;
  week52Low: number | null;
  priceInRange: number | null; // 0-100
  support: number | null;
  resistance: number | null;
  entryTiming: 'favorable' | 'neutral' | 'unfavorable';
  entryTimingReason: string;
}

function calculateEntryData(
  rec: StockRecommendation,
  analystTarget: number | null
): EntryData {
  const currentPrice = rec.currentPrice;
  const week52High = rec.fiftyTwoWeekHigh;
  const week52Low = rec.fiftyTwoWeekLow;

  // Calculate price position in 52W range
  let priceInRange: number | null = null;
  if (week52High && week52Low && week52High !== week52Low) {
    priceInRange =
      ((currentPrice - week52Low) / (week52High - week52Low)) * 100;
  }

  // Target upside
  const targetUpside = rec.targetUpside;

  // Support/Resistance from buyStrategy
  const support = rec.buyStrategy?.supportPrice ?? null;
  const resistance = rec.exitStrategy?.resistanceLevel ?? null;

  // Entry timing based on technical analysis
  let entryTiming: 'favorable' | 'neutral' | 'unfavorable' = 'neutral';
  let entryTimingReason = '';

  if (rec.technicalBias === 'BULLISH') {
    if (rec.dipScore >= 50) {
      entryTiming = 'favorable';
      entryTimingReason = 'Oversold + bullish bias';
    } else if (rec.technicalScore >= 60) {
      entryTiming = 'favorable';
      entryTimingReason = 'Silné technické indikátory';
    } else {
      entryTiming = 'neutral';
      entryTimingReason = 'Bullish trend, čekejte na pullback';
    }
  } else if (rec.technicalBias === 'BEARISH') {
    if (rec.dipScore >= 60) {
      entryTiming = 'neutral';
      entryTimingReason = 'Oversold, ale v downtrend';
    } else {
      entryTiming = 'unfavorable';
      entryTimingReason = 'Bearish trend, počkejte na obrat';
    }
  } else {
    // NEUTRAL
    if (rec.dipScore >= 50) {
      entryTiming = 'favorable';
      entryTimingReason = 'Blízko supportu / oversold';
    } else if (priceInRange !== null && priceInRange < 30) {
      entryTiming = 'favorable';
      entryTimingReason = 'Blízko 52T minima';
    } else if (priceInRange !== null && priceInRange > 80) {
      entryTiming = 'unfavorable';
      entryTimingReason = 'Blízko 52T maxima';
    } else {
      entryTiming = 'neutral';
      entryTimingReason = 'Neutrální pozice';
    }
  }

  return {
    currentPrice,
    analystTarget,
    targetUpside,
    week52High,
    week52Low,
    priceInRange,
    support,
    resistance,
    entryTiming,
    entryTimingReason,
  };
}

export function EntryPointAnalysis({
  recommendation,
  analystTarget,
}: EntryPointAnalysisProps) {
  const data = calculateEntryData(recommendation, analystTarget);

  // Debug log to check exitStrategy
  console.log('EntryPointAnalysis debug:', {
    exitStrategy: recommendation.exitStrategy,
    buyStrategy: recommendation.buyStrategy,
    resistance: recommendation.exitStrategy?.resistanceLevel,
    support: recommendation.buyStrategy?.supportPrice,
  });

  const formatPrice = (price: number | null) => {
    if (price === null) return '—';
    return `$${price.toFixed(2)}`;
  };

  const formatPercent = (value: number | null) => {
    if (value === null) return '—';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  return (
    <section className="entry-point-analysis">
      <CardTitle>
        Vstupní analýza
        <InfoTooltip text="**Vstupní analýza** | Porovnání aktuální ceny s klíčovými cenovými úrovněmi. | • Cíl analytiků = průměrná cílová cena | • 52T rozsah = min/max za posledních 52 týdnů | • Support/Resistance = technické úrovně" />
      </CardTitle>

      <div className="entry-point-analysis__content">
        {/* Price Range Visual */}
        <div className="entry-point-analysis__range">
          <div className="price-range-labels">
            <Text size="sm" color="muted">
              52T Min
            </Text>
            <Text size="sm" weight="semibold">
              {formatPrice(data.currentPrice)}
            </Text>
            <Text size="sm" color="muted">
              52T Max
            </Text>
          </div>
          <div className="price-range-bar">
            <div className="price-range-bar__track" />
            {data.priceInRange !== null && (
              <div
                className="price-range-bar__marker"
                style={{
                  left: `${Math.min(100, Math.max(0, data.priceInRange))}%`,
                }}
              />
            )}
          </div>
          <div className="price-range-values">
            <Text size="xs" color="muted">
              {formatPrice(data.week52Low)}
            </Text>
            {data.priceInRange !== null && (
              <Text size="xs" color="secondary">
                {data.priceInRange.toFixed(0)}% v rozsahu
              </Text>
            )}
            <Text size="xs" color="muted">
              {formatPrice(data.week52High)}
            </Text>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="entry-point-analysis__metrics">
          <MetricCard
            label="Cíl analytiků"
            value={formatPrice(data.analystTarget)}
            subtext={
              data.targetUpside !== null
                ? formatPercent(data.targetUpside)
                : undefined
            }
            sentiment={
              data.targetUpside !== null
                ? data.targetUpside > 15
                  ? 'positive'
                  : data.targetUpside > 0
                  ? 'neutral'
                  : 'negative'
                : undefined
            }
            tooltip={
              <InfoTooltip text="**Cílová cena analytiků** | Průměrná cílová cena od profesionálních analytiků pokrývajících tuto akcii." />
            }
          />
          <MetricCard
            label="Support"
            value={formatPrice(data.support)}
            tooltip={
              <InfoTooltip text="**Support** | Cenová úroveň, kde se očekává zájem kupujících. Potenciální vstupní bod." />
            }
          />
          <MetricCard
            label="Resistance"
            value={formatPrice(data.resistance)}
            tooltip={
              <InfoTooltip text="**Resistance** | Cenová úroveň, kde se očekává prodejní tlak. Potenciální cílový bod." />
            }
          />
        </div>

        {/* Entry Timing Signal */}
        <div className="entry-point-analysis__timing">
          <MetricLabel>Entry Timing</MetricLabel>
          <IndicatorSignal
            type={
              data.entryTiming === 'favorable'
                ? 'bullish'
                : data.entryTiming === 'unfavorable'
                ? 'bearish'
                : 'neutral'
            }
          >
            {data.entryTiming === 'favorable'
              ? 'Příznivý'
              : data.entryTiming === 'unfavorable'
              ? 'Nepříznivý'
              : 'Neutrální'}
            {' — '}
            {data.entryTimingReason}
          </IndicatorSignal>
        </div>
      </div>
    </section>
  );
}
