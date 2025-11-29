import type { ReactNode } from 'react';
import { CardTitle, Text } from '../Typography';
import { InfoTooltip } from '../InfoTooltip';
import type { TimeRange, TimeRangeOption } from '../TimeRangeSelector';
import { TimeRangeSelector } from '../TimeRangeSelector';
import './ChartSection.css';

interface ChartSectionProps {
  title: string;
  tooltip?: string;
  timeRange?: TimeRange;
  onTimeRangeChange?: (range: TimeRange) => void;
  timeRangeOptions?: TimeRangeOption[];
  children: ReactNode;
  className?: string;
}

export function ChartSection({
  title,
  tooltip,
  timeRange,
  onTimeRangeChange,
  timeRangeOptions,
  children,
  className = '',
}: ChartSectionProps) {
  return (
    <div className={`chart-section ${className}`}>
      <div className="chart-section-header">
        <div className="chart-section-title">
          <CardTitle>{title}</CardTitle>
          {tooltip && <InfoTooltip text={tooltip} />}
        </div>
        {timeRange && onTimeRangeChange && (
          <TimeRangeSelector
            value={timeRange}
            onChange={onTimeRangeChange}
            ranges={timeRangeOptions}
          />
        )}
      </div>
      <div className="chart-section-content">{children}</div>
    </div>
  );
}

interface ChartNoDataProps {
  message?: string;
}

export function ChartNoData({
  message = 'Insufficient data',
}: ChartNoDataProps) {
  return (
    <div className="chart-no-data">
      <Text color="muted">{message}</Text>
    </div>
  );
}
