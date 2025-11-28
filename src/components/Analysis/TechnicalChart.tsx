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

// Time range options for charts
type TimeRange = '1W' | '2W' | '1M' | '3M' | '6M' | '1Y';

// Standard ranges (for price charts, Bollinger - need longer history)
const TIME_RANGES_LONG: { value: TimeRange; label: string; days: number }[] = [
  { value: '1M', label: '1M', days: 21 },
  { value: '3M', label: '3M', days: 63 },
  { value: '6M', label: '6M', days: 126 },
  { value: '1Y', label: '1Y', days: 252 },
];

// Extended ranges with short intervals (for momentum indicators)
const TIME_RANGES_SHORT: { value: TimeRange; label: string; days: number }[] = [
  { value: '1W', label: '1W', days: 5 },
  { value: '2W', label: '2W', days: 10 },
  { value: '1M', label: '1M', days: 21 },
  { value: '3M', label: '3M', days: 63 },
  { value: '6M', label: '6M', days: 126 },
  { value: '1Y', label: '1Y', days: 252 },
];

// Helper to get days from any range
const getDaysForRange = (range: TimeRange): number => {
  const found = TIME_RANGES_SHORT.find((r) => r.value === range);
  return found?.days || 21;
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

// Mini component for time range selector in each chart section
function TimeRangeSelector({
  value,
  onChange,
  ranges = TIME_RANGES_SHORT,
}: {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  ranges?: { value: TimeRange; label: string; days: number }[];
}) {
  return (
    <div className="time-range-selector-mini">
      {ranges.map((range) => (
        <button
          key={range.value}
          className={`time-range-btn-mini ${
            value === range.value ? 'active' : ''
          }`}
          onClick={() => onChange(range.value)}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
}

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

  const getRSIColor = (rsi: number | null): string => {
    if (rsi === null) return 'var(--text-muted)';
    if (rsi >= 70) return 'var(--color-negative)';
    if (rsi <= 30) return 'var(--color-positive)';
    return 'var(--text-secondary)';
  };

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
          <h3>
            {data.ticker} - {data.stockName}
          </h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        {chartData.length === 0 ? (
          <div className="chart-error">
            <p>No historical data available for {data.ticker}</p>
            {data.error && <p className="error-detail">{data.error}</p>}
          </div>
        ) : (
          <>
            {/* Section 1: Trend Signal Overview */}
            <div className="tech-section">
              <div className="section-header">
                <h4>Trend Signal</h4>
                <InfoTooltip text="CO TO JE: Souhrnné hodnocení trendu akcie na základě klouzavých průměrů (Moving Averages). JAK ČÍST: 🟢 Strong Bullish = silný růstový trend, ideální pro držení/nákup. 🟢 Bullish = růstový trend. 🔴 Bearish = klesající trend, opatrnost. 🔴 Strong Bearish = silný pokles, zvážit prodej. ⚪ Mixed = nejasný signál, vyčkat." />
              </div>
              <div className="tech-overview">
                <div className={`trend-signal ${trendSignal.type}`}>
                  <span className="signal-value">{trendSignal.signal}</span>
                  <span className="signal-desc">{trendSignal.description}</span>
                </div>
              </div>
            </div>

            {/* Section 2: Price Chart with Moving Averages */}
            <div className="tech-section">
              <div className="section-header">
                <h4>Price & Moving Averages</h4>
                <TimeRangeSelector
                  value={priceTimeRange}
                  onChange={setPriceTimeRange}
                  ranges={TIME_RANGES_LONG}
                />
                <InfoTooltip text="CO TO JE: Graf ceny za poslední rok s klouzavými průměry (Moving Averages). Klouzavý průměr vyhlazuje denní výkyvy a ukazuje skutečný trend. JAK ČÍST: Když je CENA NAD průměry = akcie roste (bullish). Když je CENA POD průměry = akcie klesá (bearish). IDEÁLNÍ STAV PRO NÁKUP: Cena nad oběma čárami (50 DMA i 200 DMA)." />
              </div>
              <div className="chart-wrapper">
                <ResponsiveContainer width="100%" height={300}>
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
                  ></span>
                  <strong>Price:</strong> Daily closing price
                </div>
                <div className="legend-item">
                  <span
                    className="legend-dot"
                    style={{ background: '#f59e0b' }}
                  ></span>
                  <strong>50 DMA:</strong> Short-term trend (avg of last 50
                  days)
                </div>
                <div className="legend-item">
                  <span
                    className="legend-dot"
                    style={{ background: '#8b5cf6' }}
                  ></span>
                  <strong>200 DMA:</strong> Long-term trend (avg of last 200
                  days)
                </div>
              </div>
            </div>

            {/* Section 3: Moving Average Analysis */}
            <div className="tech-section">
              <div className="section-header">
                <h4>Moving Average Analysis</h4>
                <InfoTooltip text="CO TO JE: Porovnání aktuální ceny s klouzavými průměry. JAK ČÍST: Procenta ukazují, o kolik je cena NAD (↑ zelená = dobře) nebo POD (↓ červená = špatně) průměrem. GOLDEN CROSS: 50 DMA je NAD 200 DMA = silný nákupní signál, akcie pravděpodobně poroste. DEATH CROSS: 50 DMA je POD 200 DMA = varovný signál, akcie může klesat." />
              </div>
              <div className="ma-cards">
                <div className="ma-card">
                  <div className="ma-card-header">
                    <span className="ma-label">50 DMA</span>
                    <InfoTooltip text="CO TO JE: 50 Day Moving Average = průměrná cena za posledních 50 obchodních dnů. Ukazuje krátkodobý až střednědobý trend. JAK ČÍST: Cena NAD 50 DMA = krátkodobě roste (dobré). Cena POD 50 DMA = krátkodobě klesá (opatrnost). IDEÁLNÍ: Být co nejvíce NAD touto hodnotou." />
                  </div>
                  <span className="ma-value">
                    {data.sma50 !== null ? data.sma50.toFixed(2) : '—'}
                  </span>
                  {data.priceVsSma50 !== null && (
                    <span
                      className={`ma-vs ${
                        data.priceVsSma50 >= 0 ? 'above' : 'below'
                      }`}
                    >
                      {data.priceVsSma50 >= 0 ? '↑' : '↓'}{' '}
                      {Math.abs(data.priceVsSma50).toFixed(1)}%
                      {data.priceVsSma50 >= 0 ? ' above' : ' below'}
                    </span>
                  )}
                </div>
                <div className="ma-card">
                  <div className="ma-card-header">
                    <span className="ma-label">200 DMA</span>
                    <InfoTooltip text="CO TO JE: 200 Day Moving Average = průměrná cena za posledních 200 obchodních dnů (~1 rok). Nejdůležitější dlouhodobý ukazatel, který sledují velcí investoři. JAK ČÍST: Cena NAD 200 DMA = dlouhodobý růstový trend (velmi dobré). Cena POD 200 DMA = dlouhodobý klesající trend (varovné). IDEÁLNÍ: Být NAD touto hodnotou." />
                  </div>
                  <span className="ma-value">
                    {data.sma200 !== null ? data.sma200.toFixed(2) : '—'}
                  </span>
                  {data.priceVsSma200 !== null && (
                    <span
                      className={`ma-vs ${
                        data.priceVsSma200 >= 0 ? 'above' : 'below'
                      }`}
                    >
                      {data.priceVsSma200 >= 0 ? '↑' : '↓'}{' '}
                      {Math.abs(data.priceVsSma200).toFixed(1)}%
                      {data.priceVsSma200 >= 0 ? ' above' : ' below'}
                    </span>
                  )}
                </div>
                <div className="ma-card">
                  <div className="ma-card-header">
                    <span className="ma-label">Cross Signal</span>
                    <InfoTooltip text="CO TO JE: Signál křížení klouzavých průměrů - jeden z nejspolehlivějších indikátorů. GOLDEN CROSS (Zlatý kříž): 50 DMA překříží 200 DMA směrem NAHORU = silný nákupní signál, očekává se růst. DEATH CROSS (Kříž smrti): 50 DMA překříží 200 DMA směrem DOLŮ = varovný signál, očekává se pokles. IDEÁLNÍ: Golden Cross." />
                  </div>
                  <span className="ma-value">
                    {data.currentPrice !== null
                      ? data.currentPrice.toFixed(2)
                      : '—'}
                  </span>
                  {data.sma50 !== null && data.sma200 !== null && (
                    <span
                      className={`ma-trend ${
                        data.sma50 > data.sma200 ? 'bullish' : 'bearish'
                      }`}
                    >
                      {data.sma50 > data.sma200
                        ? 'Golden Cross'
                        : 'Death Cross'}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Section 4: RSI Indicator */}
            <div className="tech-section">
              <div className="section-header">
                <h4>RSI (Relative Strength Index)</h4>
                <InfoTooltip text="CO TO JE: Relative Strength Index = Index relativní síly. Měří rychlost a změnu cenových pohybů na stupnici 0-100. Pomáhá určit, zda je akcie 'překoupená' nebo 'přeprodaná'. JAK ČÍST: RSI > 70 = Overbought (překoupená) - cena možná příliš vyrostla, může přijít pokles. RSI < 30 = Oversold (přeprodaná) - cena možná příliš klesla, může přijít růst. RSI 30-70 = Neutral (normální stav). IDEÁLNÍ PRO NÁKUP: RSI kolem 30-50 (levnější)." />
              </div>
              <div className="rsi-display">
                <div className="rsi-gauge">
                  <div className="rsi-bar">
                    <div className="rsi-zone oversold" style={{ width: '30%' }}>
                      <span className="zone-label">Oversold</span>
                    </div>
                    <div className="rsi-zone neutral" style={{ width: '40%' }}>
                      <span className="zone-label">Neutral</span>
                    </div>
                    <div
                      className="rsi-zone overbought"
                      style={{ width: '30%' }}
                    >
                      <span className="zone-label">Overbought</span>
                    </div>
                    {data.rsi14 !== null && (
                      <div
                        className="rsi-indicator"
                        style={{ left: `${data.rsi14}%` }}
                      >
                        <span className="rsi-value">
                          {data.rsi14.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="rsi-scale">
                    <span>0</span>
                    <span>30</span>
                    <span>70</span>
                    <span>100</span>
                  </div>
                </div>
                <div className="rsi-info-cards">
                  <div className="rsi-info-card">
                    <span className="rsi-zone-label overbought">
                      &gt;70 Overbought
                    </span>
                    <span className="rsi-zone-meaning">
                      Potential pullback ahead
                    </span>
                    <InfoTooltip text="OVERBOUGHT (překoupená): RSI nad 70 znamená, že akcie v poslední době hodně rostla a může být 'drahá'. Mnoho investorů už nakoupilo a tlak na růst slábne. CO TO ZNAMENÁ: Možná není nejlepší čas na nákup - cena může brzy klesnout. Pokud akcie držíte, zvažte částečný prodej." />
                  </div>
                  <div className="rsi-info-card">
                    <span className="rsi-zone-label neutral">
                      30-70 Neutral
                    </span>
                    <span className="rsi-zone-meaning">Normal momentum</span>
                    <InfoTooltip text="NEUTRAL (neutrální zóna): RSI mezi 30-70 znamená normální obchodní podmínky. Akcie není ani překoupená, ani přeprodaná. CO TO ZNAMENÁ: Můžete nakupovat nebo prodávat podle jiných faktorů. Sledujte směr - roste RSI k 70 nebo klesá k 30?" />
                  </div>
                  <div className="rsi-info-card">
                    <span className="rsi-zone-label oversold">
                      &lt;30 Oversold
                    </span>
                    <span className="rsi-zone-meaning">
                      Potential bounce ahead
                    </span>
                    <InfoTooltip text="OVERSOLD (přeprodaná): RSI pod 30 znamená, že akcie v poslední době hodně klesala a může být 'levná'. Mnoho investorů už prodalo a tlak na pokles slábne. CO TO ZNAMENÁ: Může být dobrá příležitost k nákupu - cena může brzy vzrůst. Ale pozor - někdy akcie klesá z dobrého důvodu!" />
                  </div>
                </div>
                <div className="rsi-current">
                  <span className="rsi-current-label">Current RSI:</span>
                  <span
                    className="rsi-current-value"
                    style={{ color: getRSIColor(data.rsi14) }}
                  >
                    {data.rsi14 !== null ? data.rsi14.toFixed(1) : 'N/A'} —{' '}
                    {getRSILabel(data.rsi14)}
                  </span>
                </div>
              </div>
            </div>

            {/* Section 5: MACD */}
            <div className="tech-section">
              <div className="section-header">
                <h4>MACD (Moving Average Convergence Divergence)</h4>
                <TimeRangeSelector
                  value={macdTimeRange}
                  onChange={setMacdTimeRange}
                />
                <InfoTooltip text="CO TO JE: Moving Average Convergence Divergence = ukazatel směru trendu a síly momentum (hybnosti). Skládá se z: MACD linie (modrá), Signal linie (oranžová) a Histogramu (sloupce). JAK ČÍST: Modrá PŘEKŘÍŽÍ oranžovou NAHORU = nákupní signál (bullish). Modrá PŘEKŘÍŽÍ oranžovou DOLŮ = prodejní signál (bearish). HISTOGRAM zelený = momentum roste. HISTOGRAM červený = momentum klesá. IDEÁLNÍ: MACD nad Signal linií + zelený histogram." />
              </div>
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
                  <div className="indicator-summary">
                    <div className="indicator-values-row">
                      <div className="indicator-value">
                        <span className="indicator-label">MACD:</span>
                        <span
                          className={`indicator-num ${
                            (data.macd ?? 0) >= 0 ? 'positive' : 'negative'
                          }`}
                        >
                          {data.macd !== null ? data.macd.toFixed(3) : '—'}
                        </span>
                      </div>
                      <div className="indicator-value">
                        <span className="indicator-label">Signal:</span>
                        <span className="indicator-num">
                          {data.macdSignal !== null
                            ? data.macdSignal.toFixed(3)
                            : '—'}
                        </span>
                      </div>
                      <div className="indicator-value">
                        <span className="indicator-label">Histogram:</span>
                        <span
                          className={`indicator-num ${
                            (data.macdHistogram ?? 0) >= 0
                              ? 'positive'
                              : 'negative'
                          }`}
                        >
                          {data.macdHistogram !== null
                            ? data.macdHistogram.toFixed(3)
                            : '—'}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`indicator-signal ${
                        data.macdTrend ?? 'neutral'
                      }`}
                    >
                      {data.macdTrend === 'bullish' &&
                        'Bullish momentum — MACD above signal line'}
                      {data.macdTrend === 'bearish' &&
                        'Bearish momentum — MACD below signal line'}
                      {data.macdTrend === 'neutral' &&
                        'Neutral — Momentum transitioning'}
                      {data.macdTrend === null && 'Insufficient data'}
                    </div>
                  </div>
                </>
              ) : (
                <div className="no-data-message">
                  Insufficient data to calculate MACD
                </div>
              )}
            </div>

            {/* Section 6: Bollinger Bands */}
            <div className="tech-section">
              <div className="section-header">
                <h4>Bollinger Bands</h4>
                <TimeRangeSelector
                  value={bollingerTimeRange}
                  onChange={setBollingerTimeRange}
                  ranges={TIME_RANGES_LONG}
                />
                <InfoTooltip text="CO TO JE: Bollingerova pásma = ukazatel volatility (kolísavosti) ceny. Tři linie: Upper Band (horní), Middle (střední = 20denní průměr), Lower Band (dolní). JAK ČÍST: Cena u HORNÍHO pásma = možná překoupená (overbought), může klesnout. Cena u DOLNÍHO pásma = možná přeprodaná (oversold), může vzrůst. Cena u STŘEDU = normální stav. ŠIROKÁ pásma = vysoká volatilita. ÚZKÁ pásma = nízká volatilita, možná přijde velký pohyb. IDEÁLNÍ PRO NÁKUP: Cena blízko dolního pásma (20-30%)." />
              </div>
              {bollingerData.length > 0 && data.bollingerUpper !== null ? (
                <>
                  <div className="chart-wrapper">
                    <ResponsiveContainer width="100%" height={250}>
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
                  <div className="indicator-summary">
                    <div className="indicator-values-row">
                      <div className="indicator-value">
                        <span className="indicator-label">Upper Band:</span>
                        <span className="indicator-num">
                          {data.bollingerUpper?.toFixed(2) ?? '—'}
                        </span>
                      </div>
                      <div className="indicator-value">
                        <span className="indicator-label">
                          Middle (20 SMA):
                        </span>
                        <span className="indicator-num">
                          {data.bollingerMiddle?.toFixed(2) ?? '—'}
                        </span>
                      </div>
                      <div className="indicator-value">
                        <span className="indicator-label">Lower Band:</span>
                        <span className="indicator-num">
                          {data.bollingerLower?.toFixed(2) ?? '—'}
                        </span>
                      </div>
                    </div>
                    <div className="indicator-position-block">
                      <div className="position-header">
                        <span className="position-label">
                          Position within bands:
                        </span>
                        <span className="position-value">
                          {data.bollingerPosition ?? 0}%
                        </span>
                      </div>
                      <div className="position-bar">
                        <div
                          className="position-indicator"
                          style={{ left: `${data.bollingerPosition ?? 50}%` }}
                        />
                      </div>
                      <div className="position-zones">
                        <span className="zone-label zone-lower">
                          Lower Band
                        </span>
                        <span className="zone-label zone-middle">Middle</span>
                        <span className="zone-label zone-upper">
                          Upper Band
                        </span>
                      </div>
                    </div>
                    <div
                      className={`indicator-signal ${
                        data.bollingerSignal ?? 'neutral'
                      }`}
                    >
                      {data.bollingerSignal === 'overbought' &&
                        'Price above upper band — potentially overbought'}
                      {data.bollingerSignal === 'oversold' &&
                        'Price below lower band — potentially oversold'}
                      {data.bollingerSignal === 'neutral' &&
                        '✅ Price within bands — normal trading range'}
                      {data.bollingerSignal === null && 'Insufficient data'}
                    </div>
                  </div>
                </>
              ) : (
                <div className="no-data-message">
                  Insufficient data to calculate Bollinger Bands
                </div>
              )}
            </div>

            {/* Section 7: Stochastic Oscillator */}
            <div className="tech-section">
              <div className="section-header">
                <h4>Stochastic Oscillator</h4>
                <TimeRangeSelector
                  value={stochasticTimeRange}
                  onChange={setStochasticTimeRange}
                />
                <InfoTooltip text="CO TO JE: Stochastic Oscillator = momentum indikátor porovnávající zavírací cenu s cenovým rozsahem za určité období (14 dní). Má dvě linie: %K (rychlá, modrá) a %D (pomalá, oranžová = průměr %K). JAK ČÍST: Hodnoty 0-100. NAD 80 = Overbought (překoupená), může přijít pokles. POD 20 = Oversold (přeprodaná), může přijít růst. SIGNÁLY: %K kříží %D zespoda = nákupní signál. %K kříží %D shora = prodejní signál. IDEÁLNÍ PRO NÁKUP: %K a %D pod 20, %K kříží %D nahoru." />
              </div>
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
                  <div className="indicator-summary">
                    <div className="indicator-values-row">
                      <div className="indicator-value">
                        <span className="indicator-label">%K (Fast):</span>
                        <span
                          className={`indicator-num ${
                            (data.stochasticK ?? 50) > 80
                              ? 'overbought'
                              : (data.stochasticK ?? 50) < 20
                              ? 'oversold'
                              : ''
                          }`}
                        >
                          {data.stochasticK !== null
                            ? data.stochasticK.toFixed(1)
                            : '—'}
                        </span>
                      </div>
                      <div className="indicator-value">
                        <span className="indicator-label">%D (Slow):</span>
                        <span className="indicator-num">
                          {data.stochasticD !== null
                            ? data.stochasticD.toFixed(1)
                            : '—'}
                        </span>
                      </div>
                    </div>
                    <div className="indicator-zones-row">
                      <span className="zone-badge overbought">
                        &gt;80 Overbought
                      </span>
                      <span className="zone-badge neutral">20-80 Neutral</span>
                      <span className="zone-badge oversold">
                        &lt;20 Oversold
                      </span>
                    </div>
                    <div
                      className={`indicator-signal ${
                        data.stochasticSignal ?? 'neutral'
                      }`}
                    >
                      {data.stochasticSignal === 'overbought' &&
                        'Stochastic above 80 — potentially overbought'}
                      {data.stochasticSignal === 'oversold' &&
                        'Stochastic below 20 — potentially oversold'}
                      {data.stochasticSignal === 'neutral' &&
                        '✅ Stochastic in neutral zone — normal trading'}
                      {data.stochasticSignal === null && 'Insufficient data'}
                    </div>
                  </div>
                </>
              ) : (
                <div className="no-data-message">
                  Insufficient data to calculate Stochastic Oscillator
                </div>
              )}
            </div>

            {/* Section 8: Volume Analysis */}
            <div className="tech-section">
              <div className="section-header">
                <h4>Volume Analysis</h4>
                <TimeRangeSelector
                  value={volumeTimeRange}
                  onChange={setVolumeTimeRange}
                />
                <InfoTooltip text="CO TO JE: Volume (objem) = počet akcií zobchodovaných za den. Je klíčový pro potvrzení cenových pohybů. JAK ČÍST: VYSOKÝ objem při růstu ceny = silný nákupní zájem, růst je pravděpodobně udržitelný. VYSOKÝ objem při poklesu = silný prodejní tlak, pokles může pokračovat. NÍZKÝ objem = slabý pohyb, může se rychle obrátit. IDEÁLNÍ: Růst ceny s rostoucím objemem. Oranžová čára = 20denní průměr objemu." />
              </div>
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
                  <div className="indicator-summary">
                    <div className="indicator-values-row">
                      <div className="indicator-value">
                        <span className="indicator-label">Current Volume:</span>
                        <span className="indicator-num">
                          {data.currentVolume !== null
                            ? formatVolume(data.currentVolume)
                            : '—'}
                        </span>
                      </div>
                      <div className="indicator-value">
                        <span className="indicator-label">20-Day Average:</span>
                        <span className="indicator-num">
                          {data.avgVolume20 !== null
                            ? formatVolume(data.avgVolume20)
                            : '—'}
                        </span>
                      </div>
                      <div className="indicator-value">
                        <span className="indicator-label">vs Average:</span>
                        <span
                          className={`indicator-num ${
                            (data.volumeChange ?? 0) > 0
                              ? 'positive'
                              : (data.volumeChange ?? 0) < 0
                              ? 'negative'
                              : ''
                          }`}
                        >
                          {data.volumeChange !== null
                            ? `${data.volumeChange > 0 ? '+' : ''}${
                                data.volumeChange
                              }%`
                            : '—'}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`indicator-signal ${
                        data.volumeSignal ?? 'normal'
                      }`}
                    >
                      {data.volumeSignal === 'high' &&
                        'Volume above average — strong interest'}
                      {data.volumeSignal === 'low' &&
                        'Volume below average — weak interest'}
                      {data.volumeSignal === 'normal' &&
                        '✅ Volume near average — normal activity'}
                      {data.volumeSignal === null && 'Insufficient data'}
                    </div>
                  </div>
                </>
              ) : (
                <div className="no-data-message">
                  Insufficient data to display Volume Analysis
                </div>
              )}
            </div>

            {/* Section 9: ATR (Average True Range) */}
            <div className="tech-section">
              <div className="section-header">
                <h4>ATR (Average True Range)</h4>
                <TimeRangeSelector
                  value={atrTimeRange}
                  onChange={setAtrTimeRange}
                />
                <InfoTooltip text="CO TO JE: Average True Range (ATR) = měří volatilitu (kolísavost) akcie za posledních 14 dní. Ukazuje průměrný denní rozsah pohybu ceny. JAK ČÍST: VYSOKÝ ATR = vysoká volatilita, větší cenové výkyvy, vyšší riziko i potenciální zisk. NÍZKÝ ATR = nízká volatilita, stabilnější cena, menší riziko. ATR% = ATR jako procento ceny. Pod 2% = nízká volatilita. 2-5% = normální. Nad 5% = vysoká volatilita. VYUŽITÍ: Nastavení stop-loss (např. 2× ATR pod vstupní cenou)." />
              </div>
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
                  <div className="indicator-summary">
                    <div className="indicator-values-row">
                      <div className="indicator-value">
                        <span className="indicator-label">ATR (14):</span>
                        <span className="indicator-num">
                          ${data.atr14?.toFixed(2)}
                        </span>
                      </div>
                      <div className="indicator-value">
                        <span className="indicator-label">ATR %:</span>
                        <span className="indicator-num">
                          {data.atrPercent?.toFixed(2)}%
                        </span>
                      </div>
                      <div className="indicator-value">
                        <span className="indicator-label">Volatilita:</span>
                        <span
                          className={`indicator-num ${
                            data.atrSignal === 'high'
                              ? 'warning'
                              : data.atrSignal === 'low'
                              ? 'muted'
                              : ''
                          }`}
                        >
                          {data.atrSignal === 'high' && 'Vysoká'}
                          {data.atrSignal === 'low' && 'Nízká'}
                          {data.atrSignal === 'normal' && 'Normální'}
                        </span>
                      </div>
                      <div className="indicator-value">
                        <span className="indicator-label">Stop-Loss Tip:</span>
                        <span className="indicator-num">
                          $
                          {(
                            (data.currentPrice ?? 0) -
                            (data.atr14 ?? 0) * 2
                          ).toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`indicator-signal ${
                        data.atrSignal ?? 'normal'
                      }`}
                    >
                      {data.atrSignal === 'high' &&
                        'High volatility — consider wider stop-losses'}
                      {data.atrSignal === 'low' &&
                        '😴 Low volatility — stable but limited upside'}
                      {data.atrSignal === 'normal' &&
                        '✅ Normal volatility — typical price movement'}
                      {data.atrSignal === null && 'Insufficient data'}
                    </div>
                  </div>
                </>
              ) : (
                <div className="no-data-message">
                  Insufficient data to display ATR Analysis
                </div>
              )}
            </div>

            {/* Section 10: OBV - On-Balance Volume */}
            <div className="tech-section obv-section">
              <div className="section-header">
                <h4>On-Balance Volume (OBV)</h4>
                <TimeRangeSelector
                  value={obvTimeRange}
                  onChange={setObvTimeRange}
                />
                <InfoTooltip text="OBV měří kumulativní tok objemu. Když cena roste, objem se přičítá; když klesá, odečítá se. Rostoucí OBV signalizuje akumulaci (nákup), klesající OBV signalizuje distribuci (prodej). Divergence mezi OBV a cenou může předpovídat obrat trendu." />
              </div>

              {obvData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={obvData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis
                        dataKey="displayDate"
                        tick={{ fontSize: 11 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={formatVolume}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip
                        formatter={(value: number) => [
                          formatVolume(value),
                          value === obvData[0]?.obvSma ? 'SMA(20)' : 'OBV',
                        ]}
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #e0e0e0',
                          borderRadius: '8px',
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

                  <div className="indicator-summary">
                    <div className="indicator-values-row">
                      <div className="indicator-value">
                        <span className="indicator-label">Current OBV:</span>
                        <span className="indicator-num">
                          {data.obv !== null ? formatVolume(data.obv) : 'N/A'}
                        </span>
                      </div>
                      <div className="indicator-value">
                        <span className="indicator-label">OBV Trend:</span>
                        <span
                          className={`indicator-num ${
                            data.obvTrend === 'bullish'
                              ? 'positive'
                              : data.obvTrend === 'bearish'
                              ? 'negative'
                              : ''
                          }`}
                        >
                          {data.obvTrend === 'bullish' && 'Accumulation'}
                          {data.obvTrend === 'bearish' && 'Distribution'}
                          {data.obvTrend === 'neutral' && 'Neutral'}
                          {!data.obvTrend && 'N/A'}
                        </span>
                      </div>
                      <div className="indicator-value">
                        <span className="indicator-label">Divergence:</span>
                        <span
                          className={`indicator-num ${
                            data.obvDivergence === 'bullish'
                              ? 'positive'
                              : data.obvDivergence === 'bearish'
                              ? 'negative'
                              : 'muted'
                          }`}
                        >
                          {data.obvDivergence === 'bullish' && '🟢 Bullish'}
                          {data.obvDivergence === 'bearish' && '🔴 Bearish'}
                          {!data.obvDivergence && '— None'}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`indicator-signal ${
                        data.obvTrend ?? 'neutral'
                      }`}
                    >
                      {data.obvTrend === 'bullish' &&
                        'Accumulation — volume flowing into stock'}
                      {data.obvTrend === 'bearish' &&
                        'Distribution — volume leaving stock'}
                      {data.obvTrend === 'neutral' &&
                        'Neutral — no clear volume trend'}
                      {!data.obvTrend && 'Insufficient data'}
                    </div>
                    {data.obvDivergence && (
                      <div
                        className={`indicator-signal divergence ${data.obvDivergence}`}
                      >
                        {data.obvDivergence === 'bullish' &&
                          'Bullish divergence: Price down, OBV up — possible reversal!'}
                        {data.obvDivergence === 'bearish' &&
                          'Bearish divergence: Price up, OBV down — caution!'}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="no-data-message">
                  Insufficient data to display OBV Analysis
                </div>
              )}
            </div>

            {/* Section 11: ADX - Average Directional Index */}
            <div className="tech-section adx-section">
              <div className="section-header">
                <h4>ADX (Average Directional Index)</h4>
                <TimeRangeSelector
                  value={adxTimeRange}
                  onChange={setAdxTimeRange}
                />
                <InfoTooltip text="ADX měří SÍLU trendu (ne směr!). Hodnoty: pod 20 = slabý/žádný trend, 20-25 = trend se formuje, 25-40 = silný trend, nad 40 = velmi silný trend. +DI nad -DI = bullish trend, -DI nad +DI = bearish trend. Používejte ADX k rozhodnutí zda obchodovat trendy nebo range." />
              </div>

              {adxData.length > 0 && data.adx !== null ? (
                <>
                  <ResponsiveContainer width="100%" height={280}>
                    <ComposedChart data={adxData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis
                        dataKey="displayDate"
                        tick={{ fontSize: 11 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fontSize: 11 }} domain={[0, 60]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#fff',
                          border: '1px solid #e0e0e0',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <ReferenceLine
                        y={20}
                        stroke="#9ca3af"
                        strokeDasharray="5 5"
                        label={{ value: '20', position: 'right', fontSize: 10 }}
                      />
                      <ReferenceLine
                        y={40}
                        stroke="#9ca3af"
                        strokeDasharray="5 5"
                        label={{ value: '40', position: 'right', fontSize: 10 }}
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

                  <div className="indicator-summary">
                    <div className="indicator-values-row">
                      <div className="indicator-value">
                        <span className="indicator-label">ADX:</span>
                        <span className="indicator-num">
                          {data.adx?.toFixed(1) ?? 'N/A'}
                        </span>
                      </div>
                      <div className="indicator-value">
                        <span className="indicator-label">+DI:</span>
                        <span className="indicator-num positive">
                          {data.plusDI?.toFixed(1) ?? 'N/A'}
                        </span>
                      </div>
                      <div className="indicator-value">
                        <span className="indicator-label">-DI:</span>
                        <span className="indicator-num negative">
                          {data.minusDI?.toFixed(1) ?? 'N/A'}
                        </span>
                      </div>
                      <div className="indicator-value">
                        <span className="indicator-label">Strength:</span>
                        <span
                          className={`indicator-num ${
                            data.adxSignal === 'strong'
                              ? 'positive'
                              : data.adxSignal === 'weak'
                              ? 'warning'
                              : ''
                          }`}
                        >
                          {data.adxSignal === 'strong' && '💪 Very Strong'}
                          {data.adxSignal === 'moderate' && 'Strong'}
                          {data.adxSignal === 'weak' && 'Weak'}
                          {data.adxSignal === 'no-trend' && '😴 No Trend'}
                          {!data.adxSignal && 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`indicator-signal ${
                        data.adxSignal ?? 'neutral'
                      }`}
                    >
                      {data.adxSignal === 'strong' &&
                        '💪 Very strong trend — follow the momentum'}
                      {data.adxSignal === 'moderate' &&
                        'Strong trend — good for trend trades'}
                      {data.adxSignal === 'weak' &&
                        'Weak trend — be cautious'}
                      {data.adxSignal === 'no-trend' &&
                        '😴 No trend — avoid trend strategies'}
                      {!data.adxSignal && 'Insufficient data'}
                    </div>
                    {data.adxTrend && data.adxSignal !== 'no-trend' && (
                      <div
                        className={`indicator-signal direction ${data.adxTrend}`}
                      >
                        {data.adxTrend === 'bullish' &&
                          '🟢 +DI > -DI → Bulls in control'}
                        {data.adxTrend === 'bearish' &&
                          '🔴 -DI > +DI → Bears in control'}
                        {data.adxTrend === 'neutral' &&
                          '+DI ≈ -DI → Undecided'}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="no-data-message">
                  Insufficient data to display ADX Analysis
                </div>
              )}
            </div>

            {/* Section 12: Fibonacci Retracement */}
            <div className="tech-section fibonacci-section">
              <div className="section-header">
                <h4>Fibonacci Retracement</h4>
                <InfoTooltip text="Fibonacci retracementy identifikují klíčové úrovně podpory/odporu na základě poměrů (23.6%, 38.2%, 50%, 61.8%, 78.6%). Tyto úrovně často fungují jako body obratu při korekcích. 38.2% a 61.8% jsou nejdůležitější úrovně. Pokud cena prorazí 61.8%, je pravděpodobný pokračující trend." />
              </div>

              {data.fibonacciLevels ? (
                <>
                  <div className="fibonacci-visual">
                    <div className="fib-price-bar">
                      <div className="fib-level level-0">
                        <span className="fib-label">0% (High)</span>
                        <span className="fib-price">
                          ${data.fibonacciLevels.level0.toFixed(2)}
                        </span>
                      </div>
                      <div className="fib-level level-236">
                        <span className="fib-label">23.6%</span>
                        <span className="fib-price">
                          ${data.fibonacciLevels.level236.toFixed(2)}
                        </span>
                      </div>
                      <div className="fib-level level-382">
                        <span className="fib-label">38.2%</span>
                        <span className="fib-price">
                          ${data.fibonacciLevels.level382.toFixed(2)}
                        </span>
                      </div>
                      <div className="fib-level level-500">
                        <span className="fib-label">50%</span>
                        <span className="fib-price">
                          ${data.fibonacciLevels.level500.toFixed(2)}
                        </span>
                      </div>
                      <div className="fib-level level-618">
                        <span className="fib-label">61.8%</span>
                        <span className="fib-price">
                          ${data.fibonacciLevels.level618.toFixed(2)}
                        </span>
                      </div>
                      <div className="fib-level level-786">
                        <span className="fib-label">78.6%</span>
                        <span className="fib-price">
                          ${data.fibonacciLevels.level786.toFixed(2)}
                        </span>
                      </div>
                      <div className="fib-level level-100">
                        <span className="fib-label">100% (Low)</span>
                        <span className="fib-price">
                          ${data.fibonacciLevels.level100.toFixed(2)}
                        </span>
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
                        <span className="current-label">
                          Current: ${data.currentPrice?.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="indicator-summary">
                    <div className="indicator-values-row">
                      <div className="indicator-value">
                        <span className="indicator-label">Period High:</span>
                        <span className="indicator-num">
                          ${data.fibonacciLevels.high.toFixed(2)}
                        </span>
                      </div>
                      <div className="indicator-value">
                        <span className="indicator-label">Period Low:</span>
                        <span className="indicator-num">
                          ${data.fibonacciLevels.low.toFixed(2)}
                        </span>
                      </div>
                      <div className="indicator-value">
                        <span className="indicator-label">Trend:</span>
                        <span
                          className={`indicator-num ${
                            data.fibonacciLevels.trend === 'uptrend'
                              ? 'positive'
                              : 'negative'
                          }`}
                        >
                          {data.fibonacciLevels.trend === 'uptrend'
                            ? 'Uptrend'
                            : 'Downtrend'}
                        </span>
                      </div>
                      <div className="indicator-value">
                        <span className="indicator-label">Near Level:</span>
                        <span className="indicator-num accent">
                          {data.fibonacciLevels.currentLevel ||
                            'Between levels'}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`indicator-signal ${
                        data.fibonacciLevels.trend === 'uptrend'
                          ? 'bullish'
                          : 'bearish'
                      }`}
                    >
                      {data.fibonacciLevels.trend === 'uptrend'
                        ? 'Uptrend — look for buy opportunities at 38.2% or 61.8% levels'
                        : 'Downtrend — levels may act as resistance during rallies'}
                    </div>
                    {data.fibonacciLevels.currentLevel && (
                      <div className="indicator-signal highlight">
                        Price near{' '}
                        <strong>{data.fibonacciLevels.currentLevel}</strong> —
                        watch for reaction!
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="no-data-message">
                  Insufficient data to calculate Fibonacci levels
                </div>
              )}
            </div>

            {/* Section 13: What These Indicators Tell You */}
            <div className="tech-section tech-summary-section">
              <div className="section-header">
                <h4>How to Use This Analysis</h4>
                <InfoTooltip text="DŮLEŽITÉ: Technická analýza není 100% spolehlivá! Používejte ji jako JEDEN z nástrojů, ne jako jediný důvod k nákupu/prodeji. NEJLEPŠÍ VÝSLEDKY: Kombinujte více indikátorů. Když většina ukazuje stejný směr (bullish nebo bearish), signál je silnější. ZLATÉ PRAVIDLO: Nikdy neinvestujte jen na základě jednoho indikátoru." />
              </div>
              <div className="usage-guide">
                <div className="usage-item">
                  <strong>🟢 Bullish (růstové) signály:</strong>
                  <span>
                    Golden Cross, cena nad klouzavými průměry, RSI stoupá z
                    oversold zóny, MACD kříží signal linii nahoru, cena se
                    odráží od dolního Bollinger pásma, Stochastic %K kříží %D
                    zespoda v oversold zóně, růst ceny s vysokým objemem
                  </span>
                </div>
                <div className="usage-item">
                  <strong>🔴 Bearish (klesající) signály:</strong>
                  <span>
                    Death Cross, cena pod klouzavými průměry, RSI klesá z
                    overbought zóny, MACD kříží signal linii dolů, cena je
                    odmítnuta u horního Bollinger pásma, Stochastic %K kříží %D
                    shora v overbought zóně, pokles ceny s vysokým objemem
                  </span>
                </div>
                <div className="usage-item">
                  <strong>Volume tip:</strong>
                  <span>
                    Objem potvrzuje cenové pohyby. Růst s vysokým objemem je
                    silnější než růst s nízkým objemem. Pokles s nízkým objemem
                    může signalizovat blížící se obrat.
                  </span>
                </div>
                <div className="usage-item">
                  <strong>Důležité upozornění:</strong>
                  <span>
                    Technická analýza funguje nejlépe v kombinaci s
                    fundamentální analýzou. Žádný indikátor není 100%
                    spolehlivý. Vždy hledejte potvrzení z více zdrojů!
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
