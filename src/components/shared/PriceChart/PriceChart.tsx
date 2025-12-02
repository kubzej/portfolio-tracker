import { useState, useMemo, useCallback } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
  Line,
  Cell,
  Tooltip,
  Label,
} from 'recharts';
import { Button } from '../Button';
import { LoadingSpinner } from '../LoadingSpinner';
import { Text } from '../Typography';
import type { PriceChartProps, ChartType, ChartDataPoint } from './types';
import type {
  TimeRange,
  IntradayPricePoint,
  PricePoint,
} from '@/services/api/technical';
import {
  formatCurrency,
  formatLargeNumber,
  formatNumber,
} from '@/utils/format';
import './PriceChart.css';

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '1d', label: '1D' },
  { value: '1w', label: '1W' },
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: '5y', label: '5Y' },
];

// Filter data based on time range
function filterDataByRange(
  dailyData: PricePoint[],
  weeklyData: PricePoint[],
  range: TimeRange
): PricePoint[] {
  const now = new Date();
  let cutoffDate: Date;

  switch (range) {
    case '1m':
      cutoffDate = new Date(now.setMonth(now.getMonth() - 1));
      return dailyData.filter((d) => new Date(d.date) >= cutoffDate);
    case '3m':
      cutoffDate = new Date(now.setMonth(now.getMonth() - 3));
      return dailyData.filter((d) => new Date(d.date) >= cutoffDate);
    case '6m':
      cutoffDate = new Date(now.setMonth(now.getMonth() - 6));
      return dailyData.filter((d) => new Date(d.date) >= cutoffDate);
    case '1y':
      return dailyData; // Already 1 year
    case '5y':
      return weeklyData; // Use weekly data for 5Y
    default:
      return dailyData;
  }
}

// Format date for X-axis based on range
function formatXAxisDate(date: string, range: TimeRange): string {
  const d = new Date(date);

  if (range === '1d') {
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (range === '1w') {
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (range === '1m' || range === '3m') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (range === '6m' || range === '1y') {
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  // 5Y - include full year
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// Format date for header display
function formatHeaderDate(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function PriceChart({
  historicalPrices,
  historicalPricesWeekly = [],
  currency = 'USD',
  onLoadIntraday,
  height = 400,
  showVolume = true,
  defaultRange = '3m',
  defaultChartType = 'area',
  sma50History = [],
  sma200History = [],
}: PriceChartProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange>(defaultRange);
  const [chartType, setChartType] = useState<ChartType>(defaultChartType);
  const [intradayData, setIntradayData] = useState<
    Record<string, IntradayPricePoint[]>
  >({});
  const [loadingIntraday, setLoadingIntraday] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [showSMA, setShowSMA] = useState(false);

  // Detect mobile
  useState(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });

  // Handle range change with lazy loading for intraday
  const handleRangeChange = useCallback(
    async (range: TimeRange) => {
      setSelectedRange(range);

      // Lazy load intraday data if needed
      if (
        (range === '1d' || range === '1w') &&
        onLoadIntraday &&
        !intradayData[range]
      ) {
        setLoadingIntraday(true);
        try {
          const data = await onLoadIntraday(range);
          setIntradayData((prev) => ({ ...prev, [range]: data }));
        } catch (err) {
          console.error('Failed to load intraday data:', err);
        } finally {
          setLoadingIntraday(false);
        }
      }
    },
    [onLoadIntraday, intradayData]
  );

  // Get chart data based on selected range
  const chartData = useMemo((): ChartDataPoint[] => {
    // Helper to add candlestick properties
    const addCandleData = (p: {
      open: number;
      close: number;
      high: number;
      low: number;
    }) => {
      const bodyMin = Math.min(p.open, p.close);
      const bodyMax = Math.max(p.open, p.close);
      return {
        candleBody: [bodyMin, bodyMax] as [number, number],
        wickRange: [p.low, p.high] as [number, number],
      };
    };

    // Use intraday data for 1D/1W if available
    if (
      (selectedRange === '1d' || selectedRange === '1w') &&
      intradayData[selectedRange]
    ) {
      return intradayData[selectedRange].map((p) => ({
        date: p.date,
        timestamp: p.timestamp,
        open: p.open,
        close: p.close,
        high: p.high,
        low: p.low,
        volume: p.volume,
        ...addCandleData(p),
      }));
    }

    // Filter daily/weekly data based on range
    const filteredData = filterDataByRange(
      historicalPrices,
      historicalPricesWeekly,
      selectedRange
    );

    // Merge with SMA data
    const sma50Map = new Map(sma50History.map((s) => [s.date, s.value]));
    const sma200Map = new Map(sma200History.map((s) => [s.date, s.value]));

    return filteredData.map((p) => ({
      date: p.date,
      open: p.open,
      close: p.close,
      high: p.high,
      low: p.low,
      volume: p.volume,
      sma50: sma50Map.get(p.date),
      sma200: sma200Map.get(p.date),
      ...addCandleData(p),
    }));
  }, [
    selectedRange,
    historicalPrices,
    historicalPricesWeekly,
    intradayData,
    sma50History,
    sma200History,
  ]);

  // Check if SMA data is available (not for intraday ranges)
  const hasSMAData =
    (sma50History.length > 0 || sma200History.length > 0) &&
    selectedRange !== '1d' &&
    selectedRange !== '1w';

  // Calculate price domain with padding - includes SMA when shown
  const priceDomain = useMemo(() => {
    if (chartData.length === 0) return [0, 100];

    // Start with high/low prices
    const prices = chartData.flatMap((d) => [d.high, d.low]);

    // Include SMA values if SMA is shown
    if (showSMA && hasSMAData) {
      chartData.forEach((d) => {
        if (d.sma50 != null) prices.push(d.sma50);
        if (d.sma200 != null) prices.push(d.sma200);
      });
    }

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.05;
    return [min - padding, max + padding];
  }, [chartData, showSMA, hasSMAData]);

  // Calculate if current price is up or down vs first price
  const priceChange = useMemo(() => {
    if (chartData.length < 2)
      return { isPositive: true, color: 'var(--chart-positive)' };
    const first = chartData[0].close;
    const last = chartData[chartData.length - 1].close;
    const isPositive = last >= first;
    return {
      isPositive,
      color: isPositive ? 'var(--chart-positive)' : 'var(--chart-negative)',
    };
  }, [chartData]);

  // First price for reference line
  const firstPrice = chartData.length > 0 ? chartData[0].close : null;

  // Min/Max/Current prices for Y axis labels (desktop only)
  const priceLabels = useMemo(() => {
    if (chartData.length === 0) return null;
    const highs = chartData.map((d) => d.high);
    const lows = chartData.map((d) => d.low);
    return {
      min: Math.min(...lows),
      max: Math.max(...highs),
      current: chartData[chartData.length - 1].close,
    };
  }, [chartData]);

  // Mobile-specific height
  const chartHeight = isMobile ? 280 : height;
  const volumeHeight = isMobile ? 50 : 80;

  // Check if intraday is available
  const hasIntradaySupport = !!onLoadIntraday;

  // Data to display in header (hovered or latest)
  const displayData = useMemo(() => {
    const data =
      activeIndex !== null && chartData[activeIndex]
        ? chartData[activeIndex]
        : chartData.length > 0
        ? chartData[chartData.length - 1]
        : null;
    if (!data) return null;

    // Daily change: close vs open of the same day
    const change = data.close - data.open;
    const changePercent = data.open !== 0 ? (change / data.open) * 100 : 0;

    return {
      ...data,
      change,
      changePercent,
      isPositive: change >= 0,
    };
  }, [activeIndex, chartData]);

  // Handle mouse move on chart
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleMouseMove = useCallback((state: any) => {
    if (state && state.activeTooltipIndex != null) {
      const index = Number(state.activeTooltipIndex);
      if (!isNaN(index)) {
        setActiveIndex(index);
      }
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setActiveIndex(null);
  }, []);

  return (
    <div className="price-chart">
      {/* Price Header - shows current/hovered values */}
      {displayData && (
        <div className="price-chart__header">
          <div className="price-chart__header-row">
            <span className="price-chart__header-price">
              {formatCurrency(displayData.close, currency)}
            </span>
            <span
              className={`price-chart__header-change ${
                displayData.isPositive ? 'positive' : 'negative'
              }`}
            >
              {displayData.isPositive ? '+' : ''}
              {formatCurrency(displayData.change, currency)} (
              {displayData.isPositive ? '+' : ''}
              {formatNumber(displayData.changePercent, 2)}%)
            </span>
            <span className="price-chart__header-date">
              {formatHeaderDate(displayData.date)}
            </span>
          </div>
          <div className="price-chart__header-ohlc">
            <span>O {formatNumber(displayData.open, 2)}</span>
            <span>C {formatNumber(displayData.close, 2)}</span>
            <span>H {formatNumber(displayData.high, 2)}</span>
            <span>L {formatNumber(displayData.low, 2)}</span>
            <span>V {formatLargeNumber(displayData.volume)}</span>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="price-chart__controls">
        {/* Chart type toggle */}
        <div className="price-chart__type-toggle">
          <Button
            variant={chartType === 'area' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setChartType('area')}
          >
            Křivka
          </Button>
          <Button
            variant={chartType === 'candlestick' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setChartType('candlestick')}
          >
            Svíčky
          </Button>
        </div>

        {/* Time range selector */}
        <div className="price-chart__ranges">
          {TIME_RANGES.map(({ value, label }) => {
            // Disable 1D/1W if no intraday support
            const isDisabled =
              !hasIntradaySupport && (value === '1d' || value === '1w');
            // Disable 5Y if no weekly data
            const is5YDisabled =
              value === '5y' && historicalPricesWeekly.length === 0;

            return (
              <Button
                key={value}
                variant={selectedRange === value ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => handleRangeChange(value)}
                disabled={isDisabled || is5YDisabled}
                className="price-chart__range-btn"
              >
                {label}
              </Button>
            );
          })}
        </div>
      </div>

      {/* SMA Toggle - own row, left aligned */}
      {hasSMAData && (
        <div className="price-chart__sma-toggle">
          <label className="price-chart__checkbox">
            <input
              type="checkbox"
              checked={showSMA}
              onChange={(e) => setShowSMA(e.target.checked)}
            />
            <span className="price-chart__checkbox-label">SMA</span>
          </label>
          {showSMA && (
            <div className="price-chart__legend">
              <div className="price-chart__legend-item">
                <span className="price-chart__legend-line price-chart__legend-line--sma50" />
                <Text size="xs" color="secondary">
                  50
                </Text>
              </div>
              <div className="price-chart__legend-item">
                <span className="price-chart__legend-line price-chart__legend-line--sma200" />
                <Text size="xs" color="secondary">
                  200
                </Text>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading state for intraday */}
      {loadingIntraday && (
        <div className="price-chart__loading">
          <LoadingSpinner size="sm" />
        </div>
      )}

      {/* Main chart */}
      {!loadingIntraday && chartData.length > 0 && (
        <div
          className="price-chart__container"
          style={{ height: chartHeight }}
          onMouseLeave={handleMouseLeave}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={chartData}
              margin={{
                top: 10,
                right: isMobile ? 0 : 55,
                left: 10,
                bottom: 0,
              }}
              onMouseMove={handleMouseMove}
            >
              {/* X Axis - hidden, using custom labels below */}
              <XAxis dataKey="date" hide />

              {/* Y Axis - hidden on mobile, visible on desktop */}
              <YAxis
                domain={priceDomain}
                tickFormatter={(value) => formatNumber(value, 0)}
                tick={{ fontSize: 10, fill: 'var(--text-secondary)' }}
                axisLine={false}
                tickLine={false}
                orientation="right"
                width={45}
                hide={isMobile}
              />

              {/* Hidden tooltip just to enable cursor crosshair */}
              <Tooltip
                content={() => null}
                cursor={{
                  stroke: 'var(--text-tertiary)',
                  strokeDasharray: '3 3',
                }}
              />

              {/* Reference line at first price */}
              {firstPrice && (
                <ReferenceLine
                  y={firstPrice}
                  stroke="var(--text-tertiary)"
                  strokeDasharray="3 3"
                />
              )}

              {/* Current price line with badge */}
              {priceLabels && (
                <ReferenceLine
                  y={priceLabels.current}
                  stroke={priceChange.color}
                  strokeDasharray="2 2"
                  strokeWidth={1}
                >
                  <Label
                    content={({ viewBox }) => {
                      const { x, y } = viewBox as { x: number; y: number };
                      const badgeWidth = isMobile ? 40 : 45;
                      const fontSize = isMobile ? 9 : 10;
                      return (
                        <g>
                          <rect
                            x={x + 5}
                            y={y - 9}
                            width={badgeWidth}
                            height={18}
                            rx={4}
                            fill={priceChange.color}
                          />
                          <text
                            x={x + 5 + badgeWidth / 2}
                            y={y + 4}
                            fill="white"
                            fontSize={fontSize}
                            fontWeight={600}
                            textAnchor="middle"
                          >
                            {formatNumber(priceLabels.current, 2)}
                          </text>
                        </g>
                      );
                    }}
                  />
                </ReferenceLine>
              )}

              {/* Area chart */}
              {chartType === 'area' && (
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke={priceChange.color}
                  strokeWidth={2}
                  fill={`url(#gradient-${
                    priceChange.isPositive ? 'positive' : 'negative'
                  })`}
                  isAnimationActive={false}
                />
              )}

              {/* Candlestick chart - body bars with colored fill */}
              {chartType === 'candlestick' && (
                <>
                  {/* Wick (high-low line) as thin bar */}
                  <Bar
                    dataKey="wickRange"
                    isAnimationActive={false}
                    barSize={1}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`wick-${index}`}
                        fill={
                          entry.close >= entry.open
                            ? 'var(--chart-positive)'
                            : 'var(--chart-negative)'
                        }
                      />
                    ))}
                  </Bar>
                  {/* Body (open-close range) */}
                  <Bar
                    dataKey="candleBody"
                    isAnimationActive={false}
                    barSize={isMobile ? 5 : 10}
                  >
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`body-${index}`}
                        fill={
                          entry.close >= entry.open
                            ? 'var(--chart-positive)'
                            : 'var(--chart-negative)'
                        }
                      />
                    ))}
                  </Bar>
                </>
              )}

              {/* SMA lines - only shown when checkbox is checked */}
              {showSMA && sma50History.length > 0 && hasSMAData && (
                <Line
                  type="monotone"
                  dataKey="sma50"
                  stroke="var(--chart-sma50)"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              )}
              {showSMA && sma200History.length > 0 && hasSMAData && (
                <Line
                  type="monotone"
                  dataKey="sma200"
                  stroke="var(--chart-sma200)"
                  strokeWidth={1.5}
                  dot={false}
                  isAnimationActive={false}
                />
              )}

              {/* Gradient definitions */}
              <defs>
                <linearGradient
                  id="gradient-positive"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="var(--chart-positive)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--chart-positive)"
                    stopOpacity={0.05}
                  />
                </linearGradient>
                <linearGradient
                  id="gradient-negative"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="0%"
                    stopColor="var(--chart-negative)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--chart-negative)"
                    stopOpacity={0.05}
                  />
                </linearGradient>
              </defs>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Custom X-axis date labels (desktop only) */}
      {!isMobile && chartData.length > 0 && (
        <div className="price-chart__date-labels">
          <span>{formatXAxisDate(chartData[0].date, selectedRange)}</span>
          <span>
            {formatXAxisDate(
              chartData[chartData.length - 1].date,
              selectedRange
            )}
          </span>
        </div>
      )}

      {/* Volume chart */}
      {showVolume && !loadingIntraday && chartData.length > 0 && (
        <div className="price-chart__volume-section">
          <div className="price-chart__volume-label">
            <Text size="xs" color="muted">
              VOLUME
            </Text>
          </div>
          <div className="price-chart__volume" style={{ height: volumeHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{
                  top: 4,
                  right: isMobile ? 0 : 55,
                  left: 10,
                  bottom: 0,
                }}
                onMouseMove={handleMouseMove}
                onClick={(e) => {
                  if (e && e.activeTooltipIndex !== undefined) {
                    setActiveIndex(Number(e.activeTooltipIndex));
                  }
                }}
              >
                <XAxis dataKey="date" hide />
                <YAxis hide />
                <Bar
                  dataKey="volume"
                  isAnimationActive={false}
                  radius={[2, 2, 0, 0]}
                  cursor="pointer"
                >
                  {chartData.map((entry, index) => {
                    const isActive = activeIndex === index;
                    const baseColor =
                      entry.close >= entry.open
                        ? 'var(--chart-positive)'
                        : 'var(--chart-negative)';
                    return (
                      <Cell
                        key={`volume-${index}`}
                        fill={baseColor}
                        fillOpacity={isActive ? 1 : 0.4}
                        stroke={isActive ? baseColor : 'none'}
                        strokeWidth={isActive ? 2 : 0}
                      />
                    );
                  })}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Empty state */}
      {chartData.length === 0 && !loadingIntraday && (
        <div className="price-chart__empty">
          <Text color="secondary">Žádná cenová data</Text>
        </div>
      )}
    </div>
  );
}
