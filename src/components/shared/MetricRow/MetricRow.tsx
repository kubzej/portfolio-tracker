import { InfoTooltip } from '../InfoTooltip';
import { Label, MetricValue, Muted } from '../Typography';
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
  const formattedValue =
    value === null || value === undefined
      ? null
      : `${prefix}${
          typeof value === 'number' ? value.toLocaleString('cs-CZ') : value
        }${suffix}`;

  return (
    <div className="metric-row">
      <span className="metric-row-label">
        <Label size="sm">{label}</Label>
        {tooltip && <InfoTooltip text={tooltip} />}
      </span>
      {formattedValue !== null ? (
        <MetricValue sentiment={sentiment}>{formattedValue}</MetricValue>
      ) : (
        <Muted>—</Muted>
      )}
    </div>
  );
}
