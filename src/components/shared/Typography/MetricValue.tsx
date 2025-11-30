import './Typography.css';

interface MetricValueProps {
  children: React.ReactNode;
  sentiment?: 'positive' | 'negative' | 'neutral';
  size?: 'sm' | 'base' | 'md' | 'lg';
}

export function MetricValue({
  children,
  sentiment,
  size = 'base',
}: MetricValueProps) {
  const classes = [
    'metric-value',
    `metric-value--${size}`,
    sentiment && `metric-value--${sentiment}`,
  ]
    .filter(Boolean)
    .join(' ');

  return <span className={classes}>{children}</span>;
}
