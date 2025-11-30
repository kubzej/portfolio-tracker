import { useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
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
  SMAPoint,
  MACDPoint,
  BollingerPoint,
  StochasticPoint,
  VolumePoint,
  ATRPoint,
  OBVPoint,
  ADXPoint,
} from '@/services/api/technical';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import { Button } from '@/components/shared/Button';
import {
  Ticker,
  StockName,
  MetricLabel,
  MetricValue,
  Text,
  Muted,
} from '@/components/shared/Typography';
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

interface TechnicalChartProps {
  data: TechnicalData;
  onClose: () => void;
}

interface ChartDataPoint {
  date: string;
  displayDate: string;
  price: number | null;
  sma50: number | null;
  sma200: number | null;
}

interface BollingerChartPoint {
  date: string;
  displayDate: string;
  price: number | null;
  upper: number | null;
  middle: number | null;
  lower: number | null;
}

interface MACDChartPoint {
  date: string;
  displayDate: string;
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

interface StochasticChartPoint {
  date: string;
  displayDate: string;
  k: number | null;
  d: number | null;
}

interface VolumeChartPoint {
  date: string;
  displayDate: string;
  volume: number;
  avgVolume: number | null;
  isAboveAvg: boolean;
}

interface ATRChartPoint {
  date: string;
  displayDate: string;
  atr: number;
  atrPercent: number;
}

interface OBVChartPoint {
  date: string;
  displayDate: string;
  obv: number;
  obvSma: number | null;
}

interface ADXChartPoint {
  date: string;
  displayDate: string;
  adx: number;
  plusDI: number;
  minusDI: number;
}

// Format date helper
const formatDateStr = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

// Filter data by date range
const filterByDateRange = <T extends { date: string }>(
  data: T[],
  days: number
): T[] => {
  if (data.length === 0) return data;
  // Data is in chronological order (oldest first), so we take the last N items
  return data.slice(-days);
};

export function TechnicalChart({ data, onClose }: TechnicalChartProps) {
  // Separate time range state for each chart
  const [priceTimeRange, setPriceTimeRange] = useState<TimeRange>('1Y');
  const [bollingerTimeRange, setBollingerTimeRange] = useState<TimeRange>('6M');
  const [macdTimeRange, setMacdTimeRange] = useState<TimeRange>('1M');
  const [stochasticTimeRange, setStochasticTimeRange] =
    useState<TimeRange>('2W');
  const [volumeTimeRange, setVolumeTimeRange] = useState<TimeRange>('1M');
  const [atrTimeRange, setAtrTimeRange] = useState<TimeRange>('1M');
  const [obvTimeRange, setObvTimeRange] = useState<TimeRange>('3M');
  const [adxTimeRange, setAdxTimeRange] = useState<TimeRange>('3M');

  // Get days for each chart using helper
  const priceDays = getDaysForRange(priceTimeRange);
  const bollingerDays = getDaysForRange(bollingerTimeRange);
  const macdDays = getDaysForRange(macdTimeRange);
  const stochasticDays = getDaysForRange(stochasticTimeRange);
  const volumeDays = getDaysForRange(volumeTimeRange);
  const atrDays = getDaysForRange(atrTimeRange);
  const obvDays = getDaysForRange(obvTimeRange);
  const adxDays = getDaysForRange(adxTimeRange);

  // Merge price and SMA data for the chart
  // All data from API is now in chronological order (oldest to newest)
  const chartData = useMemo((): ChartDataPoint[] => {
    // Safety checks for undefined arrays
    const prices = data.historicalPrices || [];
    const sma50Arr = data.sma50History || [];
    const sma200Arr = data.sma200History || [];

    if (prices.length === 0) {
      return [];
    }

    // Create maps for quick lookup
    const sma50Map = new Map<string, number>();
    const sma200Map = new Map<string, number>();

    sma50Arr.forEach((s: SMAPoint) => {
      sma50Map.set(s.date, s.value);
    });
    sma200Arr.forEach((s: SMAPoint) => {
      sma200Map.set(s.date, s.value);
    });

    // Build chart data from price history (already chronological)
    const fullData = prices.map((p: PricePoint) => ({
      date: p.date,
      displayDate: formatDateStr(p.date),
      price: p.close,
      sma50: sma50Map.get(p.date) ?? null,
      sma200: sma200Map.get(p.date) ?? null,
    }));

    return filterByDateRange(fullData, priceDays);
  }, [data, priceDays]);

  // Build Bollinger Bands chart data
  const bollingerData = useMemo((): BollingerChartPoint[] => {
    const prices = data.historicalPrices || [];
    const bbArr = data.bollingerHistory || [];

    if (prices.length === 0 || bbArr.length === 0) {
      return [];
    }

    // Create map for quick lookup
    const bbMap = new Map<string, BollingerPoint>();
    bbArr.forEach((b: BollingerPoint) => {
      bbMap.set(b.date, b);
    });

    const fullData = prices.map((p: PricePoint) => {
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
  }, [data, bollingerDays]);

  // Build MACD chart data
  const macdData = useMemo((): MACDChartPoint[] => {
    const macdArr = data.macdHistory || [];

    if (macdArr.length === 0) {
      return [];
    }

    const fullData = macdArr.map((m: MACDPoint) => ({
      date: m.date,
      displayDate: formatDateStr(m.date),
      macd: m.macd,
      signal: m.signal,
      histogram: m.histogram,
    }));

    return filterByDateRange(fullData, macdDays);
  }, [data, macdDays]);

  // Build Stochastic Oscillator chart data
  const stochasticData = useMemo((): StochasticChartPoint[] => {
    const stochArr = data.stochasticHistory || [];

    if (stochArr.length === 0) {
      return [];
    }

    const fullData = stochArr.map((s: StochasticPoint) => ({
      date: s.date,
      displayDate: formatDateStr(s.date),
      k: s.k,
      d: s.d,
    }));

    return filterByDateRange(fullData, stochasticDays);
  }, [data, stochasticDays]);

  // Build Volume chart data
  const volumeData = useMemo((): VolumeChartPoint[] => {
    const volArr = data.volumeHistory || [];

    if (volArr.length === 0) {
      return [];
    }

    const fullData = volArr.map((v: VolumePoint) => ({
      date: v.date,
      displayDate: formatDateStr(v.date),
      volume: v.volume,
      avgVolume: v.avgVolume,
      isAboveAvg: v.avgVolume !== null && v.volume > v.avgVolume,
    }));

    return filterByDateRange(fullData, volumeDays);
  }, [data, volumeDays]);

  // Build ATR chart data
  const atrData = useMemo((): ATRChartPoint[] => {
    const atrArr = data.atrHistory || [];

    if (atrArr.length === 0) {
      return [];
    }

    const fullData = atrArr.map((a: ATRPoint) => ({
      date: a.date,
      displayDate: formatDateStr(a.date),
      atr: a.atr,
      atrPercent: a.atrPercent,
    }));

    return filterByDateRange(fullData, atrDays);
  }, [data, atrDays]);

  // Build OBV chart data
  const obvData = useMemo((): OBVChartPoint[] => {
    const obvArr = data.obvHistory || [];

    if (obvArr.length === 0) {
      return [];
    }

    const fullData = obvArr.map((o: OBVPoint) => ({
      date: o.date,
      displayDate: formatDateStr(o.date),
      obv: o.obv,
      obvSma: o.obvSma,
    }));

    return filterByDateRange(fullData, obvDays);
  }, [data, obvDays]);

  // Build ADX chart data
  const adxData = useMemo((): ADXChartPoint[] => {
    const adxArr = data.adxHistory || [];

    if (adxArr.length === 0) {
      return [];
    }

    const fullData = adxArr.map((a: ADXPoint) => ({
      date: a.date,
      displayDate: formatDateStr(a.date),
      adx: a.adx,
      plusDI: a.plusDI,
      minusDI: a.minusDI,
    }));

    return filterByDateRange(fullData, adxDays);
  }, [data, adxDays]);

  // Format volume for display (e.g., 1.5M, 250K)
  const formatVolume = (value: number): string => {
    if (value >= 1000000000) {
      return (value / 1000000000).toFixed(1) + 'B';
    }
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(0) + 'K';
    }
    return value.toString();
  };

  const formatPrice = (value: number): string => {
    return value.toFixed(2);
  };

  // Calculate price domain with nice rounded values
  const priceValues = chartData
    .flatMap((d) => [d.price, d.sma50, d.sma200])
    .filter((v): v is number => v !== null);

  const minPrice = priceValues.length > 0 ? Math.min(...priceValues) : 0;
  const maxPrice = priceValues.length > 0 ? Math.max(...priceValues) : 100;

  // Calculate a nice step size for the Y axis
  const range = maxPrice - minPrice;
  const roughStep = range / 5; // Aim for about 5 ticks

  // Round step to a nice number (1, 2, 5, 10, 20, 50, etc.)
  const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / magnitude;
  let niceStep: number;
  if (normalized <= 1) niceStep = 1 * magnitude;
  else if (normalized <= 2) niceStep = 2 * magnitude;
  else if (normalized <= 5) niceStep = 5 * magnitude;
  else niceStep = 10 * magnitude;

  // Round min down and max up to nice values
  const niceMin = Math.floor(minPrice / niceStep) * niceStep;
  const niceMax = Math.ceil(maxPrice / niceStep) * niceStep;

  const yDomain: [number, number] = [niceMin, niceMax];

  // Generate tick values
  const yTicks: number[] = [];
  for (let tick = niceMin; tick <= niceMax; tick += niceStep) {
    yTicks.push(tick);
  }

  // Determine trend signals
  const getTrendSignal = (): {
    signal: string;
    description: string;
    type: 'bullish' | 'bearish' | 'neutral';
  } => {
    if (data.sma50 === null || data.sma200 === null) {
      return {
        signal: 'Insufficient Data',
        description: 'Need more price history to determine trend.',
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
          'Golden Cross (50 DMA > 200 DMA) with price above both averages. Strong uptrend.',
        type: 'bullish',
      };
    } else if (goldenCross && priceAbove200) {
      return {
        signal: 'Bullish',
        description:
          'Golden Cross active. Price above 200 DMA indicates long-term uptrend.',
        type: 'bullish',
      };
    } else if (!goldenCross && !priceAbove50 && !priceAbove200) {
      return {
        signal: 'Strong Bearish',
        description:
          'Death Cross (50 DMA < 200 DMA) with price below both averages. Strong downtrend.',
        type: 'bearish',
      };
    } else if (!goldenCross && !priceAbove200) {
      return {
        signal: 'Bearish',
        description:
          'Death Cross active. Price below 200 DMA indicates long-term downtrend.',
        type: 'bearish',
      };
    } else {
      return {
        signal: 'Mixed',
        description:
          'Conflicting signals. Price is transitioning between trends.',
        type: 'neutral',
      };
    }
  };

  const trendSignal = getTrendSignal();

  const getRSILabel = (rsi: number | null): string => {
    if (rsi === null) return 'N/A';
    if (rsi >= 70) return 'Overbought';
    if (rsi <= 30) return 'Oversold';
    return 'Neutral';
  };

  return (
    <div className="technical-chart-modal">
      <div className="technical-chart-overlay" onClick={onClose} />
      <div className="technical-chart-container">
        <div className="chart-header">
          <div className="chart-header-title">
            <Ticker size="xl">{data.ticker}</Ticker>
            <StockName size="lg">{data.stockName}</StockName>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            ×
          </Button>
        </div>

        {chartData.length === 0 ? (
          <div className="chart-error">
            <Text>No historical data available for {data.ticker}</Text>
            {data.error && <Muted>{data.error}</Muted>}
          </div>
        ) : (
          <>
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

            {/* Section 2: Price Chart with Moving Averages */}
            <ChartSection
              title="Price & Moving Averages"
              tooltip="**Cena a klouzavé průměry** | Graf ceny za poslední rok s klouzavými průměry. | • Cena NAD průměry = akcie roste (bullish) | • Cena POD průměry = akcie klesá (bearish) | Ideál pro nákup: cena nad 50 DMA i 200 DMA."
              timeRange={priceTimeRange}
              onTimeRangeChange={setPriceTimeRange}
              timeRangeOptions={TIME_RANGES_LONG}
            >
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={380}>
                  <LineChart
                    data={chartData}
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
                      domain={yDomain}
                      ticks={yTicks}
                      tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                      tickLine={{ stroke: 'var(--border-color)' }}
                      axisLine={{ stroke: 'var(--border-color)' }}
                      tickFormatter={(value: number) => value.toFixed(0)}
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
                      formatter={(value: number) => [formatPrice(value), '']}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="price"
                      name="Price"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="sma50"
                      name="50 DMA"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                    <Line
                      type="monotone"
                      dataKey="sma200"
                      name="200 DMA"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="chart-legend-info">
                <div className="legend-item">
                  <span
                    className="legend-dot"
                    style={{ background: '#3b82f6' }}
                  />
                  <Text size="sm">
                    <Text weight="semibold">Price:</Text> Daily closing price
                  </Text>
                </div>
                <div className="legend-item">
                  <span
                    className="legend-dot"
                    style={{ background: '#f59e0b' }}
                  />
                  <Text size="sm">
                    <Text weight="semibold">50 DMA:</Text> Short-term trend (avg
                    of last 50 days)
                  </Text>
                </div>
                <div className="legend-item">
                  <span
                    className="legend-dot"
                    style={{ background: '#8b5cf6' }}
                  />
                  <Text size="sm">
                    <Text weight="semibold">200 DMA:</Text> Long-term trend (avg
                    of last 200 days)
                  </Text>
                </div>
              </div>
            </ChartSection>

            {/* Section 3: Moving Average Analysis */}
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

            {/* Section 4: RSI Indicator */}
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
                    <div
                      className="rsi-zone overbought"
                      style={{ width: '30%' }}
                    >
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
                      Potential pullback ahead
                    </Text>
                    <InfoTooltip text="**Překoupená (>70)** | Akcie hodně rostla a může být drahá. | • Možná není nejlepší čas na nákup | • Cena může brzy klesnout" />
                  </div>
                  <div className="rsi-info-card">
                    <Text size="sm" weight="semibold" color="secondary">
                      30-70 Neutral
                    </Text>
                    <Text size="xs" color="secondary">
                      Normal momentum
                    </Text>
                    <InfoTooltip text="**Neutrální (30-70)** | Normální obchodní podmínky. | • Můžete nakupovat/prodávat dle jiných faktorů | • Sledujte směr RSI" />
                  </div>
                  <div className="rsi-info-card">
                    <Text size="sm" weight="semibold" color="success">
                      &lt;30 Oversold
                    </Text>
                    <Text size="xs" color="secondary">
                      Potential bounce ahead
                    </Text>
                    <InfoTooltip text="**Přeprodaná (<30)** | Akcie hodně klesala a může být levná. | • Možná dobrá příležitost k nákupu | • Pozor - někdy klesá z dobrého důvodu" />
                  </div>
                </div>
                <div className="rsi-current">
                  <MetricLabel>Current RSI</MetricLabel>
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

            {/* Section 5: MACD */}
            <ChartSection
              title="MACD (Moving Average Convergence Divergence)"
              tooltip="**MACD** | Ukazatel směru a síly momenta. | • MACD nad Signal = bullish (nákupní) | • MACD pod Signal = bearish (prodejní) | • Zelený histogram = momentum roste | • Červený histogram = momentum klesá"
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
                          tickFormatter={(value: number) => value.toFixed(2)}
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
                      sentiment={
                        (data.macd ?? 0) >= 0 ? 'positive' : 'negative'
                      }
                    />
                    <IndicatorValue
                      label="Signal"
                      value={
                        data.macdSignal !== null
                          ? data.macdSignal.toFixed(3)
                          : null
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
                      'Bullish momentum — MACD above signal line'}
                    {data.macdTrend === 'bearish' &&
                      'Bearish momentum — MACD below signal line'}
                    {data.macdTrend === 'neutral' &&
                      'Neutral — Momentum transitioning'}
                    {data.macdTrend === null && 'Insufficient data'}
                  </IndicatorSignal>
                </>
              ) : (
                <ChartNoData message="Insufficient data to calculate MACD" />
              )}
            </ChartSection>

            {/* Section 6: Bollinger Bands */}
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
                          tickFormatter={(value: number) => value.toFixed(0)}
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
                      <MetricLabel>Position within bands</MetricLabel>
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
                        Lower Band
                      </Text>
                      <Text size="xs" color="muted">
                        Middle
                      </Text>
                      <Text size="xs" color="muted">
                        Upper Band
                      </Text>
                    </div>
                  </div>
                  <IndicatorSignal type={data.bollingerSignal}>
                    {data.bollingerSignal === 'overbought' &&
                      'Price above upper band — potentially overbought'}
                    {data.bollingerSignal === 'oversold' &&
                      'Price below lower band — potentially oversold'}
                    {data.bollingerSignal === 'neutral' &&
                      'Price within bands — normal trading range'}
                    {data.bollingerSignal === null && 'Insufficient data'}
                  </IndicatorSignal>
                </>
              ) : (
                <ChartNoData message="Insufficient data to calculate Bollinger Bands" />
              )}
            </ChartSection>

            {/* Section 7: Stochastic Oscillator */}
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
                        {/* Overbought zone */}
                        <ReferenceLine
                          y={80}
                          stroke="var(--color-negative)"
                          strokeDasharray="3 3"
                          strokeOpacity={0.5}
                        />
                        {/* Oversold zone */}
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
                        data.stochasticK !== null
                          ? data.stochasticK.toFixed(1)
                          : null
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
                        data.stochasticD !== null
                          ? data.stochasticD.toFixed(1)
                          : null
                      }
                    />
                  </IndicatorValuesRow>
                  <ZonesRow>
                    <ZoneBadge type="overbought">&gt;80 Overbought</ZoneBadge>
                    <ZoneBadge type="neutral">20-80 Neutral</ZoneBadge>
                    <ZoneBadge type="oversold">&lt;20 Oversold</ZoneBadge>
                  </ZonesRow>
                  <IndicatorSignal type={data.stochasticSignal}>
                    {data.stochasticSignal === 'overbought' &&
                      'Stochastic above 80 — potentially overbought'}
                    {data.stochasticSignal === 'oversold' &&
                      'Stochastic below 20 — potentially oversold'}
                    {data.stochasticSignal === 'neutral' &&
                      'Stochastic in neutral zone — normal trading'}
                    {data.stochasticSignal === null && 'Insufficient data'}
                  </IndicatorSignal>
                </>
              ) : (
                <ChartNoData message="Insufficient data to calculate Stochastic Oscillator" />
              )}
            </ChartSection>

            {/* Section 8: Volume Analysis */}
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
                      label="Current Volume"
                      value={
                        data.currentVolume !== null
                          ? formatVolume(data.currentVolume)
                          : null
                      }
                    />
                    <IndicatorValue
                      label="20-Day Average"
                      value={
                        data.avgVolume20 !== null
                          ? formatVolume(data.avgVolume20)
                          : null
                      }
                    />
                    <IndicatorValue
                      label="vs Average"
                      value={
                        data.volumeChange !== null
                          ? `${data.volumeChange > 0 ? '+' : ''}${
                              data.volumeChange
                            }%`
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
                      'Volume above average — strong interest'}
                    {data.volumeSignal === 'low' &&
                      'Volume below average — weak interest'}
                    {data.volumeSignal === 'normal' &&
                      'Volume near average — normal activity'}
                    {data.volumeSignal === null && 'Insufficient data'}
                  </IndicatorSignal>
                </>
              ) : (
                <ChartNoData message="Insufficient data to display Volume Analysis" />
              )}
            </ChartSection>

            {/* Section 9: ATR (Average True Range) */}
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
                          tickFormatter={(value: number) =>
                            `$${value.toFixed(1)}`
                          }
                          width={55}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                          tickLine={{ stroke: 'var(--border-color)' }}
                          axisLine={{ stroke: 'var(--border-color)' }}
                          tickFormatter={(value: number) =>
                            `${value.toFixed(1)}%`
                          }
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
                          formatter={(value: number, name: string) => {
                            if (name === 'ATR')
                              return [`$${value.toFixed(2)}`, name];
                            if (name === 'ATR %')
                              return [`${value.toFixed(2)}%`, name];
                            return [value, name];
                          }}
                        />
                        <Legend />
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
                    <IndicatorValue
                      label="Stop-Loss Tip"
                      value={`$${(
                        (data.currentPrice ?? 0) -
                        (data.atr14 ?? 0) * 2
                      ).toFixed(2)}`}
                    />
                  </IndicatorValuesRow>
                  <IndicatorSignal type={data.atrSignal}>
                    {data.atrSignal === 'high' &&
                      'High volatility — consider wider stop-losses'}
                    {data.atrSignal === 'low' &&
                      'Low volatility — stable but limited upside'}
                    {data.atrSignal === 'normal' &&
                      'Normal volatility — typical price movement'}
                    {data.atrSignal === null && 'Insufficient data'}
                  </IndicatorSignal>
                </>
              ) : (
                <ChartNoData message="Insufficient data to display ATR Analysis" />
              )}
            </ChartSection>

            {/* Section 10: OBV - On-Balance Volume */}
            <ChartSection
              title="On-Balance Volume (OBV)"
              tooltip="**OBV** | Kumulativní tok objemu. | • Rostoucí OBV = akumulace (nákup) | • Klesající OBV = distribuce (prodej) | Divergence s cenou předpovídá obrat."
              timeRange={obvTimeRange}
              onTimeRangeChange={setObvTimeRange}
            >
              {obvData.length > 0 ? (
                <>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height={300}>
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
                          formatter={(value: number) => [
                            formatVolume(value),
                            value === obvData[0]?.obvSma ? 'SMA(20)' : 'OBV',
                          ]}
                          contentStyle={{
                            backgroundColor: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            color: 'var(--text-primary)',
                          }}
                        />
                        <Legend />
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
                      label="Current OBV"
                      value={data.obv !== null ? formatVolume(data.obv) : null}
                    />
                    <IndicatorValue
                      label="OBV Trend"
                      value={
                        data.obvTrend === 'bullish'
                          ? 'Accumulation'
                          : data.obvTrend === 'bearish'
                          ? 'Distribution'
                          : data.obvTrend === 'neutral'
                          ? 'Neutral'
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
                          : 'None'
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
                      'Accumulation — volume flowing into stock'}
                    {data.obvTrend === 'bearish' &&
                      'Distribution — volume leaving stock'}
                    {data.obvTrend === 'neutral' &&
                      'Neutral — no clear volume trend'}
                    {!data.obvTrend && 'Insufficient data'}
                  </IndicatorSignal>
                  {data.obvDivergence && (
                    <IndicatorSignal
                      type={data.obvDivergence}
                      variant="divergence"
                    >
                      {data.obvDivergence === 'bullish' &&
                        'Bullish divergence: Price down, OBV up — possible reversal!'}
                      {data.obvDivergence === 'bearish' &&
                        'Bearish divergence: Price up, OBV down — caution!'}
                    </IndicatorSignal>
                  )}
                </>
              ) : (
                <ChartNoData message="Insufficient data to display OBV Analysis" />
              )}
            </ChartSection>

            {/* Section 11: ADX - Average Directional Index */}
            <ChartSection
              title="ADX (Average Directional Index)"
              tooltip="**ADX** | Měří SÍLU trendu (ne směr). | • Pod 20 = slabý trend | • 20-25 = vznikající | • Nad 25 = silný trend | +DI > -DI = bullish, -DI > +DI = bearish"
              timeRange={adxTimeRange}
              onTimeRangeChange={setAdxTimeRange}
            >
              {adxData.length > 0 && data.adx !== null ? (
                <>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height={300}>
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
                        <Legend />
                        <ReferenceLine
                          y={20}
                          stroke="var(--text-muted)"
                          strokeDasharray="5 5"
                          label={{
                            value: '20',
                            position: 'right',
                            fontSize: 10,
                          }}
                        />
                        <ReferenceLine
                          y={40}
                          stroke="var(--text-muted)"
                          strokeDasharray="5 5"
                          label={{
                            value: '40',
                            position: 'right',
                            fontSize: 10,
                          }}
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
                      label="Strength"
                      value={
                        data.adxSignal === 'strong'
                          ? 'Very Strong'
                          : data.adxSignal === 'moderate'
                          ? 'Strong'
                          : data.adxSignal === 'weak'
                          ? 'Weak'
                          : data.adxSignal === 'no-trend'
                          ? 'No Trend'
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
                      'Very strong trend — follow the momentum'}
                    {data.adxSignal === 'moderate' &&
                      'Strong trend — good for trend trades'}
                    {data.adxSignal === 'weak' && 'Weak trend — be cautious'}
                    {data.adxSignal === 'no-trend' &&
                      'No trend — avoid trend strategies'}
                    {!data.adxSignal && 'Insufficient data'}
                  </IndicatorSignal>
                  {data.adxTrend && data.adxSignal !== 'no-trend' && (
                    <IndicatorSignal type={data.adxTrend} variant="direction">
                      {data.adxTrend === 'bullish' &&
                        '+DI > -DI → Bulls in control'}
                      {data.adxTrend === 'bearish' &&
                        '-DI > +DI → Bears in control'}
                      {data.adxTrend === 'neutral' && '+DI ≈ -DI → Undecided'}
                    </IndicatorSignal>
                  )}
                </>
              ) : (
                <ChartNoData message="Insufficient data to display ADX Analysis" />
              )}
            </ChartSection>

            {/* Section 12: Fibonacci Retracement */}
            <ChartSection
              title="Fibonacci Retracement"
              tooltip="**Fibonacci** | Klíčové úrovně podpory/odporu. | • 38.2% a 61.8% = nejdůležitější | • Proražení 61.8% = pokračování trendu | Fungují jako body obratu při korekcích."
            >
              {data.fibonacciLevels ? (
                <>
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
                      {/* Current price indicator */}
                      <div
                        className="fib-current-price"
                        style={{
                          top: `${
                            ((data.fibonacciLevels.high -
                              (data.currentPrice || 0)) /
                              (data.fibonacciLevels.high -
                                data.fibonacciLevels.low)) *
                            100
                          }%`,
                        }}
                      >
                        <Text size="sm" weight="semibold">
                          Current: ${data.currentPrice?.toFixed(2)}
                        </Text>
                      </div>
                    </div>
                  </div>
                  <IndicatorValuesRow>
                    <IndicatorValue
                      label="Period High"
                      value={`$${data.fibonacciLevels.high.toFixed(2)}`}
                    />
                    <IndicatorValue
                      label="Period Low"
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
                      label="Near Level"
                      value={
                        data.fibonacciLevels.currentLevel || 'Between levels'
                      }
                    />
                  </IndicatorValuesRow>
                  <IndicatorSignal
                    type={
                      data.fibonacciLevels.trend === 'uptrend'
                        ? 'bullish'
                        : 'bearish'
                    }
                  >
                    {data.fibonacciLevels.trend === 'uptrend'
                      ? 'Uptrend — look for buy opportunities at 38.2% or 61.8% levels'
                      : 'Downtrend — levels may act as resistance during rallies'}
                  </IndicatorSignal>
                  {data.fibonacciLevels.currentLevel && (
                    <IndicatorSignal type="neutral" variant="highlight">
                      Price near{' '}
                      <Text weight="semibold">
                        {data.fibonacciLevels.currentLevel}
                      </Text>{' '}
                      — watch for reaction!
                    </IndicatorSignal>
                  )}
                </>
              ) : (
                <ChartNoData message="Insufficient data to calculate Fibonacci levels" />
              )}
            </ChartSection>

            {/* Section 13: What These Indicators Tell You */}
            <ChartSection
              title="How to use this analysis"
              tooltip="**Důležité** | Technická analýza není 100% spolehlivá. | • Používejte jako JEDEN z nástrojů | • Kombinujte více indikátorů | • Nikdy neinvestujte jen na základě jednoho indikátoru"
            >
              <div className="usage-guide">
                <div className="usage-item">
                  <Text weight="semibold" color="success">
                    Bullish signals:
                  </Text>
                  <Text size="sm" color="secondary">
                    Golden Cross, cena nad klouzavými průměry, RSI stoupá z
                    oversold zóny, MACD kříží signal linii nahoru, cena se
                    odráží od dolního Bollinger pásma, Stochastic %K kříží %D
                    zespoda v oversold zóně, růst ceny s vysokým objemem
                  </Text>
                </div>
                <div className="usage-item">
                  <Text weight="semibold" color="danger">
                    Bearish signals:
                  </Text>
                  <Text size="sm" color="secondary">
                    Death Cross, cena pod klouzavými průměry, RSI klesá z
                    overbought zóny, MACD kříží signal linii dolů, cena je
                    odmítnuta u horního Bollinger pásma, Stochastic %K kříží %D
                    shora v overbought zóně, pokles ceny s vysokým objemem
                  </Text>
                </div>
                <div className="usage-item">
                  <Text weight="semibold">Volume tip:</Text>
                  <Text size="sm" color="secondary">
                    Objem potvrzuje cenové pohyby. Růst s vysokým objemem je
                    silnější než růst s nízkým objemem. Pokles s nízkým objemem
                    může signalizovat blížící se obrat.
                  </Text>
                </div>
              </div>
            </ChartSection>
          </>
        )}
      </div>
    </div>
  );
}
