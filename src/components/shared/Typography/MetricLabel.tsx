import { InfoTooltip } from '../InfoTooltip';
import './Typography.css';

interface MetricLabelProps {
  children: React.ReactNode;
  onClick?: () => void;
  tooltip?: string;
}

export function MetricLabel({ children, onClick, tooltip }: MetricLabelProps) {
  return (
    <span
      className={`metric-label${onClick ? ' metric-label--clickable' : ''}`}
      onClick={onClick}
    >
      {children}
      {tooltip && <InfoTooltip text={tooltip} />}
    </span>
  );
}
