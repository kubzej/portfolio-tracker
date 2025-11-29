import { Text } from '../Typography';
import './TimeRangeSelector.css';

export type TimeRange = '1W' | '2W' | '1M' | '3M' | '6M' | '1Y';

export interface TimeRangeOption {
  value: TimeRange;
  label: string;
  days: number;
}

// Standard ranges (for price charts, Bollinger - need longer history)
export const TIME_RANGES_LONG: TimeRangeOption[] = [
  { value: '1M', label: '1M', days: 21 },
  { value: '3M', label: '3M', days: 63 },
  { value: '6M', label: '6M', days: 126 },
  { value: '1Y', label: '1Y', days: 252 },
];

// Extended ranges with short intervals (for momentum indicators)
export const TIME_RANGES_SHORT: TimeRangeOption[] = [
  { value: '1W', label: '1W', days: 5 },
  { value: '2W', label: '2W', days: 10 },
  { value: '1M', label: '1M', days: 21 },
  { value: '3M', label: '3M', days: 63 },
  { value: '6M', label: '6M', days: 126 },
  { value: '1Y', label: '1Y', days: 252 },
];

// Helper to get days from any range
export const getDaysForRange = (range: TimeRange): number => {
  const found = TIME_RANGES_SHORT.find((r) => r.value === range);
  return found?.days || 21;
};

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  ranges?: TimeRangeOption[];
}

export function TimeRangeSelector({
  value,
  onChange,
  ranges = TIME_RANGES_SHORT,
}: TimeRangeSelectorProps) {
  return (
    <div className="time-range-selector">
      {ranges.map((range) => (
        <button
          key={range.value}
          className={`time-range-btn ${value === range.value ? 'active' : ''}`}
          onClick={() => onChange(range.value)}
        >
          <Text
            size="xs"
            weight={value === range.value ? 'semibold' : 'normal'}
          >
            {range.label}
          </Text>
        </button>
      ))}
    </div>
  );
}
