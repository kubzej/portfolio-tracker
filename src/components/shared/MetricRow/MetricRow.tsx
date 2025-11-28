import { InfoTooltip } from '../InfoTooltip';
import './MetricRow.css';

interface MetricRowProps {
  label: string;
  value: string | number | null;
  tooltip?: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  suffix?: string;
  prefix?: string;
}

export function MetricRow({
  label,
  value,
  tooltip,
  sentiment,
  suffix = '',
  prefix = '',
}: MetricRowProps) {
  const displayValue =
    value === null || value === undefined
      ? '—'
      : `${prefix}${
          typeof value === 'number' ? value.toLocaleString('cs-CZ') : value
        }${suffix}`;

  return (
    <div className="metric-row">
      <span className="metric-row-label">
        {label}
        {tooltip && <InfoTooltip text={tooltip} />}
      </span>
      <span className={`metric-row-value ${sentiment || ''}`}>
        {displayValue}
      </span>
    </div>
  );
}
