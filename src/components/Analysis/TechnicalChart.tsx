import { useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type {
  TechnicalData,
  PricePoint,
  SMAPoint,
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

// Format date helper
const formatDateStr = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

export function TechnicalChart({ data, onClose }: TechnicalChartProps) {
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
    return prices.map((p: PricePoint) => ({
      date: p.date,
      displayDate: formatDateStr(p.date),
      price: p.close,
      sma50: sma50Map.get(p.date) ?? null,
      sma200: sma200Map.get(p.date) ?? null,
    }));
  }, [data]);

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
                <InfoTooltip text="Overall trend assessment based on moving average crossovers and price position. Combines multiple indicators into a single actionable signal." />
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
                <InfoTooltip text="Shows 1-year price history with 50-day and 200-day moving averages. Moving averages smooth out price fluctuations to reveal underlying trends. When price is above the averages, it's generally bullish; below is bearish." />
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
                <InfoTooltip text="Compares current price to moving averages. Being above/below indicates trend strength. The 50 DMA vs 200 DMA relationship creates Golden Cross (bullish) or Death Cross (bearish) signals." />
              </div>
              <div className="ma-cards">
                <div className="ma-card">
                  <div className="ma-card-header">
                    <span className="ma-label">50 DMA</span>
                    <InfoTooltip text="50-day moving average: average price over last 50 trading days. Used for short-to-medium term trend identification. Price above = bullish, below = bearish." />
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
                    <InfoTooltip text="200-day moving average: average price over last 200 trading days. Key long-term trend indicator watched by institutional investors. Often acts as support/resistance." />
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
                    <InfoTooltip text="Golden Cross: 50 DMA crosses above 200 DMA — bullish signal indicating potential uptrend. Death Cross: 50 DMA crosses below 200 DMA — bearish signal indicating potential downtrend. Widely followed by traders." />
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
                <InfoTooltip text="RSI measures momentum on a 0-100 scale using 14-day price changes. Shows if a stock is potentially overbought (above 70) or oversold (below 30). Useful for timing entries/exits." />
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
                    <InfoTooltip text="When RSI is above 70, the stock may be overbought. The price may have risen too fast and could be due for a pullback." />
                  </div>
                  <div className="rsi-info-card">
                    <span className="rsi-zone-label neutral">
                      30-70 Neutral
                    </span>
                    <span className="rsi-zone-meaning">Normal momentum</span>
                    <InfoTooltip text="RSI between 30-70 indicates normal trading conditions. The stock is neither overbought nor oversold." />
                  </div>
                  <div className="rsi-info-card">
                    <span className="rsi-zone-label oversold">
                      &lt;30 Oversold
                    </span>
                    <span className="rsi-zone-meaning">
                      Potential bounce ahead
                    </span>
                    <InfoTooltip text="When RSI is below 30, the stock may be oversold. The price may have fallen too fast and could be due for a bounce." />
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

            {/* Section 5: What These Indicators Tell You */}
            <div className="tech-section tech-summary-section">
              <div className="section-header">
                <h4>How to Use This Analysis</h4>
                <InfoTooltip text="Quick guide on interpreting these technical indicators for investment decisions." />
              </div>
              <div className="usage-guide">
                <div className="usage-item">
                  <strong>🟢 Bullish Signs:</strong>
                  <span>
                    Price above both MAs, Golden Cross active, RSI rising from
                    oversold
                  </span>
                </div>
                <div className="usage-item">
                  <strong>🔴 Bearish Signs:</strong>
                  <span>
                    Price below both MAs, Death Cross active, RSI falling from
                    overbought
                  </span>
                </div>
                <div className="usage-item">
                  <strong>⚠️ Caution:</strong>
                  <span>
                    Technical analysis works best combined with fundamental
                    analysis. No indicator is 100% reliable.
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
