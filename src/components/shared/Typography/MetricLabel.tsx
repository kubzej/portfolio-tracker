import './Typography.css';

interface MetricLabelProps {
  children: React.ReactNode;
}

export function MetricLabel({ children }: MetricLabelProps) {
  return <span className="metric-label">{children}</span>;
}
