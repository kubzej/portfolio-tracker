import { useCallback, useMemo, useState } from 'react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Bar,
  Cell,
  ReferenceLine,
  Area,
  ComposedChart,
} from 'recharts';
import type {
  TechnicalData,
  PricePoint,
  MACDPoint,
  BollingerPoint,
  StochasticPoint,
  VolumePoint,
  ATRPoint,
  OBVPoint,
  ADXPoint,
} from '@/services/api/technical';
import { fetchIntradayData } from '@/services/api/technical';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { MetricLabel, MetricValue, Text } from '@/components/shared/Typography';
import {
  TIME_RANGES_LONG,
  getDaysForRange,
  type TimeRange,
} from '@/components/shared/TimeRangeSelector';
import { ChartSection, ChartNoData } from '@/components/shared/ChartSection';
import {
  IndicatorValue,
  IndicatorValuesRow,
  IndicatorSignal,
  ZoneBadge,
  ZonesRow,
} from '@/components/shared/IndicatorValue';
import {
  TrendSignal,
  MACard,
  MACardsRow,
} from '@/components/shared/TrendSignal';
import { PriceChart } from '@/components/shared/PriceChart';
import './ResearchTechnical.css';

interface ResearchTechnicalProps {
  ticker: string;
  data: TechnicalData | null;
  isLoading: boolean;
}

export function ResearchTechnical({
  ticker,
  data,
  isLoading,
}: ResearchTechnicalProps) {
  // Time range states
  const [macdTimeRange, setMacdTimeRange] = useState<TimeRange>('1M');
  const [bollingerTimeRange, setBollingerTimeRange] = useState<TimeRange>('6M');
  const [stochasticTimeRange, setStochasticTimeRange] =
    useState<TimeRange>('2W');
  const [volumeTimeRange, setVolumeTimeRange] = useState<TimeRange>('1M');
  const [atrTimeRange, setAtrTimeRange] = useState<TimeRange>('1M');
  const [obvTimeRange, setObvTimeRange] = useState<TimeRange>('3M');
  const [adxTimeRange, setAdxTimeRange] = useState<TimeRange>('3M');

  // Callback for loading intraday data (1D/1W)
  const handleLoadIntraday = useCallback(
    async (range: '1d' | '1w') => {
      const response = await fetchIntradayData(ticker, range);
      return response.prices;
    },
    [ticker]
  );

  // Get days for each chart
  const macdDays = getDaysForRange(macdTimeRange);
  const bollingerDays = getDaysForRange(bollingerTimeRange);
  const stochasticDays = getDaysForRange(stochasticTimeRange);
  const volumeDays = getDaysForRange(volumeTimeRange);
  const atrDays = getDaysForRange(atrTimeRange);
  const obvDays = getDaysForRange(obvTimeRange);
  const adxDays = getDaysForRange(adxTimeRange);

  // Format helpers
  const formatDateStr = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const filterByDateRange = <T extends { date: string }>(
    arr: T[],
    days: number
  ): T[] => {
    if (arr.length === 0) return arr;
    return arr.slice(-days);
  };

  const formatVolume = (value: number): string => {
    if (value >= 1000000000) return (value / 1000000000).toFixed(1) + 'B';
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
    return value.toString();
  };

  // MACD chart data
  const macdData = useMemo(() => {
    if (!data?.macdHistory) return [];
    const fullData = data.macdHistory.map((m: MACDPoint) => ({
      date: m.date,
      displayDate: formatDateStr(m.date),
      macd: m.macd,
      signal: m.signal,
      histogram: m.histogram,
    }));
    return filterByDateRange(fullData, macdDays);
  }, [data?.macdHistory, macdDays]);

  // Bollinger chart data
  const bollingerData = useMemo(() => {
    if (!data?.historicalPrices || !data?.bollingerHistory) return [];
    const bbMap = new Map<string, BollingerPoint>();
    data.bollingerHistory.forEach((b: BollingerPoint) => bbMap.set(b.date, b));
    const fullData = data.historicalPrices.map((p: PricePoint) => {
      const bb = bbMap.get(p.date);
      return {
        date: p.date,
        displayDate: formatDateStr(p.date),
        price: p.close,
        upper: bb?.upper ?? null,
        middle: bb?.middle ?? null,
        lower: bb?.lower ?? null,
      };
    });
    return filterByDateRange(fullData, bollingerDays);
  }, [data?.historicalPrices, data?.bollingerHistory, bollingerDays]);

  // Stochastic chart data
  const stochasticData = useMemo(() => {
    if (!data?.stochasticHistory) return [];
    const fullData = data.stochasticHistory.map((s: StochasticPoint) => ({
      date: s.date,
      displayDate: formatDateStr(s.date),
      k: s.k,
      d: s.d,
    }));
    return filterByDateRange(fullData, stochasticDays);
  }, [data?.stochasticHistory, stochasticDays]);

  // Volume chart data
  const volumeData = useMemo(() => {
    if (!data?.volumeHistory) return [];
    const fullData = data.volumeHistory.map((v: VolumePoint) => ({
      date: v.date,
      displayDate: formatDateStr(v.date),
      volume: v.volume,
      avgVolume: v.avgVolume,
      isAboveAvg: v.avgVolume !== null && v.volume > v.avgVolume,
    }));
    return filterByDateRange(fullData, volumeDays);
  }, [data?.volumeHistory, volumeDays]);

  // ATR chart data
  const atrData = useMemo(() => {
    if (!data?.atrHistory) return [];
    const fullData = data.atrHistory.map((a: ATRPoint) => ({
      date: a.date,
      displayDate: formatDateStr(a.date),
      atr: a.atr,
      atrPercent: a.atrPercent,
    }));
    return filterByDateRange(fullData, atrDays);
  }, [data?.atrHistory, atrDays]);

  // OBV chart data
  const obvData = useMemo(() => {
    if (!data?.obvHistory) return [];
    const fullData = data.obvHistory.map((o: OBVPoint) => ({
      date: o.date,
      displayDate: formatDateStr(o.date),
      obv: o.obv,
      obvSma: o.obvSma,
    }));
    return filterByDateRange(fullData, obvDays);
  }, [data?.obvHistory, obvDays]);

  // ADX chart data
  const adxData = useMemo(() => {
    if (!data?.adxHistory) return [];
    const fullData = data.adxHistory.map((a: ADXPoint) => ({
      date: a.date,
      displayDate: formatDateStr(a.date),
      adx: a.adx,
      plusDI: a.plusDI,
      minusDI: a.minusDI,
    }));
    return filterByDateRange(fullData, adxDays);
  }, [data?.adxHistory, adxDays]);

  // Loading state
  if (isLoading) {
    return (
      <div className="research-technical">
        <div className="research-technical__loading">
          <Text color="muted">Loading technical data...</Text>
        </div>
      </div>
    );
  }

  // No data state
  if (!data) {
    return (
      <div className="research-technical">
        <div className="research-technical__empty">
          <Text color="muted">No technical data available for {ticker}</Text>
        </div>
      </div>
    );
  }

  // Determine trend signals
  const getTrendSignal = (): {
    signal: string;
    description: string;
    type: 'bullish' | 'bearish' | 'neutral';
  } => {
    if (data.sma50 === null || data.sma200 === null) {
      return {
        signal: 'Nedostatek dat',
        description: 'Potřebujeme více historie cen pro určení trendu.',
        type: 'neutral',
      };
    }

    const priceAbove50 =
      data.currentPrice !== null && data.currentPrice > data.sma50;
    const priceAbove200 =
      data.currentPrice !== null && data.currentPrice > data.sma200;
    const goldenCross = data.sma50 > data.sma200;

    if (goldenCross && priceAbove50 && priceAbove200) {
      return {
        signal: 'Strong Bullish',
        description:
          'Golden Cross (50 DMA > 200 DMA) s cenou nad oběma průměry. Silný růstový trend.',
        type: 'bullish',
      };
    } else if (goldenCross && priceAbove50 && !priceAbove200) {
      return {
        signal: 'Bullish',
        description:
          'Golden Cross aktivní. Cena nad 50 DMA, ale stále pod 200 DMA. Vznikající uptrend.',
        type: 'bullish',
      };
    } else if (goldenCross && !priceAbove50 && priceAbove200) {
      return {
        signal: 'Bullish',
        description:
          'Golden Cross aktivní. Cena nad 200 DMA indikuje dlouhodobý uptrend.',
        type: 'bullish',
      };
    } else if (goldenCross && !priceAbove50 && !priceAbove200) {
      return {
        signal: 'Mixed',
        description:
          'Golden Cross aktivní, ale cena pod oběma průměry. Možná korekce v uptrendu.',
        type: 'neutral',
      };
    } else if (!goldenCross && !priceAbove50 && !priceAbove200) {
      return {
        signal: 'Strong Bearish',
        description:
          'Death Cross (50 DMA < 200 DMA) s cenou pod oběma průměry. Silný klesající trend.',
        type: 'bearish',
      };
    } else if (!goldenCross && !priceAbove50 && priceAbove200) {
      return {
        signal: 'Mixed',
        description:
          'Death Cross aktivní, ale cena nad 200 DMA. Nejasný signál, vyčkejte.',
        type: 'neutral',
      };
    } else if (!goldenCross && priceAbove50 && !priceAbove200) {
      return {
        signal: 'Bearish',
        description:
          'Death Cross aktivní. Cena pod 200 DMA indikuje dlouhodobý downtrend.',
        type: 'bearish',
      };
    } else {
      return {
        signal: 'Mixed',
        description: 'Protichůdné signály. Cena přechází mezi trendy.',
        type: 'neutral',
      };
    }
  };

  const trendSignal = getTrendSignal();

  const getRSILabel = (rsi: number | null): string => {
    if (rsi === null) return 'N/A';
    if (rsi >= 70) return 'Překoupená';
    if (rsi <= 30) return 'Přeprodaná';
    return 'Neutrální';
  };

  return (
    <div className="research-technical">
      {/* Main Price Chart */}
      <div className="research-technical__price-chart">
        <PriceChart
          historicalPrices={data.historicalPrices}
          historicalPricesWeekly={data.historicalPricesWeekly}
          sma50History={data.sma50History}
          sma200History={data.sma200History}
          showVolume={true}
          defaultRange="3m"
          defaultChartType="area"
          onLoadIntraday={handleLoadIntraday}
        />
      </div>

      {/* Section 1: Trend Signal Overview */}
      <ChartSection
        title="Trend Signal"
        tooltip="**Trend Signál** | Souhrnné hodnocení trendu na základě klouzavých průměrů. | • Strong Bullish = silný růst, ideální pro držení | • Bullish = růstový trend | • Bearish = klesající, opatrnost | • Strong Bearish = silný pokles | • Mixed = nejasný signál, vyčkat"
      >
        <TrendSignal
          signal={trendSignal.signal}
          description={trendSignal.description}
          type={trendSignal.type}
        />
      </ChartSection>

      {/* Section 2: Moving Average Analysis */}
      <ChartSection
        title="Moving Average Analysis"
        tooltip="**Analýza klouzavých průměrů** | Porovnání ceny s průměry. | • Procenta = o kolik je cena nad/pod průměrem | • Golden Cross = 50 DMA nad 200 DMA (nákupní signál) | • Death Cross = 50 DMA pod 200 DMA (varovný signál)"
      >
        <MACardsRow>
          <MACard
            label="50 DMA"
            value={data.sma50}
            vsValue={data.priceVsSma50}
            vsLabel={
              data.priceVsSma50 !== null
                ? data.priceVsSma50 >= 0
                  ? ' above'
                  : ' below'
                : undefined
            }
            tooltip="**50 DMA** | Průměrná cena za 50 dní (krátkodobý trend). | • Cena NAD = krátkodobě roste (dobré) | • Cena POD = krátkodobě klesá (opatrnost)"
          />
          <MACard
            label="200 DMA"
            value={data.sma200}
            vsValue={data.priceVsSma200}
            vsLabel={
              data.priceVsSma200 !== null
                ? data.priceVsSma200 >= 0
                  ? ' above'
                  : ' below'
                : undefined
            }
            tooltip="**200 DMA** | Průměrná cena za 200 dní (dlouhodobý trend). | • Cena NAD = dlouhodobý růst (velmi dobré) | • Cena POD = dlouhodobý pokles (varovné)"
          />
          <MACard
            label="Cross Signal"
            value={data.currentPrice}
            crossSignal={
              data.sma50 !== null && data.sma200 !== null
                ? data.sma50 > data.sma200
                  ? 'golden'
                  : 'death'
                : null
            }
            tooltip="**Cross Signál** | Křížení klouzavých průměrů. | • Golden Cross = 50 DMA nad 200 DMA (nákupní signál) | • Death Cross = 50 DMA pod 200 DMA (varovný signál)"
          />
        </MACardsRow>
      </ChartSection>

      {/* Section 3: RSI */}
      <ChartSection
        title="RSI (Relative Strength Index)"
        tooltip="**RSI** | Index relativní síly (0-100). | • RSI > 70 = překoupená, může klesnout | • RSI < 30 = přeprodaná, může růst | • RSI 30-70 = neutrální | Ideál pro nákup: RSI kolem 30-50."
      >
        <div className="rsi-display">
          <div className="rsi-gauge">
            <div className="rsi-bar">
              <div className="rsi-zone oversold" style={{ width: '30%' }}>
                <Text size="xs" color="muted">
                  Oversold
                </Text>
              </div>
              <div className="rsi-zone neutral" style={{ width: '40%' }}>
                <Text size="xs" color="muted">
                  Neutral
                </Text>
              </div>
              <div className="rsi-zone overbought" style={{ width: '30%' }}>
                <Text size="xs" color="muted">
                  Overbought
                </Text>
              </div>
              {data.rsi14 !== null && (
                <div
                  className="rsi-indicator"
                  style={{ left: `${data.rsi14}%` }}
                >
                  <Text size="sm" weight="bold">
                    {data.rsi14.toFixed(1)}
                  </Text>
                </div>
              )}
            </div>
            <div className="rsi-scale">
              <Text size="xs" color="muted">
                0
              </Text>
              <Text size="xs" color="muted">
                30
              </Text>
              <Text size="xs" color="muted">
                70
              </Text>
              <Text size="xs" color="muted">
                100
              </Text>
            </div>
          </div>
          <div className="rsi-info-cards">
            <div className="rsi-info-card">
              <Text size="sm" weight="semibold" color="danger">
                &gt;70 Overbought
              </Text>
              <Text size="xs" color="secondary">
                Možný pokles
              </Text>
              <InfoTooltip text="**Překoupená (>70)** | Akcie rostla příliš rychle a může být 'přehřátá'. | • Často následuje korekce (pokles ceny) | • Rizikový čas pro nákup, možný čas pro prodej." />
            </div>
            <div className="rsi-info-card">
              <Text size="sm" weight="semibold" color="secondary">
                30-70 Neutral
              </Text>
              <Text size="xs" color="secondary">
                Normální momentum
              </Text>
              <InfoTooltip text="**Neutrální (30-70)** | Cena se pohybuje v normálním rozmezí. | • RSI nad 50 značí spíše rostoucí trend | • RSI pod 50 značí spíše klesající trend." />
            </div>
            <div className="rsi-info-card">
              <Text size="sm" weight="semibold" color="success">
                &lt;30 Oversold
              </Text>
              <Text size="xs" color="secondary">
                Možný odraz
              </Text>
              <InfoTooltip text="**Přeprodaná (<30)** | Akcie klesla příliš rychle a může být 've slevě'. | • Často následuje odraz ceny nahoru (rebound) | • Může být dobrá příležitost k nákupu (pokud je firma zdravá)." />
            </div>
          </div>
          <div className="rsi-current">
            <MetricLabel>Aktuální RSI</MetricLabel>
            <MetricValue
              size="lg"
              sentiment={
                data.rsi14 !== null
                  ? data.rsi14 >= 70
                    ? 'negative'
                    : data.rsi14 <= 30
                    ? 'positive'
                    : undefined
                  : undefined
              }
            >
              {data.rsi14 !== null ? data.rsi14.toFixed(1) : 'N/A'} —{' '}
              {getRSILabel(data.rsi14)}
            </MetricValue>
          </div>
        </div>
      </ChartSection>

      {/* Section 4: MACD */}
      <ChartSection
        title="MACD (Moving Average Convergence Divergence)"
        tooltip="**MACD** | Ukazatel trendu a momenta. Sleduje vztah mezi dvěma klouzavými průměry. | • MACD překříží Signal nahoru = Nákupní signál (Bullish) | • MACD překříží Signal dolů = Prodejní signál (Bearish) | • Histogram ukazuje sílu trendu (čím vyšší sloupce, tím silnější trend)."
        timeRange={macdTimeRange}
        onTimeRangeChange={setMacdTimeRange}
      >
        {macdData.length > 0 ? (
          <>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart
                  data={macdData}
                  margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border-color)"
                  />
                  <XAxis
                    dataKey="displayDate"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickLine={{ stroke: 'var(--border-color)' }}
                    axisLine={{ stroke: 'var(--border-color)' }}
                    interval="preserveStartEnd"
                    minTickGap={50}
                  />
                  <YAxis
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickLine={{ stroke: 'var(--border-color)' }}
                    axisLine={{ stroke: 'var(--border-color)' }}
                    tickFormatter={(v: number) => v.toFixed(2)}
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                    }}
                    formatter={(value: number, name: string) => [
                      value.toFixed(3),
                      name,
                    ]}
                  />
                  <ReferenceLine
                    y={0}
                    stroke="var(--text-muted)"
                    strokeDasharray="3 3"
                  />
                  <Bar dataKey="histogram" name="Histogram">
                    {macdData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          (entry.histogram ?? 0) >= 0
                            ? 'rgba(34, 197, 94, 0.6)'
                            : 'rgba(239, 68, 68, 0.6)'
                        }
                      />
                    ))}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="macd"
                    name="MACD"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="signal"
                    name="Signal"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <IndicatorValuesRow>
              <IndicatorValue
                label="MACD"
                value={data.macd !== null ? data.macd.toFixed(3) : null}
                sentiment={(data.macd ?? 0) >= 0 ? 'positive' : 'negative'}
              />
              <IndicatorValue
                label="Signal"
                value={
                  data.macdSignal !== null ? data.macdSignal.toFixed(3) : null
                }
              />
              <IndicatorValue
                label="Histogram"
                value={
                  data.macdHistogram !== null
                    ? data.macdHistogram.toFixed(3)
                    : null
                }
                sentiment={
                  (data.macdHistogram ?? 0) >= 0 ? 'positive' : 'negative'
                }
              />
            </IndicatorValuesRow>
            <IndicatorSignal type={data.macdTrend}>
              {data.macdTrend === 'bullish' &&
                'Bullish momentum — MACD nad signal linií'}
              {data.macdTrend === 'bearish' &&
                'Bearish momentum — MACD pod signal linií'}
              {data.macdTrend === 'neutral' &&
                'Neutrální — Momentum v přechodu'}
              {data.macdTrend === null && 'Nedostatek dat'}
            </IndicatorSignal>
          </>
        ) : (
          <ChartNoData message="Nedostatek dat pro výpočet MACD" />
        )}
      </ChartSection>

      {/* Section 5: Bollinger Bands */}
      <ChartSection
        title="Bollinger Bands"
        tooltip="**Bollingerova pásma** | Ukazatel volatility ceny. | • Cena u horního pásma = možná překoupená | • Cena u dolního pásma = možná přeprodaná | • Široká pásma = vysoká volatilita | • Úzká pásma = nízká, čeká se pohyb"
        timeRange={bollingerTimeRange}
        onTimeRangeChange={setBollingerTimeRange}
        timeRangeOptions={TIME_RANGES_LONG}
      >
        {bollingerData.length > 0 && data.bollingerUpper !== null ? (
          <>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart
                  data={bollingerData}
                  margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border-color)"
                  />
                  <XAxis
                    dataKey="displayDate"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickLine={{ stroke: 'var(--border-color)' }}
                    axisLine={{ stroke: 'var(--border-color)' }}
                    interval="preserveStartEnd"
                    minTickGap={50}
                  />
                  <YAxis
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickLine={{ stroke: 'var(--border-color)' }}
                    axisLine={{ stroke: 'var(--border-color)' }}
                    tickFormatter={(v: number) => v.toFixed(0)}
                    width={50}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                    }}
                    formatter={(value: number, name: string) => [
                      value.toFixed(2),
                      name,
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="upper"
                    stroke="transparent"
                    fill="rgba(139, 92, 246, 0.1)"
                  />
                  <Area
                    type="monotone"
                    dataKey="lower"
                    stroke="transparent"
                    fill="var(--bg-primary)"
                  />
                  <Line
                    type="monotone"
                    dataKey="upper"
                    name="Upper Band"
                    stroke="#8b5cf6"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="middle"
                    name="Middle (20 SMA)"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="lower"
                    name="Lower Band"
                    stroke="#8b5cf6"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    name="Price"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <IndicatorValuesRow>
              <IndicatorValue
                label="Upper Band"
                value={data.bollingerUpper?.toFixed(2) ?? null}
              />
              <IndicatorValue
                label="Middle (20 SMA)"
                value={data.bollingerMiddle?.toFixed(2) ?? null}
              />
              <IndicatorValue
                label="Lower Band"
                value={data.bollingerLower?.toFixed(2) ?? null}
              />
            </IndicatorValuesRow>
            <div className="indicator-position-block">
              <div className="position-header">
                <MetricLabel>Pozice v pásmech</MetricLabel>
                <MetricValue>{data.bollingerPosition ?? 0}%</MetricValue>
              </div>
              <div className="position-bar">
                <div
                  className="position-indicator"
                  style={{ left: `${data.bollingerPosition ?? 50}%` }}
                />
              </div>
              <div className="position-zones">
                <Text size="xs" color="muted">
                  Spodní
                </Text>
                <Text size="xs" color="muted">
                  Střed
                </Text>
                <Text size="xs" color="muted">
                  Horní
                </Text>
              </div>
            </div>
            <IndicatorSignal type={data.bollingerSignal}>
              {data.bollingerSignal === 'overbought' &&
                'Cena nad horním pásmem — možná překoupená'}
              {data.bollingerSignal === 'oversold' &&
                'Cena pod dolním pásmem — možná přeprodaná'}
              {data.bollingerSignal === 'neutral' &&
                'Cena v pásmech — normální obchodní rozsah'}
              {data.bollingerSignal === null && 'Nedostatek dat'}
            </IndicatorSignal>
          </>
        ) : (
          <ChartNoData message="Nedostatek dat pro výpočet Bollinger Bands" />
        )}
      </ChartSection>

      {/* Section 6: Stochastic Oscillator */}
      <ChartSection
        title="Stochastic Oscillator"
        tooltip="**Stochastic** | Momentum indikátor (0-100). | • Nad 80 = překoupená | • Pod 20 = přeprodaná | • %K kříží %D zespoda = nákupní signál | • %K kříží %D shora = prodejní signál"
        timeRange={stochasticTimeRange}
        onTimeRangeChange={setStochasticTimeRange}
      >
        {stochasticData.length > 0 ? (
          <>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart
                  data={stochasticData}
                  margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border-color)"
                  />
                  <XAxis
                    dataKey="displayDate"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickLine={{ stroke: 'var(--border-color)' }}
                    axisLine={{ stroke: 'var(--border-color)' }}
                    interval="preserveStartEnd"
                    minTickGap={50}
                  />
                  <YAxis
                    domain={[0, 100]}
                    ticks={[0, 20, 50, 80, 100]}
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickLine={{ stroke: 'var(--border-color)' }}
                    axisLine={{ stroke: 'var(--border-color)' }}
                    width={35}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                    }}
                    formatter={(value: number, name: string) => [
                      value.toFixed(1),
                      name,
                    ]}
                  />
                  <ReferenceLine
                    y={80}
                    stroke="var(--color-negative)"
                    strokeDasharray="3 3"
                    strokeOpacity={0.5}
                  />
                  <ReferenceLine
                    y={20}
                    stroke="var(--color-positive)"
                    strokeDasharray="3 3"
                    strokeOpacity={0.5}
                  />
                  <Line
                    type="monotone"
                    dataKey="k"
                    name="%K"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="d"
                    name="%D"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <IndicatorValuesRow>
              <IndicatorValue
                label="%K (Fast)"
                value={
                  data.stochasticK !== null ? data.stochasticK.toFixed(1) : null
                }
                sentiment={
                  (data.stochasticK ?? 50) > 80
                    ? 'overbought'
                    : (data.stochasticK ?? 50) < 20
                    ? 'oversold'
                    : undefined
                }
              />
              <IndicatorValue
                label="%D (Slow)"
                value={
                  data.stochasticD !== null ? data.stochasticD.toFixed(1) : null
                }
              />
            </IndicatorValuesRow>
            <ZonesRow>
              <ZoneBadge type="overbought">&gt;80 Překoupená</ZoneBadge>
              <ZoneBadge type="neutral">20-80 Neutrální</ZoneBadge>
              <ZoneBadge type="oversold">&lt;20 Přeprodaná</ZoneBadge>
            </ZonesRow>
            <IndicatorSignal type={data.stochasticSignal}>
              {data.stochasticSignal === 'overbought' &&
                'Stochastic nad 80 — možná překoupená'}
              {data.stochasticSignal === 'oversold' &&
                'Stochastic pod 20 — možná přeprodaná'}
              {data.stochasticSignal === 'neutral' &&
                'Stochastic v neutrální zóně — normální obchodování'}
              {data.stochasticSignal === null && 'Nedostatek dat'}
            </IndicatorSignal>
          </>
        ) : (
          <ChartNoData message="Nedostatek dat pro výpočet Stochastic Oscillator" />
        )}
      </ChartSection>

      {/* Section 7: Volume Analysis */}
      <ChartSection
        title="Volume Analysis"
        tooltip="**Objem obchodů** | Počet akcií zobchodovaných za den. | • Vysoký při růstu = silný zájem | • Vysoký při poklesu = prodejní tlak | • Nízký = slabý pohyb | Oranžová čára = 20denní průměr."
        timeRange={volumeTimeRange}
        onTimeRangeChange={setVolumeTimeRange}
      >
        {volumeData.length > 0 ? (
          <>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart
                  data={volumeData}
                  margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border-color)"
                  />
                  <XAxis
                    dataKey="displayDate"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickLine={{ stroke: 'var(--border-color)' }}
                    axisLine={{ stroke: 'var(--border-color)' }}
                    interval="preserveStartEnd"
                    minTickGap={50}
                  />
                  <YAxis
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickLine={{ stroke: 'var(--border-color)' }}
                    axisLine={{ stroke: 'var(--border-color)' }}
                    tickFormatter={formatVolume}
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                    }}
                    formatter={(value: number, name: string) => [
                      formatVolume(value),
                      name === 'volume' ? 'Volume' : 'Avg Volume (20d)',
                    ]}
                  />
                  <Bar dataKey="volume" name="volume">
                    {volumeData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          entry.isAboveAvg
                            ? 'rgba(59, 130, 246, 0.7)'
                            : 'rgba(59, 130, 246, 0.3)'
                        }
                      />
                    ))}
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="avgVolume"
                    name="avgVolume"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <IndicatorValuesRow>
              <IndicatorValue
                label="Aktuální objem"
                value={
                  data.currentVolume !== null
                    ? formatVolume(data.currentVolume)
                    : null
                }
              />
              <IndicatorValue
                label="20denní průměr"
                value={
                  data.avgVolume20 !== null
                    ? formatVolume(data.avgVolume20)
                    : null
                }
              />
              <IndicatorValue
                label="vs průměr"
                value={
                  data.volumeChange !== null
                    ? `${data.volumeChange > 0 ? '+' : ''}${data.volumeChange}%`
                    : null
                }
                sentiment={
                  (data.volumeChange ?? 0) > 0
                    ? 'positive'
                    : (data.volumeChange ?? 0) < 0
                    ? 'negative'
                    : undefined
                }
              />
            </IndicatorValuesRow>
            <IndicatorSignal type={data.volumeSignal}>
              {data.volumeSignal === 'high' &&
                'Objem nad průměrem — silný zájem'}
              {data.volumeSignal === 'low' &&
                'Objem pod průměrem — slabý zájem'}
              {data.volumeSignal === 'normal' &&
                'Objem blízko průměru — normální aktivita'}
              {data.volumeSignal === null && 'Nedostatek dat'}
            </IndicatorSignal>
          </>
        ) : (
          <ChartNoData message="Nedostatek dat pro Volume Analysis" />
        )}
      </ChartSection>

      {/* Section 8: ATR */}
      <ChartSection
        title="ATR (Average True Range)"
        tooltip="**ATR** | Měří volatilitu akcie (14 dní). | • Vysoký ATR = větší výkyvy, vyšší riziko | • Nízký ATR = stabilnější cena | • ATR% pod 2% = nízká volatilita | • ATR% nad 5% = vysoká volatilita"
        timeRange={atrTimeRange}
        onTimeRangeChange={setAtrTimeRange}
      >
        {atrData.length > 0 && data.atr14 !== null ? (
          <>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={200}>
                <ComposedChart
                  data={atrData}
                  margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border-color)"
                  />
                  <XAxis
                    dataKey="displayDate"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickLine={{ stroke: 'var(--border-color)' }}
                    axisLine={{ stroke: 'var(--border-color)' }}
                    interval="preserveStartEnd"
                    minTickGap={50}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickLine={{ stroke: 'var(--border-color)' }}
                    axisLine={{ stroke: 'var(--border-color)' }}
                    tickFormatter={(v: number) => `$${v.toFixed(1)}`}
                    width={55}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickLine={{ stroke: 'var(--border-color)' }}
                    axisLine={{ stroke: 'var(--border-color)' }}
                    tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                    width={50}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                    }}
                    labelStyle={{ color: 'var(--text-secondary)' }}
                    formatter={(value: number, name: string) =>
                      name === 'ATR'
                        ? [`$${value.toFixed(2)}`, name]
                        : [`${value.toFixed(2)}%`, name]
                    }
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="atr"
                    name="ATR"
                    fill="rgba(168, 85, 247, 0.2)"
                    stroke="#a855f7"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="atrPercent"
                    name="ATR %"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <IndicatorValuesRow>
              <IndicatorValue
                label="ATR (14)"
                value={`$${data.atr14?.toFixed(2)}`}
              />
              <IndicatorValue
                label="ATR %"
                value={`${data.atrPercent?.toFixed(2)}%`}
              />
              <IndicatorValue
                label="Volatilita"
                value={
                  data.atrSignal === 'high'
                    ? 'Vysoká'
                    : data.atrSignal === 'low'
                    ? 'Nízká'
                    : data.atrSignal === 'normal'
                    ? 'Normální'
                    : null
                }
                sentiment={
                  data.atrSignal === 'high'
                    ? 'warning'
                    : data.atrSignal === 'low'
                    ? 'muted'
                    : undefined
                }
              />
            </IndicatorValuesRow>
            <IndicatorSignal type={data.atrSignal}>
              {data.atrSignal === 'high' &&
                'Vysoká volatilita — zvažte širší stop-loss'}
              {data.atrSignal === 'low' &&
                'Nízká volatilita — stabilní, ale omezený potenciál'}
              {data.atrSignal === 'normal' &&
                'Normální volatilita — typický cenový pohyb'}
              {data.atrSignal === null && 'Nedostatek dat'}
            </IndicatorSignal>
          </>
        ) : (
          <ChartNoData message="Nedostatek dat pro ATR Analysis" />
        )}
      </ChartSection>

      {/* Section 9: OBV */}
      <ChartSection
        title="On-Balance Volume (OBV)"
        tooltip="**OBV** | Kumulativní tok objemu. | • Rostoucí OBV = akumulace (nákup) | • Klesající OBV = distribuce (prodej) | Divergence s cenou předpovídá obrat."
        timeRange={obvTimeRange}
        onTimeRangeChange={setObvTimeRange}
      >
        {obvData.length > 0 ? (
          <>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={obvData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border-color)"
                  />
                  <XAxis
                    dataKey="displayDate"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    tickFormatter={formatVolume}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    formatter={(value: number) => [formatVolume(value), 'OBV']}
                    contentStyle={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="obv"
                    fill="rgba(102, 126, 234, 0.2)"
                    stroke="#667eea"
                    strokeWidth={2}
                    name="OBV"
                  />
                  <Line
                    type="monotone"
                    dataKey="obvSma"
                    stroke="#f093fb"
                    strokeWidth={2}
                    dot={false}
                    name="SMA(20)"
                    connectNulls
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <IndicatorValuesRow>
              <IndicatorValue
                label="Aktuální OBV"
                value={data.obv !== null ? formatVolume(data.obv) : null}
              />
              <IndicatorValue
                label="OBV Trend"
                value={
                  data.obvTrend === 'bullish'
                    ? 'Akumulace'
                    : data.obvTrend === 'bearish'
                    ? 'Distribuce'
                    : data.obvTrend === 'neutral'
                    ? 'Neutrální'
                    : null
                }
                sentiment={
                  data.obvTrend === 'bullish'
                    ? 'positive'
                    : data.obvTrend === 'bearish'
                    ? 'negative'
                    : undefined
                }
              />
              <IndicatorValue
                label="Divergence"
                value={
                  data.obvDivergence === 'bullish'
                    ? 'Bullish'
                    : data.obvDivergence === 'bearish'
                    ? 'Bearish'
                    : 'Žádná'
                }
                sentiment={
                  data.obvDivergence === 'bullish'
                    ? 'positive'
                    : data.obvDivergence === 'bearish'
                    ? 'negative'
                    : 'muted'
                }
              />
            </IndicatorValuesRow>
            <IndicatorSignal type={data.obvTrend}>
              {data.obvTrend === 'bullish' &&
                'Akumulace — objem proudí do akcie'}
              {data.obvTrend === 'bearish' &&
                'Distribuce — objem odchází z akcie'}
              {data.obvTrend === 'neutral' &&
                'Neutrální — žádný jasný objemový trend'}
              {!data.obvTrend && 'Nedostatek dat'}
            </IndicatorSignal>
          </>
        ) : (
          <ChartNoData message="Nedostatek dat pro OBV Analysis" />
        )}
      </ChartSection>

      {/* Section 10: ADX */}
      <ChartSection
        title="ADX (Average Directional Index)"
        tooltip="**ADX** | Měří SÍLU trendu (ne směr). | • Pod 20 = slabý trend | • 20-25 = vznikající | • Nad 25 = silný trend | +DI > -DI = bullish, -DI > +DI = bearish"
        timeRange={adxTimeRange}
        onTimeRangeChange={setAdxTimeRange}
      >
        {adxData.length > 0 && data.adx !== null ? (
          <>
            <div className="chart-wrapper">
              <ResponsiveContainer width="100%" height={250}>
                <ComposedChart data={adxData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--border-color)"
                  />
                  <XAxis
                    dataKey="displayDate"
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                    domain={[0, 60]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <ReferenceLine
                    y={20}
                    stroke="var(--text-muted)"
                    strokeDasharray="5 5"
                  />
                  <ReferenceLine
                    y={40}
                    stroke="var(--text-muted)"
                    strokeDasharray="5 5"
                  />
                  <Line
                    type="monotone"
                    dataKey="adx"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    dot={false}
                    name="ADX"
                  />
                  <Line
                    type="monotone"
                    dataKey="plusDI"
                    stroke="#22c55e"
                    strokeWidth={2}
                    dot={false}
                    name="+DI"
                  />
                  <Line
                    type="monotone"
                    dataKey="minusDI"
                    stroke="#ef4444"
                    strokeWidth={2}
                    dot={false}
                    name="-DI"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <IndicatorValuesRow>
              <IndicatorValue
                label="ADX"
                value={data.adx?.toFixed(1) ?? null}
              />
              <IndicatorValue
                label="+DI"
                value={data.plusDI?.toFixed(1) ?? null}
                sentiment="positive"
              />
              <IndicatorValue
                label="-DI"
                value={data.minusDI?.toFixed(1) ?? null}
                sentiment="negative"
              />
              <IndicatorValue
                label="Síla"
                value={
                  data.adxSignal === 'strong'
                    ? 'Velmi silný'
                    : data.adxSignal === 'moderate'
                    ? 'Silný'
                    : data.adxSignal === 'weak'
                    ? 'Slabý'
                    : data.adxSignal === 'no-trend'
                    ? 'Žádný trend'
                    : null
                }
                sentiment={
                  data.adxSignal === 'strong'
                    ? 'positive'
                    : data.adxSignal === 'weak'
                    ? 'warning'
                    : data.adxSignal === 'no-trend'
                    ? 'muted'
                    : undefined
                }
              />
            </IndicatorValuesRow>
            <IndicatorSignal type={data.adxSignal}>
              {data.adxSignal === 'strong' &&
                'Velmi silný trend — následujte momentum'}
              {data.adxSignal === 'moderate' &&
                'Silný trend — vhodné pro trendové obchody'}
              {data.adxSignal === 'weak' && 'Slabý trend — buďte opatrní'}
              {data.adxSignal === 'no-trend' &&
                'Žádný trend — vyhněte se trendovým strategiím'}
              {!data.adxSignal && 'Nedostatek dat'}
            </IndicatorSignal>
            {data.adxTrend && data.adxSignal !== 'no-trend' && (
              <IndicatorSignal type={data.adxTrend} variant="direction">
                {data.adxTrend === 'bullish' &&
                  '+DI > -DI → Býci mají kontrolu'}
                {data.adxTrend === 'bearish' &&
                  '-DI > +DI → Medvědi mají kontrolu'}
                {data.adxTrend === 'neutral' && '+DI ≈ -DI → Nerozhodně'}
              </IndicatorSignal>
            )}
          </>
        ) : (
          <ChartNoData message="Nedostatek dat pro ADX Analysis" />
        )}
      </ChartSection>

      {/* Section 11: Fibonacci */}
      {data.fibonacciLevels && (
        <ChartSection
          title="Fibonacci Retracement"
          tooltip="**Fibonacci** | Klíčové úrovně podpory/odporu. | • 38.2% a 61.8% = nejdůležitější | • Proražení 61.8% = pokračování trendu | Fungují jako body obratu při korekcích."
        >
          <div className="fibonacci-visual">
            <div className="fib-price-bar">
              <div className="fib-level level-0">
                <Text size="xs" color="muted">
                  0% (High)
                </Text>
                <Text size="sm" weight="medium">
                  ${data.fibonacciLevels.level0.toFixed(2)}
                </Text>
              </div>
              <div className="fib-level level-236">
                <Text size="xs" color="muted">
                  23.6%
                </Text>
                <Text size="sm" weight="medium">
                  ${data.fibonacciLevels.level236.toFixed(2)}
                </Text>
              </div>
              <div className="fib-level level-382">
                <Text size="xs" color="muted">
                  38.2%
                </Text>
                <Text size="sm" weight="medium">
                  ${data.fibonacciLevels.level382.toFixed(2)}
                </Text>
              </div>
              <div className="fib-level level-500">
                <Text size="xs" color="muted">
                  50%
                </Text>
                <Text size="sm" weight="medium">
                  ${data.fibonacciLevels.level500.toFixed(2)}
                </Text>
              </div>
              <div className="fib-level level-618">
                <Text size="xs" color="muted">
                  61.8%
                </Text>
                <Text size="sm" weight="medium">
                  ${data.fibonacciLevels.level618.toFixed(2)}
                </Text>
              </div>
              <div className="fib-level level-786">
                <Text size="xs" color="muted">
                  78.6%
                </Text>
                <Text size="sm" weight="medium">
                  ${data.fibonacciLevels.level786.toFixed(2)}
                </Text>
              </div>
              <div className="fib-level level-100">
                <Text size="xs" color="muted">
                  100% (Low)
                </Text>
                <Text size="sm" weight="medium">
                  ${data.fibonacciLevels.level100.toFixed(2)}
                </Text>
              </div>
              <div
                className="fib-current-price"
                style={{
                  top: `${
                    ((data.fibonacciLevels.high - (data.currentPrice || 0)) /
                      (data.fibonacciLevels.high - data.fibonacciLevels.low)) *
                    100
                  }%`,
                }}
              >
                <Text size="sm" weight="semibold">
                  Aktuální: ${data.currentPrice?.toFixed(2)}
                </Text>
              </div>
            </div>
          </div>
          <IndicatorValuesRow>
            <IndicatorValue
              label="Maximum období"
              value={`$${data.fibonacciLevels.high.toFixed(2)}`}
            />
            <IndicatorValue
              label="Minimum období"
              value={`$${data.fibonacciLevels.low.toFixed(2)}`}
            />
            <IndicatorValue
              label="Trend"
              value={
                data.fibonacciLevels.trend === 'uptrend'
                  ? 'Uptrend'
                  : 'Downtrend'
              }
              sentiment={
                data.fibonacciLevels.trend === 'uptrend'
                  ? 'positive'
                  : 'negative'
              }
            />
            <IndicatorValue
              label="Blízko úrovně"
              value={data.fibonacciLevels.currentLevel || 'Mezi úrovněmi'}
            />
          </IndicatorValuesRow>
          <IndicatorSignal
            type={
              data.fibonacciLevels.trend === 'uptrend' ? 'bullish' : 'bearish'
            }
          >
            {data.fibonacciLevels.trend === 'uptrend'
              ? 'Uptrend — hledejte nákupní příležitosti na 38.2% nebo 61.8% úrovních'
              : 'Downtrend — úrovně mohou fungovat jako odpor při růstech'}
          </IndicatorSignal>
          {data.fibonacciLevels.currentLevel && (
            <IndicatorSignal type="neutral" variant="highlight">
              Cena blízko{' '}
              <Text weight="semibold">{data.fibonacciLevels.currentLevel}</Text>{' '}
              — sledujte reakci!
            </IndicatorSignal>
          )}
        </ChartSection>
      )}

      {/* Section 12: Jak používat tuto analýzu */}
      <ChartSection
        title="Jak používat tuto analýzu"
        tooltip="**Důležité** | Technická analýza není 100% spolehlivá. | • Používejte jako JEDEN z nástrojů | • Kombinujte více indikátorů | • Nikdy neinvestujte jen na základě jednoho indikátoru"
      >
        <div className="usage-guide">
          <div className="usage-item">
            <Text weight="semibold" color="success">
              Bullish signály:
            </Text>
            <Text size="sm" color="secondary">
              Golden Cross, cena nad klouzavými průměry, RSI stoupá z oversold
              zóny, MACD kříží signal linii nahoru, cena se odráží od dolního
              Bollinger pásma, Stochastic %K kříží %D zespoda v oversold zóně,
              růst ceny s vysokým objemem
            </Text>
          </div>
          <div className="usage-item">
            <Text weight="semibold" color="danger">
              Bearish signály:
            </Text>
            <Text size="sm" color="secondary">
              Death Cross, cena pod klouzavými průměry, RSI klesá z overbought
              zóny, MACD kříží signal linii dolů, cena je odmítnuta u horního
              Bollinger pásma, Stochastic %K kříží %D shora v overbought zóně,
              pokles ceny s vysokým objemem
            </Text>
          </div>
          <div className="usage-item">
            <Text weight="semibold">Tip k objemu:</Text>
            <Text size="sm" color="secondary">
              Objem potvrzuje cenové pohyby. Růst s vysokým objemem je silnější
              než růst s nízkým objemem. Pokles s nízkým objemem může
              signalizovat blížící se obrat.
            </Text>
          </div>
        </div>
      </ChartSection>
    </div>
  );
}
