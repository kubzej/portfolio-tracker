import type {
  PricePoint,
  IntradayPricePoint,
  TimeRange,
  SMAPoint,
} from '@/services/api/technical';

export type ChartType = 'area' | 'candlestick';

export interface PriceChartProps {
  // Data from TechnicalData
  historicalPrices: PricePoint[]; // 1Y daily
  historicalPricesWeekly?: PricePoint[]; // 5Y weekly
  currency?: string;

  // Optional callbacks for lazy loading intraday
  onLoadIntraday?: (range: '1d' | '1w') => Promise<IntradayPricePoint[]>;

  // Display options
  height?: number;
  showVolume?: boolean;
  defaultRange?: TimeRange;
  defaultChartType?: ChartType;

  // Optional SMA overlays
  sma50History?: SMAPoint[];
  sma200History?: SMAPoint[];
}

export interface ChartDataPoint {
  date: string;
  timestamp?: number;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  sma50?: number;
  sma200?: number;
  // Candlestick specific
  candleBody?: [number, number]; // [min(open,close), max(open,close)]
  wickRange?: [number, number]; // [low, high] for the wick line
}

export interface TooltipData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
}
