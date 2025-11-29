import './Typography.css';

interface MetricLabelProps {
  children: React.ReactNode;
  onClick?: () => void;
}

export function MetricLabel({ children, onClick }: MetricLabelProps) {
  return (
    <span
      className={`metric-label${onClick ? ' metric-label--clickable' : ''}`}
      onClick={onClick}
    >
      {children}
    </span>
  );
}
