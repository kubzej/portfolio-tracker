import { ReactNode } from 'react';
import { MetricLabel, MetricValue, Muted, Subtext } from '../Typography';
import { cn } from '@/utils/cn';
import './MetricCard.css';

interface MetricCardProps {
  /** Label text displayed at top */
  label: string;
  /** Main value to display */
  value: string | number | null;
  /** Optional suffix for the value (e.g., "x", "%") - attached directly to value */
  suffix?: string;
  /** Optional secondary value (displayed as "value / subValue") */
  subValue?: string | number;
  /** Optional custom subtext (e.g., "/ 2.00", "analysts") - more flexible than subValue */
  subtext?: string;
  /** Tooltip element to display after the label */
  tooltip?: ReactNode;
  /** Color sentiment for the value */
  sentiment?: 'positive' | 'negative' | 'neutral';
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
}

export function MetricCard({
  label,
  value,
  suffix = '',
  subValue,
  subtext,
  tooltip,
  sentiment,
  size = 'md',
}: MetricCardProps) {
  const formattedValue =
    value === null || value === undefined
      ? null
      : typeof value === 'number'
      ? value.toLocaleString()
      : value;

  // Determine what to show after the value
  const subtextContent =
    subtext ?? (subValue !== undefined ? `/ ${subValue}` : null);

  return (
    <div className={cn('metric-card', `metric-card--${size}`)}>
      <div className="metric-card__label">
        <MetricLabel>{label}</MetricLabel>
        {tooltip}
      </div>
      <div className="metric-card__value">
        {formattedValue !== null ? (
          <>
            <MetricValue
              size={size === 'lg' ? 'lg' : 'base'}
              sentiment={sentiment}
            >
              {formattedValue}
              {suffix}
            </MetricValue>
            {subtextContent && <Subtext>{subtextContent}</Subtext>}
          </>
        ) : (
          <Muted>—</Muted>
        )}
      </div>
    </div>
  );
}
